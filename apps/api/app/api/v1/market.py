"""
OmniFlow — Market Data API endpoints.
Public crypto & stock market data for exploring all available assets.
Uses CoinGecko (crypto) and proxied data for markets.
Phase F1.7: Pydantic response_model on all endpoints + 2 new endpoints.
"""

from __future__ import annotations

import json
import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.core.redis import redis_client
from app.schemas.market import (
    ChartData,
    CoinDetail,
    CoinListItem,
    FearGreedResponse,
    GlobalMarketData,
    OHLCVResponse,
    OrderbookResponse,
    ScreenerResponse,
    SearchResult,
    SentimentResponse,
    StockChartData,
    StockQuote,
    StockSearchResponse,
    StockUniverseItem,
    TopMoversResponse,
    TradesResponse,
    TrendingCoin,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])

COINGECKO_BASE = "https://api.coingecko.com/api/v3"


# ─────────────────── Crypto Market ───────────────────────


@router.get("/crypto/coins", response_model=list[CoinListItem])
async def list_crypto_coins(
    page: int = Query(1, ge=1, le=50),
    per_page: int = Query(100, ge=10, le=250),
    order: str = Query("market_cap_desc"),
    sparkline: bool = Query(True),
):
    """
    Get top crypto coins by market cap with price, volume, sparkline.
    Proxies CoinGecko /coins/markets.
    """
    cache_key = f"market:crypto:coins:{page}:{per_page}:{order}:{sparkline}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/coins/markets"
    params = {
        "vs_currency": "eur",
        "order": order,
        "per_page": str(per_page),
        "page": str(page),
        "sparkline": str(sparkline).lower(),
        "price_change_percentage": "1h,24h,7d,30d",
        "locale": "fr",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko coins/markets failed: %s", e)
        return []

    result = []
    for c in data:
        result.append({
            "id": c.get("id"),
            "symbol": (c.get("symbol") or "").upper(),
            "name": c.get("name"),
            "image": c.get("image"),
            "current_price": c.get("current_price"),
            "market_cap": c.get("market_cap"),
            "market_cap_rank": c.get("market_cap_rank"),
            "total_volume": c.get("total_volume"),
            "price_change_percentage_1h_in_currency": c.get("price_change_percentage_1h_in_currency"),
            "price_change_percentage_24h": c.get("price_change_percentage_24h"),
            "price_change_percentage_7d_in_currency": c.get("price_change_percentage_7d_in_currency"),
            "price_change_percentage_30d_in_currency": c.get("price_change_percentage_30d_in_currency"),
            "circulating_supply": c.get("circulating_supply"),
            "total_supply": c.get("total_supply"),
            "max_supply": c.get("max_supply"),
            "ath": c.get("ath"),
            "ath_change_percentage": c.get("ath_change_percentage"),
            "ath_date": c.get("ath_date"),
            "atl": c.get("atl"),
            "high_24h": c.get("high_24h"),
            "low_24h": c.get("low_24h"),
            "sparkline_in_7d": c.get("sparkline_in_7d"),
            "fully_diluted_valuation": c.get("fully_diluted_valuation"),
        })

    await redis_client.set(cache_key, json.dumps(result), ex=90)
    return result


@router.get("/crypto/coin/{coin_id}", response_model=CoinDetail)
async def get_crypto_coin_detail(coin_id: str):
    """Get comprehensive detail for a single coin (description, links, stats)."""
    cache_key = f"market:crypto:detail:{coin_id}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/coins/{coin_id}"
    params = {
        "localization": "false",
        "tickers": "false",
        "market_data": "true",
        "community_data": "true",
        "developer_data": "false",
        "sparkline": "true",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko coin detail failed: %s", e)
        return {}

    md = data.get("market_data", {})
    result = {
        "id": data.get("id"),
        "symbol": (data.get("symbol") or "").upper(),
        "name": data.get("name"),
        "image": (data.get("image") or {}).get("large"),
        "description": (data.get("description") or {}).get("en", "")[:1000],
        "categories": data.get("categories", []),
        "links": {
            "homepage": (data.get("links") or {}).get("homepage", [None])[0],
            "blockchain_site": [u for u in (data.get("links") or {}).get("blockchain_site", []) if u][:3],
            "twitter": (data.get("links") or {}).get("twitter_screen_name"),
            "reddit": (data.get("links") or {}).get("subreddit_url"),
        },
        "market_data": {
            "current_price_eur": md.get("current_price", {}).get("eur"),
            "market_cap_eur": md.get("market_cap", {}).get("eur"),
            "total_volume_eur": md.get("total_volume", {}).get("eur"),
            "high_24h_eur": md.get("high_24h", {}).get("eur"),
            "low_24h_eur": md.get("low_24h", {}).get("eur"),
            "price_change_24h": md.get("price_change_24h"),
            "price_change_percentage_24h": md.get("price_change_percentage_24h"),
            "price_change_percentage_7d": md.get("price_change_percentage_7d"),
            "price_change_percentage_30d": md.get("price_change_percentage_30d"),
            "price_change_percentage_1y": md.get("price_change_percentage_1y"),
            "ath_eur": md.get("ath", {}).get("eur"),
            "ath_change_percentage": md.get("ath_change_percentage", {}).get("eur"),
            "ath_date": md.get("ath_date", {}).get("eur"),
            "atl_eur": md.get("atl", {}).get("eur"),
            "circulating_supply": md.get("circulating_supply"),
            "total_supply": md.get("total_supply"),
            "max_supply": md.get("max_supply"),
            "fully_diluted_valuation_eur": md.get("fully_diluted_valuation", {}).get("eur"),
            "sparkline_7d": md.get("sparkline_7d", {}).get("price", []),
        },
        "community_data": data.get("community_data", {}),
        "genesis_date": data.get("genesis_date"),
        "sentiment_votes_up_percentage": data.get("sentiment_votes_up_percentage"),
        "sentiment_votes_down_percentage": data.get("sentiment_votes_down_percentage"),
    }

    await redis_client.set(cache_key, json.dumps(result), ex=120)
    return result


@router.get("/crypto/chart/{coin_id}", response_model=ChartData)
async def get_crypto_chart(
    coin_id: str,
    days: str = Query("7", description="1, 7, 30, 90, 365, max"),
):
    """Get price chart data for a coin."""
    cache_key = f"market:crypto:chart:{coin_id}:{days}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/coins/{coin_id}/market_chart"
    params = {"vs_currency": "eur", "days": days}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko chart failed: %s", e)
        return {"prices": [], "volumes": []}

    result = {
        "prices": data.get("prices", []),
        "volumes": data.get("total_volumes", []),
        "market_caps": data.get("market_caps", []),
    }

    ttl = 120 if days in ("1", "7") else 600
    await redis_client.set(cache_key, json.dumps(result), ex=ttl)
    return result


@router.get("/crypto/trending", response_model=list[TrendingCoin])
async def get_trending_coins():
    """Get trending coins (top 7 by search volume on CoinGecko)."""
    cache_key = "market:crypto:trending"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/search/trending"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko trending failed: %s", e)
        return []

    result = []
    for item in data.get("coins", []):
        c = item.get("item", {})
        result.append({
            "id": c.get("id"),
            "symbol": (c.get("symbol") or "").upper(),
            "name": c.get("name"),
            "thumb": c.get("thumb"),
            "market_cap_rank": c.get("market_cap_rank"),
            "price_btc": c.get("price_btc"),
            "score": c.get("score"),
        })

    await redis_client.set(cache_key, json.dumps(result), ex=300)
    return result


@router.get("/crypto/global", response_model=GlobalMarketData)
async def get_global_crypto_data():
    """Get global crypto market data (total market cap, BTC dominance, etc.)."""
    cache_key = "market:crypto:global"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/global"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko global data failed: %s", e)
        return {}

    gd = data.get("data", {})
    result = {
        "active_cryptocurrencies": gd.get("active_cryptocurrencies"),
        "total_market_cap_eur": gd.get("total_market_cap", {}).get("eur"),
        "total_volume_eur": gd.get("total_volume", {}).get("eur"),
        "market_cap_change_percentage_24h": gd.get("market_cap_change_percentage_24h_usd"),
        "btc_dominance": gd.get("market_cap_percentage", {}).get("btc"),
        "eth_dominance": gd.get("market_cap_percentage", {}).get("eth"),
    }

    await redis_client.set(cache_key, json.dumps(result), ex=120)
    return result


