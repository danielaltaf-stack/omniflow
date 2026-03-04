"""
OmniFlow — Database engine (SQLAlchemy 2.0 async).

Production-ready:
  - Neon serverless PostgreSQL support (SSL, PgBouncer pooling)
  - Pool event logging (checkout, checkin, overflow)
  - Statement timeout to kill runaway queries
  - Auto-detect SSL requirement from connection string
"""

import logging

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import Pool

from app.core.config import get_settings

logger = logging.getLogger("omniflow.db")
settings = get_settings()

# ── Build connect_args ───────────────────────────────────────────
_connect_args: dict = {
    "server_settings": {
        "statement_timeout": str(settings.DB_STATEMENT_TIMEOUT_MS),
    },
}

# Auto-detect SSL for cloud databases (Neon, Supabase, etc.)
# If sslmode=require is in the URL, asyncpg handles it natively.
# For explicit SSL without URL param, detect cloud providers.
_url = settings.DATABASE_URL
_is_cloud = any(p in _url for p in (".neon.tech", ".supabase.co", ".railway.app"))
if _is_cloud and "sslmode" not in _url:
    _connect_args["ssl"] = "require"
    logger.info("Cloud database detected — SSL mode set to 'require'.")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=settings.DB_POOL_RECYCLE,
    connect_args=_connect_args,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Pool event logging (production observability) ────────────────
@event.listens_for(Pool, "checkout")
def _pool_checkout(dbapi_conn, connection_record, connection_proxy):
    logger.debug("DB pool checkout — connections in use: %s", connection_proxy)


@event.listens_for(Pool, "checkin")
def _pool_checkin(dbapi_conn, connection_record):
    logger.debug("DB pool checkin")


@event.listens_for(Pool, "invalidate")
def _pool_invalidate(dbapi_conn, connection_record, exception):
    if exception:
        logger.warning("DB pool connection invalidated due to error: %s", exception)
    else:
        logger.info("DB pool connection invalidated (soft).")


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """Dependency: yield an async DB session. Commit is EXPLICIT by callers."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
