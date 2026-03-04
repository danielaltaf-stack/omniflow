"""
OmniFlow — Net Worth calculation service.
Handles balance snapshots, time-series, and breakdown by asset type.
Aggregates: bank accounts + crypto + stocks + real estate.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.balance_snapshot import BalanceSnapshot
from app.models.bank_connection import BankConnection
from app.models.crypto_wallet import CryptoWallet
from app.models.crypto_holding import CryptoHolding
from app.models.stock_portfolio import StockPortfolio
from app.models.stock_position import StockPosition
from app.models.real_estate import RealEstateProperty
from app.models.debt import Debt


# ── Type grouping ─────────────────────────────────────────────

_ASSET_GROUP: dict[str, str] = {
    "checking": "Liquidités",
    "savings": "Épargne",
    "deposit": "Épargne",
    "market": "Investissements",
    "pea": "Investissements",
    "life_insurance": "Investissements",
    "loan": "Dettes",
    "mortgage": "Dettes",
    "credit": "Dettes",
    "unknown": "Autres",
}


def _group_for(account_type: str) -> str:
    return _ASSET_GROUP.get(account_type, "Autres")


# ── Period helpers ────────────────────────────────────────────

PERIOD_DAYS: dict[str, int] = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
    "all": 0,
}


def _since(period: str) -> datetime | None:
    days = PERIOD_DAYS.get(period, 30)
    if days == 0:
        return None
    return datetime.now(timezone.utc) - timedelta(days=days)


# ── Public API ────────────────────────────────────────────────

async def get_current_networth(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Calculate current net worth from ALL asset types:
    bank accounts + crypto + stocks + real estate - debts.
    Returns total, breakdown by group, and change vs 30d ago.
    """
    breakdown: dict[str, int] = {}
    total = 0

    # ── 1. Bank accounts ──────────────────────────────────
    result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    accounts = result.scalars().all()

    for acc in accounts:
        group = _group_for(acc.type.value if hasattr(acc.type, 'value') else str(acc.type))
        balance = acc.balance or 0
        if group == "Dettes":
            total -= abs(balance)
            breakdown[group] = breakdown.get(group, 0) - abs(balance)
        else:
            total += balance
            breakdown[group] = breakdown.get(group, 0) + balance

    # ── 2. Crypto holdings ────────────────────────────────
    crypto_result = await db.execute(
        select(func.sum(CryptoHolding.value))
        .join(CryptoWallet, CryptoHolding.wallet_id == CryptoWallet.id)
        .where(CryptoWallet.user_id == user_id)
    )
    crypto_total = crypto_result.scalar() or 0
    if crypto_total > 0:
        total += crypto_total
        breakdown["Crypto"] = int(crypto_total)

    # ── 3. Stock positions ────────────────────────────────
    stock_result = await db.execute(
        select(func.sum(StockPosition.value))
        .join(StockPortfolio, StockPosition.portfolio_id == StockPortfolio.id)
        .where(StockPortfolio.user_id == user_id)
    )
    stock_total = stock_result.scalar() or 0
    if stock_total > 0:
        total += stock_total
        breakdown["Bourse"] = int(stock_total)

    # ── 4. Real estate ────────────────────────────────────
    re_result = await db.execute(
        select(
            func.sum(RealEstateProperty.current_value),
            func.sum(RealEstateProperty.loan_remaining),
        )
        .where(RealEstateProperty.user_id == user_id)
    )
    re_row = re_result.one_or_none()
    re_value = int(re_row[0] or 0) if re_row else 0
    re_loans = int(re_row[1] or 0) if re_row else 0
    if re_value > 0:
        total += re_value
        breakdown["Immobilier"] = re_value
    if re_loans > 0:
        total -= re_loans
        breakdown["Dettes"] = breakdown.get("Dettes", 0) - re_loans

    # ── 5. Debts module (Phase B1) ────────────────────────
    debt_result = await db.execute(
        select(func.sum(Debt.remaining_amount))
        .where(Debt.user_id == user_id)
    )
    debt_total = int(debt_result.scalar() or 0)
    if debt_total > 0:
        total -= debt_total
        breakdown["Dettes"] = breakdown.get("Dettes", 0) - debt_total

    # Previous value (30 days ago)
    prev_total = await _get_total_at(db, user_id, days_ago=30)
    change_abs = total - prev_total if prev_total is not None else 0
    change_pct = (
        round((change_abs / abs(prev_total)) * 100, 2)
        if prev_total and prev_total != 0
        else 0.0
    )

    return {
        "total": total,
        "currency": "EUR",
        "breakdown": breakdown,
        "change": {
            "absolute": change_abs,
            "percentage": change_pct,
            "period": "30d",
        },
    }


async def get_networth_history(
    db: AsyncSession,
    user_id: UUID,
    period: str = "30d",
) -> list[dict[str, Any]]:
    """
    Return daily net worth time-series from balance snapshots.
    """
    since = _since(period)

    # Get all account IDs for this user
    accounts_q = (
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acc_result = await db.execute(accounts_q)
    account_ids = [row[0] for row in acc_result.all()]

    if not account_ids:
        return []

    # Aggregate snapshots by date
    query = (
        select(
            func.date_trunc("day", BalanceSnapshot.captured_at).label("day"),
            func.sum(BalanceSnapshot.balance).label("total"),
        )
        .where(BalanceSnapshot.account_id.in_(account_ids))
        .group_by("day")
        .order_by("day")
    )

    if since:
        query = query.where(BalanceSnapshot.captured_at >= since)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "date": row.day.isoformat() if row.day else None,
            "total": int(row.total) if row.total else 0,
        }
        for row in rows
    ]


async def capture_snapshots(
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """
    Capture current balance for all accounts owned by user.
    Returns number of snapshots created.
    """
    result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    accounts = result.scalars().all()

    count = 0
    for acc in accounts:
        snapshot = BalanceSnapshot(
            account_id=acc.id,
            balance=acc.balance or 0,
            currency=acc.currency or "EUR",
        )
        db.add(snapshot)
        count += 1

    await db.commit()
    return count


async def capture_snapshots_for_account(
    db: AsyncSession,
    account_id: UUID,
    balance: int,
    currency: str = "EUR",
) -> None:
    """Capture a single snapshot for an account after sync."""
    snapshot = BalanceSnapshot(
        account_id=account_id,
        balance=balance,
        currency=currency,
    )
    db.add(snapshot)
    await db.commit()


async def _get_total_at(
    db: AsyncSession,
    user_id: UUID,
    days_ago: int,
) -> int | None:
    """Get the net worth total from N days ago (closest snapshot)."""
    target = datetime.now(timezone.utc) - timedelta(days=days_ago)

    accounts_q = (
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acc_result = await db.execute(accounts_q)
    account_ids = [row[0] for row in acc_result.all()]

    if not account_ids:
        return None

    # Find snapshots closest to target date
    query = (
        select(func.sum(BalanceSnapshot.balance))
        .where(
            BalanceSnapshot.account_id.in_(account_ids),
            func.date_trunc("day", BalanceSnapshot.captured_at) == func.date_trunc("day", target),
        )
    )

    result = await db.execute(query)
    total = result.scalar()
    return int(total) if total is not None else None
