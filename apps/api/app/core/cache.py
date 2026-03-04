"""
OmniFlow — Redis Cache Manager.
Centralized caching with TTL, invalidation by pattern, structured logging.
Replaces manual redis.get/setex/json.loads patterns throughout the codebase.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Awaitable, Callable
from uuid import UUID

from app.core.redis import redis_client

logger = logging.getLogger("omniflow.cache")


def _json_serializer(obj: Any) -> str:
    """Custom JSON serializer for dates, UUIDs, and other types."""
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    return str(obj)


class CacheManager:
    """
    Centralized Redis cache with:
    - cached_result(): async compute-or-fetch with TTL
    - invalidate(): pattern-based cache eviction (SCAN, not KEYS)
    - invalidate_user(): evict all cache for a specific user
    - stats(): cache key counts and memory info
    """

    def __init__(self, redis=None):
        self._redis = redis or redis_client

    async def cached_result(
        self,
        key: str,
        ttl: int,
        compute_fn: Callable[[], Awaitable[Any]],
    ) -> Any:
        """
        Return cached value if present, otherwise compute, store, and return.

        Args:
            key: Redis key (e.g. "networth:{user_id}")
            ttl: Time-to-live in seconds
            compute_fn: Async callable that produces the result on cache miss
        """
        start = time.monotonic()

        try:
            cached = await self._redis.get(key)
            if cached is not None:
                elapsed = (time.monotonic() - start) * 1000
                logger.debug("CACHE HIT  %s (%.1fms)", key, elapsed)
                return json.loads(cached)
        except Exception as e:
            logger.warning("Redis GET failed for %s: %s", key, e)

        # Cache miss — compute
        result = await compute_fn()

        # Store in cache
        try:
            serialized = json.dumps(result, default=_json_serializer)
            await self._redis.setex(key, ttl, serialized)
            elapsed = (time.monotonic() - start) * 1000
            logger.debug("CACHE MISS %s — computed + stored (%.1fms)", key, elapsed)
        except Exception as e:
            logger.warning("Redis SET failed for %s: %s", key, e)

        return result

    async def invalidate(self, pattern: str) -> int:
        """
        Delete all keys matching a glob pattern using SCAN (non-blocking).
        Returns count of deleted keys.

        Example: invalidate("networth:*") removes all networth caches.
        """
        deleted = 0
        try:
            cursor = 0
            while True:
                cursor, keys = await self._redis.scan(
                    cursor=cursor, match=pattern, count=100
                )
                if keys:
                    await self._redis.delete(*keys)
                    deleted += len(keys)
                if cursor == 0:
                    break
            if deleted > 0:
                logger.info("CACHE INVALIDATE '%s' — %d keys deleted", pattern, deleted)
        except Exception as e:
            logger.warning("Cache invalidation failed for '%s': %s", pattern, e)
        return deleted

    async def invalidate_user(self, user_id: str | UUID) -> int:
        """
        Invalidate all cached data for a specific user.
        Called after sync completion or data import.
        """
        uid = str(user_id)
        total = 0
        patterns = [
            f"networth:{uid}*",
            f"networth:history:{uid}*",
            f"cashflow:{uid}*",
            f"budget:*:{uid}*",
            f"dashboard:summary:{uid}",
            f"omniscore:{uid}",
        ]
        for pattern in patterns:
            total += await self.invalidate(pattern)
        return total

    async def delete(self, key: str) -> bool:
        """Delete a single cache key."""
        try:
            result = await self._redis.delete(key)
            if result:
                logger.debug("CACHE DELETE %s", key)
            return bool(result)
        except Exception as e:
            logger.warning("Cache delete failed for %s: %s", key, e)
            return False

    async def stats(self) -> dict[str, Any]:
        """Return cache statistics: key counts per namespace, memory usage."""
        try:
            info = await self._redis.info("memory")
            memory_used = info.get("used_memory_human", "unknown")

            # Count keys by namespace (sample via SCAN)
            namespaces: dict[str, int] = {}
            cursor = 0
            total_keys = 0
            while True:
                cursor, keys = await self._redis.scan(
                    cursor=cursor, count=200
                )
                for key in keys:
                    ns = key.split(":")[0] if ":" in key else "other"
                    namespaces[ns] = namespaces.get(ns, 0) + 1
                    total_keys += 1
                if cursor == 0:
                    break

            return {
                "total_keys": total_keys,
                "memory_used": memory_used,
                "namespaces": namespaces,
            }
        except Exception as e:
            logger.warning("Cache stats failed: %s", e)
            return {"total_keys": 0, "memory_used": "unknown", "namespaces": {}}


# Module-level singleton
cache_manager = CacheManager()
