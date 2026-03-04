"""
OmniFlow — Binance API client.
Reads spot, earn & staking balances using real Binance REST API.
Uses HMAC-SHA256 signed requests.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Any
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

BINANCE_BASE = "https://api.binance.com"


class BinanceClient:
    """Production Binance API client (read-only operations)."""

    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret

    def _sign(self, params: dict[str, Any]) -> dict[str, Any]:
        """Add timestamp + HMAC-SHA256 signature to params."""
        params["timestamp"] = int(time.time() * 1000)
        query = urlencode(params)
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            query.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        params["signature"] = signature
        return params

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        signed: bool = True,
    ) -> Any:
        """Execute an authenticated Binance API request."""
        url = f"{BINANCE_BASE}{path}"
        params = params or {}

        if signed:
            params = self._sign(params)

        headers = {"X-MBX-APIKEY": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                if method == "GET":
                    resp = await client.get(url, params=params, headers=headers)
                else:
                    resp = await client.post(url, data=params, headers=headers)

                if resp.status_code != 200:
                    error_msg = resp.text[:500]
                    logger.error("Binance API error %d: %s", resp.status_code, error_msg)
                    # Parse Binance error for user-friendly messages
                    try:
                        err_data = resp.json()
                        binance_msg = err_data.get("msg", error_msg)
                        binance_code = err_data.get("code", resp.status_code)
                        raise RuntimeError(
                            f"Binance erreur {binance_code}: {binance_msg}"
                        )
                    except (ValueError, KeyError):
                        raise RuntimeError(
                            f"Binance API erreur {resp.status_code}: {error_msg}"
                        )

                return resp.json()

        except httpx.ConnectError as e:
            logger.error("Binance connection failed: %s", e)
            raise RuntimeError(
                "Impossible de se connecter à Binance. "
                "Vérifiez votre connexion internet ou réessayez plus tard."
            ) from e
        except httpx.TimeoutException as e:
            logger.error("Binance request timed out: %s", e)
            raise RuntimeError(
                "Délai d'attente dépassé pour Binance. "
                "Le serveur met trop de temps à répondre."
            ) from e
        except httpx.RequestError as e:
            logger.error("Binance request error: %s", e)
            raise RuntimeError(
                f"Erreur réseau Binance : {type(e).__name__}. "
                "Vérifiez votre connexion."
            ) from e

    async def get_spot_balances(self) -> list[dict[str, Any]]:
        """
        Get all spot wallet balances with non-zero amounts.
        Returns [{asset: "BTC", free: "0.123", locked: "0.001"}, ...]
        """
        data = await self._request("GET", "/api/v3/account")
        balances = []
        for b in data.get("balances", []):
            free = float(b.get("free", 0))
            locked = float(b.get("locked", 0))
            total = free + locked
            if total > 0.000001:
                balances.append({
                    "asset": b["asset"],
                    "free": free,
                    "locked": locked,
                    "total": total,
                })
        return balances

    async def get_earn_positions(self) -> list[dict[str, Any]]:
        """Get Simple Earn flexible positions."""
        try:
            data = await self._request("GET", "/sapi/v1/simple-earn/flexible/position", {"size": 100})
            positions = []
            for row in data.get("rows", []):
                total = float(row.get("totalAmount", 0))
                if total > 0.000001:
                    positions.append({
                        "asset": row.get("asset", ""),
                        "total": total,
                        "apy": float(row.get("latestAnnualPercentageRate", 0)),
                        "type": "earn_flexible",
                    })
            return positions
        except Exception as e:
            logger.warning("Binance Earn fetch failed (may not be enabled): %s", e)
            return []

    async def get_staking_positions(self) -> list[dict[str, Any]]:
        """Get locked staking positions."""
        try:
            data = await self._request("GET", "/sapi/v1/simple-earn/locked/position", {"size": 100})
            positions = []
            for row in data.get("rows", []):
                total = float(row.get("amount", 0))
                if total > 0.000001:
                    positions.append({
                        "asset": row.get("asset", ""),
                        "total": total,
                        "apy": float(row.get("apy", 0)),
                        "type": "staking",
                        "lock_period": row.get("duration", 0),
                    })
            return positions
        except Exception as e:
            logger.warning("Binance Staking fetch failed: %s", e)
            return []

    async def get_all_holdings(self) -> list[dict[str, Any]]:
        """
        Aggregate all holdings (spot + earn + staking) by asset.
        Returns [{asset: str, quantity: float, sources: [str]}]
        """
        spot = await self.get_spot_balances()
        earn = await self.get_earn_positions()
        staking = await self.get_staking_positions()

        aggregated: dict[str, dict[str, Any]] = {}

        for b in spot:
            asset = b["asset"]
            if asset not in aggregated:
                aggregated[asset] = {"asset": asset, "quantity": 0.0, "sources": []}
            aggregated[asset]["quantity"] += b["total"]
            aggregated[asset]["sources"].append("spot")

        for p in earn:
            asset = p["asset"]
            if asset not in aggregated:
                aggregated[asset] = {"asset": asset, "quantity": 0.0, "sources": []}
            aggregated[asset]["quantity"] += p["total"]
            aggregated[asset]["sources"].append("earn")

        for s in staking:
            asset = s["asset"]
            if asset not in aggregated:
                aggregated[asset] = {"asset": asset, "quantity": 0.0, "sources": []}
            aggregated[asset]["quantity"] += s["total"]
            aggregated[asset]["sources"].append("staking")

        # Filter stablecoins and dust (< $0.01 equivalent — we just filter very small amounts)
        return [
            h for h in aggregated.values()
            if h["quantity"] > 0.000001
        ]
