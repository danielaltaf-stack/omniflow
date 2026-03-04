"""
OmniFlow — Notifications API endpoints (DB-backed).
GET    /notifications              — list notifications (paginated)
GET    /notifications/unread-count — unread badge count
PATCH  /notifications/{id}/read   — mark single as read
PATCH  /notifications/read-all    — mark all as read
DELETE /notifications/{id}        — delete a notification
"""

from __future__ import annotations

import logging
import uuid as uuid_mod
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification

logger = logging.getLogger("omniflow.notifications")

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── Helper: push a notification (called from services) ──────────
async def push_notification(
    db: AsyncSession,
    user_id: str | UUID,
    notif_type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> Notification:
    """
    Insert a notification into the DB.
    Called by sync services, anomaly detector, etc.
    """
    notif = Notification(
        id=uuid_mod.uuid4(),
        user_id=UUID(str(user_id)),
        type=notif_type,
        title=title,
        body=body,
        data=data,
        is_read=False,
    )
    db.add(notif)
    await db.flush()
    logger.info("[notif] Pushed '%s' for user %s", title, user_id)
    return notif


# ── Endpoints ───────────────────────────────────────────────────
@router.get("")
async def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List notifications for the current user, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(desc(Notification.created_at))
        .limit(limit)
        .offset(offset)
    )
    notifications = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "body": n.body,
            "data": n.data,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


@router.get("/unread-count")
async def unread_count(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Return the number of unread notifications (for badge display)."""
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
    )
    count = result.scalar() or 0
    return {"unread": count}


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark a single notification as read."""
    result = await db.execute(
        update(Notification)
        .where(
            Notification.id == UUID(notification_id),
            Notification.user_id == user.id,
        )
        .values(is_read=True)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    await db.commit()
    return {"status": "ok"}


@router.patch("/read-all")
async def mark_all_read(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark all notifications as read for the current user."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete a notification."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == UUID(notification_id),
            Notification.user_id == user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable.")
    await db.delete(notif)
    await db.commit()
    return {"status": "deleted"}
