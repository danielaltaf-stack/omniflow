"""
OmniFlow — Debt API endpoints.
CRUD, amortization tables, early repayment simulation, invest-vs-repay, consolidation.
Cached via CacheManager (300s summary, invalidated on mutations).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.debt import (
    AmortizationTableResponse,
    ConsolidationResponse,
    CreateDebtRequest,
    DebtResponse,
    DebtSummaryResponse,
    EarlyRepaymentResponse,
    InvestVsRepayResponse,
    RecordPaymentRequest,
    UpdateDebtRequest,
)
from app.services import debt_service

settings = get_settings()
router = APIRouter(prefix="/debts", tags=["debts"])

CACHE_TTL_DEBTS = 300  # 5 minutes


async def _invalidate_debt_cache(user_id: UUID) -> None:
    """Invalidate all debt-related caches for a user."""
    await cache_manager.invalidate(f"debts:{user_id}*")
    await cache_manager.invalidate(f"networth:{user_id}*")
    await cache_manager.invalidate(f"omniscore:{user_id}")
    await cache_manager.invalidate(f"dashboard:*:{user_id}")


# ── CRUD ──────────────────────────────────────────────────────


@router.get("", response_model=DebtSummaryResponse)
async def list_debts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List all debts with aggregated summary. Cached 300s."""
    return await cache_manager.cached_result(
        key=f"debts:{user.id}",
        ttl=CACHE_TTL_DEBTS,
        compute_fn=lambda: debt_service.get_debt_summary(db, user.id),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DebtResponse)
async def create_debt(
    body: CreateDebtRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new debt."""
    debt = await debt_service.create_debt(db, user.id, body.model_dump())
    await _invalidate_debt_cache(user.id)
    return debt_service.debt_to_response(debt)


@router.get("/{debt_id}", response_model=DebtResponse)
async def get_debt(
    debt_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single debt by ID."""
    debt = await debt_service.get_debt_by_id(db, debt_id, user.id)
    if not debt:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    return debt_service.debt_to_response(debt)


@router.put("/{debt_id}", response_model=DebtResponse)
async def update_debt(
    debt_id: UUID,
    body: UpdateDebtRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a debt."""
    data = body.model_dump(exclude_unset=True)
    debt = await debt_service.update_debt(db, debt_id, user.id, data)
    if not debt:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    await _invalidate_debt_cache(user.id)
    return debt_service.debt_to_response(debt)


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debt(
    debt_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a debt."""
    deleted = await debt_service.delete_debt(db, debt_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    await _invalidate_debt_cache(user.id)


@router.patch("/{debt_id}/payment")
async def record_payment(
    debt_id: UUID,
    body: RecordPaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record an actual payment for a debt."""
    payment = await debt_service.record_payment(db, debt_id, user.id, body.model_dump())
    if not payment:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    await _invalidate_debt_cache(user.id)
    return {
        "id": payment.id,
        "debt_id": payment.debt_id,
        "payment_number": payment.payment_number,
        "total_amount": payment.total_amount,
        "principal_amount": payment.principal_amount,
        "interest_amount": payment.interest_amount,
        "insurance_amount": payment.insurance_amount,
        "remaining_after": payment.remaining_after,
        "payment_date": payment.payment_date,
    }


# ── Analytics ─────────────────────────────────────────────────


@router.get("/{debt_id}/amortization", response_model=AmortizationTableResponse)
async def get_amortization(
    debt_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full amortization table for a debt."""
    result = await debt_service.get_amortization_table(db, debt_id, user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    return {
        "rows": [
            {
                "payment_number": r.payment_number,
                "date": r.date,
                "total": r.total,
                "principal": r.principal,
                "interest": r.interest,
                "insurance": r.insurance,
                "remaining": r.remaining,
            }
            for r in result.rows
        ],
        "total_interest": result.total_interest,
        "total_insurance": result.total_insurance,
        "total_cost": result.total_cost,
        "total_paid": result.total_paid,
        "end_date": result.end_date,
    }


@router.get("/{debt_id}/simulate-early-repayment", response_model=EarlyRepaymentResponse)
async def simulate_early_repayment_endpoint(
    debt_id: UUID,
    amount: int = Query(..., gt=0, description="Repayment amount in centimes"),
    at_month: int = Query(default=0, ge=0, description="Month offset for repayment"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Simulate early repayment: reduced duration vs reduced payment."""
    result = await debt_service.get_early_repayment_sim(db, debt_id, user.id, amount, at_month)
    if result is None:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    return result


@router.get("/{debt_id}/invest-vs-repay", response_model=InvestVsRepayResponse)
async def invest_vs_repay_endpoint(
    debt_id: UUID,
    amount: int = Query(..., gt=0, description="Amount in centimes"),
    return_rate: float = Query(default=7.0, ge=0, le=30, description="Expected annual return %"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare investing the surplus vs early repayment."""
    result = await debt_service.get_invest_vs_repay(db, debt_id, user.id, amount, return_rate)
    if result is None:
        raise HTTPException(status_code=404, detail="Dette non trouvée.")
    return result


@router.get("/consolidation", response_model=ConsolidationResponse)
async def get_consolidation(
    monthly_income: int = Query(default=0, ge=0, description="Monthly income in centimes"),
    extra_monthly: int = Query(default=0, ge=0, description="Extra budget for payoff in centimes"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get consolidated debt analytics with avalanche/snowball strategies."""
    return await debt_service.get_consolidation(db, user.id, monthly_income, extra_monthly)


@router.get("/chart-data")
async def get_chart_data(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get stacked chart data for all debts (principal/interest/insurance per month)."""
    return await debt_service.get_chart_data(db, user.id)
