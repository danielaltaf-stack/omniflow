"""
OmniFlow — MarketHub: singleton real-time market data multiplexer.

Receives ticks from upstream providers (Binance WS, CoinGecko polling),
maintains an in-memory snapshot cache, and fans out updates to all
connected frontend WebSocket clients with intelligent throttling.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("omniflow.market_hub")


class MarketHub:
    """
    Singleton hub that:
    1. Aggregates ticks from multiple upstream providers.
    2. Maintains latest snapshot per symbol + circular buffer.
    3. Fans-out to subscribed WebSocket clients with throttle.
    4. Publishes to Redis PubSub for multi-worker scaling.
    """

    _instance: MarketHub | None = None

    def __new__(cls) -> MarketHub:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True

        # channel -> set of connected WebSocket clients
        self._subscriptions: dict[str, set[WebSocket]] = defaultdict(set)
        # channel -> latest tick data
        self._latest: dict[str, dict[str, Any]] = {}
        # channel -> circular buffer (last 500 ticks)
        self._buffer: dict[str, deque] = defaultdict(lambda: deque(maxlen=500))
        # throttle: channel -> last push timestamp
        self._last_push: dict[str, float] = {}
        # min interval between pushes per channel (250ms = 4 ticks/sec)
        self._throttle_interval = 0.25
        # pending throttled ticks (will be pushed on next interval)
        self._pending: dict[str, dict[str, Any]] = {}

        self._lock = asyncio.Lock()
        self._tasks: list[asyncio.Task] = []
        self._providers: list[Any] = []
        self._running = False
        self._heartbeat_task: asyncio.Task | None = None
        self._flush_task: asyncio.Task | None = None

        # Stats
        self._tick_count = 0
        self._stats_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start all providers and background tasks."""
        if self._running:
            return
        self._running = True
        logger.info("MarketHub starting...")

        # Import providers lazily to avoid circular imports
        from app.services.realtime.binance_ws import BinanceWSProvider
        from app.services.realtime.coingecko_provider import CoinGeckoPollingProvider
        from app.services.realtime.alert_engine import alert_engine

        binance = BinanceWSProvider(self)
        coingecko = CoinGeckoPollingProvider(self)
        self._providers = [binance, coingecko]

        # Start the alert engine (needs DB URL from config)
        try:
            from app.core.config import get_settings
            db_url = str(get_settings().DATABASE_URL)
            await alert_engine.start(db_url)
            self._alert_engine = alert_engine
            logger.info("AlertEngine integrated into MarketHub")
        except Exception as e:
            logger.warning("AlertEngine start failed (alerts disabled): %s", e)
            self._alert_engine = None

        for provider in self._providers:
            task = asyncio.create_task(provider.run(), name=f"provider-{provider.name}")
            self._tasks.append(task)

        # Heartbeat task — ping clients every 30s
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        # Flush task — push throttled pending ticks every 250ms
        self._flush_task = asyncio.create_task(self._flush_loop())
        # Stats logger
        self._stats_task = asyncio.create_task(self._stats_loop())

        logger.info(
            "MarketHub started — %d providers active", len(self._providers)
        )

    async def stop(self) -> None:
        """Gracefully stop all providers and tasks."""
        if not self._running:
            return
        self._running = False
        logger.info("MarketHub stopping...")

        for task in self._tasks:
            task.cancel()
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._flush_task:
            self._flush_task.cancel()
        if self._stats_task:
            self._stats_task.cancel()

        # Wait for tasks to finish
        all_tasks = self._tasks + [
            t for t in [self._heartbeat_task, self._flush_task, self._stats_task] if t
        ]
        await asyncio.gather(*all_tasks, return_exceptions=True)
        self._tasks.clear()
        self._providers.clear()

        # Close all client connections
        async with self._lock:
            all_clients: set[WebSocket] = set()
            for clients in self._subscriptions.values():
                all_clients.update(clients)
            for ws in all_clients:
                try:
                    await ws.close()
                except Exception:
                    pass
            self._subscriptions.clear()

        logger.info("MarketHub stopped.")

    async def subscribe(self, ws: WebSocket, channels: list[str]) -> None:
        """Subscribe a WebSocket client to one or more channels."""
        async with self._lock:
            for ch in channels:
                self._subscriptions[ch].add(ws)
                # Send snapshot immediately if available
                if ch in self._latest:
                    try:
                        await ws.send_json({
                            "type": "snapshot",
                            "channel": ch,
                            "data": self._latest[ch],
                        })
                    except Exception:
                        self._subscriptions[ch].discard(ws)

        logger.debug("Client subscribed to %d channels", len(channels))

    async def unsubscribe(self, ws: WebSocket, channels: list[str] | None = None) -> None:
        """Unsubscribe a client from specific channels or all channels."""
        async with self._lock:
            if channels:
                for ch in channels:
                    self._subscriptions[ch].discard(ws)
            else:
                # Remove from all channels
                for clients in self._subscriptions.values():
                    clients.discard(ws)

    async def on_tick(self, channel: str, data: dict[str, Any]) -> None:
        """
        Called by providers when a new tick arrives.
        Updates snapshot, buffer, and broadcasts to subscribers.
        Also evaluates alerts via the AlertEngine.
        """
        self._tick_count += 1

        # Update snapshot
        self._latest[channel] = data
        self._buffer[channel].append(data)

        # Evaluate alerts (non-blocking, fire-and-forget on error)
        if hasattr(self, '_alert_engine') and self._alert_engine:
            try:
                await self._alert_engine.evaluate(channel, data)
            except Exception:
                pass  # alert evaluation must never block the tick pipeline

        # Throttle: check if we should push now or defer
        now = time.monotonic()
        last = self._last_push.get(channel, 0)
        if now - last >= self._throttle_interval:
            # Push immediately
            self._last_push[channel] = now
            await self._broadcast(channel, data)
        else:
            # Defer — store as pending, will be flushed by _flush_loop
            self._pending[channel] = data

    async def _broadcast(self, channel: str, data: dict[str, Any]) -> None:
        """Send tick to all subscribers of a channel."""
        message = json.dumps({
            "type": "tick",
            "channel": channel,
            "data": data,
            "ts": int(time.time() * 1000),
        })

        dead: list[WebSocket] = []
        subscribers = self._subscriptions.get(channel, set()).copy()

        for ws in subscribers:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        # Clean up dead connections
        if dead:
            async with self._lock:
                for ws in dead:
                    self._subscriptions[channel].discard(ws)

    async def _flush_loop(self) -> None:
        """Periodically flush pending throttled ticks."""
        while self._running:
            try:
                await asyncio.sleep(self._throttle_interval)
                if not self._pending:
                    continue
                # Grab and clear pending
                to_flush = dict(self._pending)
                self._pending.clear()
                now = time.monotonic()
                for channel, data in to_flush.items():
                    self._last_push[channel] = now
                    await self._broadcast(channel, data)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Flush loop error: %s", e)

    async def _heartbeat_loop(self) -> None:
        """Send heartbeat pings to all connected clients every 30s."""
        while self._running:
            try:
                await asyncio.sleep(30)
                hb = json.dumps({"type": "heartbeat", "ts": int(time.time() * 1000)})
                dead: list[tuple[str, WebSocket]] = []
                async with self._lock:
                    for channel, clients in self._subscriptions.items():
                        for ws in clients:
                            try:
                                await ws.send_text(hb)
                            except Exception:
                                dead.append((channel, ws))
                    for channel, ws in dead:
                        self._subscriptions[channel].discard(ws)
                if dead:
                    logger.debug("Heartbeat: removed %d dead clients", len(dead))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Heartbeat error: %s", e)

    async def _stats_loop(self) -> None:
        """Log stats every 60 seconds."""
        while self._running:
            try:
                await asyncio.sleep(60)
                client_count = sum(len(c) for c in self._subscriptions.values())
                channel_count = len([
                    ch for ch, clients in self._subscriptions.items() if clients
                ])
                logger.info(
                    "MarketHub stats: %d clients, %d channels, %d ticks total",
                    client_count, channel_count, self._tick_count,
                )
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    def get_snapshot(self, symbols: list[str] | None = None) -> dict[str, Any]:
        """
        Return current price snapshot for given symbols (or all).
        Used by the REST /market/live/snapshot endpoint.
        """
        if symbols is None:
            return dict(self._latest)
        return {s: self._latest[s] for s in symbols if s in self._latest}

    @property
    def active_channels(self) -> list[str]:
        """Channels that have at least one subscriber."""
        return [ch for ch, clients in self._subscriptions.items() if clients]

    @property
    def client_count(self) -> int:
        """Total number of unique connected clients."""
        all_clients: set[int] = set()
        for clients in self._subscriptions.values():
            all_clients.update(id(ws) for ws in clients)
        return len(all_clients)


# Global singleton
market_hub = MarketHub()
