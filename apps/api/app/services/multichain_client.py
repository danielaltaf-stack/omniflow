"""
OmniFlow — Phase B4 — Multi-chain client.
Unified interface for querying balances on Polygon, Arbitrum, Optimism, BSC.
Same pattern as EtherscanClient: native balance + ERC-20 token balances.
Uses public *scan APIs (free tier, optional apikey param).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Redis cache helper (import what the codebase already uses)
try:
    from app.core.redis import get_redis
except Exception:
    get_redis = None  # type: ignore


@dataclass
class ChainConfig:
    """Configuration for a single EVM chain's block explorer API."""
    chain_id: str
    base_url: str
    native_symbol: str
    native_name: str
    native_decimals: int = 18
    top_tokens: list[dict[str, Any]] = field(default_factory=list)


# ── Chain configurations ─────────────────────────────────

CHAINS: dict[str, ChainConfig] = {
    "polygon": ChainConfig(
        chain_id="polygon",
        base_url="https://api.polygonscan.com/api",
        native_symbol="MATIC",
        native_name="Polygon",
        top_tokens=[
            {"contract": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "symbol": "USDT", "name": "Tether", "decimals": 6},
            {"contract": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "symbol": "USDC", "name": "USD Coin", "decimals": 6},
            {"contract": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", "symbol": "DAI", "name": "Dai", "decimals": 18},
            {"contract": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", "symbol": "WETH", "name": "Wrapped Ether", "decimals": 18},
            {"contract": "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", "symbol": "WBTC", "name": "Wrapped Bitcoin", "decimals": 8},
            {"contract": "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", "symbol": "LINK", "name": "Chainlink", "decimals": 18},
            {"contract": "0xb33EaAd8d922B1083446DC23f610c2567fB5180f", "symbol": "UNI", "name": "Uniswap", "decimals": 18},
            {"contract": "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", "symbol": "AAVE", "name": "Aave", "decimals": 18},
        ],
    ),
    "arbitrum": ChainConfig(
        chain_id="arbitrum",
        base_url="https://api.arbiscan.io/api",
        native_symbol="ETH",
        native_name="Ethereum",
        top_tokens=[
            {"contract": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "symbol": "USDT", "name": "Tether", "decimals": 6},
            {"contract": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "symbol": "USDC", "name": "USD Coin", "decimals": 6},
            {"contract": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", "symbol": "DAI", "name": "Dai", "decimals": 18},
            {"contract": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", "symbol": "WBTC", "name": "Wrapped Bitcoin", "decimals": 8},
            {"contract": "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", "symbol": "LINK", "name": "Chainlink", "decimals": 18},
            {"contract": "0x912CE59144191C1204E64559FE8253a0e49E6548", "symbol": "ARB", "name": "Arbitrum", "decimals": 18},
        ],
    ),
    "optimism": ChainConfig(
        chain_id="optimism",
        base_url="https://api-optimistic.etherscan.io/api",
        native_symbol="ETH",
        native_name="Ethereum",
        top_tokens=[
            {"contract": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", "symbol": "USDT", "name": "Tether", "decimals": 6},
            {"contract": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "symbol": "USDC", "name": "USD Coin", "decimals": 6},
            {"contract": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", "symbol": "DAI", "name": "Dai", "decimals": 18},
            {"contract": "0x4200000000000000000000000000000000000042", "symbol": "OP", "name": "Optimism", "decimals": 18},
            {"contract": "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", "symbol": "LINK", "name": "Chainlink", "decimals": 18},
        ],
    ),
    "bsc": ChainConfig(
        chain_id="bsc",
        base_url="https://api.bscscan.com/api",
        native_symbol="BNB",
        native_name="BNB",
        top_tokens=[
            {"contract": "0x55d398326f99059fF775485246999027B3197955", "symbol": "USDT", "name": "Tether", "decimals": 18},
            {"contract": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "symbol": "USDC", "name": "USD Coin", "decimals": 18},
            {"contract": "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", "symbol": "DAI", "name": "Dai", "decimals": 18},
            {"contract": "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", "symbol": "ETH", "name": "Ethereum", "decimals": 18},
            {"contract": "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", "symbol": "BTCB", "name": "Bitcoin BEP2", "decimals": 18},
            {"contract": "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", "symbol": "LINK", "name": "Chainlink", "decimals": 18},
            {"contract": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", "symbol": "CAKE", "name": "PancakeSwap", "decimals": 18},
        ],
    ),
}


class MultichainClient:
    """
    Unified client for multi-chain on-chain balance queries.
    Same interface as EtherscanClient for consistency.
    """

    def __init__(self, address: str, chain: str = "polygon"):
        self.address = address
        if chain not in CHAINS:
            raise ValueError(f"Chaîne non supportée: {chain}. Disponibles: {', '.join(CHAINS.keys())}")
        self.config = CHAINS[chain]
        self.chain = chain

    async def _request(self, params: dict[str, str]) -> Any:
        """Execute a GET request to the chain's explorer API."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(self.config.base_url, params=params)
                resp.raise_for_status()
                data = resp.json()
                if data.get("status") == "0" and "No transactions found" not in data.get("message", ""):
                    logger.warning(f"[{self.chain}] API error: {data.get('message', 'unknown')}")
                return data
        except httpx.TimeoutException:
            logger.error(f"[{self.chain}] Timeout requesting {self.config.base_url}")
            raise RuntimeError(f"Timeout sur {self.chain}")
        except httpx.RequestError as e:
            logger.error(f"[{self.chain}] Request error: {e}")
            raise RuntimeError(f"Erreur réseau sur {self.chain}: {e}")

    async def get_native_balance(self) -> dict[str, Any]:
        """Get native token balance (MATIC, ETH, BNB)."""
        data = await self._request({
            "module": "account",
            "action": "balance",
            "address": self.address,
            "tag": "latest",
        })
        raw = int(data.get("result", "0"))
        qty = raw / (10 ** self.config.native_decimals)

        return {
            "asset": self.config.native_symbol,
            "name": self.config.native_name,
            "quantity": qty,
            "chain": self.chain,
        }

    async def get_erc20_balances(self) -> list[dict[str, Any]]:
        """Get ERC-20 token balances for top tracked tokens."""
        results = []
        for token in self.config.top_tokens:
            try:
                data = await self._request({
                    "module": "account",
                    "action": "tokenbalance",
                    "contractaddress": token["contract"],
                    "address": self.address,
                    "tag": "latest",
                })
                raw = int(data.get("result", "0"))
                qty = raw / (10 ** token["decimals"])
                if qty > 0.000001:
                    results.append({
                        "asset": token["symbol"],
                        "name": token["name"],
                        "quantity": qty,
                        "chain": self.chain,
                    })
            except Exception as e:
                logger.warning(f"[{self.chain}] Error fetching {token['symbol']}: {e}")
                continue
        return results

    async def get_all_holdings(self) -> list[dict[str, Any]]:
        """Get all holdings: native + ERC-20 tokens."""
        holdings = []

        try:
            native = await self.get_native_balance()
            if native["quantity"] > 0.000001:
                holdings.append({
                    "asset": native["asset"],
                    "name": native["name"],
                    "quantity": native["quantity"],
                    "sources": [f"on-chain-{self.chain}"],
                })
        except Exception as e:
            logger.warning(f"[{self.chain}] Error fetching native balance: {e}")

        try:
            tokens = await self.get_erc20_balances()
            for t in tokens:
                holdings.append({
                    "asset": t["asset"],
                    "name": t["name"],
                    "quantity": t["quantity"],
                    "sources": [f"on-chain-{self.chain}"],
                })
        except Exception as e:
            logger.warning(f"[{self.chain}] Error fetching ERC-20 tokens: {e}")

        return holdings


def get_supported_chains() -> list[dict[str, str]]:
    """Return list of supported chains with metadata."""
    return [
        {
            "id": cfg.chain_id,
            "name": cfg.native_name,
            "native_symbol": cfg.native_symbol,
            "base_url": cfg.base_url,
        }
        for cfg in CHAINS.values()
    ]
