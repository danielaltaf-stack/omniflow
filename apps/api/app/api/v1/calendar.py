"""
OmniFlow — Financial Calendar API endpoints.
Month view with aggregated events, cashflow lifeline, green-day tracker, payday countdown.
CRUD for custom calendar events/reminders.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.database import get_db
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventResponse,
    CalendarMonthResponse,
    CreateCalendarEventRequest,
    UpdateCalendarEventRequest,
)
from app.services import calendar_service

router = APIRouter(prefix="/calendar", tags=["calendar"])

CACHE_TTL_CALENDAR = 120  # 2 minutes


async def _invalidate_calendar_cache(user_id: UUID) -> None:
    await cache_manager.invalidate(f"calendar:{user_id}*")


# ── Month View ────────────────────────────────────────────


@router.get("/month", response_model=CalendarMonthResponse)
async def get_calendar_month(
    year: int = Query(..., ge=2020, le=2040),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Récupère le calendrier financier pour un mois donné.
    Agrège : transactions, abonnements, crédits, dividendes, immobilier,
    garanties, échéances fiscales, événements personnalisés.
    """
    return await cache_manager.cached_result(
        key=f"calendar:{user.id}:{year}-{month:02d}",
        ttl=CACHE_TTL_CALENDAR,
        compute_fn=lambda: calendar_service.get_calendar_month(db, user.id, year, month),
    )


# ── Custom Events CRUD ────────────────────────────────────


@router.get("/events", response_model=list[CalendarEventResponse])
async def list_events(
    year: int = Query(..., ge=2020, le=2040),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les événements personnalisés pour un mois."""
    from datetime import date
    import calendar as cal_mod

    start = date(year, month, 1)
    end = date(year, month, cal_mod.monthrange(year, month)[1])
    return await calendar_service.list_user_events(db, user.id, start, end)


@router.post("/events", status_code=status.HTTP_201_CREATED, response_model=CalendarEventResponse)
async def create_event(
    body: CreateCalendarEventRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Crée un événement personnalisé dans le calendrier."""
    event = await calendar_service.create_event(db, user.id, body.model_dump())
    await _invalidate_calendar_cache(user.id)
    return event


@router.get("/events/{event_id}", response_model=CalendarEventResponse)
async def get_event(
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Récupère un événement personnalisé."""
    event = await calendar_service.get_event_by_id(db, event_id, user.id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé.")
    return event


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: UUID,
    body: UpdateCalendarEventRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Met à jour un événement personnalisé."""
    data = body.model_dump(exclude_unset=True)
    event = await calendar_service.update_event(db, event_id, user.id, data)
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé.")
    await _invalidate_calendar_cache(user.id)
    return event


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supprime un événement personnalisé."""
    deleted = await calendar_service.delete_event(db, event_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Événement non trouvé.")
    await _invalidate_calendar_cache(user.id)
