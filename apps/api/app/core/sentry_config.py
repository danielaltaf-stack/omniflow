"""
OmniFlow — Sentry SDK Configuration.

Production error tracking, performance monitoring, and profiling.
Conditional: only active when SENTRY_DSN is configured (non-empty).

Features:
  - FastAPI ASGI integration (auto-create transactions per request)
  - SQLAlchemy integration (DB query spans)
  - Redis integration (cache operation spans)
  - httpx integration (external API call spans)
  - before_send filter: suppress 401/404 noise, always capture 500+
  - Sensitive data scrubbing (Authorization, passwords, cookies)
  - Release tracking (APP_VERSION)
  - Environment tagging (production / staging / development)
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("omniflow.sentry")

_sentry_initialized = False


def init_sentry(
    dsn: str,
    environment: str = "production",
    release: str = "0.5.0",
    traces_sample_rate: float = 0.2,
    profiles_sample_rate: float = 0.1,
) -> bool:
    """
    Initialize Sentry SDK if DSN is provided and sentry-sdk is installed.

    Returns True if Sentry was successfully initialized, False otherwise.
    Gracefully degrades: if sentry-sdk is not installed, logs a warning and continues.
    """
    global _sentry_initialized

    if not dsn or dsn.strip() == "":
        logger.info("Sentry DSN not configured — error tracking disabled.")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.httpx import HttpxIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
    except ImportError:
        logger.warning(
            "sentry-sdk not installed — error tracking disabled. "
            "Install with: pip install sentry-sdk[fastapi]"
        )
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=f"omniflow-api@{release}",
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,

        # Integrations
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            RedisIntegration(),
            HttpxIntegration(),
            LoggingIntegration(
                level=logging.WARNING,        # Capture WARNING+ as breadcrumbs
                event_level=logging.ERROR,     # Create events for ERROR+
            ),
        ],

        # Filtering: suppress noise, capture real errors
        before_send=_before_send,

        # Sensitive data scrubbing
        send_default_pii=False,
        before_send_transaction=_before_send_transaction,

        # Performance
        enable_tracing=True,

        # Limit breadcrumbs to reduce payload size
        max_breadcrumbs=50,

        # Attach server name for multi-instance debugging
        server_name=None,  # Railway sets HOSTNAME automatically
    )

    _sentry_initialized = True
    logger.info(
        "Sentry initialized — env=%s, release=omniflow-api@%s, "
        "traces=%.0f%%, profiles=%.0f%%",
        environment, release,
        traces_sample_rate * 100,
        profiles_sample_rate * 100,
    )
    return True


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """
    Filter events before sending to Sentry.

    - Suppress 401/404 (normal auth/routing noise)
    - Always capture 500+ (server errors)
    - Scrub sensitive data from request bodies
    """
    # Check if this is an HTTP exception
    if "exc_info" in hint:
        exc_type, exc_value, _ = hint["exc_info"]
        exc_name = exc_type.__name__ if exc_type else ""

        # FastAPI HTTPException
        if exc_name == "HTTPException":
            status_code = getattr(exc_value, "status_code", 500)
            if status_code in (401, 403, 404):
                return None  # Drop — normal auth/routing behavior
            if status_code == 422:
                return None  # Drop — validation errors (Pydantic)

    # Scrub sensitive fields from request data
    request = event.get("request", {})
    headers = request.get("headers", {})

    # Remove Authorization header values
    if "Authorization" in headers:
        headers["Authorization"] = "[Filtered]"
    if "authorization" in headers:
        headers["authorization"] = "[Filtered]"

    # Remove Cookie header
    if "Cookie" in headers:
        headers["Cookie"] = "[Filtered]"
    if "cookie" in headers:
        headers["cookie"] = "[Filtered]"

    # Scrub password fields from request body
    data = request.get("data", {})
    if isinstance(data, dict):
        for key in list(data.keys()):
            if "password" in key.lower() or "secret" in key.lower() or "token" in key.lower():
                data[key] = "[Filtered]"

    return event


def _before_send_transaction(
    event: dict[str, Any], hint: dict[str, Any]
) -> dict[str, Any] | None:
    """
    Filter transactions before sending.
    Drop health check transactions to save quota.
    """
    transaction_name = event.get("transaction", "")
    if "/health" in transaction_name or "/metrics" in transaction_name:
        return None
    return event


def capture_exception(exc: Exception) -> None:
    """Capture an exception to Sentry (no-op if not initialized)."""
    if not _sentry_initialized:
        return
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except ImportError:
        pass


def set_user(user_id: str, email: str | None = None) -> None:
    """Set the current user context for Sentry (no-op if not initialized)."""
    if not _sentry_initialized:
        return
    try:
        import sentry_sdk
        user_data: dict[str, str] = {"id": user_id}
        if email:
            # Hash email for privacy — don't send raw PII
            import hashlib
            user_data["email_hash"] = hashlib.sha256(email.encode()).hexdigest()[:16]
        sentry_sdk.set_user(user_data)
    except ImportError:
        pass


def is_initialized() -> bool:
    """Check if Sentry is currently active."""
    return _sentry_initialized
