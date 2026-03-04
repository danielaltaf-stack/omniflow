"""
OmniFlow — Heritage / Succession Simulation API endpoints (Phase C2).

Endpoints:
  GET  /heritage/profile            → Heritage profile (or create default)
  PUT  /heritage/profile            → Update profile + heirs
  POST /heritage/simulate           → Run succession simulation
  POST /heritage/optimize-donations → Donation optimization scenarios
  GET  /heritage/timeline           → N-year projection
  GET  /heritage/patrimoine-detail  → Heritage patrimoine breakdown
  POST /heritage/what-if            → What-if simulation with overrides

Cached via CacheManager (600s, invalidated on profile mutations).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.database import get_db
from app.models.user import User
from app.schemas.heritage import (
    DonationOptimizationResponse,
    HeritageResponse,
    SimulateSuccessionRequest,
    SimulationSuccessionResponse,
    TimelineRequest,
    TimelineResponse,
    UpdateHeritageRequest,
)
from app.services import heritage_engine

router = APIRouter(prefix="/heritage", tags=["heritage"])

CACHE_TTL_HERITAGE = 600  # 10 minutes


async def _invalidate_heritage_cache(user_id: UUID) -> None:
    """Invalidate all heritage-related caches for a user."""
    await cache_manager.invalidate(f"heritage:{user_id}*")
    await cache_manager.invalidate(f"dashboard:*:{user_id}")


# ── Profile ───────────────────────────────────────────────────


@router.get("/profile", response_model=HeritageResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get or create heritage profile. Cached 600s."""
    return await cache_manager.cached_result(
        key=f"heritage:{user.id}:profile",
        ttl=CACHE_TTL_HERITAGE,
        compute_fn=lambda: heritage_engine.get_or_create_profile(db, user.id),
    )


@router.put("/profile", response_model=HeritageResponse)
async def update_profile(
    body: UpdateHeritageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update heritage profile (heirs, regime, insurance). Invalidates cache."""
    data = body.model_dump(exclude_unset=True)
    # Convert Pydantic sub-models to dicts for JSONB storage
    if "heirs" in data and data["heirs"] is not None:
        data["heirs"] = [
            h.model_dump() if hasattr(h, "model_dump") else h
            for h in body.heirs
        ]
    if "donation_history" in data and data["donation_history"] is not None:
        data["donation_history"] = [
            d.model_dump() if hasattr(d, "model_dump") else d
            for d in body.donation_history
        ]
    profile = await heritage_engine.update_profile(db, user.id, data)
    await _invalidate_heritage_cache(user.id)
    return profile


# ── Simulation ────────────────────────────────────────────────


@router.post("/simulate", response_model=SimulationSuccessionResponse)
async def run_simulation(
    body: SimulateSuccessionRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Run succession simulation. Cached 600s when no overrides."""
    overrides: dict[str, Any] | None = None
    if body:
        overrides = body.model_dump(exclude_unset=True)
        # Convert heir sub-models
        if "heirs_override" in overrides and overrides["heirs_override"] is not None:
            overrides["heirs_override"] = [
                h.model_dump() if hasattr(h, "model_dump") else h
                for h in body.heirs_override
            ]

    has_overrides = overrides and any(v is not None for v in overrides.values())
    if has_overrides:
        # Never cache what-if scenarios
        return await heritage_engine.simulate_succession(db, user.id, overrides)

    return await cache_manager.cached_result(
        key=f"heritage:{user.id}:sim",
        ttl=CACHE_TTL_HERITAGE,
        compute_fn=lambda: heritage_engine.simulate_succession(db, user.id),
    )


# ── Donation Optimization ─────────────────────────────────────


@router.post("/optimize-donations", response_model=DonationOptimizationResponse)
async def optimize_donations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Run donation optimization scenarios. Cached 600s."""
    return await cache_manager.cached_result(
        key=f"heritage:{user.id}:donate-opt",
        ttl=CACHE_TTL_HERITAGE,
        compute_fn=lambda: heritage_engine.simulate_donation_optimization(db, user.id),
    )


# ── Timeline ──────────────────────────────────────────────────


@router.get("/timeline", response_model=TimelineResponse)
async def get_timeline(
    years: int = Query(default=30, ge=5, le=50),
    inflation: float = Query(default=2.0, ge=0.0, le=10.0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Project patrimoine and succession tax over N years. Cached 600s."""
    cache_key = f"heritage:{user.id}:timeline:{years}:{inflation}"
    return await cache_manager.cached_result(
        key=cache_key,
        ttl=CACHE_TTL_HERITAGE,
        compute_fn=lambda: heritage_engine.compute_timeline_projection(
            db, user.id, years=years, inflation_rate_pct=inflation,
        ),
    )


# ── Patrimoine Detail ────────────────────────────────────────


@router.get("/patrimoine-detail")
async def get_patrimoine_detail(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Heritage patrimoine breakdown (reuses retirement collect)."""
    from app.services.retirement_engine import collect_patrimoine, PatrimoineSnapshot

    profile = await heritage_engine.get_or_create_profile(db, user.id)
    snap = await collect_patrimoine(db, user.id, profile.include_real_estate)
    total = max(snap.total, 1)

    li_total = profile.life_insurance_before_70 + profile.life_insurance_after_70

    return {
        "patrimoine_hors_assurance_vie": snap.total,
        "assurance_vie_before_70": profile.life_insurance_before_70,
        "assurance_vie_after_70": profile.life_insurance_after_70,
        "patrimoine_total": snap.total + li_total,
        "stocks": snap.stocks,
        "stocks_pct": round(snap.stocks / total * 100, 1),
        "bonds": snap.bonds,
        "bonds_pct": round(snap.bonds / total * 100, 1),
        "real_estate": snap.real_estate,
        "real_estate_pct": round(snap.real_estate / total * 100, 1),
        "crypto": snap.crypto,
        "crypto_pct": round(snap.crypto / total * 100, 1),
        "savings": snap.savings,
        "savings_pct": round(snap.savings / total * 100, 1),
        "cash": snap.cash,
        "cash_pct": round(snap.cash / total * 100, 1),
    }


# ── What-If ───────────────────────────────────────────────────


@router.post("/what-if", response_model=SimulationSuccessionResponse)
async def what_if(
    body: SimulateSuccessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Run a what-if succession simulation. Never cached."""
    overrides = body.model_dump(exclude_unset=True)
    if "heirs_override" in overrides and overrides["heirs_override"] is not None:
        overrides["heirs_override"] = [
            h.model_dump() if hasattr(h, "model_dump") else h
            for h in body.heirs_override
        ]
    return await heritage_engine.simulate_succession(db, user.id, overrides)
