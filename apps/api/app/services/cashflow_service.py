"""
OmniFlow — Cash Flow Engine.
Revenue vs expenses per period, 3-month moving average trends.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, exists, func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)


def _internal_transfer_filter(account_ids: list) -> any:
    """
    Build a NOT EXISTS filter to exclude internal transfers.
    
    An internal transfer is a transaction of type 'transfer' that has a 
    matching counterpart (opposite amount, same date, different account)
    within the user's own accounts.
    """
    mirror = aliased(Transaction, flat=True)
    return ~and_(
        Transaction.type == "transfer",
        exists(
            select(mirror.id).where(
                mirror.account_id.in_(account_ids),
                mirror.account_id != Transaction.account_id,
                mirror.amount == -Transaction.amount,
                mirror.date == Transaction.date,
            )
        ),
    )


async def get_cashflow(
    db: AsyncSession,
    user_id: UUID,
    period: str = "monthly",  # weekly, monthly, quarterly
    months: int = 6,
) -> dict[str, Any]:
    """
    Calculate cash flow (income vs expenses) per period.
    Returns {periods: [...], summary: {...}, trends: {...}}.
    """
    # Determine date range
    now = datetime.now(timezone.utc)
    if period == "weekly":
        start_date = now - timedelta(weeks=months * 4)  # ~months in weeks
    elif period == "quarterly":
        start_date = now - timedelta(days=months * 90)
    else:  # monthly
        start_date = now - timedelta(days=months * 30)

    # Get all account IDs for user
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    account_ids = [row[0] for row in acc_result.all()]

    if not account_ids:
        return {"periods": [], "summary": _empty_summary(), "trends": _empty_trends(), "top_categories": []}

    # Determine truncation function
    if period == "weekly":
        trunc_expr = func.date_trunc("week", Transaction.date)
    elif period == "quarterly":
        trunc_expr = func.date_trunc("quarter", Transaction.date)
    else:
        trunc_expr = func.date_trunc("month", Transaction.date)

    # Aggregate income and expenses per period (exclude internal transfers)
    transfer_filter = _internal_transfer_filter(account_ids)
    query = (
        select(
            trunc_expr.label("period"),
            func.sum(
                case(
                    (Transaction.amount > 0, Transaction.amount),
                    else_=0,
                )
            ).label("income"),
            func.sum(
                case(
                    (Transaction.amount < 0, func.abs(Transaction.amount)),
                    else_=0,
                )
            ).label("expenses"),
            func.count(Transaction.id).label("tx_count"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.date >= start_date.date() if hasattr(start_date, "date") else start_date,
            transfer_filter,
        )
        .group_by("period")
        .order_by("period")
    )

    result = await db.execute(query)
    rows = result.all()

    periods = []
    incomes = []
    expenses_list = []

    for row in rows:
        income = int(row.income or 0)
        expenses = int(row.expenses or 0)
        net = income - expenses
        savings_rate = round((net / income) * 100, 1) if income > 0 else 0.0

        period_data = {
            "date": row.period.isoformat() if row.period else None,
            "income": income,
            "expenses": expenses,
            "net": net,
            "savings_rate": savings_rate,
            "tx_count": row.tx_count,
        }
        periods.append(period_data)
        incomes.append(income)
        expenses_list.append(expenses)

    # Summary
    total_income = sum(incomes)
    total_expenses = sum(expenses_list)
    avg_income = total_income // len(incomes) if incomes else 0
    avg_expenses = total_expenses // len(expenses_list) if expenses_list else 0

    summary = {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "total_net": total_income - total_expenses,
        "avg_income": avg_income,
        "avg_expenses": avg_expenses,
        "avg_net": avg_income - avg_expenses,
        "avg_savings_rate": round(((avg_income - avg_expenses) / avg_income) * 100, 1) if avg_income > 0 else 0.0,
        "periods_count": len(periods),
    }

    # Trends (3-period moving average)
    trends = _calculate_trends(incomes, expenses_list)

    # Top expense categories
    top_categories = await _get_top_categories(db, account_ids, start_date)

    return {
        "periods": periods,
        "summary": summary,
        "trends": trends,
        "top_categories": top_categories,
    }


def _calculate_trends(
    incomes: list[int],
    expenses: list[int],
    window: int = 3,
) -> dict[str, Any]:
    """Calculate moving average trends for income and expenses."""
    if len(incomes) < window:
        return _empty_trends()

    income_ma = _moving_average(incomes, window)
    expense_ma = _moving_average(expenses, window)

    # Trend direction: compare last MA to previous
    income_trend = "up" if len(income_ma) >= 2 and income_ma[-1] > income_ma[-2] else "down" if len(income_ma) >= 2 and income_ma[-1] < income_ma[-2] else "stable"
    expense_trend = "up" if len(expense_ma) >= 2 and expense_ma[-1] > expense_ma[-2] else "down" if len(expense_ma) >= 2 and expense_ma[-1] < expense_ma[-2] else "stable"

    # Change percentage
    income_change = round(((income_ma[-1] - income_ma[-2]) / income_ma[-2]) * 100, 1) if len(income_ma) >= 2 and income_ma[-2] > 0 else 0.0
    expense_change = round(((expense_ma[-1] - expense_ma[-2]) / expense_ma[-2]) * 100, 1) if len(expense_ma) >= 2 and expense_ma[-2] > 0 else 0.0

    return {
        "income_ma": income_ma,
        "expense_ma": expense_ma,
        "income_trend": income_trend,
        "expense_trend": expense_trend,
        "income_change_pct": income_change,
        "expense_change_pct": expense_change,
    }


def _moving_average(values: list[int], window: int) -> list[int]:
    """Calculate simple moving average."""
    if len(values) < window:
        return values
    result = []
    for i in range(window - 1, len(values)):
        avg = sum(values[i - window + 1:i + 1]) // window
        result.append(avg)
    return result


async def _get_top_categories(
    db: AsyncSession,
    account_ids: list,
    start_date: datetime,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Get top expense categories by total amount."""
    transfer_filter = _internal_transfer_filter(account_ids)
    query = (
        select(
            Transaction.category,
            func.count(Transaction.id).label("count"),
            func.sum(func.abs(Transaction.amount)).label("total"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.amount < 0,  # Expenses only
            Transaction.date >= start_date.date() if hasattr(start_date, "date") else start_date,
            Transaction.category.isnot(None),
            transfer_filter,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    total_expenses = sum(int(r.total or 0) for r in rows)
    return [
        {
            "category": r.category,
            "count": r.count,
            "total": int(r.total or 0),
            "percentage": round((int(r.total or 0) / total_expenses) * 100, 1) if total_expenses > 0 else 0.0,
        }
        for r in rows
    ]


def _empty_summary() -> dict[str, Any]:
    return {
        "total_income": 0, "total_expenses": 0, "total_net": 0,
        "avg_income": 0, "avg_expenses": 0, "avg_net": 0,
        "avg_savings_rate": 0.0, "periods_count": 0,
    }


def _empty_trends() -> dict[str, Any]:
    return {
        "income_ma": [], "expense_ma": [],
        "income_trend": "stable", "expense_trend": "stable",
        "income_change_pct": 0.0, "expense_change_pct": 0.0,
    }
