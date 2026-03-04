"""
OmniFlow — Web Push Subscription API (VAPID-based PWA Push Notifications).

POST   /push/subscribe     — Register a push subscription
DELETE /push/unsubscribe   — Remove a push subscription
POST   /push/test          — Send a test push notification
GET    /push/vapid-key     — Get the VAPID public key for client-side subscription
"""

from __future__ import annotations

import logging
import uuid as uuid_mod
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.push_subscription import PushSubscription
from app.schemas.push import (
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    PushSubscriptionUnsubscribe,
    PushTestRequest,
)
from app.services.push_service import send_push_notification

logger = logging.getLogger("omniflow.push")

router = APIRouter(prefix="/push", tags=["Push Notifications"])


@router.get("/vapid-key")
async def get_vapid_public_key() -> dict[str, str]:
    """Return the VAPID public key for client-side push subscription."""
    settings = get_settings()
    if not settings.VAPID_PUBLIC_KEY or "CHANGE-ME" in settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail="Push notifications are not configured on this server.",
        )
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_push(
    payload: PushSubscriptionCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a Web Push subscription for the current user."""
    # Check if subscription already exists (UPSERT on endpoint)
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing subscription (may have new keys or different user)
        existing.user_id = user.id
        existing.p256dh_key = payload.keys.p256dh
        existing.auth_key = payload.keys.auth
        existing.user_agent = payload.user_agent
        await db.flush()
        await db.commit()
        logger.info(
            "Push subscription updated for user %s (endpoint=%s...)",
            user.id, payload.endpoint[:60],
        )
        return existing

    # Create new subscription
    sub = PushSubscription(
        id=uuid_mod.uuid4(),
        user_id=user.id,
        endpoint=payload.endpoint,
        p256dh_key=payload.keys.p256dh,
        auth_key=payload.keys.auth,
        user_agent=payload.user_agent,
    )
    db.add(sub)
    await db.flush()
    await db.commit()

    logger.info(
        "Push subscription created for user %s (endpoint=%s...)",
        user.id, payload.endpoint[:60],
    )
    return sub


@router.delete("/unsubscribe")
async def unsubscribe_push(
    payload: PushSubscriptionUnsubscribe,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Remove a Web Push subscription."""
    result = await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == user.id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Subscription introuvable.")
    await db.commit()
    logger.info(
        "Push subscription removed for user %s (endpoint=%s...)",
        user.id, payload.endpoint[:60],
    )
    return {"status": "unsubscribed"}


@router.post("/test")
async def send_test_push(
    payload: PushTestRequest = PushTestRequest(),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str | int]:
    """Send a test push notification to the current user's devices."""
    count = await send_push_notification(
        db=db,
        user_id=user.id,
        title=payload.title,
        body=payload.body,
        url=payload.url,
        tag="omniflow-test",
    )
    if count == 0:
        return {
            "status": "no_subscriptions",
            "message": "Aucune souscription push trouvée. Activez les notifications dans l'app.",
            "sent": 0,
        }
    return {"status": "sent", "sent": count}
