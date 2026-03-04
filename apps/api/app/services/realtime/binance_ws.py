"""
OmniFlow — Binance WebSocket Provider.

Connects to Binance combined streams for real-time crypto prices.
No API key required. Supports dynamic subscribe/unsubscribe.
Top 20 crypto pairs always active; additional pairs on-demand.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import TYPE_CHECKING

import websockets
from websockets.exceptions import ConnectionClosed

if TYPE_CHECKING:
    from app.services.realtime.market_hub import MarketHub

logger = logging.getLogger("omniflow.binance_ws")

# Top 20 crypto pairs — always subscribed
BASE_SYMBOLS = [
    "btc", "eth", "bnb", "sol", "xrp", "ada", "doge", "avax", "dot", "link",
    "matic", "uni", "atom", "ltc", "fil", "near", "apt", "arb", "op", "inj",
]

BINANCE_WS_URL = "wss://stream.binance.com:9443/stream"


class BinanceWSProvider:
    """
    Connects to Binance combined streams and pushes normalized ticks
    to the MarketHub.
    """

    name = "binance"

    def __init__(self, hub: MarketHub) -> None:
        self._hub = hub
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._retry_count = 0
        self._max_backoff = 30.0
        self._running = True
        self._sub_id = 1

    async def run(self) -> None:
        """Main loop: connect, receive messages, reconnect on failure."""
        while self._running:
            try:
                await self._connect_and_listen()
            except asyncio.CancelledError:
                logger.info("BinanceWS provider cancelled")
                break
            except Exception as e:
                self._retry_count += 1
                backoff = min(2 ** self._retry_count, self._max_backoff)
                # Add jitter ±20%
                import random
                jitter = backoff * 0.2 * (2 * random.random() - 1)
                wait = backoff + jitter
                logger.warning(
                    "BinanceWS disconnected (attempt %d): %s — reconnecting in %.1fs",
                    self._retry_count, str(e)[:100], wait,
                )
                await asyncio.sleep(wait)

    async def _connect_and_listen(self) -> None:
        """Connect to Binance and process messages."""
        # Build initial stream list
        streams = []
        for sym in BASE_SYMBOLS:
            streams.append(f"{sym}usdt@miniTicker")

        stream_param = "/".join(streams)
        url = f"{BINANCE_WS_URL}?streams={stream_param}"

        logger.info(
            "Connecting to Binance WS with %d streams...", len(streams)
        )

        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
            max_size=2**20,  # 1MB max message
        ) as ws:
            self._ws = ws
            self._retry_count = 0  # Reset on successful connect
            logger.info("Binance WS connected — %d streams active", len(streams))

            async for raw_msg in ws:
                try:
                    msg = json.loads(raw_msg)
                    await self._handle_message(msg)
                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.debug("BinanceWS message handling error: %s", e)

    async def _handle_message(self, msg: dict) -> None:
        """Parse Binance combined stream message and push to hub."""
        # Combined stream format: {"stream": "btcusdt@miniTicker", "data": {...}}
        data = msg.get("data")
        if not data:
            return

        event_type = data.get("e")

        if event_type == "24hrMiniTicker":
            await self._handle_mini_ticker(data)

    async def _handle_mini_ticker(self, data: dict) -> None:
        """Process 24hrMiniTicker event."""
        raw_symbol = data.get("s", "")  # e.g. "BTCUSDT"
        if not raw_symbol.endswith("USDT"):
            return

        symbol = raw_symbol.replace("USDT", "")
        channel = f"crypto:{symbol}"

        try:
            close_price = float(data.get("c", 0))
            open_price = float(data.get("o", 0))
            high_price = float(data.get("h", 0))
            low_price = float(data.get("l", 0))
            volume = float(data.get("v", 0))
            quote_volume = float(data.get("q", 0))

            # Calculate 24h change percentage
            change_pct = 0.0
            if open_price > 0:
                change_pct = round(((close_price - open_price) / open_price) * 100, 3)

            tick = {
                "symbol": symbol,
                "price": close_price,
                "open_24h": open_price,
                "high_24h": high_price,
                "low_24h": low_price,
                "volume_24h": volume,
                "quote_volume_24h": quote_volume,
                "change_pct_24h": change_pct,
                "source": "binance",
                "ts": int(time.time() * 1000),
            }

            await self._hub.on_tick(channel, tick)

        except (ValueError, TypeError) as e:
            logger.debug("Failed to parse miniTicker for %s: %s", raw_symbol, e)

    async def subscribe_symbol(self, symbol: str) -> None:
        """Dynamically subscribe to a new symbol's streams."""
        if not self._ws:
            return
        sym = symbol.lower()
        params = [f"{sym}usdt@miniTicker"]
        try:
            await self._ws.send(json.dumps({
                "method": "SUBSCRIBE",
                "params": params,
                "id": self._sub_id,
            }))
            self._sub_id += 1
            logger.debug("Subscribed to Binance stream: %s", sym)
        except Exception as e:
            logger.warning("Failed to subscribe %s: %s", sym, e)

    async def unsubscribe_symbol(self, symbol: str) -> None:
        """Dynamically unsubscribe from a symbol's streams."""
        if not self._ws:
            return
        sym = symbol.lower()
        params = [f"{sym}usdt@miniTicker"]
        try:
            await self._ws.send(json.dumps({
                "method": "UNSUBSCRIBE",
                "params": params,
                "id": self._sub_id,
            }))
            self._sub_id += 1
        except Exception:
            pass
