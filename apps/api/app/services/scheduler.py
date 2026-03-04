"""
OmniFlow — APScheduler background sync scheduler (A2.2 hardened).

- Configurable interval from settings.SYNC_INTERVAL_HOURS
- Jitter 0-60 s per connection to avoid thundering-herd on bank APIs
- Concurrent sync with asyncio.Semaphore(settings.SYNC_MAX_CONCURRENT)
- Batch metrics (total time, success/fail counts)
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.models.bank_connection import BankConnection

logger = logging.getLogger("omniflow.scheduler")

scheduler = AsyncIOScheduler()
settings = get_settings()


async def _sync_one(
    sem: asyncio.Semaphore,
    conn_id: int,
    bank_module: str,
) -> bool:
    """Sync a single connection behind a concurrency semaphore with jitter."""
    from app.woob_engine.sync_service import sync_connection

    # Random jitter 0-60 s to spread requests across bank APIs
    jitter = random.uniform(0, 60)
    await asyncio.sleep(jitter)

    async with sem:
        async with async_session_factory() as db:
            result = await db.execute(
                select(BankConnection).where(BankConnection.id == conn_id)
            )
            conn = result.scalar_one_or_none()
            if conn is None or conn.status != "active":
                return True  # skip silently

            try:
                logger.info(
                    f"[scheduler] Syncing connection {conn.id} ({bank_module}) "
                    f"[jitter={jitter:.1f}s]"
                )
                await sync_connection(db, conn)
                await db.commit()
                logger.info(f"[scheduler] ✓ connection {conn.id}")
                return True
            except Exception as e:
                await db.rollback()
                logger.error(f"[scheduler] ✗ connection {conn.id}: {e}")
                # Persist error information
                conn.sync_error = str(e)[:500]
                conn.last_sync_at = datetime.now(timezone.utc)
                try:
                    await db.commit()
                except Exception:
                    await db.rollback()
                return False


async def sync_all_active_connections() -> None:
    """
    Iterate all active connections and sync them concurrently (bounded).
    Called periodically by APScheduler.
    """
    t0 = time.monotonic()
    logger.info("[scheduler] Starting periodic sync batch")

    async with async_session_factory() as db:
        result = await db.execute(
            select(BankConnection.id, BankConnection.bank_module).where(
                BankConnection.status == "active"
            )
        )
        rows = result.all()

    total = len(rows)
    if total == 0:
        logger.info("[scheduler] No active connections — nothing to sync")
        return

    logger.info(f"[scheduler] {total} connections to sync (max_concurrent={settings.SYNC_MAX_CONCURRENT})")

    sem = asyncio.Semaphore(settings.SYNC_MAX_CONCURRENT)
    results = await asyncio.gather(
        *[_sync_one(sem, row.id, row.bank_module) for row in rows],
        return_exceptions=True,
    )

    ok = sum(1 for r in results if r is True)
    fail = total - ok
    elapsed = time.monotonic() - t0
    logger.info(
        f"[scheduler] Batch done in {elapsed:.1f}s — "
        f"{ok}/{total} ok, {fail} failed"
    )


def start_scheduler() -> None:
    """Start the APScheduler with periodic sync job."""
    interval_h = settings.SYNC_INTERVAL_HOURS
    scheduler.add_job(
        sync_all_active_connections,
        trigger=IntervalTrigger(hours=interval_h),
        id="sync_all_connections",
        name="Sync all active bank connections",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info(f"[scheduler] APScheduler started — sync every {interval_h}h")


def stop_scheduler() -> None:
    """Gracefully stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[scheduler] APScheduler stopped")
