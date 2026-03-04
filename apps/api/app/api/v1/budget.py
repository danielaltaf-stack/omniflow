"""
OmniFlow — Budget API endpoints.
Auto-generated budgets, manual adjustments, and progress tracking.
Cached via CacheManager (300s) with invalidation on updates.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.ai.auto_budget import (
    generate_auto_budgets,
    save_budgets,
    get_current_budgets_with_spending,
)
from app.models.ai_insight import Budget

logger = logging.getLogger("omniflow.budget")
settings = get_settings()

router = APIRouter(prefix="/budget", tags=["budget"])


class BudgetUpdateRequest(BaseModel):
    amount_limit: int = Field(..., gt=0, description="Budget limit in centimes")


@router.get("/auto-generate")
async def auto_generate_budgets(
    months: int = 3,
    level: str = "optimized",
    save: bool = True,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate auto-budgets from spending history.

    - months: lookback period (default 3)
    - level: comfortable / optimized / aggressive
    - save: persist to DB (default true)
    """
    if level not in ("comfortable", "optimized", "aggressive"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Niveau invalide. Choisissez : comfortable, optimized, aggressive",
        )

    budgets = await generate_auto_budgets(
        db, user.id, months_lookback=months, level=level,
    )

    if save and budgets:
        count = await save_budgets(db, user.id, budgets)
        await db.commit()
        logger.info(f"[Budget] Saved {count} auto-budgets for {user.id}")
        # Invalidate budget caches after generating new budgets
        await cache_manager.invalidate(f"budget:*:{user.id}*")

    total_limit = sum(b["limit"] for b in budgets)
    total_avg_spent = sum(b["avg_spent"] for b in budgets)
    savings_potential = max(0, total_avg_spent - total_limit) if level != "comfortable" else 0

    return {
        "budgets": budgets,
        "summary": {
            "total_categories": len(budgets),
            "total_limit": total_limit,
            "total_avg_spent": total_avg_spent,
            "savings_potential": savings_potential,
            "level": level,
            "months_analyzed": months,
        },
    }


@router.get("/current")
async def get_current_budgets(
    month: str | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get budgets for current (or specified) month with real-time spending.
    Cached for 300s, invalidated on budget update/generate.
    """
    if not month:
        month = date.today().strftime("%Y-%m")

    async def _compute():
        budgets = await get_current_budgets_with_spending(db, user.id, month)
        total_limit = sum(b["limit"] for b in budgets)
        total_spent = sum(b["spent"] for b in budgets)
        on_track = sum(1 for b in budgets if b["progress_pct"] <= 100)
        over_budget = sum(1 for b in budgets if b["progress_pct"] > 100)
        return {
            "month": month,
            "budgets": budgets,
            "summary": {
                "total_limit": total_limit,
                "total_spent": total_spent,
                "total_progress_pct": round(total_spent / total_limit * 100, 1) if total_limit > 0 else 0,
                "categories_on_track": on_track,
                "categories_over_budget": over_budget,
                "days_remaining": budgets[0]["days_remaining"] if budgets else 0,
            },
        }

    return await cache_manager.cached_result(
        key=f"budget:current:{user.id}:{month}",
        ttl=settings.CACHE_TTL_BUDGET,
        compute_fn=_compute,
    )


@router.put("/{category}")
async def update_budget(
    category: str,
    body: BudgetUpdateRequest,
    month: str | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Manually adjust a budget limit for a category."""
    if not month:
        month = date.today().strftime("%Y-%m")

    result = await db.execute(
        select(Budget).where(
            and_(
                Budget.user_id == user.id,
                Budget.category == category,
                Budget.month == month,
            )
        )
    )
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Budget introuvable pour {category} en {month}.",
        )

    budget.amount_limit = body.amount_limit
    budget.is_auto = False
    await db.commit()

    # Invalidate budget caches after manual update
    await cache_manager.invalidate(f"budget:*:{user.id}*")

    return {
        "id": str(budget.id),
        "category": budget.category,
        "month": budget.month,
        "limit": budget.amount_limit,
        "level": budget.level.value if hasattr(budget.level, 'value') else budget.level,
        "is_auto": budget.is_auto,
    }


@router.get("/history")
async def get_budget_history(
    months: int = 6,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get budget vs actual spending for the last N months. Cached 300s."""

    async def _compute():
        history = []
        today = date.today()

        for i in range(months):
            target = today.replace(day=1)
            for _ in range(i):
                target = (target - timedelta(days=1)).replace(day=1)
            month_str = target.strftime("%Y-%m")

            month_budgets = await get_current_budgets_with_spending(
                db, user.id, month_str
            )

            total_limit = sum(b["limit"] for b in month_budgets)
            total_spent = sum(b["spent"] for b in month_budgets)

            history.append({
                "month": month_str,
                "total_limit": total_limit,
                "total_spent": total_spent,
                "categories": len(month_budgets),
                "respected": total_spent <= total_limit if total_limit > 0 else True,
            })

        return {"history": history}

    return await cache_manager.cached_result(
        key=f"budget:history:{user.id}:{months}",
        ttl=settings.CACHE_TTL_BUDGET,
        compute_fn=_compute,
    )