@router.get("/crypto/search", response_model=list[SearchResult])
async def search_crypto(q: str = Query(..., min_length=1)):
    """Search crypto coins by name or symbol."""
    cache_key = f"market:crypto:search:{q.lower()}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{COINGECKO_BASE}/search"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"query": q})
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("CoinGecko search failed: %s", e)
        return []

    result = [
        {
            "id": c["id"],
            "symbol": c["symbol"].upper(),
            "name": c["name"],
            "thumb": c.get("thumb", ""),
            "market_cap_rank": c.get("market_cap_rank"),
        }
        for c in data.get("coins", [])[:30]
    ]

    await redis_client.set(cache_key, json.dumps(result), ex=600)
    return result


# ─────────────────── Stock / ETF Market ──────────────────

# Free, curated universe of popular EU & US instruments.
# Since there's no free real-time stock API as comprehensive as CoinGecko,
# we provide a curated catalog with static metadata + Yahoo Finance proxy
# for dynamic prices and charts.

STOCK_UNIVERSE = [
    # ── Actions FR / EU ──
    {"symbol": "MC.PA", "name": "LVMH", "type": "action", "sector": "Luxe", "country": "FR", "isin": "FR0000121014"},
    {"symbol": "OR.PA", "name": "L'Oréal", "type": "action", "sector": "Consommation", "country": "FR", "isin": "FR0000120321"},
    {"symbol": "SAN.PA", "name": "Sanofi", "type": "action", "sector": "Santé", "country": "FR", "isin": "FR0000120578"},
    {"symbol": "AI.PA", "name": "Air Liquide", "type": "action", "sector": "Industrie", "country": "FR", "isin": "FR0000120073"},
    {"symbol": "SU.PA", "name": "Schneider Electric", "type": "action", "sector": "Industrie", "country": "FR", "isin": "FR0000121972"},
    {"symbol": "BNP.PA", "name": "BNP Paribas", "type": "action", "sector": "Finance", "country": "FR", "isin": "FR0000131104"},
    {"symbol": "TTE.PA", "name": "TotalEnergies", "type": "action", "sector": "Énergie", "country": "FR", "isin": "FR0000120271"},
    {"symbol": "DG.PA", "name": "Vinci", "type": "action", "sector": "Construction", "country": "FR", "isin": "FR0000125486"},
    {"symbol": "RMS.PA", "name": "Hermès", "type": "action", "sector": "Luxe", "country": "FR", "isin": "FR0000052292"},
    {"symbol": "SAF.PA", "name": "Safran", "type": "action", "sector": "Aérospatiale", "country": "FR", "isin": "FR0000073272"},
    {"symbol": "KER.PA", "name": "Kering", "type": "action", "sector": "Luxe", "country": "FR", "isin": "FR0000121485"},
    {"symbol": "ACA.PA", "name": "Crédit Agricole", "type": "action", "sector": "Finance", "country": "FR", "isin": "FR0000045072"},
    {"symbol": "CS.PA", "name": "AXA", "type": "action", "sector": "Assurance", "country": "FR", "isin": "FR0000120628"},
    {"symbol": "DSY.PA", "name": "Dassault Systèmes", "type": "action", "sector": "Technologie", "country": "FR", "isin": "FR0014003TT8"},
    {"symbol": "STLAM.MI", "name": "Stellantis", "type": "action", "sector": "Automobile", "country": "NL", "isin": "NL00150001Q9"},
    {"symbol": "ASML.AS", "name": "ASML", "type": "action", "sector": "Semi-conducteurs", "country": "NL", "isin": "NL0010273215"},
    {"symbol": "SAP.DE", "name": "SAP", "type": "action", "sector": "Technologie", "country": "DE", "isin": "DE0007164600"},
    {"symbol": "SIE.DE", "name": "Siemens", "type": "action", "sector": "Industrie", "country": "DE", "isin": "DE0007236101"},
    {"symbol": "ALV.DE", "name": "Allianz", "type": "action", "sector": "Assurance", "country": "DE", "isin": "DE0008404005"},
    # ── US Tech ──
    {"symbol": "AAPL", "name": "Apple", "type": "action", "sector": "Technologie", "country": "US", "isin": "US0378331005"},
    {"symbol": "MSFT", "name": "Microsoft", "type": "action", "sector": "Technologie", "country": "US", "isin": "US5949181045"},
    {"symbol": "GOOGL", "name": "Alphabet (Google)", "type": "action", "sector": "Technologie", "country": "US", "isin": "US02079K3059"},
    {"symbol": "AMZN", "name": "Amazon", "type": "action", "sector": "E-commerce", "country": "US", "isin": "US0231351067"},
    {"symbol": "NVDA", "name": "NVIDIA", "type": "action", "sector": "Semi-conducteurs", "country": "US", "isin": "US67066G1040"},
    {"symbol": "TSLA", "name": "Tesla", "type": "action", "sector": "Automobile", "country": "US", "isin": "US88160R1014"},
    {"symbol": "META", "name": "Meta Platforms", "type": "action", "sector": "Technologie", "country": "US", "isin": "US30303M1027"},
    {"symbol": "JPM", "name": "JPMorgan Chase", "type": "action", "sector": "Finance", "country": "US", "isin": "US46625H1005"},
    {"symbol": "V", "name": "Visa", "type": "action", "sector": "Finance", "country": "US", "isin": "US92826C8394"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "type": "action", "sector": "Santé", "country": "US", "isin": "US4781601046"},
    # ── ETF populaires PEA / CTO ──
    {"symbol": "CW8.PA", "name": "Amundi MSCI World UCITS", "type": "etf", "sector": "Monde", "country": "FR", "isin": "LU1681043599"},
    {"symbol": "EWLD.PA", "name": "Lyxor MSCI World PEA", "type": "etf", "sector": "Monde", "country": "FR", "isin": "FR0011869353"},
    {"symbol": "ESE.PA", "name": "BNP S&P 500 EUR PEA", "type": "etf", "sector": "US", "country": "FR", "isin": "FR0011550185"},
    {"symbol": "PANX.PA", "name": "Amundi Nasdaq-100 PEA", "type": "etf", "sector": "US Tech", "country": "FR", "isin": "FR0013412285"},
    {"symbol": "TNO.PA", "name": "Amundi Euro Stoxx 50 PEA", "type": "etf", "sector": "Europe", "country": "FR", "isin": "FR0007054358"},
    {"symbol": "PAEEM.PA", "name": "Amundi Emerging Markets PEA", "type": "etf", "sector": "Émergents", "country": "FR", "isin": "FR0013412020"},
    {"symbol": "CAC.PA", "name": "Amundi CAC 40 UCITS", "type": "etf", "sector": "France", "country": "FR", "isin": "FR0007052782"},
    {"symbol": "IWDA.AS", "name": "iShares MSCI World Acc", "type": "etf", "sector": "Monde", "country": "IE", "isin": "IE00B4L5Y983"},
    {"symbol": "VWCE.DE", "name": "Vanguard FTSE All-World", "type": "etf", "sector": "Monde", "country": "IE", "isin": "IE00BK5BQT80"},
    {"symbol": "CSPX.AS", "name": "iShares Core S&P 500 Acc", "type": "etf", "sector": "US", "country": "IE", "isin": "IE00B5BMR087"},
    # ── Obligations / Bonds ETF ──
    {"symbol": "AGGH.PA", "name": "iShares Global Agg Bond", "type": "obligation", "sector": "Obligations mondiales", "country": "IE", "isin": "IE00BDBRDM35"},
    {"symbol": "EUNA.DE", "name": "iShares Euro Govt Bond", "type": "obligation", "sector": "Obligations euro", "country": "IE", "isin": "IE00B4WXJJ64"},
    {"symbol": "IBGS.DE", "name": "iShares Euro Govt 1-3yr", "type": "obligation", "sector": "Obligations court terme", "country": "IE", "isin": "IE00B14X4Q57"},
]

