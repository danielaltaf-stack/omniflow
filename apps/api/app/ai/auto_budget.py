"""
OmniFlow — Auto-Budget Engine.
Generates monthly budgets per category from transaction history.
100% statistical, zero external dependencies.
"""

from __future__ import annotations

import logging
import statistics
from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.ai_insight import Budget, BudgetLevel

logger = logging.getLogger("omniflow.ai.budget")


def _remove_outliers_iqr(values: list[float]) -> list[float]:
    """Remove outliers using IQR (Interquartile Range) method."""
    if len(values) < 4:
        return values
    sorted_v = sorted(values)
    n = len(sorted_v)
    q1 = sorted_v[n // 4]
    q3 = sorted_v[3 * n // 4]
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    return [v for v in values if lower <= v <= upper]


async def _get_user_account_ids(
    db: AsyncSession, user_id: UUID
) -> list[UUID]:
    """Get all account IDs for a user."""
    result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def generate_auto_budgets(
    db: AsyncSession,
    user_id: UUID,
    months_lookback: int = 3,
    level: str = "optimized",
    target_month: str | None = None,
) -> list[dict]:
    """
    Generate auto-budgets from spending history.

    Algorithm:
    1. Aggregate spending by category over `months_lookback` months
    2. Remove outliers via IQR
    3. Compute median per category
    4. Apply level multiplier: comfortable=1.20, optimized=1.00, aggressive=0.85
    5. Return budget suggestions

    Returns list of {category, limit, avg_spent, volatility, is_volatile, level}
    """
    account_ids = await _get_user_account_ids(db, user_id)
    if not account_ids:
        return []

    # Date range: last N months
    today = date.today()
    start_date = today.replace(day=1) - timedelta(days=months_lookback * 31)
    start_date = start_date.replace(day=1)
    end_of_last_month = today.replace(day=1) - timedelta(days=1)

    # Fetch all debit transactions with categories in the date range
    result = await db.execute(
        select(
            Transaction.category,
            func.extract("year", Transaction.date).label("yr"),
            func.extract("month", Transaction.date).label("mo"),
            func.sum(func.abs(Transaction.amount)).label("total"),
        )
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.amount < 0,  # debits only
                Transaction.date >= start_date,
                Transaction.date <= end_of_last_month,
                Transaction.category.isnot(None),
                Transaction.category != "Autres",
                Transaction.category != "Revenus",
            )
        )
        .group_by(
            Transaction.category,
            func.extract("year", Transaction.date),
            func.extract("month", Transaction.date),
        )
    )
    rows = result.all()

    if not rows:
        return []

    # Group by category → list of monthly totals
    category_months: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        # amount is in centimes, keep in centimes
        category_months[row.category].append(float(row.total))

    # Level multiplier
    multipliers = {
        "comfortable": 1.20,
        "optimized": 1.00,
        "aggressive": 0.85,
    }
    mult = multipliers.get(level, 1.00)
    budget_level = {
        "comfortable": BudgetLevel.COMFORTABLE,
        "optimized": BudgetLevel.OPTIMIZED,
        "aggressive": BudgetLevel.AGGRESSIVE,
    }.get(level, BudgetLevel.OPTIMIZED)

    # Target month
    if not target_month:
        target_month = today.strftime("%Y-%m")

    budgets = []
    for category, monthly_totals in sorted(
        category_months.items(), key=lambda x: -max(x[1])
    ):
        clean = _remove_outliers_iqr(monthly_totals)
        if not clean:
            continue

        median_spending = statistics.median(clean)
        mean_spending = statistics.mean(clean)
        std_spending = statistics.stdev(clean) if len(clean) >= 2 else 0
        volatility = std_spending / mean_spending if mean_spending > 0 else 0

        limit = int(median_spending * mult)
        if limit < 100:  # min 1€
            continue

        budgets.append({
            "category": category,
            "month": target_month,
            "limit": limit,
            "avg_spent": int(mean_spending),
            "median_spent": int(median_spending),
            "volatility": round(volatility, 3),
            "is_volatile": volatility > 0.30,
            "level": budget_level.value,
        })

    logger.info(
        f"[AI] Auto-budget generated for {user_id}: "
        f"{len(budgets)} categories, level={level}"
    )
    return budgets


async def save_budgets(
    db: AsyncSession,
    user_id: UUID,
    budgets: list[dict],
) -> int:
    """
    Save (upsert) auto-generated budgets to DB.
    Returns count of budgets saved.
    """
    from sqlalchemy import delete

    # Delete old auto-budgets for this month
    if budgets:
        month = budgets[0]["month"]
        await db.execute(
            delete(Budget).where(
                and_(
                    Budget.user_id == user_id,
                    Budget.month == month,
                    Budget.is_auto == True,
                )
            )
        )

    count = 0
    for b in budgets:
        budget = Budget(
            user_id=user_id,
            category=b["category"],
            month=b["month"],
            amount_limit=b["limit"],
            amount_spent=0,
            level=BudgetLevel(b["level"]),
            is_auto=True,
        )
        db.add(budget)
        count += 1

    if count:
        await db.flush()

    return count


async def get_current_budgets_with_spending(
    db: AsyncSession,
    user_id: UUID,
    month: str | None = None,
) -> list[dict]:
    """
    Get budgets for a given month with real-time spending progress.
    """
    if not month:
        month = date.today().strftime("%Y-%m")

    # Parse month
    year, mo = int(month[:4]), int(month[5:7])
    month_start = date(year, mo, 1)
    if mo == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, mo + 1, 1) - timedelta(days=1)

    # Get budgets
    result = await db.execute(
        select(Budget).where(
            and_(Budget.user_id == user_id, Budget.month == month)
        )
    )
    budgets = result.scalars().all()
    if not budgets:
        return []

    # Get account IDs
    account_ids = await _get_user_account_ids(db, user_id)
    if not account_ids:
        return [
            {
                "id": str(b.id),
                "category": b.category,
                "month": b.month,
                "limit": b.amount_limit,
                "spent": 0,
                "progress_pct": 0,
                "level": b.level.value if hasattr(b.level, 'value') else b.level,
                "is_auto": b.is_auto,
                "days_remaining": (month_end - date.today()).days,
            }
            for b in budgets
        ]

    # Get actual spending per category this month
    spend_result = await db.execute(
        select(
            Transaction.category,
            func.sum(func.abs(Transaction.amount)).label("total"),
        )
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.amount < 0,
                Transaction.date >= month_start,
                Transaction.date <= month_end,
                Transaction.category.isnot(None),
            )
        )
        .group_by(Transaction.category)
    )
    spending_by_cat = {row.category: int(row.total) for row in spend_result.all()}

    days_remaining = max(0, (month_end - date.today()).days)

    results = []
    for b in budgets:
        spent = spending_by_cat.get(b.category, 0)
        limit = b.amount_limit
        pct = round(spent / limit * 100, 1) if limit > 0 else 0

        results.append({
            "id": str(b.id),
            "category": b.category,
            "month": b.month,
            "limit": limit,
            "spent": spent,
            "progress_pct": pct,
            "level": b.level.value if hasattr(b.level, 'value') else b.level,
            "is_auto": b.is_auto,
            "days_remaining": days_remaining,
        })

    # Sort by progress descending (most over-budget first)
    results.sort(key=lambda x: -x["progress_pct"])
    return results
