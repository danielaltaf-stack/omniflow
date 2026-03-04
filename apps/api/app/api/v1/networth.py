"""
OmniFlow — Net Worth API endpoints.
GET /networth, GET /networth/history
Cached via CacheManager (120s networth, 300s history).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.networth import get_current_networth, get_networth_history

settings = get_settings()
router = APIRouter(prefix="/networth", tags=["networth"])


@router.get("")
async def current_networth(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get current net worth with breakdown by asset type.
    Cached for 120s, invalidated on sync.
    """
    return await cache_manager.cached_result(
        key=f"networth:{user.id}",
        ttl=settings.CACHE_TTL_NETWORTH,
        compute_fn=lambda: get_current_networth(db, user.id),
    )


@router.get("/history")
async def networth_history(
    period: str = Query("30d", pattern=r"^(7d|30d|90d|1y|all)$"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Get daily net worth time-series for charts.
    Cached for 300s per period, invalidated on sync.
    """
    return await cache_manager.cached_result(
        key=f"networth:history:{user.id}:{period}",
        ttl=settings.CACHE_TTL_NETWORTH_HISTORY,
        compute_fn=lambda: get_networth_history(db, user.id, period),
    )
