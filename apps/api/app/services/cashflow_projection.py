"""
OmniFlow — Cross-Asset Cash-Flow Projection Engine (Phase B5).

Aggregates income & expense flows from ALL asset classes:
  Bank recurring · Real Estate rents · Stock dividends · Crypto staking
  Debt payments · Project savings · Budget limits

Produces a 12-month forward projection with:
  - Monthly income / expense breakdown by source
  - Cumulative treasury balance
  - Deficit alerts & surplus allocation suggestions
  - Cross-asset health score (0-100)

All monetary values in centimes (BigInteger).  Zero external ML deps.
"""

from __future__ import annotations

import calendar
import logging
import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.ai_insight import Budget
from app.models.bank_connection import BankConnection
from app.models.crypto_holding import CryptoHolding
from app.models.crypto_wallet import CryptoWallet
from app.models.debt import Debt
from app.models.project_budget import ProjectBudget
from app.models.real_estate import RealEstateProperty
from app.models.stock_dividend import StockDividend
from app.models.stock_portfolio import StockPortfolio
from app.models.stock_position import StockPosition
from app.models.transaction import Transaction

logger = logging.getLogger("omniflow.cashflow_projection")


# ── Source type enums ─────────────────────────────────────

INCOME_SOURCE_TYPES = (
    "salary",
    "rent",
    "dividends",
    "staking",
    "interest",
    "other_recurring",
)

EXPENSE_SOURCE_TYPES = (
    "fixed_charges",
    "debt_payment",
    "re_charges",
    "re_tax",
    "project_saving",
    "budget_limit",
    "other_recurring",
)


# ── Public API ────────────────────────────────────────────


async def get_projection(
    db: AsyncSession,
    user_id: UUID,
    months: int = 12,
) -> dict[str, Any]:
    """
    Build a cross-asset cash-flow projection for the next *months* months.

    Returns:
    {
        monthly_projection: [{month, date, income, expenses, net, cumulative,
                              income_breakdown, expense_breakdown, alerts, suggestions}],
        annual_summary: {...},
        deficit_alerts: [...],
        surplus_suggestions: [...],
        health_score: {...},
    }
    """
    today = date.today()

    # Collect all sources
    income_sources = await _collect_income_sources(db, user_id)
    expense_sources = await _collect_expense_sources(db, user_id)

    # Get current liquid balance for cumulative calculation
    current_balance = await _get_liquid_balance(db, user_id)

    # Build monthly projection
    monthly = []
    cumulative = current_balance
    deficit_alerts: list[dict[str, Any]] = []
    surplus_suggestions: list[dict[str, Any]] = []

    # Calculate average monthly income for surplus threshold
    total_monthly_income = sum(s["amount_monthly"] for s in income_sources)
    surplus_threshold = int(total_monthly_income * 0.20) if total_monthly_income > 0 else 0

    for offset in range(1, months + 1):
        # Target month
        year = today.year + (today.month + offset - 1) // 12
        month_num = (today.month + offset - 1) % 12 + 1
        month_date = date(year, month_num, 1)
        month_label = f"{year}-{month_num:02d}"

        # Income for this month
        income_breakdown: dict[str, int] = {}
        month_income = 0
        for src in income_sources:
            amt = _source_amount_for_month(src, month_date, is_income=True)
            if amt > 0:
                income_breakdown[src["source_type"]] = (
                    income_breakdown.get(src["source_type"], 0) + amt
                )
                month_income += amt

        # Expenses for this month
        expense_breakdown: dict[str, int] = {}
        month_expenses = 0
        for src in expense_sources:
            amt = _source_amount_for_month(src, month_date, is_income=False)
            if amt > 0:
                expense_breakdown[src["source_type"]] = (
                    expense_breakdown.get(src["source_type"], 0) + amt
                )
                month_expenses += amt

        net = month_income - month_expenses
        cumulative += net

        # Alerts & suggestions
        month_alerts: list[str] = []
        month_suggestions: list[str] = []

        if cumulative < 0:
            alert = {
                "month": month_label,
                "shortfall": abs(cumulative),
                "main_cause": _dominant_expense(expense_breakdown),
                "recommendation": (
                    f"Déficit projeté de {abs(cumulative) / 100:.0f} € en {month_label}. "
                    "Envisagez de réduire les dépenses variables ou de puiser dans l'épargne."
                ),
            }
            deficit_alerts.append(alert)
            month_alerts.append(alert["recommendation"])
        elif net < 0:
            month_alerts.append(
                f"Mois déficitaire : dépenses supérieures de {abs(net) / 100:.0f} € aux revenus."
            )

        if net > surplus_threshold > 0:
            suggestion = {
                "month": month_label,
                "surplus": net,
                "suggestion_type": "invest",
                "message": (
                    f"Excédent de {net / 100:.0f} € en {month_label}. "
                    "Suggestion : allouer vers épargne projet ou investissements."
                ),
            }
            surplus_suggestions.append(suggestion)
            month_suggestions.append(suggestion["message"])

        monthly.append({
            "month": month_label,
            "date": month_date.isoformat(),
            "income": month_income,
            "expenses": month_expenses,
            "net": net,
            "cumulative": cumulative,
            "income_breakdown": income_breakdown,
            "expense_breakdown": expense_breakdown,
            "alerts": month_alerts,
            "suggestions": month_suggestions,
        })

    # Annual summary
    total_income = sum(m["income"] for m in monthly)
    total_expenses = sum(m["expenses"] for m in monthly)
    total_net = total_income - total_expenses
    passive_income = sum(
        m["income_breakdown"].get("rent", 0)
        + m["income_breakdown"].get("dividends", 0)
        + m["income_breakdown"].get("staking", 0)
        + m["income_breakdown"].get("interest", 0)
        for m in monthly
    )
    passive_ratio = (
        round(passive_income / total_income * 100, 1)
        if total_income > 0
        else 0.0
    )

    months_deficit = sum(1 for m in monthly if m["net"] < 0)
    largest_surplus = max((m["net"] for m in monthly), default=0)
    largest_surplus_month = next(
        (m["month"] for m in monthly if m["net"] == largest_surplus),
        None,
    )

    annual_summary = {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "total_net": total_net,
        "passive_income": passive_income,
        "passive_income_ratio": passive_ratio,
        "months_deficit": months_deficit,
        "largest_surplus": largest_surplus,
        "largest_surplus_month": largest_surplus_month,
    }

    # Health score
    health = _compute_health_score(
        total_income=total_income,
        total_net=total_net,
        income_sources=income_sources,
        months_deficit=months_deficit,
        months_total=months,
        passive_income=passive_income,
    )

    return {
        "monthly_projection": monthly,
        "annual_summary": annual_summary,
        "deficit_alerts": deficit_alerts,
        "surplus_suggestions": surplus_suggestions,
        "health_score": health,
        "income_sources": [
            {k: v for k, v in s.items() if k != "projected_events"}
            for s in income_sources
        ],
        "expense_sources": [
            {k: v for k, v in s.items() if k != "projected_events"}
            for s in expense_sources
        ],
    }


