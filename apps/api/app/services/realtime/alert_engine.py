"""
OmniFlow — AlertEngine: real-time cross-asset alert evaluator.

Loaded by MarketHub at startup. On each price tick, evaluates all active
alerts for the given symbol with O(1) dict lookup. Triggers notifications
when conditions are met, respecting cooldown periods.
"""

from __future__ import annotations

import asyncio
import logging
import uuid as uuid_mod
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, selectinload

logger = logging.getLogger("omniflow.alert_engine")


class AlertRule:
    """In-memory representation of an active alert for fast evaluation."""

    __slots__ = (
        "id", "user_id", "name", "asset_type", "symbol", "condition",
        "threshold", "cooldown_minutes", "last_triggered_at",
        "notify_in_app", "notify_push", "notify_email",
    )

    def __init__(self, row: Any) -> None:
        self.id = row.id
        self.user_id = row.user_id
        self.name = row.name
        self.asset_type = row.asset_type
        self.symbol = row.symbol
        self.condition = row.condition
        self.threshold = row.threshold
        self.cooldown_minutes = row.cooldown_minutes
        self.last_triggered_at = row.last_triggered_at
        self.notify_in_app = row.notify_in_app
        self.notify_push = row.notify_push
        self.notify_email = row.notify_email


class AlertEngine:
    """
    Singleton engine that maintains an in-memory index of active alerts
    and evaluates them on each market tick.
    """

    _instance: AlertEngine | None = None

    def __new__(cls) -> AlertEngine:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True

        # symbol → list[AlertRule]  — O(1) lookup per tick
        self._alerts_by_symbol: dict[str, list[AlertRule]] = {}
        self._total_alerts = 0
        self._running = False
        self._reload_task: asyncio.Task | None = None
        self._db_url: str | None = None
        self._trigger_count = 0

    async def start(self, db_url: str) -> None:
        """Start the engine: load alerts and begin periodic reload."""
        if self._running:
            return
        self._running = True
        self._db_url = db_url

        await self._reload_alerts()
        self._reload_task = asyncio.create_task(self._reload_loop())
        logger.info(
            "AlertEngine started — %d active alerts loaded", self._total_alerts
        )

    async def stop(self) -> None:
        """Stop the engine."""
        if not self._running:
            return
        self._running = False
        if self._reload_task:
            self._reload_task.cancel()
            try:
                await self._reload_task
            except asyncio.CancelledError:
                pass
        self._alerts_by_symbol.clear()
        logger.info("AlertEngine stopped.")

    async def _reload_loop(self) -> None:
        """Reload alerts from DB every 30 seconds."""
        while self._running:
            try:
                await asyncio.sleep(30)
                await self._reload_alerts()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("AlertEngine reload error: %s", e)
                await asyncio.sleep(5)

    async def _reload_alerts(self) -> None:
        """Load all active alerts from DB into in-memory index."""
        if not self._db_url:
            return

        try:
            from app.models.alert import UserAlert

            engine = create_async_engine(self._db_url, pool_size=2, max_overflow=0)
            async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

            async with async_session() as session:
                result = await session.execute(
                    select(UserAlert).where(UserAlert.is_active == True)  # noqa: E712
                )
                alerts = result.scalars().all()

            await engine.dispose()

            # Rebuild index
            new_index: dict[str, list[AlertRule]] = {}
            for a in alerts:
                rule = AlertRule(a)
                symbol = a.symbol.upper()
                if symbol not in new_index:
                    new_index[symbol] = []
                new_index[symbol].append(rule)

            self._alerts_by_symbol = new_index
            self._total_alerts = sum(len(v) for v in new_index.values())
            logger.debug(
                "AlertEngine reloaded: %d alerts for %d symbols",
                self._total_alerts,
                len(new_index),
            )

        except Exception as e:
            logger.error("AlertEngine reload failed: %s", e)

    def _channel_to_symbol(self, channel: str) -> str:
        """Convert MarketHub channel (crypto:BTC) to symbol (BTC)."""
        if ":" in channel:
            return channel.split(":", 1)[1].upper()
        return channel.upper()

    async def evaluate(self, channel: str, data: dict[str, Any]) -> None:
        """
        Evaluate all alerts for a given channel/symbol.
        Called by MarketHub.on_tick() on each price update.
        """
        symbol = self._channel_to_symbol(channel)
        rules = self._alerts_by_symbol.get(symbol)
        if not rules:
            return

        price = data.get("price") or data.get("p")
        change_24h = data.get("change_24h") or data.get("P")
        volume_24h = data.get("volume_24h") or data.get("v")

        if price is None:
            return

        try:
            price = float(price)
        except (ValueError, TypeError):
            return

        now = datetime.now(UTC)

        for rule in rules:
            # Check cooldown
            if rule.last_triggered_at:
                cooldown_delta = timedelta(minutes=rule.cooldown_minutes)
                if now - rule.last_triggered_at < cooldown_delta:
                    continue

            triggered = False
            message = ""

            if rule.condition == "price_above" and price >= rule.threshold:
                triggered = True
                message = f"🚀 {rule.name} — {symbol} a franchi {rule.threshold:,.2f} (prix actuel: {price:,.2f})"

            elif rule.condition == "price_below" and price <= rule.threshold:
                triggered = True
                message = f"📉 {rule.name} — {symbol} est passé sous {rule.threshold:,.2f} (prix actuel: {price:,.2f})"

            elif rule.condition == "pct_change_24h_above" and change_24h is not None:
                try:
                    pct = float(change_24h)
                    if pct >= rule.threshold:
                        triggered = True
                        message = f"📈 {rule.name} — {symbol} +{pct:.1f}% en 24h (seuil: +{rule.threshold:.1f}%)"
                except (ValueError, TypeError):
                    pass

            elif rule.condition == "pct_change_24h_below" and change_24h is not None:
                try:
                    pct = float(change_24h)
                    if pct <= -rule.threshold:
                        triggered = True
                        message = f"🔻 {rule.name} — {symbol} {pct:.1f}% en 24h (seuil: -{rule.threshold:.1f}%)"
                except (ValueError, TypeError):
                    pass

            elif rule.condition == "volume_spike" and volume_24h is not None:
                # volume_spike: threshold is a multiplier (e.g., 2.0 = 2x average)
                # For simplicity, trigger if volume exceeds threshold * 1M
                try:
                    vol = float(volume_24h)
                    if vol > rule.threshold * 1_000_000:
                        triggered = True
                        message = f"🔊 {rule.name} — {symbol} volume spike: {vol/1_000_000:.1f}M (seuil: {rule.threshold:.0f}M)"
                except (ValueError, TypeError):
                    pass

            if triggered:
                await self._trigger_alert(rule, price, message, now)

    async def _trigger_alert(
        self,
        rule: AlertRule,
        price: float,
        message: str,
        now: datetime,
    ) -> None:
        """Persist trigger to DB and push notification."""
        self._trigger_count += 1

        # Update cooldown in memory immediately
        rule.last_triggered_at = now

        logger.info(
            "[alert] TRIGGERED: %s (symbol=%s, price=%.4f)",
            rule.name, rule.symbol, price,
        )

        if not self._db_url:
            return

        try:
            from app.models.alert import UserAlert, AlertHistory
            from app.models.notification import Notification

            engine = create_async_engine(self._db_url, pool_size=2, max_overflow=0)
            async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

            async with async_session() as session:
                async with session.begin():
                    # Insert history row
                    history = AlertHistory(
                        id=uuid_mod.uuid4(),
                        alert_id=rule.id,
                        user_id=rule.user_id,
                        price_at_trigger=price,
                        message=message,
                    )
                    session.add(history)

                    # Update last_triggered_at
                    await session.execute(
                        update(UserAlert)
                        .where(UserAlert.id == rule.id)
                        .values(last_triggered_at=now)
                    )

                    # Push in-app notification
                    if rule.notify_in_app:
                        notif = Notification(
                            id=uuid_mod.uuid4(),
                            user_id=rule.user_id,
                            type="alert_triggered",
                            title=f"Alerte: {rule.name}",
                            body=message,
                            data={
                                "alert_id": str(rule.id),
                                "symbol": rule.symbol,
                                "condition": rule.condition,
                                "threshold": rule.threshold,
                                "price": price,
                            },
                            is_read=False,
                        )
                        session.add(notif)

            await engine.dispose()

        except Exception as e:
            logger.error("AlertEngine trigger persist error: %s", e)

    @property
    def stats(self) -> dict[str, Any]:
        """Return engine statistics."""
        return {
            "total_alerts": self._total_alerts,
            "symbols_watched": len(self._alerts_by_symbol),
            "triggers_total": self._trigger_count,
            "running": self._running,
        }


# Global singleton
alert_engine = AlertEngine()
