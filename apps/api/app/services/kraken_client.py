"""
OmniFlow — Kraken API client.
Reads spot & staking balances using real Kraken REST API.
Uses HMAC-SHA512 signed requests.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import time
from typing import Any
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

KRAKEN_BASE = "https://api.kraken.com"

# Kraken uses different asset names
_KRAKEN_RENAME: dict[str, str] = {
    "XXBT": "BTC",
    "XETH": "ETH",
    "XXRP": "XRP",
    "XXLM": "XLM",
    "XLTC": "LTC",
    "XDOGE": "DOGE",
    "ZUSD": "USD",
    "ZEUR": "EUR",
    "ZGBP": "GBP",
    "ZJPY": "JPY",
    "XXDG": "DOGE",
}


def _normalize_asset(kraken_name: str) -> str:
    """Normalize Kraken asset names to standard symbols."""
    return _KRAKEN_RENAME.get(kraken_name, kraken_name)


class KrakenClient:
    """Production Kraken API client (read-only operations)."""

    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = base64.b64decode(api_secret)

    def _sign(self, path: str, data: dict[str, Any]) -> dict[str, str]:
        """Generate Kraken API-Sign header."""
        nonce = str(int(time.time() * 1000))
        data["nonce"] = nonce

        post_data = urlencode(data)
        encoded = (nonce + post_data).encode("utf-8")

        message = path.encode("utf-8") + hashlib.sha256(encoded).digest()
        signature = hmac.new(self.api_secret, message, hashlib.sha512)

        return {
            "API-Key": self.api_key,
            "API-Sign": base64.b64encode(signature.digest()).decode("utf-8"),
        }

    async def _request(self, path: str, data: dict[str, Any] | None = None) -> Any:
        """Execute a signed Kraken API request (always POST for private endpoints)."""
        url = f"{KRAKEN_BASE}{path}"
        data = data or {}

        headers = self._sign(path, data)
        headers["Content-Type"] = "application/x-www-form-urlencoded"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, data=urlencode(data), headers=headers)

            if resp.status_code != 200:
                logger.error("Kraken API error %d: %s", resp.status_code, resp.text[:500])
                raise RuntimeError(f"Kraken API error {resp.status_code}")

            result = resp.json()
            errors = result.get("error", [])
            if errors:
                logger.error("Kraken API errors: %s", errors)
                raise RuntimeError(f"Kraken errors: {', '.join(errors)}")

            return result.get("result", {})

    async def get_balances(self) -> list[dict[str, Any]]:
        """
        Get all account balances (spot + staking combined).
        Returns [{asset: str, quantity: float}]
        """
        data = await self._request("/0/private/Balance")

        balances = []
        for asset, amount in data.items():
            qty = float(amount)
            if qty > 0.000001:
                normalized = _normalize_asset(asset)
                # Skip fiat and staking suffixes — aggregate them
                is_staking = asset.endswith(".S") or asset.endswith(".M")
                base_symbol = normalized.replace(".S", "").replace(".M", "")

                balances.append({
                    "asset": base_symbol,
                    "quantity": qty,
                    "source": "staking" if is_staking else "spot",
                })

        # Aggregate by symbol
        aggregated: dict[str, dict[str, Any]] = {}
        for b in balances:
            sym = b["asset"]
            if sym not in aggregated:
                aggregated[sym] = {"asset": sym, "quantity": 0.0, "sources": []}
            aggregated[sym]["quantity"] += b["quantity"]
            if b["source"] not in aggregated[sym]["sources"]:
                aggregated[sym]["sources"].append(b["source"])

        return list(aggregated.values())

    async def get_staking_info(self) -> list[dict[str, Any]]:
        """Get staking transactions (pending and active)."""
        try:
            data = await self._request("/0/private/Staking/Pending")
            return [
                {
                    "asset": _normalize_asset(item.get("asset", "")),
                    "amount": float(item.get("amount", 0)),
                    "status": item.get("status", ""),
                    "type": item.get("type", ""),
                }
                for item in data.values()
                if isinstance(item, dict)
            ]
        except Exception as e:
            logger.warning("Kraken staking info fetch failed: %s", e)
            return []
