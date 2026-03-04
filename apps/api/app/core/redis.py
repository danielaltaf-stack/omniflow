"""
OmniFlow — Redis connection pool.

Production-ready:
  - TLS support for Upstash (rediss:// auto-detected)
  - Connection retry with exponential backoff (3 retries)
  - Startup ping for fail-fast
  - Graceful degradation logging
"""

from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis

from app.core.config import get_settings

logger = logging.getLogger("omniflow.redis")
settings = get_settings()

# ── Build connection kwargs ──────────────────────────────────────
_redis_kwargs: dict = {
    "decode_responses": True,
    "max_connections": settings.REDIS_MAX_CONNECTIONS,
    "socket_connect_timeout": 5,
    "socket_timeout": 5,
    "retry_on_timeout": True,
}

# TLS: rediss:// is auto-handled by redis.asyncio (ssl=True)
# Upstash requires TLS — the rediss:// scheme triggers ssl=True automatically
_is_tls = settings.REDIS_URL.startswith("rediss://")
if _is_tls:
    logger.info("Redis TLS detected (rediss://) — SSL enabled automatically.")

redis_client = aioredis.from_url(settings.REDIS_URL, **_redis_kwargs)


async def get_redis() -> aioredis.Redis:
    """Dependency: return the shared Redis client."""
    return redis_client


async def verify_redis_connection(max_retries: int = 3) -> bool:
    """
    Verify Redis connectivity with exponential backoff.
    Returns True if connected, False if all retries failed.
    Used at startup to fail-fast in production.
    """
    for attempt in range(1, max_retries + 1):
        try:
            pong = await redis_client.ping()
            if pong:
                logger.info(
                    "Redis connection verified (attempt %d/%d, tls=%s).",
                    attempt, max_retries, _is_tls,
                )
                return True
        except (aioredis.ConnectionError, aioredis.TimeoutError, OSError) as e:
            wait = min(2 ** attempt, 8)  # 2s, 4s, 8s
            logger.warning(
                "Redis connection attempt %d/%d failed: %s. Retrying in %ds...",
                attempt, max_retries, e, wait,
            )
            if attempt < max_retries:
                await asyncio.sleep(wait)

    logger.error(
        "Redis connection failed after %d attempts. "
        "Cache, rate limiting, and JWT blacklist will be unavailable.",
        max_retries,
    )
    return False
