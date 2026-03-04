"""
OmniFlow — CoinGecko API client.
Free API for real-time crypto prices. Cache in Redis 60s.
https://www.coingecko.com/en/api/documentation
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
PRICE_CACHE_TTL = 60  # seconds
SPARKLINE_CACHE_TTL = 300  # 5 min

# Symbol → CoinGecko ID mapping (most common tokens)
_SYMBOL_TO_ID: dict[str, str] = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "BNB": "binancecoin",
    "SOL": "solana",
    "ADA": "cardano",
    "DOT": "polkadot",
    "AVAX": "avalanche-2",
    "MATIC": "matic-network",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "AAVE": "aave",
    "CRV": "curve-dao-token",
    "MKR": "maker",
    "COMP": "compound-governance-token",
    "SNX": "havven",
    "ATOM": "cosmos",
    "NEAR": "near",
    "FTM": "fantom",
    "ALGO": "algorand",
    "XRP": "ripple",
    "DOGE": "dogecoin",
    "SHIB": "shiba-inu",
    "LTC": "litecoin",
    "BCH": "bitcoin-cash",
    "XLM": "stellar",
    "USDT": "tether",
    "USDC": "usd-coin",
    "DAI": "dai",
    "BUSD": "binance-usd",
    "ARB": "arbitrum",
    "OP": "optimism",
    "APT": "aptos",
    "SUI": "sui",
    "SEI": "sei-network",
    "TIA": "celestia",
    "INJ": "injective-protocol",
    "RENDER": "render-token",
    "FET": "fetch-ai",
    "PEPE": "pepe",
    "WIF": "dogwifcoin",
    "BONK": "bonk",
}


def symbol_to_coingecko_id(symbol: str) -> str | None:
    """Convert a token symbol to CoinGecko ID."""
    return _SYMBOL_TO_ID.get(symbol.upper())


async def get_prices(
    symbols: list[str],
    vs_currency: str = "eur",
) -> dict[str, dict[str, Any]]:
    """
    Get current prices for multiple tokens.
    Returns {symbol: {price_eur: int (centimes), change_24h: float, market_cap: int}}.
    Uses Redis cache (60s TTL).
    """
    cache_key = f"coingecko:prices:{vs_currency}:{','.join(sorted(s.upper() for s in symbols))}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Map symbols to CoinGecko IDs
    id_map: dict[str, str] = {}
    for sym in symbols:
        cg_id = symbol_to_coingecko_id(sym)
        if cg_id:
            id_map[sym.upper()] = cg_id

    if not id_map:
        return {}

    ids_str = ",".join(id_map.values())
    url = f"{COINGECKO_BASE}/simple/price"
    params = {
        "ids": ids_str,
        "vs_currencies": vs_currency,
        "include_24hr_change": "true",
        "include_market_cap": "true",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko price fetch failed: %s", e)
        return {}

    result: dict[str, dict[str, Any]] = {}
    id_to_sym = {v: k for k, v in id_map.items()}

    for cg_id, prices in data.items():
        sym = id_to_sym.get(cg_id)
        if not sym:
            continue
        price = prices.get(vs_currency, 0)
        result[sym] = {
            "price_centimes": int(price * 100),
            "change_24h": prices.get(f"{vs_currency}_24h_change", 0.0),
            "market_cap": int(prices.get(f"{vs_currency}_market_cap", 0)),
        }

    await redis_client.set(cache_key, json.dumps(result), ex=PRICE_CACHE_TTL)
    return result


async def get_sparkline(
    symbol: str,
    days: int = 7,
    vs_currency: str = "eur",
) -> list[float]:
    """
    Get 7-day sparkline (hourly prices) for a token.
    Returns list of prices in base currency.
    """
    cache_key = f"coingecko:sparkline:{symbol.upper()}:{days}:{vs_currency}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    cg_id = symbol_to_coingecko_id(symbol)
    if not cg_id:
        return []

    url = f"{COINGECKO_BASE}/coins/{cg_id}/market_chart"
    params = {"vs_currency": vs_currency, "days": str(days)}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko sparkline fetch failed: %s", e)
        return []

    prices = [p[1] for p in data.get("prices", [])]

    await redis_client.set(cache_key, json.dumps(prices), ex=SPARKLINE_CACHE_TTL)
    return prices


async def search_token(query: str) -> list[dict[str, str]]:
    """Search tokens by name or symbol on CoinGecko."""
    cache_key = f"coingecko:search:{query.lower()}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/search"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"query": query})
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko search failed: %s", e)
        return []

    coins = [
        {
            "id": c["id"],
            "symbol": c["symbol"].upper(),
            "name": c["name"],
            "thumb": c.get("thumb", ""),
        }
        for c in data.get("coins", [])[:20]
    ]

    await redis_client.set(cache_key, json.dumps(coins), ex=600)
    return coins
