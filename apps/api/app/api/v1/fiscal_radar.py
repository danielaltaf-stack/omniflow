"""
OmniFlow — Fiscal Radar API Router.

Endpoints:
  GET    /fiscal/profile          → fiscal profile
  PUT    /fiscal/profile          → update fiscal profile
  POST   /fiscal/analyze          → run full analysis
  GET    /fiscal/alerts           → proactive alerts
  GET    /fiscal/export/{year}    → CERFA-ready fiscal export
  POST   /fiscal/simulate-tmi    → TMI impact simulation
  GET    /fiscal/score            → fiscal score + breakdown
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
from app.schemas.fiscal_radar import (
    FiscalAlertListResponse,
    FiscalAnalysisRequest,
    FiscalAnalysisResponse,
    FiscalExportResponse,
    FiscalProfileResponse,
    FiscalScoreResponse,
    TMISimulationRequest,
    TMISimulationResponse,
    UpdateFiscalProfileRequest,
)
from app.services import fiscal_radar_engine

logger = logging.getLogger("omniflow.fiscal_radar")
settings = get_settings()

router = APIRouter(prefix="/fiscal", tags=["fiscal"])


# ── GET /fiscal/profile ──────────────────────────────────────

@router.get("/profile", response_model=FiscalProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's fiscal profile (creates default if missing)."""
    cache_key = f"fiscal:profile:{user.id}"

    async def _compute():
        profile = await fiscal_radar_engine.get_or_create_profile(db, user.id)
        await db.commit()
        return FiscalProfileResponse.model_validate(profile).model_dump(mode="json")

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FISCAL_RADAR, _compute
    )


# ── PUT /fiscal/profile ─────────────────────────────────────

@router.put("/profile", response_model=FiscalProfileResponse)
async def update_profile(
    body: UpdateFiscalProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the user's fiscal profile."""
    data = body.model_dump(exclude_unset=True)
    profile = await fiscal_radar_engine.update_profile(db, user.id, data)
    await db.commit()
    await cache_manager.invalidate(f"fiscal:profile:{user.id}")
    await cache_manager.invalidate(f"fiscal:analysis:{user.id}")
    await cache_manager.invalidate(f"fiscal:alerts:{user.id}")
    await cache_manager.invalidate(f"fiscal:score:{user.id}")
    return FiscalProfileResponse.model_validate(profile)


# ── POST /fiscal/analyze ────────────────────────────────────

@router.post("/analyze", response_model=FiscalAnalysisResponse)
async def run_analysis(
    body: FiscalAnalysisRequest = FiscalAnalysisRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the full fiscal analysis (7 domains, alerts, score, export)."""
    cache_key = f"fiscal:analysis:{user.id}"

    async def _compute():
        result = await fiscal_radar_engine.run_full_analysis(db, user.id, body.year)
        await db.commit()
        return result

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FISCAL_RADAR, _compute
    )


# ── GET /fiscal/alerts ──────────────────────────────────────

@router.get("/alerts", response_model=FiscalAlertListResponse)
async def get_alerts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return proactive fiscal alerts for the user."""
    cache_key = f"fiscal:alerts:{user.id}"

    async def _compute():
        profile = await fiscal_radar_engine.get_or_create_profile(db, user.id)
        await db.commit()
        alerts = fiscal_radar_engine.generate_fiscal_alerts(profile)
        total_eco = sum(a["economy_estimate"] for a in alerts)
        return {
            "alerts": alerts,
            "count": len(alerts),
            "total_economy": total_eco,
        }

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FISCAL_RADAR, _compute
    )


# ── GET /fiscal/export/{year} ───────────────────────────────

@router.get("/export/{year}", response_model=FiscalExportResponse)
async def get_export(
    year: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return CERFA-ready fiscal export for the given year."""
    if year < 2020 or year > 2040:
        raise HTTPException(status_code=400, detail="Year must be between 2020 and 2040")

    cache_key = f"fiscal:export:{user.id}:{year}"

    async def _compute():
        profile = await fiscal_radar_engine.get_or_create_profile(db, user.id)
        await db.commit()
        export = fiscal_radar_engine.build_fiscal_export(profile, year)
        # Add score
        alerts = fiscal_radar_engine.generate_fiscal_alerts(profile)
        score, _ = fiscal_radar_engine.compute_fiscal_score(profile, alerts)
        export["synthese"]["score_fiscal"] = score
        return export

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FISCAL_RADAR, _compute
    )


# ── POST /fiscal/simulate-tmi ──────────────────────────────

@router.post("/simulate-tmi", response_model=TMISimulationResponse)
async def simulate_tmi(
    body: TMISimulationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Simulate the impact of additional income on TMI and IR."""
    profile = await fiscal_radar_engine.get_or_create_profile(db, user.id)
    await db.commit()
    result = fiscal_radar_engine.simulate_tmi_impact(
        profile, body.extra_income, body.income_type
    )
    return result


# ── GET /fiscal/score ───────────────────────────────────────

@router.get("/score", response_model=FiscalScoreResponse)
async def get_score(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the fiscal optimization score with domain breakdown."""
    cache_key = f"fiscal:score:{user.id}"

    async def _compute():
        profile = await fiscal_radar_engine.get_or_create_profile(db, user.id)
        await db.commit()
        alerts = fiscal_radar_engine.generate_fiscal_alerts(profile)
        score, domain_scores = fiscal_radar_engine.compute_fiscal_score(profile, alerts)
        total_eco = sum(a["economy_estimate"] for a in alerts)
        opt_count = sum(1 for a in alerts if a["economy_estimate"] > 0)
        return {
            "breakdown": {
                "overall_score": score,
                "domain_scores": domain_scores,
                "total_economy_estimate": total_eco,
                "optimization_count": opt_count,
            }
        }

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_FISCAL_RADAR, _compute
    )
