"""
OmniFlow — Dashboard Summary API endpoint.
GET /dashboard/summary — Aggregated data in ONE request for fast dashboard load.
Refactored to use CacheManager (60s TTL).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.bank_connection import BankConnection
from app.services.networth import get_current_networth, get_networth_history

logger = logging.getLogger("omniflow.dashboard")
settings = get_settings()

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Aggregated dashboard data in a single request.
    Returns: networth, recent transactions, sparkline data, last sync time.
    Cached via CacheManager for 60s.
    """

    async def _compute():
        # ── Net Worth ───────────────────────────────────────
        networth = await get_current_networth(db, user.id)

        # ── Sparkline last 7 days ──────────────────────────
        sparkline_data = await get_networth_history(db, user.id, "7d")

        # ── Last 15 transactions across all accounts ───────
        # Get user's account IDs via BankConnection join
        acc_ids_result = await db.execute(
            select(Account.id)
            .join(BankConnection, Account.connection_id == BankConnection.id)
            .where(BankConnection.user_id == user.id)
        )
        user_account_ids = [row[0] for row in acc_ids_result.fetchall()]

        txn_result = await db.execute(
            select(Transaction)
            .where(Transaction.account_id.in_(user_account_ids))
            .order_by(desc(Transaction.date), desc(Transaction.created_at))
            .limit(15)
        )
        recent_transactions = []
        for txn in txn_result.scalars().all():
            recent_transactions.append({
                "id": str(txn.id),
                "account_id": str(txn.account_id),
                "external_id": txn.external_id,
                "date": str(txn.date),
                "amount": txn.amount,
                "label": txn.label,
                "raw_label": txn.raw_label,
                "type": txn.type or "other",
                "category": txn.category,
                "subcategory": txn.subcategory,
                "merchant": txn.merchant,
                "is_recurring": txn.is_recurring or False,
                "created_at": txn.created_at.isoformat() if txn.created_at else None,
            })

        # ── Last sync time ─────────────────────────────────
        sync_result = await db.execute(
            select(func.max(BankConnection.last_sync_at))
            .where(BankConnection.user_id == user.id)
            .where(BankConnection.last_sync_at.is_not(None))
        )
        last_sync = sync_result.scalar()

        # ── Connections count ──────────────────────────────
        conn_count_result = await db.execute(
            select(func.count(BankConnection.id))
            .where(BankConnection.user_id == user.id)
        )
        connections_count = conn_count_result.scalar() or 0

        # ── Accounts count ─────────────────────────────────
        acc_count_result = await db.execute(
            select(func.count(Account.id))
            .join(BankConnection, Account.connection_id == BankConnection.id)
            .where(BankConnection.user_id == user.id)
        )
        accounts_count = acc_count_result.scalar() or 0

        return {
            "networth": networth,
            "sparkline": sparkline_data,
            "recent_transactions": recent_transactions,
            "last_sync_at": last_sync.isoformat() if last_sync else None,
            "connections_count": connections_count,
            "accounts_count": accounts_count,
        }

    return await cache_manager.cached_result(
        key=f"dashboard:summary:{user.id}",
        ttl=settings.CACHE_TTL_DASHBOARD,
        compute_fn=_compute,
    )
