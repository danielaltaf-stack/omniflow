"""
OmniFlow — WebSocket endpoint for real-time market data.

Clients connect, subscribe to channels (crypto:BTC, stock:AAPL, index:^FCHI),
and receive live price ticks. No authentication required (public market data).
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from app.services.realtime.market_hub import market_hub

logger = logging.getLogger("omniflow.ws_markets")

router = APIRouter()


@router.websocket("/ws/markets")
async def websocket_markets(websocket: WebSocket):
    """
    Real-time market data WebSocket.

    Protocol:
    1. Client connects (no auth needed — public data).
    2. Client sends: {"action": "subscribe", "channels": ["crypto:BTC", "stock:AAPL"]}
    3. Server pushes: {"type": "tick", "channel": "crypto:BTC", "data": {...}, "ts": 123}
    4. Client can: {"action": "unsubscribe", "channels": ["crypto:BTC"]}
    5. Server sends heartbeat every 30s: {"type": "heartbeat", "ts": 123}
    """
    await websocket.accept()
    logger.debug("Market WS client connected")

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON",
                })
                continue

            action = msg.get("action")
            channels = msg.get("channels", [])

            if not isinstance(channels, list):
                channels = [channels] if channels else []

            # Validate channels format
            valid_channels = []
            for ch in channels:
                if isinstance(ch, str) and ":" in ch:
                    prefix = ch.split(":")[0]
                    if prefix in ("crypto", "stock", "index"):
                        valid_channels.append(ch)

            if action == "subscribe" and valid_channels:
                await market_hub.subscribe(websocket, valid_channels)
                await websocket.send_json({
                    "type": "subscribed",
                    "channels": valid_channels,
                })

            elif action == "unsubscribe" and valid_channels:
                await market_hub.unsubscribe(websocket, valid_channels)
                await websocket.send_json({
                    "type": "unsubscribed",
                    "channels": valid_channels,
                })

            elif action == "ping":
                await websocket.send_json({"type": "pong", "ts": msg.get("ts")})

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown action: {action}. Use subscribe/unsubscribe/ping.",
                })

    except WebSocketDisconnect:
        logger.debug("Market WS client disconnected")
    except Exception as e:
        logger.debug("Market WS error: %s", str(e)[:100])
    finally:
        await market_hub.unsubscribe(websocket)


@router.get("/market/live/snapshot")
async def market_snapshot(
    symbols: Optional[str] = Query(
        None,
        description="Comma-separated channels: crypto:BTC,stock:AAPL,index:^FCHI"
    ),
):
    """
    REST fallback: get latest price snapshot for given symbols.
    Used for SSR hydration and when WebSocket is unavailable.
    
    Example: GET /api/v1/market/live/snapshot?symbols=crypto:BTC,crypto:ETH
    """
    if symbols:
        channel_list = [s.strip() for s in symbols.split(",") if s.strip()]
    else:
        channel_list = None

    snapshot = market_hub.get_snapshot(channel_list)

    return {
        "data": snapshot,
        "channels_active": len(market_hub.active_channels),
        "clients_connected": market_hub.client_count,
    }
