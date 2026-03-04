"""
OmniFlow — CoinGecko Polling Provider.

Backup provider that polls CoinGecko REST API every 30 seconds
for crypto prices, and Yahoo Finance for stock prices.
Used as fallback when Binance WS is unavailable, and as the
primary source for stock/index data that has no free WebSocket.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from app.services.realtime.market_hub import MarketHub

logger = logging.getLogger("omniflow.coingecko_provider")

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# Top coins to always poll (CoinGecko IDs)
CRYPTO_IDS = [
    "bitcoin", "ethereum", "binancecoin", "solana", "ripple",
    "cardano", "dogecoin", "avalanche-2", "polkadot", "chainlink",
    "matic-network", "uniswap", "cosmos", "litecoin", "filecoin",
    "near", "aptos", "arbitrum", "optimism", "injective-protocol",
]

# Mapping CoinGecko ID → OmniFlow symbol
CG_TO_SYMBOL = {
    "bitcoin": "BTC", "ethereum": "ETH", "binancecoin": "BNB",
    "solana": "SOL", "ripple": "XRP", "cardano": "ADA",
    "dogecoin": "DOGE", "avalanche-2": "AVAX", "polkadot": "DOT",
    "chainlink": "LINK", "matic-network": "MATIC", "uniswap": "UNI",
    "cosmos": "ATOM", "litecoin": "LTC", "filecoin": "FIL",
    "near": "NEAR", "aptos": "APT", "arbitrum": "ARB",
    "optimism": "OP", "injective-protocol": "INJ",
}

# Stock indices/tickers to poll via Yahoo Finance
STOCK_SYMBOLS = [
    "^GSPC", "^FCHI", "^GDAXI", "^FTSE", "^IXIC",
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "MC.PA", "OR.PA", "SAN.PA", "AI.PA", "BNP.PA", "TTE.PA",
]


class CoinGeckoPollingProvider:
    """
    Polls CoinGecko (crypto) + Yahoo Finance (stocks) at regular
    intervals and pushes normalized ticks to MarketHub.
    """

    name = "coingecko_polling"

    def __init__(self, hub: MarketHub) -> None:
        self._hub = hub
        self._running = True
        self._crypto_interval = 30  # seconds
        self._stock_interval = 60  # seconds (Yahoo is more restrictive)

    async def run(self) -> None:
        """Run both polling loops concurrently."""
        try:
            await asyncio.gather(
                self._poll_crypto_loop(),
                self._poll_stocks_loop(),
            )
        except asyncio.CancelledError:
            logger.info("CoinGecko provider cancelled")

    async def _poll_crypto_loop(self) -> None:
        """Poll CoinGecko every 30s for crypto prices."""
        while self._running:
            try:
                await self._fetch_crypto_prices()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("CoinGecko poll error: %s", str(e)[:100])
            await asyncio.sleep(self._crypto_interval)

    async def _poll_stocks_loop(self) -> None:
        """Poll Yahoo Finance every 60s for stock/index prices."""
        while self._running:
            try:
                await self._fetch_stock_prices()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("Yahoo Finance poll error: %s", str(e)[:100])
            await asyncio.sleep(self._stock_interval)

    async def _fetch_crypto_prices(self) -> None:
        """Fetch crypto prices from CoinGecko simple/price."""
        ids_str = ",".join(CRYPTO_IDS)
        url = f"{COINGECKO_BASE}/simple/price"
        params = {
            "ids": ids_str,
            "vs_currencies": "usd,eur",
            "include_24hr_change": "true",
            "include_24hr_vol": "true",
            "include_market_cap": "true",
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 429:
                logger.warning("CoinGecko rate-limited, backing off")
                await asyncio.sleep(60)
                return
            resp.raise_for_status()
            data = resp.json()

        ts = int(time.time() * 1000)
        count = 0
        for cg_id, prices in data.items():
            symbol = CG_TO_SYMBOL.get(cg_id)
            if not symbol:
                continue

            channel = f"crypto:{symbol}"
            price_usd = prices.get("usd", 0)
            price_eur = prices.get("eur", 0)
            change_24h = prices.get("usd_24h_change", 0)
            volume_24h = prices.get("usd_24h_vol", 0)
            market_cap = prices.get("usd_market_cap", 0)

            tick = {
                "symbol": symbol,
                "price": price_usd,
                "price_eur": price_eur,
                "change_pct_24h": round(change_24h, 3) if change_24h else 0,
                "volume_24h": volume_24h,
                "market_cap": market_cap,
                "source": "coingecko",
                "ts": ts,
            }
            await self._hub.on_tick(channel, tick)
            count += 1

        logger.debug("CoinGecko poll: %d crypto ticks pushed", count)

    async def _fetch_stock_prices(self) -> None:
        """Fetch stock prices from Yahoo Finance spark API."""
        symbols_str = ",".join(STOCK_SYMBOLS)
        url = "https://query1.finance.yahoo.com/v7/finance/spark"
        params = {
            "symbols": symbols_str,
            "range": "1d",
            "interval": "5m",
            "indicators": "close",
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; OmniFlow/1.0)",
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code != 200:
                logger.debug("Yahoo spark returned %d", resp.status_code)
                return
            data = resp.json()

        ts = int(time.time() * 1000)
        count = 0
        spark_data = data.get("spark", {}).get("result", [])
        for item in spark_data:
            symbol = item.get("symbol", "")
            response_data = item.get("response", [{}])
            if not response_data:
                continue

            meta = response_data[0].get("meta", {})
            price = meta.get("regularMarketPrice", 0)
            prev_close = meta.get("chartPreviousClose", 0) or meta.get("previousClose", 0)
            currency = meta.get("currency", "USD")

            change_pct = 0.0
            if prev_close and prev_close > 0:
                change_pct = round(((price - prev_close) / prev_close) * 100, 3)

            # Determine channel prefix
            if symbol.startswith("^"):
                channel = f"index:{symbol}"
            else:
                channel = f"stock:{symbol}"

            tick = {
                "symbol": symbol,
                "price": price,
                "prev_close": prev_close,
                "change_pct_24h": change_pct,
                "currency": currency,
                "source": "yahoo",
                "ts": ts,
            }
            await self._hub.on_tick(channel, tick)
            count += 1

        logger.debug("Yahoo poll: %d stock ticks pushed", count)
