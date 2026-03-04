"""
OmniFlow — Cash Flow & Currency API endpoints.
Cashflow cached via CacheManager (300s).
Phase B5: Cross-asset projection, sources, health score.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.cashflow import (
    CashFlowHealthScore,
    CashFlowResponse,
    CrossAssetProjectionResponse,
    CurrencyConvertRequest,
    CurrencyConvertResponse,
    ExchangeRatesResponse,
    SourcesResponse,
)
from app.services import cashflow_service, currency_service
from app.services import cashflow_projection

settings = get_settings()
router = APIRouter(tags=["cashflow"])


# ── Existing endpoints ────────────────────────────────────


@router.get("/cashflow", response_model=CashFlowResponse)
async def get_cashflow(
    period: str = Query(default="monthly", pattern="^(weekly|monthly|quarterly)$"),
    months: int = Query(default=6, ge=1, le=24),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get cash flow analysis (income vs expenses) per period.
    Cached for 300s, invalidated on sync.
    """
    return await cache_manager.cached_result(
        key=f"cashflow:{user.id}:{period}:{months}",
        ttl=settings.CACHE_TTL_CASHFLOW,
        compute_fn=lambda: cashflow_service.get_cashflow(
            db=db, user_id=user.id, period=period, months=months,
        ),
    )


@router.get("/currencies/rates", response_model=ExchangeRatesResponse)
async def get_exchange_rates():
    """
    Get current exchange rates (EUR base).
    Fetched from ECB, cached 24h in Redis.
    """
    rates = await currency_service.get_rates()
    return {"base": "EUR", "rates": rates}


@router.post("/currencies/convert", response_model=CurrencyConvertResponse)
async def convert_currency(body: CurrencyConvertRequest):
    """Convert an amount between currencies."""
    rates = await currency_service.get_rates()

    from_rate = rates.get(body.from_currency, 1.0)
    to_rate = rates.get(body.to_currency, 1.0)

    converted = currency_service.convert(
        body.amount_centimes,
        body.from_currency,
        body.to_currency,
        rates,
    )

    rate = to_rate / from_rate if from_rate > 0 else 0.0

    return {
        "original": body.amount_centimes,
        "converted": converted,
        "from_currency": body.from_currency,
        "to_currency": body.to_currency,
        "rate": round(rate, 6),
    }


# ── Phase B5: Cross-asset projection endpoints ───────────


@router.get("/cashflow/projection", response_model=CrossAssetProjectionResponse)
async def get_cashflow_projection(
    months: int = Query(default=12, ge=1, le=24),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-asset cash-flow projection (B5).
    Aggregates income & expenses from ALL asset classes:
    bank, real estate, stocks, crypto, debts, projects.
    Returns a month-by-month projection with health score.
    Cached for 600s.
    """
    return await cache_manager.cached_result(
        key=f"cashflow_projection:{user.id}:{months}",
        ttl=600,
        compute_fn=lambda: cashflow_projection.get_projection(
            db=db, user_id=user.id, months=months,
        ),
    )


@router.get("/cashflow/sources", response_model=SourcesResponse)
async def get_cashflow_sources(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all detected income & expense sources across asset classes.
    Useful for understanding the composition of the projection.
    Cached for 600s.
    """
    async def _compute():
        income = await cashflow_projection.get_income_sources(db, user.id)
        expenses = await cashflow_projection.get_expense_sources(db, user.id)
        total_in = sum(s["amount_monthly"] for s in income)
        total_out = sum(s["amount_monthly"] for s in expenses)
        return {
            "income_sources": income,
            "expense_sources": expenses,
            "total_monthly_income": total_in,
            "total_monthly_expenses": total_out,
            "net_monthly": total_in - total_out,
        }

    return await cache_manager.cached_result(
        key=f"cashflow_sources:{user.id}",
        ttl=600,
        compute_fn=_compute,
    )


@router.get("/cashflow/health", response_model=CashFlowHealthScore)
async def get_cashflow_health(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-asset cash-flow health score (0-100).
    Composite of savings rate, income stability, deficit risk, passive income.
    Cached for 600s.
    """
    return await cache_manager.cached_result(
        key=f"cashflow_health:{user.id}",
        ttl=600,
        compute_fn=lambda: cashflow_projection.get_health_score(
            db=db, user_id=user.id,
        ),
    )
