"""
OmniFlow — Wealth Autopilot API Router.

Endpoints:
  GET    /autopilot/config         → autopilot config
  PUT    /autopilot/config         → update config
  POST   /autopilot/compute        → compute savings suggestion
  GET    /autopilot/suggestions    → last suggestion
  POST   /autopilot/accept         → accept a suggestion
  GET    /autopilot/history        → suggestion history
  POST   /autopilot/simulate       → 3-scenario simulation
  GET    /autopilot/score          → autopilot score + breakdown
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
from app.schemas.wealth_autopilot import (
    AcceptSuggestionRequest,
    AutopilotConfigResponse,
    AutopilotScoreResponse,
    ComputeResponse,
    SimulateResponse,
    SuggestionHistoryResponse,
    UpdateAutopilotConfigRequest,
)
from app.services import wealth_autopilot_engine

logger = logging.getLogger("omniflow.wealth_autopilot")
settings = get_settings()

router = APIRouter(prefix="/autopilot", tags=["autopilot"])


# ── GET /autopilot/config ────────────────────────────────────

@router.get("/config", response_model=AutopilotConfigResponse)
async def get_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's autopilot config (creates default if missing)."""
    cache_key = f"autopilot:config:{user.id}"

    async def _compute():
        config = await wealth_autopilot_engine.get_or_create_config(db, user.id)
        await db.commit()
        return AutopilotConfigResponse.model_validate(config).model_dump(mode="json")

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_WEALTH_AUTOPILOT, _compute
    )


# ── PUT /autopilot/config ───────────────────────────────────

@router.put("/config", response_model=AutopilotConfigResponse)
async def update_config(
    body: UpdateAutopilotConfigRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the user's autopilot config."""
    data = body.model_dump(exclude_unset=True)
    config = await wealth_autopilot_engine.update_config(db, user.id, data)
    await db.commit()
    await cache_manager.invalidate(f"autopilot:config:{user.id}")
    await cache_manager.invalidate(f"autopilot:compute:{user.id}")
    await cache_manager.invalidate(f"autopilot:score:{user.id}")
    return AutopilotConfigResponse.model_validate(config)


# ── POST /autopilot/compute ─────────────────────────────────

@router.post("/compute", response_model=ComputeResponse)
async def compute_savings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the 4-step savings computation engine."""
    cache_key = f"autopilot:compute:{user.id}"

    async def _compute():
        result = await wealth_autopilot_engine.compute_savings(db, user.id)
        await db.commit()
        return result

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_WEALTH_AUTOPILOT, _compute
    )


# ── GET /autopilot/suggestions ──────────────────────────────

@router.get("/suggestions")
async def get_suggestions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the last computed suggestion."""
    config = await wealth_autopilot_engine.get_or_create_config(db, user.id)
    await db.commit()
    return config.last_suggestion or {}


# ── POST /autopilot/accept ──────────────────────────────────

@router.post("/accept")
async def accept_suggestion(
    body: AcceptSuggestionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a savings suggestion (logs to history)."""
    result = await wealth_autopilot_engine.accept_suggestion(
        db, user.id, body.suggestion_id
    )
    await db.commit()
    await cache_manager.invalidate(f"autopilot:config:{user.id}")
    await cache_manager.invalidate(f"autopilot:score:{user.id}")
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ── GET /autopilot/history ──────────────────────────────────

@router.get("/history", response_model=SuggestionHistoryResponse)
async def get_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return suggestion history with acceptance stats."""
    result = await wealth_autopilot_engine.get_suggestion_history(db, user.id)
    await db.commit()
    return result


# ── POST /autopilot/simulate ────────────────────────────────

@router.post("/simulate", response_model=SimulateResponse)
async def simulate_scenarios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run 3-scenario savings simulation (prudent/moderate/ambitious)."""
    config = await wealth_autopilot_engine.get_or_create_config(db, user.id)
    available = config.last_available or 0
    result = wealth_autopilot_engine.simulate_scenarios(config, available)
    await db.commit()
    return result


# ── GET /autopilot/score ────────────────────────────────────

@router.get("/score", response_model=AutopilotScoreResponse)
async def get_score(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return autopilot score (0-100) with component breakdown."""
    cache_key = f"autopilot:score:{user.id}"

    async def _compute():
        config = await wealth_autopilot_engine.get_or_create_config(db, user.id)
        await db.commit()
        score, breakdown = wealth_autopilot_engine.compute_autopilot_score(config)
        return {
            "breakdown": {
                "overall_score": score,
                **breakdown,
            }
        }

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_WEALTH_AUTOPILOT, _compute
    )
