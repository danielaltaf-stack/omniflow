"""
OmniFlow — Web Push Notification Service (VAPID).

Sends native push notifications to subscribed browsers via the Web Push Protocol.
Uses pywebpush to handle VAPID signing and HTTP/2 delivery.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger("omniflow.push")

# Lazy-imported to avoid hard failure if pywebpush is not installed
_webpush = None


def _get_webpush():
    """Lazy import pywebpush."""
    global _webpush
    if _webpush is None:
        try:
            from pywebpush import webpush, WebPushException  # type: ignore
            _webpush = (webpush, WebPushException)
        except ImportError:
            logger.warning(
                "pywebpush not installed — push notifications disabled. "
                "Install with: pip install pywebpush"
            )
            _webpush = (None, None)
    return _webpush


async def send_push_notification(
    db: AsyncSession,
    user_id: UUID | str,
    title: str,
    body: str,
    url: str = "/dashboard",
    icon: str | None = None,
    tag: str = "omniflow-default",
) -> int:
    """
    Send a Web Push notification to all subscribed devices for a user.
    Returns the number of successful deliveries.
    """
    webpush_fn, WebPushException = _get_webpush()
    if webpush_fn is None:
        logger.debug("Push skipped — pywebpush not available")
        return 0

    settings = get_settings()
    if not settings.VAPID_PRIVATE_KEY or "CHANGE-ME" in settings.VAPID_PRIVATE_KEY:
        logger.debug("Push skipped — VAPID keys not configured")
        return 0

    # Fetch all subscriptions for this user
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == UUID(str(user_id))
        )
    )
    subscriptions = result.scalars().all()
    if not subscriptions:
        logger.debug("No push subscriptions for user %s", user_id)
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": icon or "/icons/icon-192.svg",
        "badge": "/icons/badge-72.svg",
        "tag": tag,
    })

    vapid_claims = {
        "sub": settings.VAPID_SUBJECT,
    }

    success_count = 0
    expired_endpoints: list[str] = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh_key,
                "auth": sub.auth_key,
            },
        }
        try:
            webpush_fn(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims=vapid_claims,
                ttl=86400,  # 24h
            )
            success_count += 1
            logger.info(
                "Push sent to user %s: %s (endpoint=%s...)",
                user_id, title, sub.endpoint[:60],
            )
        except WebPushException as e:
            status_code = getattr(e, 'response', None)
            if status_code and hasattr(status_code, 'status_code'):
                code = status_code.status_code
            else:
                code = 0
            if code in (404, 410):
                # Subscription expired or unsubscribed — mark for deletion
                expired_endpoints.append(sub.endpoint)
                logger.info(
                    "Push subscription expired (HTTP %d), queued for removal: %s...",
                    code, sub.endpoint[:60],
                )
            else:
                logger.warning(
                    "Push failed for user %s: %s (endpoint=%s...)",
                    user_id, str(e)[:200], sub.endpoint[:60],
                )
        except Exception as e:
            logger.warning(
                "Push unexpected error for user %s: %s", user_id, str(e)[:200],
            )

    # Clean up expired subscriptions
    if expired_endpoints:
        await db.execute(
            delete(PushSubscription).where(
                PushSubscription.endpoint.in_(expired_endpoints)
            )
        )
        await db.flush()
        logger.info(
            "Removed %d expired push subscriptions for user %s",
            len(expired_endpoints), user_id,
        )

    return success_count


async def broadcast_push(
    db: AsyncSession,
    user_ids: list[UUID | str],
    title: str,
    body: str,
    url: str = "/dashboard",
    tag: str = "omniflow-broadcast",
) -> int:
    """Send the same push notification to multiple users."""
    total = 0
    for uid in user_ids:
        total += await send_push_notification(db, uid, title, body, url, tag=tag)
    return total
