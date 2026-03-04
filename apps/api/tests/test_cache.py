"""
Tests for CacheManager — Redis cache abstraction layer.
Tests: cached_result (hit/miss), invalidate, invalidate_user, delete, stats.
"""

from __future__ import annotations

import json
import pytest

from app.core.cache import CacheManager, _json_serializer


# ── Fixtures ────────────────────────────────────────────────────


class FakeRedis:
    """In-memory Redis mock for cache tests."""

    def __init__(self):
        self._store: dict[str, str] = {}
        self._ttls: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self._store[key] = value
        self._ttls[key] = ttl

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            if key in self._store:
                del self._store[key]
                self._ttls.pop(key, None)
                deleted += 1
        return deleted

    async def scan(self, cursor: int = 0, match: str = "*", count: int = 100):
        """Simplified scan that matches glob patterns."""
        import fnmatch

        matched = [k for k in self._store if fnmatch.fnmatch(k, match)]
        return (0, matched)

    async def info(self, section: str = "memory"):
        return {"used_memory_human": "1.5M"}


@pytest.fixture
def fake_redis():
    return FakeRedis()


@pytest.fixture
def cache(fake_redis):
    return CacheManager(redis=fake_redis)


# ── Tests: cached_result ────────────────────────────────────────


@pytest.mark.asyncio
async def test_cache_miss_computes_and_stores(cache, fake_redis):
    """On cache miss, compute_fn is called and result is stored."""
    call_count = 0

    async def compute():
        nonlocal call_count
        call_count += 1
        return {"total": 42, "label": "test"}

    result = await cache.cached_result("test:key", ttl=60, compute_fn=compute)
    assert result == {"total": 42, "label": "test"}
    assert call_count == 1

    # Verify stored in redis
    stored = json.loads(fake_redis._store["test:key"])
    assert stored["total"] == 42
    assert fake_redis._ttls["test:key"] == 60


@pytest.mark.asyncio
async def test_cache_hit_returns_cached(cache, fake_redis):
    """On cache hit, compute_fn is NOT called."""
    # Pre-populate cache
    fake_redis._store["test:key"] = json.dumps({"cached": True})

    call_count = 0

    async def compute():
        nonlocal call_count
        call_count += 1
        return {"cached": False}

    result = await cache.cached_result("test:key", ttl=60, compute_fn=compute)
    assert result == {"cached": True}
    assert call_count == 0  # compute was NOT called


@pytest.mark.asyncio
async def test_cache_miss_then_hit(cache, fake_redis):
    """First call computes, second call returns cached."""
    call_count = 0

    async def compute():
        nonlocal call_count
        call_count += 1
        return {"value": call_count}

    # First call — miss
    r1 = await cache.cached_result("test:counter", ttl=120, compute_fn=compute)
    assert r1 == {"value": 1}
    assert call_count == 1

    # Second call — hit
    r2 = await cache.cached_result("test:counter", ttl=120, compute_fn=compute)
    assert r2 == {"value": 1}  # same cached value
    assert call_count == 1  # compute was NOT called again


# ── Tests: invalidate ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_invalidate_by_pattern(cache, fake_redis):
    """Invalidate deletes all matching keys."""
    fake_redis._store["networth:user1"] = '{"v": 1}'
    fake_redis._store["networth:user2"] = '{"v": 2}'
    fake_redis._store["dashboard:user1"] = '{"v": 3}'

    deleted = await cache.invalidate("networth:*")
    assert deleted == 2
    assert "networth:user1" not in fake_redis._store
    assert "networth:user2" not in fake_redis._store
    assert "dashboard:user1" in fake_redis._store


@pytest.mark.asyncio
async def test_invalidate_no_match(cache, fake_redis):
    """Invalidate with non-matching pattern returns 0."""
    fake_redis._store["dashboard:user1"] = '{"v": 1}'
    deleted = await cache.invalidate("nonexistent:*")
    assert deleted == 0


# ── Tests: invalidate_user ──────────────────────────────────────


@pytest.mark.asyncio
async def test_invalidate_user_clears_all_namespaces(cache, fake_redis):
    """invalidate_user removes all cache keys for a specific user."""
    uid = "abc-123"
    fake_redis._store[f"networth:{uid}"] = '{"v": 1}'
    fake_redis._store[f"networth:history:{uid}:30d"] = '{"v": 2}'
    fake_redis._store[f"cashflow:{uid}:monthly:6"] = '{"v": 3}'
    fake_redis._store[f"budget:current:{uid}:2026-03"] = '{"v": 4}'
    fake_redis._store[f"dashboard:summary:{uid}"] = '{"v": 5}'
    fake_redis._store[f"omniscore:{uid}"] = '{"v": 6}'
    fake_redis._store["networth:other-user"] = '{"v": 99}'

    total = await cache.invalidate_user(uid)
    assert total == 6
    # Only other-user should remain
    assert len(fake_redis._store) == 1
    assert "networth:other-user" in fake_redis._store


# ── Tests: delete ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_single_key(cache, fake_redis):
    """delete() removes exactly one key."""
    fake_redis._store["test:key"] = '{"v": 1}'
    fake_redis._store["test:other"] = '{"v": 2}'

    result = await cache.delete("test:key")
    assert result is True
    assert "test:key" not in fake_redis._store
    assert "test:other" in fake_redis._store


@pytest.mark.asyncio
async def test_delete_nonexistent_key(cache, fake_redis):
    """delete() returns False for non-existent key."""
    result = await cache.delete("nonexistent")
    assert result is False


# ── Tests: stats ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stats_returns_namespaces(cache, fake_redis):
    """stats() counts keys per namespace."""
    fake_redis._store["networth:u1"] = "{}"
    fake_redis._store["networth:u2"] = "{}"
    fake_redis._store["dashboard:u1"] = "{}"
    fake_redis._store["omniscore:u1"] = "{}"

    stats = await cache.stats()
    assert stats["total_keys"] == 4
    assert stats["namespaces"]["networth"] == 2
    assert stats["namespaces"]["dashboard"] == 1
    assert stats["namespaces"]["omniscore"] == 1
    assert stats["memory_used"] == "1.5M"


# ── Tests: JSON serializer ─────────────────────────────────────


def test_json_serializer_date():
    """Serializer handles date/datetime objects."""
    from datetime import date, datetime

    assert _json_serializer(date(2026, 3, 2)) == "2026-03-02"
    dt = datetime(2026, 3, 2, 14, 30, 0)
    assert "2026-03-02" in _json_serializer(dt)


def test_json_serializer_uuid():
    """Serializer handles UUID objects."""
    from uuid import UUID

    uid = UUID("12345678-1234-5678-1234-567812345678")
    assert _json_serializer(uid) == "12345678-1234-5678-1234-567812345678"


def test_json_serializer_fallback():
    """Serializer falls back to str() for unknown types."""
    assert _json_serializer(42) == "42"
