"""
OmniFlow — Unified Price Service.
Tries CoinGecko first, then falls back to Binance public API.
Binance public ticker requires NO authentication and is not IP-blocked.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.redis import redis_client
from app.services import coingecko

logger = logging.getLogger(__name__)

BINANCE_BASE = "https://api.binance.com"
_PRICE_CACHE_TTL = 60  # seconds


async def _get_binance_eur_rate() -> float:
    """Get EUR/USDT rate from Binance to convert USDT prices to EUR."""
    cache_key = "price:eurusdt"
    cached = await redis_client.get(cache_key)
    if cached:
        return float(cached)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{BINANCE_BASE}/api/v3/ticker/price",
                params={"symbol": "EURUSDT"},
            )
            if resp.status_code == 200:
                rate = float(resp.json()["price"])
                await redis_client.set(cache_key, str(rate), ex=_PRICE_CACHE_TTL)
                return rate
    except Exception as e:
        logger.warning("[PriceService] Failed to get EUR/USDT rate: %s", e)
    return 0.0


async def _get_binance_prices(
    symbols: list[str],
    vs_currency: str = "eur",
) -> dict[str, dict[str, Any]]:
    """
    Fallback: get prices from Binance public ticker API (no auth needed).
    Converts to EUR via EURUSDT.
    Returns {SYMBOL: {price_centimes: int, change_24h: float, market_cap: 0}}.
    """
    cache_key = f"binance:prices:{vs_currency}:{','.join(sorted(s.upper() for s in symbols))}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Get EUR conversion rate
    eur_rate = await _get_binance_eur_rate()
    if eur_rate <= 0:
        logger.error("[PriceService] Cannot get EUR/USDT rate — Binance fallback unavailable")
        return {}

    # Fetch all ticker prices in one call
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Get 24h ticker for price + change
            resp = await client.get(f"{BINANCE_BASE}/api/v3/ticker/24hr")
            if resp.status_code != 200:
                logger.error("[PriceService] Binance ticker error: %d", resp.status_code)
                return {}
            all_tickers = resp.json()
    except Exception as e:
        logger.error("[PriceService] Binance ticker fetch failed: %s", e)
        return {}

    # Build lookup: BTCUSDT → ticker data
    usdt_tickers: dict[str, dict] = {}
    for t in all_tickers:
        sym = t.get("symbol", "")
        if sym.endswith("USDT"):
            base = sym[:-4]  # Remove "USDT" suffix
            usdt_tickers[base] = t

    result: dict[str, dict[str, Any]] = {}
    for sym in symbols:
        s = sym.upper()
        # Stablecoins: 1 USD ≈ 1/EUR_RATE EUR
        if s in ("USDT", "USDC", "BUSD", "FDUSD", "DAI", "TUSD"):
            eur_price = 1.0 / eur_rate
            result[s] = {
                "price_centimes": int(eur_price * 100),
                "change_24h": 0.0,
                "market_cap": 0,
            }
            continue

        ticker = usdt_tickers.get(s)
        if not ticker:
            continue

        try:
            price_usdt = float(ticker.get("lastPrice", 0))
            price_eur = price_usdt / eur_rate
            change_24h = float(ticker.get("priceChangePercent", 0))

            result[s] = {
                "price_centimes": int(price_eur * 100),
                "change_24h": change_24h,
                "market_cap": 0,  # Binance doesn't provide market cap
            }
        except (ValueError, TypeError, ZeroDivisionError):
            continue

    if result:
        await redis_client.set(cache_key, json.dumps(result), ex=_PRICE_CACHE_TTL)
        logger.info(
            "[PriceService] Binance fallback: got prices for %d/%d symbols",
            len(result), len(symbols),
        )

    return result


async def get_prices(
    symbols: list[str],
    vs_currency: str = "eur",
) -> dict[str, dict[str, Any]]:
    """
    Get crypto prices with automatic fallback.
    1. Try CoinGecko (preferred — has market cap, more data)
    2. Fall back to Binance public API (always works, no auth)
    """
    if not symbols:
        return {}

    # Try CoinGecko first
    prices = await coingecko.get_prices(symbols, vs_currency)

    if prices:
        # Check if we got prices for most symbols
        missing = [s.upper() for s in symbols if s.upper() not in prices]
        if missing:
            logger.info(
                "[PriceService] CoinGecko missing %s — trying Binance fallback",
                missing,
            )
            fallback = await _get_binance_prices(missing, vs_currency)
            prices.update(fallback)
        return prices

    # CoinGecko returned nothing — full fallback to Binance
    logger.warning(
        "[PriceService] CoinGecko returned empty — using Binance fallback for %s",
        symbols,
    )
    return await _get_binance_prices(symbols, vs_currency)
