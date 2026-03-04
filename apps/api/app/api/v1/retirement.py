"""
OmniFlow — Retirement & FIRE Simulation API endpoints (Phase C1).

Endpoints:
  GET  /retirement/profile       → Current retirement profile
  PUT  /retirement/profile       → Update retirement profile
  POST /retirement/simulate      → Run Monte-Carlo simulation
  POST /retirement/optimize      → Run optimisation levers
  GET  /retirement/fire-dashboard → FIRE metrics dashboard
  GET  /retirement/patrimoine    → Current patrimoine snapshot
  POST /retirement/what-if       → What-if simulation with overrides

Cached via CacheManager (600s, invalidated on profile mutations).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.database import get_db
from app.models.user import User
from app.schemas.retirement import (
    CreateRetirementProfileRequest,
    FireDashboardResponse,
    OptimizationResponse,
    RetirementProfileResponse,
    SimulationRequest,
    SimulationResponse,
    UpdateRetirementProfileRequest,
    WhatIfRequest,
)
from app.services import retirement_engine

router = APIRouter(prefix="/retirement", tags=["retirement"])

CACHE_TTL_RETIREMENT = 600  # 10 minutes


async def _invalidate_retirement_cache(user_id: UUID) -> None:
    """Invalidate all retirement-related caches for a user."""
    await cache_manager.invalidate(f"retirement:{user_id}*")
    await cache_manager.invalidate(f"dashboard:*:{user_id}")


# ── Profile ───────────────────────────────────────────────────


@router.get("/profile", response_model=RetirementProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get or create retirement profile. Cached 600s."""
    return await cache_manager.cached_result(
        key=f"retirement:{user.id}:profile",
        ttl=CACHE_TTL_RETIREMENT,
        compute_fn=lambda: retirement_engine.get_or_create_profile(db, user.id),
    )


@router.put("/profile", response_model=RetirementProfileResponse)
async def update_profile(
    body: UpdateRetirementProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update retirement profile. Invalidates cache."""
    profile = await retirement_engine.update_profile(
        db, user.id, body.model_dump(exclude_unset=True),
    )
    await _invalidate_retirement_cache(user.id)
    return profile


# ── Simulation ────────────────────────────────────────────────


@router.post("/simulate", response_model=SimulationResponse)
async def run_simulation(
    body: SimulationRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Run Monte-Carlo retirement simulation.
    Cached 600s when no extra savings override.
    """
    extra = body.extra_monthly_savings if body else 0
    num_sim = body.num_simulations if body and body.num_simulations else 1000
    num_sim = min(max(num_sim, 100), 5000)  # clamp

    cache_key = f"retirement:{user.id}:sim:{extra}:{num_sim}"
    return await cache_manager.cached_result(
        key=cache_key,
        ttl=CACHE_TTL_RETIREMENT,
        compute_fn=lambda: retirement_engine.simulate(
            db, user.id,
            extra_monthly_savings=extra,
            num_simulations=num_sim,
        ),
    )


@router.post("/optimize", response_model=OptimizationResponse)
async def run_optimization(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Run optimization: evaluate multiple levers.
    Cached 600s.
    """
    return await cache_manager.cached_result(
        key=f"retirement:{user.id}:optimize",
        ttl=CACHE_TTL_RETIREMENT,
        compute_fn=lambda: retirement_engine.optimize(db, user.id),
    )


# ── FIRE Dashboard ────────────────────────────────────────────


@router.get("/fire-dashboard", response_model=FireDashboardResponse)
async def get_fire_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """FIRE metrics dashboard. Cached 600s."""
    return await cache_manager.cached_result(
        key=f"retirement:{user.id}:fire",
        ttl=CACHE_TTL_RETIREMENT,
        compute_fn=lambda: retirement_engine.get_fire_dashboard(db, user.id),
    )


# ── Patrimoine Snapshot ───────────────────────────────────────


@router.get("/patrimoine")
async def get_patrimoine_snapshot(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Current patrimoine aggregated by asset class.
    Returned in centimes and percentages.
    """
    snap = await retirement_engine.collect_patrimoine(db, user.id)
    total = max(snap.total, 1)  # avoid division by zero
    return {
        "total": snap.total,
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


@router.post("/what-if", response_model=SimulationResponse)
async def what_if(
    body: WhatIfRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Run a what-if simulation with arbitrary overrides.
    Never cached — always fresh.
    """
    overrides: dict[str, Any] = {}
    if body.retirement_age is not None:
        overrides["retirement_age"] = body.retirement_age
    if body.monthly_savings is not None:
        overrides["monthly_savings"] = body.monthly_savings
    if body.inflation_rate_pct is not None:
        overrides["inflation_rate"] = body.inflation_rate_pct
    if body.asset_returns_override is not None:
        overrides["asset_returns_override"] = body.asset_returns_override

    return await retirement_engine.simulate(
        db,
        user.id,
        extra_monthly_savings=0,
        num_simulations=body.num_simulations or 1000,
        overrides=overrides if overrides else None,
    )