YAHOO_FINANCE_V8 = "https://query1.finance.yahoo.com/v8/finance"
YAHOO_FINANCE_V10 = "https://query2.finance.yahoo.com/v10/finance"


@router.get("/stocks/universe", response_model=list[StockUniverseItem])
async def list_stock_universe(
    asset_type: str | None = Query(None, description="action, etf, obligation"),
    sector: str | None = Query(None),
    country: str | None = Query(None),
    search: str | None = Query(None),
):
    """Return our curated stock/ETF/bond universe with live quotes."""
    # Filter
    items = STOCK_UNIVERSE
    if asset_type:
        items = [i for i in items if i["type"] == asset_type]
    if sector:
        items = [i for i in items if sector.lower() in i["sector"].lower()]
    if country:
        items = [i for i in items if i["country"].upper() == country.upper()]
    if search:
        q = search.lower()
        items = [i for i in items if q in i["name"].lower() or q in i["symbol"].lower() or q in i.get("isin", "").lower()]

    symbols = [i["symbol"] for i in items]
    if not symbols:
        return []

    # Batch fetch quotes from Yahoo Finance
    quotes_map = await _fetch_yahoo_quotes(symbols)

    result = []
    for item in items:
        quote = quotes_map.get(item["symbol"], {})
        result.append({
            **item,
            "price": quote.get("regularMarketPrice"),
            "change_pct": quote.get("regularMarketChangePercent"),
            "change": quote.get("regularMarketChange"),
            "previous_close": quote.get("regularMarketPreviousClose"),
            "open": quote.get("regularMarketOpen"),
            "day_high": quote.get("regularMarketDayHigh"),
            "day_low": quote.get("regularMarketDayLow"),
            "volume": quote.get("regularMarketVolume"),
            "market_cap": quote.get("marketCap"),
            "fifty_two_week_high": quote.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": quote.get("fiftyTwoWeekLow"),
            "currency": quote.get("currency", "EUR"),
            "exchange": quote.get("exchange"),
        })

    return result


