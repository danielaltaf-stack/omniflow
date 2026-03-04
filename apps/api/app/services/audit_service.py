"""
OmniFlow — Audit Trail Service.

Provides a simple, async-safe function to log security-sensitive actions
into the audit_log table. Used by auth endpoints, RGPD endpoints,
and any mutation that should be traceable.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog

logger = logging.getLogger("omniflow.audit")


async def log_action(
    db: AsyncSession,
    *,
    action: str,
    user_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    """
    Insert an audit log entry.

    This is fire-and-forget safe — errors are logged but never raised,
    so audit failures don't break the main flow.
    """
    try:
        async with db.begin_nested():  # SAVEPOINT — failure rolls back only this
            entry = AuditLog(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
                user_agent=user_agent if user_agent else None,
                metadata_=metadata,
            )
            db.add(entry)
            await db.flush()

        logger.info(
            "AUDIT: %s user_id=%s resource=%s/%s",
            action,
            user_id,
            resource_type,
            resource_id,
            extra={
                "audit_action": action,
                "user_id": str(user_id) if user_id else None,
                "resource_type": resource_type,
                "resource_id": resource_id,
            },
        )
        return entry
    except Exception:
        logger.warning("Failed to write audit log entry: action=%s", action)
        # Return a stub so callers don't crash — session stays usable
        return AuditLog(action=action)


def get_client_ip(request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def get_user_agent(request) -> str:
    """Extract truncated user agent from request."""
    return (request.headers.get("user-agent") or "")[:500]
