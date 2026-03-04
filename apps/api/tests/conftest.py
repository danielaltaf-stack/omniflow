"""
OmniFlow — Test configuration and shared fixtures.

Provides:
- RedisMock          : in-memory Redis replacement (no external dep)
- db_session         : transactional DB session (auto-rollback after each test)
- client             : httpx.AsyncClient wired to the FastAPI app with DI overrides
"""

from __future__ import annotations

from typing import AsyncGenerator

import httpx
import pytest
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
)

from app.core.config import get_settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.main import app
from app.models.base import Base

settings = get_settings()


# ═══════════════════════════════════════════════════════════════════
#  REDIS MOCK — dict-backed, implements all methods used by OmniFlow
# ═══════════════════════════════════════════════════════════════════


class RedisMock:
    """In-memory Redis mock — zero external dependencies."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._ttl: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._store[key] = str(value)
        if ex:
            self._ttl[key] = ex

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self._store[key] = str(value)
        self._ttl[key] = ttl

    async def exists(self, key: str) -> int:
        return 1 if key in self._store else 0

    async def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                self._ttl.pop(k, None)
                count += 1
        return count

    async def incr(self, key: str) -> int:
        val = int(self._store.get(key, "0")) + 1
        self._store[key] = str(val)
        return val

    async def expire(self, key: str, seconds: int) -> None:
        self._ttl[key] = seconds

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        pass

    def pipeline(self) -> RedisPipelineMock:
        return RedisPipelineMock(self)


class RedisPipelineMock:
    """Pipeline mock that batches and executes commands."""

    def __init__(self, redis: RedisMock) -> None:
        self._redis = redis
        self._commands: list[tuple] = []

    def incr(self, key: str) -> RedisPipelineMock:
        self._commands.append(("incr", key))
        return self

    def expire(self, key: str, seconds: int) -> RedisPipelineMock:
        self._commands.append(("expire", key, seconds))
        return self

    async def execute(self) -> list:
        results: list = []
        for cmd in self._commands:
            if cmd[0] == "incr":
                results.append(await self._redis.incr(cmd[1]))
            elif cmd[0] == "expire":
                await self._redis.expire(cmd[1], cmd[2])
                results.append(True)
        self._commands.clear()
        return results


# ═══════════════════════════════════════════════════════════════════
#  DATABASE — per-test engine + transactional session (auto-rollback)
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield a transactional DB session that is rolled back after the test.

    Engine is created INSIDE the fixture so it lives on the current event loop
    (prevents "Future attached to a different loop" errors with asyncpg).

    We override ``session.commit()`` → ``session.flush()`` so that handler
    code writes rows for within-test visibility, but nothing persists.
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=2,
    )

    # Ensure all ORM tables exist (idempotent — uses checkfirst)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    connection = await engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection, expire_on_commit=False)

    # Intercept commit → flush (visible in txn, rolled back at teardown)
    async def _flush_instead_of_commit() -> None:
        await session.flush()

    session.commit = _flush_instead_of_commit  # type: ignore[assignment]

    yield session

    await session.close()
    await transaction.rollback()
    await connection.close()
    await engine.dispose()


# ═══════════════════════════════════════════════════════════════════
#  HTTPX ASYNC CLIENT — wired to FastAPI with DI overrides
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
def redis_mock() -> RedisMock:
    """Provide a fresh Redis mock per test."""
    return RedisMock()


@pytest.fixture
async def client(
    db_session: AsyncSession,
    redis_mock: RedisMock,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    httpx.AsyncClient talking to the real FastAPI app, with:
    - DB session → transactional (auto-rollback)
    - Redis      → in-memory mock
    """

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def _override_get_redis() -> RedisMock:
        return redis_mock

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_redis] = _override_get_redis

    # Patch the module-level redis_client used directly (outside DI)
    import app.core.redis as _redis_mod
    import app.core.security as _security_mod
    import app.main as _main_mod

    _orig_redis = _redis_mod.redis_client
    _orig_security = _security_mod.redis_client
    _orig_main = _main_mod.redis_client

    _redis_mod.redis_client = redis_mock  # type: ignore[assignment]
    _security_mod.redis_client = redis_mock  # type: ignore[assignment]
    _main_mod.redis_client = redis_mock  # type: ignore[assignment]

    transport = httpx.ASGITransport(app=app)  # type: ignore[arg-type]
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    # Restore originals
    app.dependency_overrides.clear()
    _redis_mod.redis_client = _orig_redis
    _security_mod.redis_client = _orig_security
    _main_mod.redis_client = _orig_main