@router.get("/stocks/quote/{symbol}", response_model=StockQuote)
async def get_stock_quote(symbol: str):
    """Get detailed real-time quote for a single stock/ETF."""
    cache_key = f"market:stock:quote:{symbol}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    quotes = await _fetch_yahoo_quotes([symbol])
    quote = quotes.get(symbol, {})

    # Find metadata from universe
    meta = next((i for i in STOCK_UNIVERSE if i["symbol"] == symbol), None)

    result = {
        "symbol": symbol,
        "name": meta["name"] if meta else quote.get("shortName", symbol),
        "type": meta["type"] if meta else "action",
        "sector": meta["sector"] if meta else "",
        "country": meta["country"] if meta else "",
        "isin": meta["isin"] if meta else "",
        "price": quote.get("regularMarketPrice"),
        "change": quote.get("regularMarketChange"),
        "change_pct": quote.get("regularMarketChangePercent"),
        "previous_close": quote.get("regularMarketPreviousClose"),
        "open": quote.get("regularMarketOpen"),
        "day_high": quote.get("regularMarketDayHigh"),
        "day_low": quote.get("regularMarketDayLow"),
        "volume": quote.get("regularMarketVolume"),
        "avg_volume": quote.get("averageDailyVolume3Month"),
        "market_cap": quote.get("marketCap"),
        "pe_ratio": quote.get("trailingPE"),
        "eps": quote.get("epsTrailingTwelveMonths"),
        "dividend_yield": quote.get("dividendYield"),
        "fifty_two_week_high": quote.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": quote.get("fiftyTwoWeekLow"),
        "fifty_day_avg": quote.get("fiftyDayAverage"),
        "two_hundred_day_avg": quote.get("twoHundredDayAverage"),
        "currency": quote.get("currency", "EUR"),
        "exchange": quote.get("exchange"),
        "market_state": quote.get("marketState"),
    }

    await redis_client.set(cache_key, json.dumps(result), ex=60)
    return result


@router.get("/stocks/chart/{symbol}", response_model=StockChartData)
async def get_stock_chart(
    symbol: str,
    period: str = Query("6mo", description="1d,5d,1mo,3mo,6mo,1y,2y,5y,max"),
    interval: str = Query("1d", description="1m,5m,15m,1h,1d,1wk,1mo"),
):
    """Get historical chart data for a stock/ETF from Yahoo Finance."""
    cache_key = f"market:stock:chart:{symbol}:{period}:{interval}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{YAHOO_FINANCE_V8}/chart/{symbol}"
    params = {"range": period, "interval": interval, "includePrePost": "false"}
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo Finance chart failed for %s: %s", symbol, e)
        return {"timestamps": [], "prices": [], "volumes": []}

    chart = data.get("chart", {}).get("result", [{}])[0]
    timestamps = chart.get("timestamp", [])
    indicators = chart.get("indicators", {})
    quotes = indicators.get("quote", [{}])[0]

    prices = quotes.get("close", [])
    volumes = quotes.get("volume", [])

    result = {
        "symbol": symbol,
        "timestamps": timestamps,
        "prices": prices,
        "volumes": volumes,
        "currency": chart.get("meta", {}).get("currency", "EUR"),
    }

    ttl = 300 if period in ("1d", "5d") else 3600
    await redis_client.set(cache_key, json.dumps(result), ex=ttl)
    return result


