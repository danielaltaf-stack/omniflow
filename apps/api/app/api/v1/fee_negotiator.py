"""
OmniFlow — Fee Negotiator API Router.

Endpoints:
  GET    /fees/analysis              → full analysis profile
  POST   /fees/scan                  → scan 12-month fees, persist
  GET    /fees/compare               → top alternatives
  POST   /fees/negotiate             → generate negotiation letter
  PUT    /fees/negotiation-status    → update pipeline status
  GET    /fees/schedules             → all bank fee schedules
  GET    /fees/schedules/{bank_slug} → single bank schedule
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.fee_negotiator import (
    BankFeeScheduleResponse,
    FeeAnalysisResponse,
    FeeScanResponse,
    FeeScheduleListResponse,
    NegotiationLetterResponse,
    ScanFeesRequest,
    UpdateNegotiationRequest,
)
from app.services import fee_negotiator_engine

logger = logging.getLogger("omniflow.fees")
settings = get_settings()

router = APIRouter(prefix="/fees", tags=["fees"])


# ── GET /fees/analysis ────────────────────────────────────────

@router.get("/analysis", response_model=FeeAnalysisResponse)
async def get_analysis(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's fee analysis (creates default if missing)."""
    cache_key = f"fees:analysis:{user.id}"

    async def _compute():
        analysis = await fee_negotiator_engine.get_or_create_analysis(db, user.id)
        await db.commit()
        return FeeAnalysisResponse.model_validate(analysis).model_dump(mode="json")

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FEE_NEGOTIATOR, _compute
    )


# ── POST /fees/scan ───────────────────────────────────────────

@router.post("/scan", response_model=FeeScanResponse)
async def scan_fees(
    body: ScanFeesRequest = ScanFeesRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scan last N months of bank-fee transactions, compare, persist."""
    # 1. Scan transactions
    scan = await fee_negotiator_engine.scan_user_fees(db, user.id, body.months)

    # 2. Compare with market
    alternatives = await fee_negotiator_engine.compare_with_market(
        db, scan.get("fees_by_type", [])
    )

    # 3. Overcharge score
    schedules = await fee_negotiator_engine.get_fee_schedules(db)
    sched_totals = [
        sum(getattr(s, f, 0) for f in fee_negotiator_engine.ALL_FEE_FIELDS)
        for s in schedules
    ]
    overcharge = fee_negotiator_engine.compute_overcharge_score(
        scan["total_fees_annual"], sched_totals
    )

    # 4. Persist
    await fee_negotiator_engine.persist_scan_results(
        db, user.id, scan, alternatives, overcharge
    )
    await db.commit()

    # 5. Invalidate cache
    await cache_manager.invalidate(f"fees:*:{user.id}")

    return FeeScanResponse(
        total_fees_annual=scan["total_fees_annual"],
        fees_by_type=scan.get("fees_by_type", []),
        monthly_breakdown=scan.get("monthly_breakdown", []),
        overcharge_score=overcharge,
        top_alternatives=alternatives,
        best_alternative_slug=alternatives[0]["bank_slug"] if alternatives else None,
        best_alternative_saving=alternatives[0]["saving"] if alternatives else 0,
    )


# ── GET /fees/compare ─────────────────────────────────────────

@router.get("/compare")
async def compare_fees(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top alternatives based on last scan."""
    cache_key = f"fees:compare:{user.id}"

    async def _compute():
        analysis = await fee_negotiator_engine.get_or_create_analysis(db, user.id)
        # Use persisted fees_by_type
        fees_list = []
        if isinstance(analysis.fees_by_type, dict):
            for ft, amount in analysis.fees_by_type.items():
                fees_list.append({
                    "fee_type": ft,
                    "label": fee_negotiator_engine.FEE_TYPE_LABELS.get(ft, ft),
                    "annual_total": amount,
                    "monthly_avg": amount // 12,
                    "count": 0,
                })
        alternatives = await fee_negotiator_engine.compare_with_market(db, fees_list)
        return {"alternatives": alternatives}

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FEE_NEGOTIATOR, _compute
    )


# ── POST /fees/negotiate ──────────────────────────────────────

@router.post("/negotiate", response_model=NegotiationLetterResponse)
async def negotiate(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate negotiation letter based on last scan."""
    analysis = await fee_negotiator_engine.get_or_create_analysis(db, user.id)

    # Build user_fees from persisted analysis
    fees_list = []
    if isinstance(analysis.fees_by_type, dict):
        for ft, amount in analysis.fees_by_type.items():
            fees_list.append({
                "fee_type": ft,
                "label": fee_negotiator_engine.FEE_TYPE_LABELS.get(ft, ft),
                "annual_total": amount,
                "monthly_avg": amount // 12,
                "count": 0,
            })
    user_fees = {
        "total_fees_annual": analysis.total_fees_annual,
        "fees_by_type": fees_list,
    }

    alternatives = analysis.top_alternatives or []

    result = await fee_negotiator_engine.generate_negotiation_letter(
        db,
        user.id,
        user_fees,
        alternatives,
        user_name=user.name or "Client OmniFlow",
    )

    # Persist letter
    await fee_negotiator_engine.save_negotiation_letter(
        db, user.id, result["letter_markdown"]
    )
    await db.commit()

    return NegotiationLetterResponse(**result)


# ── PUT /fees/negotiation-status ──────────────────────────────

@router.put("/negotiation-status", response_model=FeeAnalysisResponse)
async def update_status(
    body: UpdateNegotiationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update negotiation pipeline status."""
    analysis = await fee_negotiator_engine.update_negotiation_status(
        db, user.id, body.status, body.result_amount
    )
    await db.commit()
    await cache_manager.invalidate(f"fees:*:{user.id}")
    return FeeAnalysisResponse.model_validate(analysis)


# ── GET /fees/schedules ───────────────────────────────────────

@router.get("/schedules", response_model=FeeScheduleListResponse)
async def list_schedules(
    db: AsyncSession = Depends(get_db),
):
    """List all 20+ bank fee schedules."""
    cache_key = "fees:schedules:all"

    async def _compute():
        schedules = await fee_negotiator_engine.get_fee_schedules(db)
        items = [
            BankFeeScheduleResponse.model_validate(s).model_dump(mode="json")
            for s in schedules
        ]
        return {"schedules": items, "count": len(items)}

    return await cache_manager.cached_result(cache_key, 86400, _compute)


# ── GET /fees/schedules/{bank_slug} ──────────────────────────

@router.get("/schedules/{bank_slug}", response_model=BankFeeScheduleResponse)
async def get_schedule(
    bank_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a single bank's fee schedule."""
    schedules = await fee_negotiator_engine.get_fee_schedules(db, bank_slug)
    if not schedules:
        raise HTTPException(status_code=404, detail=f"Bank '{bank_slug}' not found")
    return BankFeeScheduleResponse.model_validate(schedules[0])
