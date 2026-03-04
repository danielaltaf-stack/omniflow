"""
OmniFlow — Etherscan API client.
Reads ETH balance + ERC-20 token balances for a given public address.
https://docs.etherscan.io/api-endpoints
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

ETHERSCAN_BASE = "https://api.etherscan.io/api"
CACHE_TTL = 120  # 2 minutes

# Top ERC-20 token contracts → symbol mapping
_TOP_ERC20: dict[str, dict[str, Any]] = {
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": {"symbol": "USDT", "name": "Tether USD", "decimals": 6},
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {"symbol": "USDC", "name": "USD Coin", "decimals": 6},
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": {"symbol": "DAI", "name": "Dai", "decimals": 18},
    "0x514910771AF9Ca656af840dff83E8264EcF986CA": {"symbol": "LINK", "name": "Chainlink", "decimals": 18},
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": {"symbol": "UNI", "name": "Uniswap", "decimals": 18},
    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9": {"symbol": "AAVE", "name": "Aave", "decimals": 18},
    "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2": {"symbol": "MKR", "name": "Maker", "decimals": 18},
    "0xc00e94Cb662C3520282E6f5717214004A7f26888": {"symbol": "COMP", "name": "Compound", "decimals": 18},
    "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F": {"symbol": "SNX", "name": "Synthetix", "decimals": 18},
    "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE": {"symbol": "SHIB", "name": "Shiba Inu", "decimals": 18},
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": {"symbol": "WBTC", "name": "Wrapped Bitcoin", "decimals": 8},
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {"symbol": "WETH", "name": "Wrapped Ether", "decimals": 18},
    "0x6982508145454Ce325dDbE47a25d4ec3d2311933": {"symbol": "PEPE", "name": "Pepe", "decimals": 18},
    "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1": {"symbol": "ARB", "name": "Arbitrum", "decimals": 18},
}


class EtherscanClient:
    """Production Etherscan API client for ETH + ERC-20 balances."""

    def __init__(self, address: str, api_key: str | None = None):
        self.address = address
        self.api_key = api_key or getattr(get_settings(), "ETHERSCAN_API_KEY", "")

    async def _request(self, params: dict[str, str]) -> Any:
        """Execute an Etherscan API request."""
        if self.api_key:
            params["apikey"] = self.api_key

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(ETHERSCAN_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "1" and data.get("message") != "No transactions found":
            msg = data.get("result", data.get("message", "Unknown error"))
            if isinstance(msg, str) and "rate limit" in msg.lower():
                logger.warning("Etherscan rate limited")
                raise RuntimeError("Etherscan rate limit reached")
            # Some queries return status "0" with empty results, not an error
            if data.get("result") == []:
                return []
            logger.warning("Etherscan API: status=%s, message=%s", data.get("status"), msg)

        return data.get("result")

    async def get_eth_balance(self) -> dict[str, Any]:
        """Get ETH balance for the address."""
        cache_key = f"etherscan:eth:{self.address}"
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        result = await self._request({
            "module": "account",
            "action": "balance",
            "address": self.address,
            "tag": "latest",
        })

        # Result is in Wei (1 ETH = 10^18 Wei)
        wei = int(result) if isinstance(result, str) else 0
        eth = wei / 1e18

        balance = {
            "asset": "ETH",
            "name": "Ethereum",
            "quantity": eth,
            "wei": wei,
        }

        await redis_client.set(cache_key, json.dumps(balance), ex=CACHE_TTL)
        return balance

    async def get_erc20_balances(self) -> list[dict[str, Any]]:
        """Get ERC-20 token balances for top tokens."""
        cache_key = f"etherscan:erc20:{self.address}"
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        balances = []

        for contract, info in _TOP_ERC20.items():
            try:
                result = await self._request({
                    "module": "account",
                    "action": "tokenbalance",
                    "contractaddress": contract,
                    "address": self.address,
                    "tag": "latest",
                })
                raw = int(result) if isinstance(result, str) else 0
                quantity = raw / (10 ** info["decimals"])
                if quantity > 0.000001:
                    balances.append({
                        "asset": info["symbol"],
                        "name": info["name"],
                        "quantity": quantity,
                        "contract": contract,
                    })
            except Exception as e:
                logger.warning("ERC-20 balance check failed for %s: %s", info["symbol"], e)
                continue

        await redis_client.set(cache_key, json.dumps(balances), ex=CACHE_TTL)
        return balances

    async def get_all_holdings(self) -> list[dict[str, Any]]:
        """Get ETH + all ERC-20 token balances."""
        eth = await self.get_eth_balance()
        erc20s = await self.get_erc20_balances()

        holdings = []
        if eth["quantity"] > 0.000001:
            holdings.append({
                "asset": "ETH",
                "name": "Ethereum",
                "quantity": eth["quantity"],
                "sources": ["on-chain"],
            })

        for token in erc20s:
            holdings.append({
                "asset": token["asset"],
                "name": token["name"],
                "quantity": token["quantity"],
                "sources": ["on-chain"],
            })

        return holdings