async def _fetch_yahoo_quotes(symbols: list[str]) -> dict:
    """Batch fetch quotes from Yahoo Finance v7 API. Returns {symbol: quote_dict}."""
    if not symbols:
        return {}

    # Check cache first
    cache_key = "market:stock:quotes:" + ",".join(sorted(symbols))
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = "https://query1.finance.yahoo.com/v7/finance/quote"
    params = {"symbols": ",".join(symbols)}
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo Finance quotes failed: %s", e)
        return {}

    result = {}
    for q in data.get("quoteResponse", {}).get("result", []):
        result[q.get("symbol", "")] = q

    await redis_client.set(cache_key, json.dumps(result), ex=60)
    return result


# ─────────────────── Stock OHLCV (for TradingView charts) ───────────────


@router.get("/stocks/ohlcv/{symbol}", response_model=OHLCVResponse)
async def get_stock_ohlcv(
    symbol: str,
    interval: str = Query("1d", description="1m,5m,15m,1h,1d,1wk,1mo"),
    range: str = Query("1y", description="1d,5d,1mo,3mo,6mo,1y,2y,5y,max"),
):
    """
    Get OHLCV candle data for lightweight-charts (TradingView).
    Returns normalized candles: [{time, open, high, low, close, volume}].
    """
    cache_key = f"market:stock:ohlcv:{symbol}:{interval}:{range}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{YAHOO_FINANCE_V8}/chart/{symbol}"
    params = {"range": range, "interval": interval, "includePrePost": "false"}
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo OHLCV failed for %s: %s", symbol, e)
        return {"symbol": symbol, "interval": interval, "candles": [], "currency": "EUR"}

    chart = data.get("chart", {}).get("result", [{}])[0]
    timestamps = chart.get("timestamp") or []
    indicators = chart.get("indicators", {})
    quotes = indicators.get("quote", [{}])[0]
    meta = chart.get("meta", {})

    opens = quotes.get("open", [])
    highs = quotes.get("high", [])
    lows = quotes.get("low", [])
    closes = quotes.get("close", [])
    volumes = quotes.get("volume", [])

    candles = []
    for i, ts in enumerate(timestamps):
        o = opens[i] if i < len(opens) else None
        h = highs[i] if i < len(highs) else None
        l_ = lows[i] if i < len(lows) else None
        c = closes[i] if i < len(closes) else None
        v = volumes[i] if i < len(volumes) else None
        if o is None or h is None or l_ is None or c is None:
            continue
        # lightweight-charts expects time as unix timestamp (seconds) or 'YYYY-MM-DD'
        if interval in ("1d", "1wk", "1mo"):
            from datetime import datetime, timezone
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            time_val = dt.strftime("%Y-%m-%d")
        else:
            time_val = ts  # intraday: unix seconds
        candles.append({
            "time": time_val,
            "open": round(o, 4),
            "high": round(h, 4),
            "low": round(l_, 4),
            "close": round(c, 4),
            "volume": v or 0,
        })

    result = {
        "symbol": symbol,
        "interval": interval,
        "candles": candles,
        "currency": meta.get("currency", "EUR"),
        "exchange": meta.get("exchangeName", ""),
        "name": meta.get("shortName", symbol),
    }

    ttl = 120 if interval in ("1m", "5m") else 300 if interval in ("15m", "1h") else 3600
    await redis_client.set(cache_key, json.dumps(result), ex=ttl)
    return result


# ─────────────────── Stock Screener ──────────────────────────────────────


