"""
OmniFlow — Currency Service.
ECB daily exchange rates with Redis cache (24h).
Automatic conversion to base currency (EUR).
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

ECB_RATES_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?lastNObservations=1&format=jsondata"
FALLBACK_RATES_URL = "https://api.exchangerate-api.com/v4/latest/EUR"
CACHE_TTL = 86400  # 24h
CACHE_KEY = "ecb:rates:eur"

# Fallback rates if external APIs are unavailable
_FALLBACK_RATES: dict[str, float] = {
    "USD": 1.08,
    "GBP": 0.86,
    "CHF": 0.96,
    "JPY": 162.0,
    "CAD": 1.47,
    "AUD": 1.65,
    "SEK": 11.2,
    "NOK": 11.5,
    "DKK": 7.46,
    "PLN": 4.32,
    "CZK": 25.2,
    "HUF": 395.0,
    "TRY": 35.5,
    "BRL": 5.35,
    "CNY": 7.85,
    "INR": 91.0,
    "KRW": 1430.0,
}


async def get_rates(base: str = "EUR") -> dict[str, float]:
    """
    Get current exchange rates with EUR as base.
    Returns {USD: 1.08, GBP: 0.86, ...}.
    Tries ECB first, falls back to exchangerate-api.
    """
    cached = await redis_client.get(CACHE_KEY)
    if cached:
        return json.loads(cached)

    rates = await _fetch_ecb_rates()
    if not rates:
        rates = await _fetch_fallback_rates()
    if not rates:
        rates = _FALLBACK_RATES.copy()
        logger.warning("Using hardcoded fallback exchange rates")

    # Always include EUR → EUR = 1.0
    rates["EUR"] = 1.0

    await redis_client.set(CACHE_KEY, json.dumps(rates), ex=CACHE_TTL)
    return rates


async def _fetch_ecb_rates() -> dict[str, float] | None:
    """Fetch rates from ECB Statistical Data Warehouse API."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(ECB_RATES_URL)
            resp.raise_for_status()
            data = resp.json()

        rates: dict[str, float] = {}

        # Parse ECB JSON-data format
        structure = data.get("structure", {})
        dimensions = structure.get("dimensions", {}).get("series", [])
        observations = data.get("dataSets", [{}])[0].get("series", {})

        # Find the currency dimension
        currency_dim = None
        for dim in dimensions:
            if dim.get("id") == "CURRENCY":
                currency_dim = dim
                break

        if not currency_dim:
            return None

        currencies = currency_dim.get("values", [])

        for key, series in observations.items():
            parts = key.split(":")
            if len(parts) < 2:
                continue
            currency_idx = int(parts[1])
            if currency_idx < len(currencies):
                currency = currencies[currency_idx]["id"]
                obs = series.get("observations", {})
                if obs:
                    last_obs = list(obs.values())[-1]
                    if last_obs and len(last_obs) > 0:
                        rates[currency] = float(last_obs[0])

        return rates if rates else None

    except Exception as e:
        logger.warning("ECB rates fetch failed: %s", e)
        return None


async def _fetch_fallback_rates() -> dict[str, float] | None:
    """Fallback: fetch from exchangerate-api.com (free, no auth)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(FALLBACK_RATES_URL)
            resp.raise_for_status()
            data = resp.json()
        return data.get("rates", {})
    except Exception as e:
        logger.warning("Fallback rates fetch failed: %s", e)
        return None


def convert(amount_centimes: int, from_currency: str, to_currency: str, rates: dict[str, float]) -> int:
    """
    Convert an amount in centimes from one currency to another.
    All rates are relative to EUR.
    """
    if from_currency == to_currency:
        return amount_centimes

    # Convert to EUR first, then to target
    from_rate = rates.get(from_currency, 1.0)
    to_rate = rates.get(to_currency, 1.0)

    eur_amount = amount_centimes / from_rate
    return int(eur_amount * to_rate)


async def convert_to_eur(amount_centimes: int, from_currency: str) -> int:
    """Convert any currency amount to EUR centimes."""
    if from_currency == "EUR":
        return amount_centimes
    rates = await get_rates()
    return convert(amount_centimes, from_currency, "EUR", rates)