async def get_income_sources(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Return all detected income sources with monthly amounts."""
    return await _collect_income_sources(db, user_id)


async def get_expense_sources(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Return all detected expense sources with monthly amounts."""
    return await _collect_expense_sources(db, user_id)


async def get_health_score(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Compute a cross-asset cash-flow health score (0-100).
    Quick version — calls projection internally with 12 months.
    """
    projection = await get_projection(db, user_id, months=12)
    return projection["health_score"]


# ── Income sources collection ─────────────────────────────


async def _collect_income_sources(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Aggregate all income sources from every asset class."""
    sources: list[dict[str, Any]] = []

    # 1. Bank recurring income (salary, etc.)
    bank_income = await _bank_recurring_income(db, user_id)
    sources.extend(bank_income)

    # 2. Real estate rents
    re_income = await _real_estate_income(db, user_id)
    sources.extend(re_income)

    # 3. Stock dividends
    div_income = await _dividend_income(db, user_id)
    sources.extend(div_income)

    # 4. Crypto staking rewards
    staking_income = await _staking_income(db, user_id)
    sources.extend(staking_income)

    # 5. Savings interest (simplified)
    interest_income = await _savings_interest(db, user_id)
    sources.extend(interest_income)

    return sources


async def _bank_recurring_income(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Detect recurring positive transactions (salary, pensions, etc.)."""
    # Get account IDs
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    account_ids = [row[0] for row in acc_result.all()]
    if not account_ids:
        return []

    # Find recurring income in last 90 days
    since = date.today() - timedelta(days=90)
    result = await db.execute(
        select(
            Transaction.merchant,
            Transaction.label,
            func.avg(Transaction.amount).label("avg_amount"),
            func.count(Transaction.id).label("occurrences"),
        )
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.amount > 0,
                Transaction.is_recurring == True,  # noqa: E712
                Transaction.date >= since,
            )
        )
        .group_by(Transaction.merchant, Transaction.label)
    )
    rows = result.all()

    sources = []
    for row in rows:
        avg_amt = int(row.avg_amount or 0)
        if avg_amt <= 0:
            continue

        label = row.merchant or row.label or "Revenu récurrent"
        # Determine source type heuristic
        label_lower = label.lower()
        if any(kw in label_lower for kw in ("salaire", "salary", "paie", "virement employeur")):
            src_type = "salary"
        else:
            src_type = "other_recurring"

        sources.append({
            "source_type": src_type,
            "label": label,
            "amount_monthly": avg_amt,
            "details": {
                "occurrences_90d": int(row.occurrences or 0),
                "origin": "bank_recurring",
            },
            "projected_events": [],  # Every month
        })

    return sources


async def _real_estate_income(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Income from real estate rents (adjusted for vacancy)."""
    result = await db.execute(
        select(RealEstateProperty).where(
            RealEstateProperty.user_id == user_id,
            RealEstateProperty.monthly_rent > 0,
        )
    )
    properties = result.scalars().all()

    sources = []
    for prop in properties:
        rent = int(prop.monthly_rent or 0)
        vacancy = float(prop.vacancy_rate_pct or 0)
        effective_rent = int(rent * (1 - vacancy / 100))

        if effective_rent > 0:
            sources.append({
                "source_type": "rent",
                "label": f"Loyer — {prop.label}",
                "amount_monthly": effective_rent,
                "details": {
                    "property_id": str(prop.id),
                    "gross_rent": rent,
                    "vacancy_rate_pct": vacancy,
                    "origin": "real_estate",
                },
                "projected_events": [],  # Every month
            })

    return sources


async def _dividend_income(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Projected dividend income from stock positions."""
    # Get all user's stock positions
    result = await db.execute(
        select(StockPosition)
        .join(StockPortfolio, StockPosition.portfolio_id == StockPortfolio.id)
        .where(
            StockPortfolio.user_id == user_id,
            StockPosition.annual_dividend_yield.isnot(None),
            StockPosition.annual_dividend_yield > 0,
        )
    )
    positions = result.scalars().all()

    sources = []
    for pos in positions:
        annual_yield_pct = float(pos.annual_dividend_yield or 0)
        value = int(pos.value or 0)
        annual_div = int(value * annual_yield_pct / 100)
        monthly_div = annual_div // 12

        if monthly_div <= 0:
            continue

        # Determine frequency and projected pay dates
        freq = pos.dividend_frequency or "quarterly"
        projected_months = _dividend_projected_months(
            freq=freq,
            next_ex_date=pos.next_ex_date,
        )

        sources.append({
            "source_type": "dividends",
            "label": f"Dividendes — {pos.symbol}",
            "amount_monthly": monthly_div,
            "details": {
                "symbol": pos.symbol,
                "annual_dividend": annual_div,
                "yield_pct": annual_yield_pct,
                "frequency": freq,
                "origin": "stocks",
            },
            "projected_events": projected_months,
        })

    return sources


async def _staking_income(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Projected staking rewards from crypto holdings."""
    result = await db.execute(
        select(CryptoHolding)
        .join(CryptoWallet, CryptoHolding.wallet_id == CryptoWallet.id)
        .where(
            CryptoWallet.user_id == user_id,
            CryptoHolding.is_staked == True,  # noqa: E712
            CryptoHolding.staking_apy > 0,
        )
    )
    holdings = result.scalars().all()

    sources = []
    for h in holdings:
        apy = float(h.staking_apy or 0)
        value = int(h.value or 0)
        monthly_reward = int(value * apy / 100 / 12)

        if monthly_reward <= 0:
            continue

        sources.append({
            "source_type": "staking",
            "label": f"Staking — {h.token_symbol}",
            "amount_monthly": monthly_reward,
            "details": {
                "token": h.token_symbol,
                "apy_pct": apy,
                "value": value,
                "origin": "crypto",
            },
            "projected_events": [],  # Every month
        })

    return sources


async def _savings_interest(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Simplified savings account interest (Livret A rate default 3%)."""
    result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(
            BankConnection.user_id == user_id,
        )
    )
    accounts = result.scalars().all()

    savings_balance = 0
    for acc in accounts:
        acc_type = acc.type.value if hasattr(acc.type, "value") else str(acc.type)
        if acc_type in ("savings", "deposit"):
            savings_balance += int(acc.balance or 0)

    if savings_balance <= 0:
        return []

    # Default Livret A rate: 2.4% annual (2026 estimate)
    annual_rate = 0.024
    monthly_interest = int(savings_balance * annual_rate / 12)

    if monthly_interest <= 0:
        return []

    return [{
        "source_type": "interest",
        "label": "Intérêts épargne",
        "amount_monthly": monthly_interest,
        "details": {
            "savings_balance": savings_balance,
            "annual_rate_pct": annual_rate * 100,
            "origin": "bank_savings",
        },
        "projected_events": [],
    }]


# ── Expense sources collection ────────────────────────────


async def _collect_expense_sources(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Aggregate all expense sources from every asset class."""
    sources: list[dict[str, Any]] = []

    # 1. Bank recurring expenses
    bank_exp = await _bank_recurring_expenses(db, user_id)
    sources.extend(bank_exp)

    # 2. Debt monthly payments
    debt_exp = await _debt_expenses(db, user_id)
    sources.extend(debt_exp)

    # 3. Real estate charges
    re_exp = await _real_estate_expenses(db, user_id)
    sources.extend(re_exp)

    # 4. Project savings targets
    project_exp = await _project_expenses(db, user_id)
    sources.extend(project_exp)

    # 5. Budget category limits (top categories as reference)
    budget_exp = await _budget_expenses(db, user_id)
    sources.extend(budget_exp)

    return sources


async def _bank_recurring_expenses(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Detect recurring negative transactions (subscriptions, charges fixes)."""
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    account_ids = [row[0] for row in acc_result.all()]
    if not account_ids:
        return []

    since = date.today() - timedelta(days=90)
    result = await db.execute(
        select(
            Transaction.merchant,
            Transaction.label,
            Transaction.category,
            func.avg(func.abs(Transaction.amount)).label("avg_amount"),
            func.count(Transaction.id).label("occurrences"),
        )
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.amount < 0,
                Transaction.is_recurring == True,  # noqa: E712
                Transaction.date >= since,
            )
        )
        .group_by(Transaction.merchant, Transaction.label, Transaction.category)
    )
    rows = result.all()

    sources = []
    for row in rows:
        avg_amt = int(row.avg_amount or 0)
        if avg_amt <= 0:
            continue

        label = row.merchant or row.label or "Charge récurrente"

        sources.append({
            "source_type": "fixed_charges",
            "label": label,
            "amount_monthly": avg_amt,
            "details": {
                "category": row.category,
                "occurrences_90d": int(row.occurrences or 0),
                "origin": "bank_recurring",
            },
            "projected_events": [],
        })

    return sources


async def _debt_expenses(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Monthly payments for all active debts."""
    result = await db.execute(
        select(Debt).where(
            Debt.user_id == user_id,
            Debt.remaining_amount > 0,
        )
    )
    debts = result.scalars().all()

    sources = []
    for d in debts:
        payment = int(d.monthly_payment or 0)
        if payment <= 0:
            continue

        sources.append({
            "source_type": "debt_payment",
            "label": f"Mensualité — {d.label}",
            "amount_monthly": payment,
            "details": {
                "debt_id": str(d.id),
                "debt_type": d.debt_type.value if hasattr(d.debt_type, "value") else str(d.debt_type),
                "remaining": int(d.remaining_amount or 0),
                "end_date": d.end_date.isoformat() if d.end_date else None,
                "origin": "debts",
            },
            "projected_events": [],
        })

    return sources


async def _real_estate_expenses(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Monthly charges, loan payments, taxes for real estate properties."""
    result = await db.execute(
        select(RealEstateProperty).where(
            RealEstateProperty.user_id == user_id,
        )
    )
    properties = result.scalars().all()

    sources = []
    for prop in properties:
        # Monthly charges (copro, etc.)
        charges = int(prop.monthly_charges or 0)
        loan = int(prop.monthly_loan_payment or 0)
        assurance = int(prop.assurance_pno or 0)
        travaux = int(prop.provision_travaux or 0)
        monthly_total = charges + loan + assurance + travaux

        if monthly_total > 0:
            sources.append({
                "source_type": "re_charges",
                "label": f"Charges immo — {prop.label}",
                "amount_monthly": monthly_total,
                "details": {
                    "property_id": str(prop.id),
                    "charges": charges,
                    "loan_payment": loan,
                    "assurance_pno": assurance,
                    "provision_travaux": travaux,
                    "origin": "real_estate",
                },
                "projected_events": [],
            })

        # Taxe foncière (annual — peak in October)
        taxe = int(prop.taxe_fonciere or 0)
        if taxe > 0:
            sources.append({
                "source_type": "re_tax",
                "label": f"Taxe foncière — {prop.label}",
                "amount_monthly": taxe // 12,  # Averaged for summary
                "details": {
                    "property_id": str(prop.id),
                    "annual_amount": taxe,
                    "peak_month": 10,  # October
                    "origin": "real_estate",
                },
                "projected_events": [10],  # October peak
            })

    return sources


async def _project_expenses(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Monthly savings targets for active projects."""
    result = await db.execute(
        select(ProjectBudget).where(
            ProjectBudget.user_id == user_id,
            ProjectBudget.status == "active",
            ProjectBudget.is_archived == False,  # noqa: E712
        )
    )
    projects = result.scalars().all()

    sources = []
    for proj in projects:
        target = int(proj.monthly_target or 0)
        if target <= 0:
            continue

        sources.append({
            "source_type": "project_saving",
            "label": f"Épargne — {proj.name}",
            "amount_monthly": target,
            "details": {
                "project_id": str(proj.id),
                "target_amount": int(proj.target_amount or 0),
                "current_amount": int(proj.current_amount or 0),
                "deadline": proj.deadline.isoformat() if proj.deadline else None,
                "origin": "projects",
            },
            "projected_events": [],
        })

    return sources


async def _budget_expenses(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """
    Budget category limits as expense proxy.
    Uses the most recent month's budget data.
    Only includes top 5 categories to avoid noise.
    """
    today = date.today()
    current_month = f"{today.year}-{today.month:02d}"

    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == user_id, Budget.month == current_month)
        .order_by(Budget.amount_limit.desc())
        .limit(5)
    )
    budgets = result.scalars().all()

    sources = []
    for b in budgets:
        limit = int(b.amount_limit or 0)
        if limit <= 0:
            continue

        sources.append({
            "source_type": "budget_limit",
            "label": f"Budget — {b.category}",
            "amount_monthly": limit,
            "details": {
                "category": b.category,
                "amount_spent": int(b.amount_spent or 0),
                "is_auto": b.is_auto,
                "origin": "budgets",
            },
            "projected_events": [],
        })

    return sources


# ── Helpers ───────────────────────────────────────────────


async def _get_liquid_balance(
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """Sum of checking + savings balances (starting point for projection)."""
    result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    accounts = result.scalars().all()

    total = 0
    for acc in accounts:
        acc_type = acc.type.value if hasattr(acc.type, "value") else str(acc.type)
        if acc_type in ("checking", "savings", "deposit"):
            total += int(acc.balance or 0)
    return total


def _source_amount_for_month(
    source: dict[str, Any],
    month_date: date,
    is_income: bool,
) -> int:
    """
    Calculate the actual amount a source contributes for a specific month.
    Handles:
    - Dividend frequency (only pay months)
    - Taxe foncière (peak in October)
    - Debt end dates (stop after maturity)
    - Project deadlines (stop after deadline)
    """
    month_num = month_date.month
    src_type = source["source_type"]
    details = source.get("details", {})
    projected = source.get("projected_events", [])
    base_amount = source["amount_monthly"]

    # ── Dividends: pay only on projected months
    if src_type == "dividends" and projected:
        if month_num not in projected:
            return 0
        # Dividends are spread — give annual / frequency_count
        freq_count = len(projected) if projected else 4
        annual = details.get("annual_dividend", base_amount * 12)
        return annual // freq_count

    # ── Taxe foncière: 75% in October, 25% spread over Q1
    if src_type == "re_tax":
        annual = details.get("annual_amount", base_amount * 12)
        if month_num == 10:
            return int(annual * 0.75)
        elif month_num in (1, 2, 3):
            return int(annual * 0.25 / 3)
        else:
            return 0

    # ── Debt: stop after end_date
    if src_type == "debt_payment":
        end_str = details.get("end_date")
        if end_str:
            try:
                end_date = date.fromisoformat(end_str)
                if month_date > end_date:
                    return 0
            except (ValueError, TypeError):
                pass

    # ── Project: stop after deadline or if already funded
    if src_type == "project_saving":
        deadline_str = details.get("deadline")
        if deadline_str:
            try:
                deadline = date.fromisoformat(deadline_str)
                if month_date > deadline:
                    return 0
            except (ValueError, TypeError):
                pass
        target = details.get("target_amount", 0)
        current = details.get("current_amount", 0)
        if target > 0 and current >= target:
            return 0

    return base_amount


def _dividend_projected_months(
    freq: str,
    next_ex_date: date | None,
) -> list[int]:
    """
    Compute which months a dividend is expected to pay.
    Returns a list of month numbers (1-12).
    """
    if next_ex_date:
        base_month = next_ex_date.month
    else:
        base_month = 3  # Default March

    freq_lower = (freq or "quarterly").lower()

    if freq_lower == "monthly":
        return list(range(1, 13))
    elif freq_lower == "quarterly":
        return [(base_month + i * 3 - 1) % 12 + 1 for i in range(4)]
    elif freq_lower in ("semi_annual", "semiannual"):
        return [(base_month - 1) % 12 + 1, (base_month + 5) % 12 + 1]
    elif freq_lower == "annual":
        return [base_month]
    else:
        return [(base_month + i * 3 - 1) % 12 + 1 for i in range(4)]


def _dominant_expense(breakdown: dict[str, int]) -> str:
    """Return the largest expense category name."""
    if not breakdown:
        return "dépenses générales"
    return max(breakdown, key=breakdown.get)  # type: ignore[arg-type]


def _compute_health_score(
    total_income: int,
    total_net: int,
    income_sources: list[dict[str, Any]],
    months_deficit: int,
    months_total: int,
    passive_income: int,
) -> dict[str, Any]:
    """
    Composite cash-flow health score (0-100).

    25 pts : savings_rate (net/income) — target ≥ 20%
    25 pts : income_stability (σ / μ of sources) — lower = better
    25 pts : deficit_risk (months in deficit / total) — 0 = perfect
    25 pts : passive_income_ratio — target ≥ 30%
    """
    # 1. Savings rate score
    savings_rate = total_net / total_income if total_income > 0 else 0
    savings_score = min(25, int(savings_rate / 0.20 * 25))
    savings_score = max(0, savings_score)

    # 2. Income stability score
    amounts = [s["amount_monthly"] for s in income_sources if s["amount_monthly"] > 0]
    if len(amounts) >= 2:
        mean_amt = sum(amounts) / len(amounts)
        variance = sum((a - mean_amt) ** 2 for a in amounts) / len(amounts)
        std_dev = math.sqrt(variance)
        cv = std_dev / mean_amt if mean_amt > 0 else 1
        stability_score = max(0, min(25, int((1 - cv) * 25)))
    elif len(amounts) == 1:
        stability_score = 20  # Single source = moderate risk
    else:
        stability_score = 0

    # 3. Deficit risk score
    deficit_ratio = months_deficit / months_total if months_total > 0 else 0
    deficit_score = max(0, min(25, int((1 - deficit_ratio) * 25)))

    # 4. Passive income ratio score
    passive_ratio = passive_income / total_income if total_income > 0 else 0
    passive_score = min(25, int(passive_ratio / 0.30 * 25))
    passive_score = max(0, passive_score)

    total_score = savings_score + stability_score + deficit_score + passive_score

    return {
        "score": total_score,
        "max_score": 100,
        "components": {
            "savings_rate": {
                "score": savings_score,
                "max": 25,
                "value": round(savings_rate * 100, 1),
                "target": 20.0,
                "label": "Taux d'épargne",
            },
            "income_stability": {
                "score": stability_score,
                "max": 25,
                "label": "Stabilité des revenus",
            },
            "deficit_risk": {
                "score": deficit_score,
                "max": 25,
                "value": months_deficit,
                "target": 0,
                "label": "Risque de déficit",
            },
            "passive_income": {
                "score": passive_score,
                "max": 25,
                "value": round(passive_ratio * 100, 1),
                "target": 30.0,
                "label": "Revenus passifs",
            },
        },
        "grade": _score_to_grade(total_score),
    }


def _score_to_grade(score: int) -> str:
    """Convert numeric score to letter grade."""
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B+"
    elif score >= 60:
        return "B"
    elif score >= 50:
        return "C"
    elif score >= 40:
        return "D"
    else:
        return "F"