@router.get("/stocks/screen", response_model=ScreenerResponse)
async def screen_stocks(
    sector: str | None = Query(None),
    asset_type: str | None = Query(None, description="action, etf, obligation"),
    country: str | None = Query(None),
    min_cap: float | None = Query(None, description="Min market cap"),
    max_cap: float | None = Query(None, description="Max market cap"),
    min_pe: float | None = Query(None),
    max_pe: float | None = Query(None),
    min_dividend_yield: float | None = Query(None, description="Min dividend yield (0-100)"),
    min_change_pct: float | None = Query(None, description="Min price change %"),
    max_change_pct: float | None = Query(None, description="Max price change %"),
    min_volume: float | None = Query(None),
    sort_by: str = Query("market_cap", description="Sorting field"),
    sort_dir: str = Query("desc", description="asc or desc"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Advanced stock screener with multi-criteria filtering.
    Filters on sector, cap, P/E, dividend yield, performance, volume.
    """
    # Start with full universe
    items = list(STOCK_UNIVERSE)
    if asset_type:
        items = [i for i in items if i["type"] == asset_type]
    if sector:
        items = [i for i in items if sector.lower() in i["sector"].lower()]
    if country:
        items = [i for i in items if i["country"].upper() == country.upper()]

    symbols = [i["symbol"] for i in items]
    if not symbols:
        return {"results": [], "total": 0}

    quotes_map = await _fetch_yahoo_quotes(symbols)

    enriched = []
    for item in items:
        quote = quotes_map.get(item["symbol"], {})
        cap = quote.get("marketCap")
        pe = quote.get("trailingPE")
        div_yield = quote.get("dividendYield")
        change_pct = quote.get("regularMarketChangePercent")
        vol = quote.get("regularMarketVolume")

        # Apply numerical filters
        if min_cap is not None and (cap is None or cap < min_cap):
            continue
        if max_cap is not None and (cap is None or cap > max_cap):
            continue
        if min_pe is not None and (pe is None or pe < min_pe):
            continue
        if max_pe is not None and (pe is None or pe > max_pe):
            continue
        if min_dividend_yield is not None and (div_yield is None or div_yield * 100 < min_dividend_yield):
            continue
        if min_change_pct is not None and (change_pct is None or change_pct < min_change_pct):
            continue
        if max_change_pct is not None and (change_pct is None or change_pct > max_change_pct):
            continue
        if min_volume is not None and (vol is None or vol < min_volume):
            continue

        enriched.append({
            **item,
            "price": quote.get("regularMarketPrice"),
            "change_pct": change_pct,
            "change": quote.get("regularMarketChange"),
            "previous_close": quote.get("regularMarketPreviousClose"),
            "open": quote.get("regularMarketOpen"),
            "day_high": quote.get("regularMarketDayHigh"),
            "day_low": quote.get("regularMarketDayLow"),
            "volume": vol,
            "market_cap": cap,
            "pe_ratio": pe,
            "eps": quote.get("epsTrailingTwelveMonths"),
            "dividend_yield": div_yield,
            "fifty_two_week_high": quote.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": quote.get("fiftyTwoWeekLow"),
            "currency": quote.get("currency", "EUR"),
            "exchange": quote.get("exchange"),
        })

    # Sort
    reverse = sort_dir.lower() == "desc"

    def sort_val(item):
        v = item.get(sort_by)
        if v is None:
            return float("-inf") if reverse else float("inf")
        return v

    enriched.sort(key=sort_val, reverse=reverse)

    total = len(enriched)
    enriched = enriched[:limit]

    return {"results": enriched, "total": total}


# ─────────────────── Stock Search Autocomplete ───────────────────────────


@router.get("/stocks/search", response_model=StockSearchResponse)
async def search_stocks(
    q: str = Query(..., min_length=1, description="Search query for symbol/name"),
):
    """
    Autocomplete stock/ETF search using Yahoo Finance autosuggest.
    Returns matches with symbol, name, exchange, type.
    """
    cache_key = f"market:stock:search:{q.lower().strip()}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {"q": q, "newsCount": "0", "quotesCount": "10", "enableFuzzyQuery": "true"}
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo search failed: %s", e)
        # Fallback: search in local universe
        ql = q.lower()
        local = [
            {"symbol": i["symbol"], "name": i["name"], "exchange": "", "type": i["type"], "sector": i["sector"]}
            for i in STOCK_UNIVERSE
            if ql in i["name"].lower() or ql in i["symbol"].lower()
        ]
        return {"results": local[:10]}

    results = []
    for item in data.get("quotes", []):
        sym = item.get("symbol", "")
        name = item.get("shortname") or item.get("longname") or sym
        exchange = item.get("exchange", "")
        qtype = item.get("quoteType", "EQUITY").lower()
        type_label = "etf" if qtype == "etf" else "index" if qtype == "index" else "action"
        results.append({
            "symbol": sym,
            "name": name,
            "exchange": exchange,
            "type": type_label,
            "sector": item.get("sector", ""),
        })

    result = {"results": results[:10]}
    await redis_client.set(cache_key, json.dumps(result), ex=3600)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# F1.3 — Crypto Trading Terminal endpoints (Binance + alternative.me proxy)
# ═══════════════════════════════════════════════════════════════════════════

BINANCE_BASE = "https://api.binance.com"

INTERVAL_MAP_CRYPTO = {
    "1m": ("1m", 500),
    "5m": ("5m", 500),
    "15m": ("15m", 500),
    "1h": ("1h", 500),
    "4h": ("4h", 500),
    "1d": ("1d", 365),
    "1w": ("1w", 200),
    "1M": ("1M", 60),
}


@router.get("/crypto/ohlcv/{symbol}", response_model=OHLCVResponse)
async def get_crypto_ohlcv(
    symbol: str,
    interval: str = Query("1d", pattern="^(1m|5m|15m|1h|4h|1d|1w|1M)$"),
    limit: int = Query(365, ge=10, le=1000),
):
    """OHLCV candle data for crypto via Binance klines API."""
    sym_upper = symbol.upper().replace("-", "").replace("/", "")
    pair = f"{sym_upper}USDT" if not sym_upper.endswith("USDT") else sym_upper

    cache_ttl = 30 if interval in ("1m", "5m", "15m") else 120 if interval in ("1h", "4h") else 300
    cache_key = f"crypto_ohlcv:{pair}:{interval}:{limit}"

    try:
        redis_client = await _get_redis()
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    url = f"{BINANCE_BASE}/api/v3/klines"
    params = {"symbol": pair, "interval": interval, "limit": limit}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance klines error: {e}")

    candles = []
    for k in raw:
        ts_ms = k[0]
        if interval in ("1d", "1w", "1M"):
            from datetime import datetime, timezone
            dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
            time_val = dt.strftime("%Y-%m-%d")
        else:
            time_val = int(ts_ms / 1000)
        candles.append({
            "time": time_val,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })

    result = {
        "symbol": sym_upper,
        "pair": pair,
        "interval": interval,
        "candles": candles,
    }

    try:
        redis_client = await _get_redis()
        await redis_client.set(cache_key, json.dumps(result), ex=cache_ttl)
    except Exception:
        pass
    return result


@router.get("/crypto/depth/{symbol}", response_model=OrderbookResponse)
async def get_crypto_depth(
    symbol: str,
    limit: int = Query(20, ge=5, le=100),
):
    """Orderbook depth from Binance."""
    sym_upper = symbol.upper().replace("-", "").replace("/", "")
    pair = f"{sym_upper}USDT" if not sym_upper.endswith("USDT") else sym_upper

    cache_key = f"crypto_depth:{pair}:{limit}"
    try:
        redis_client = await _get_redis()
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    url = f"{BINANCE_BASE}/api/v3/depth"
    params = {"symbol": pair, "limit": limit}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance depth error: {e}")

    bids = [[float(p), float(q)] for p, q in data.get("bids", [])]
    asks = [[float(p), float(q)] for p, q in data.get("asks", [])]

    bid_total = sum(q for _, q in bids)
    ask_total = sum(q for _, q in asks)
    best_bid = bids[0][0] if bids else 0
    best_ask = asks[0][0] if asks else 0
    spread = best_ask - best_bid
    spread_pct = (spread / best_ask * 100) if best_ask > 0 else 0
    imbalance = (bid_total / ask_total) if ask_total > 0 else 0

    result = {
        "symbol": sym_upper,
        "pair": pair,
        "bids": bids,
        "asks": asks,
        "spread": round(spread, 8),
        "spread_pct": round(spread_pct, 4),
        "imbalance": round(imbalance, 3),
        "last_update_id": data.get("lastUpdateId"),
    }

    try:
        redis_client = await _get_redis()
        await redis_client.set(cache_key, json.dumps(result), ex=2)
    except Exception:
        pass
    return result


@router.get("/crypto/trades/{symbol}", response_model=TradesResponse)
async def get_crypto_trades(
    symbol: str,
    limit: int = Query(50, ge=10, le=100),
):
    """Recent aggregated trades from Binance."""
    sym_upper = symbol.upper().replace("-", "").replace("/", "")
    pair = f"{sym_upper}USDT" if not sym_upper.endswith("USDT") else sym_upper

    cache_key = f"crypto_trades:{pair}:{limit}"
    try:
        redis_client = await _get_redis()
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    url = f"{BINANCE_BASE}/api/v3/aggTrades"
    params = {"symbol": pair, "limit": limit}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance trades error: {e}")

    trades = []
    for t in raw:
        trades.append({
            "id": t.get("a"),
            "price": float(t.get("p", 0)),
            "qty": float(t.get("q", 0)),
            "time": t.get("T"),
            "is_buyer_maker": t.get("m", False),
        })

    result = {"symbol": sym_upper, "pair": pair, "trades": trades}

    try:
        redis_client = await _get_redis()
        await redis_client.set(cache_key, json.dumps(result), ex=2)
    except Exception:
        pass
    return result


@router.get("/crypto/top-movers", response_model=TopMoversResponse)
async def get_crypto_top_movers(
    limit: int = Query(50, ge=10, le=100),
):
    """Top gainers, losers, and volume leaders from CoinGecko."""
    cache_key = f"crypto_top_movers:{limit}"
    try:
        redis_client = await _get_redis()
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {
        "vs_currency": "eur",
        "order": "market_cap_desc",
        "per_page": 250,
        "page": 1,
        "sparkline": True,
        "price_change_percentage": "1h,24h,7d",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            all_coins = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CoinGecko error: {e}")

    def coin_item(c):
        return {
            "id": c.get("id"),
            "symbol": (c.get("symbol") or "").upper(),
            "name": c.get("name"),
            "image": c.get("image"),
            "price": c.get("current_price"),
            "market_cap": c.get("market_cap"),
            "volume": c.get("total_volume"),
            "change_1h": c.get("price_change_percentage_1h_in_currency"),
            "change_24h": c.get("price_change_percentage_24h_in_currency"),
            "change_7d": c.get("price_change_percentage_7d_in_currency"),
            "sparkline": (c.get("sparkline_in_7d") or {}).get("price", []),
        }

    # Filter out stablecoins and coins without change data
    valid = [c for c in all_coins if c.get("price_change_percentage_24h_in_currency") is not None]

    gainers = sorted(valid, key=lambda c: c.get("price_change_percentage_24h_in_currency", 0), reverse=True)[:limit]
    losers = sorted(valid, key=lambda c: c.get("price_change_percentage_24h_in_currency", 0))[:limit]
    volume_leaders = sorted(valid, key=lambda c: c.get("total_volume", 0), reverse=True)[:limit]

    # Treemap data: top 100 by market cap
    treemap = sorted(valid[:100], key=lambda c: c.get("market_cap", 0), reverse=True)

    import time
    result = {
        "gainers": [coin_item(c) for c in gainers],
        "losers": [coin_item(c) for c in losers],
        "volume_leaders": [coin_item(c) for c in volume_leaders],
        "treemap": [coin_item(c) for c in treemap],
        "updated_at": int(time.time()),
    }

    try:
        redis_client = await _get_redis()
        await redis_client.set(cache_key, json.dumps(result), ex=30)
    except Exception:
        pass
    return result


@router.get("/crypto/fear-greed", response_model=FearGreedResponse)
async def get_crypto_fear_greed():
    """Fear & Greed Index from alternative.me."""
    cache_key = "crypto_fear_greed"
    try:
        redis_client = await _get_redis()
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    url = "https://api.alternative.me/fng/"
    params = {"limit": 31, "format": "json"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Fear & Greed API error: {e}")

    items = data.get("data", [])
    if not items:
        raise HTTPException(status_code=502, detail="No Fear & Greed data")

    current = items[0]
    history = []
    for item in items:
        history.append({
            "value": int(item.get("value", 50)),
            "label": item.get("value_classification", "Neutral"),
            "date": item.get("timestamp"),
        })

    result = {
        "value": int(current.get("value", 50)),
        "label": current.get("value_classification", "Neutral"),
        "timestamp": current.get("timestamp"),
        "history": history,
    }

    try:
        redis_client = await _get_redis()
        await redis_client.set(cache_key, json.dumps(result), ex=600)
    except Exception:
        pass
    return result


# ═══════════════════════════════════════════════════════════════════════════
# F1.7 — New endpoints: Stock News/Sentiment + Stock Orderbook
# ═══════════════════════════════════════════════════════════════════════════


@router.get("/stocks/news/{symbol}", response_model=SentimentResponse)
async def get_stock_news_sentiment(symbol: str):
    """
    Get latest news + NLP sentiment analysis for a stock symbol.
    Uses Google News RSS + keyword-based scoring pipeline.
    Returns articles with per-article sentiment + aggregate conviction score.
    """
    from app.services.sentiment_service import get_sentiment_for_symbol

    # Find company name from universe for better search
    company_name = ""
    for item in STOCK_UNIVERSE:
        if item["symbol"].upper() == symbol.upper():
            company_name = item["name"]
            break

    try:
        redis = await _get_redis()
    except Exception:
        redis = None

    return await get_sentiment_for_symbol(
        symbol=symbol,
        company_name=company_name,
        redis_client=redis,
    )


@router.get("/stocks/orderbook/{symbol}", response_model=OrderbookResponse)
async def get_stock_orderbook(symbol: str):
    """
    Get stock orderbook data (bid/ask levels).
    Uses Yahoo Finance quote data to build a synthetic L2 book
    based on the current bid-ask spread.
    """
    import random
    import math

    cache_key = f"stock_orderbook:{symbol}"
    try:
        redis = await _get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        redis = None

    # Fetch quote for bid/ask data
    quotes = await _fetch_yahoo_quotes([symbol])
    quote = quotes.get(symbol, {})

    # Use regularMarketPrice as fallback when bid/ask aren't available (outside market hours)
    market_price = quote.get("regularMarketPrice", 0)
    bid = quote.get("bid") or market_price
    ask = quote.get("ask") or market_price
    bid_size = quote.get("bidSize") or 100
    ask_size = quote.get("askSize") or 100

    if not market_price and not bid:
        raise HTTPException(status_code=404, detail=f"No quote data for {symbol}")

    # If bid/ask are both market_price (outside hours), simulate a tight spread
    if bid == ask and bid > 0:
        spread_sim = bid * 0.001  # 0.1% simulated spread
        bid = round(bid - spread_sim / 2, 4)
        ask = round(ask + spread_sim / 2, 4)

    # Ensure bid <= ask
    if bid > ask:
        bid, ask = ask, bid

    spread = ask - bid
    mid_price = (bid + ask) / 2
    tick_size = max(0.01, spread * 0.1) if spread > 0 else 0.01

    # Generate 20 synthetic levels based on spread distribution
    random.seed(hash(symbol + str(int(bid * 100))))  # deterministic by symbol+price
    bids = []
    asks = []

    for i in range(20):
        bid_price = round(bid - i * tick_size, 4)
        ask_price = round(ask + i * tick_size, 4)
        # Volume decreases with distance from mid, with some randomness
        bid_vol = max(1, int(bid_size * math.exp(-i * 0.15) * (0.5 + random.random())))
        ask_vol = max(1, int(ask_size * math.exp(-i * 0.15) * (0.5 + random.random())))
        bids.append([bid_price, float(bid_vol)])
        asks.append([ask_price, float(ask_vol)])

    bid_total = sum(v for _, v in bids)
    ask_total = sum(v for _, v in asks)
    spread_pct = (spread / mid_price * 100) if mid_price > 0 else 0
    imbalance = (bid_total / ask_total) if ask_total > 0 else 0

    result = {
        "symbol": symbol,
        "pair": None,
        "bids": bids,
        "asks": asks,
        "spread": round(spread, 4),
        "spread_pct": round(spread_pct, 4),
        "mid_price": round(mid_price, 4),
        "bid_volume": bid_total,
        "ask_volume": ask_total,
        "imbalance": round(imbalance, 3),
        "last_update_id": None,
    }

    if redis:
        try:
            await redis.set(cache_key, json.dumps(result), ex=5)
        except Exception:
            pass
    return result
