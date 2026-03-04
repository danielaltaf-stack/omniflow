"""
OmniFlow — Pydantic response models for all Market API endpoints.
Phase F1.7: Typed schemas for OpenAPI docs + frontend type safety.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────
# Crypto schemas
# ──────────────────────────────────────────────────────────────

class SparklineData(BaseModel):
    price: list[float] = []


class CoinListItem(BaseModel):
    id: str | None = None
    symbol: str | None = None
    name: str | None = None
    image: str | None = None
    current_price: float | None = None
    market_cap: float | None = None
    market_cap_rank: int | None = None
    total_volume: float | None = None
    price_change_percentage_1h_in_currency: float | None = None
    price_change_percentage_24h: float | None = None
    price_change_percentage_7d_in_currency: float | None = None
    price_change_percentage_30d_in_currency: float | None = None
    circulating_supply: float | None = None
    total_supply: float | None = None
    max_supply: float | None = None
    ath: float | None = None
    ath_change_percentage: float | None = None
    ath_date: str | None = None
    atl: float | None = None
    high_24h: float | None = None
    low_24h: float | None = None
    sparkline_in_7d: SparklineData | dict | None = None
    fully_diluted_valuation: float | None = None


class CoinLinks(BaseModel):
    homepage: str | None = None
    blockchain_site: list[str] = []
    twitter: str | None = None
    reddit: str | None = None


class CoinMarketData(BaseModel):
    current_price_eur: float | None = None
    market_cap_eur: float | None = None
    total_volume_eur: float | None = None
    high_24h_eur: float | None = None
    low_24h_eur: float | None = None
    price_change_24h: float | None = None
    price_change_percentage_24h: float | None = None
    price_change_percentage_7d: float | None = None
    price_change_percentage_30d: float | None = None
    price_change_percentage_1y: float | None = None
    ath_eur: float | None = None
    ath_change_percentage: float | None = None
    ath_date: str | None = None
    atl_eur: float | None = None
    circulating_supply: float | None = None
    total_supply: float | None = None
    max_supply: float | None = None
    fully_diluted_valuation_eur: float | None = None
    sparkline_7d: list[float] = []


class CoinDetail(BaseModel):
    id: str | None = None
    symbol: str | None = None
    name: str | None = None
    image: str | None = None
    description: str | None = None
    categories: list[str] = []
    links: CoinLinks = CoinLinks()
    market_data: CoinMarketData = CoinMarketData()
    community_data: dict = {}
    genesis_date: str | None = None
    sentiment_votes_up_percentage: float | None = None
    sentiment_votes_down_percentage: float | None = None


class ChartData(BaseModel):
    prices: list[list[float]] = []
    volumes: list[list[float]] = []
    market_caps: list[list[float]] = []


class TrendingCoin(BaseModel):
    id: str | None = None
    symbol: str | None = None
    name: str | None = None
    thumb: str | None = None
    market_cap_rank: int | None = None
    price_btc: float | None = None
    score: int | None = None


class GlobalMarketData(BaseModel):
    active_cryptocurrencies: int | None = None
    total_market_cap_eur: float | None = None
    total_volume_eur: float | None = None
    market_cap_change_percentage_24h: float | None = None
    btc_dominance: float | None = None
    eth_dominance: float | None = None


class SearchResult(BaseModel):
    id: str | None = None
    symbol: str
    name: str
    thumb: str = ""
    market_cap_rank: int | None = None


# ──────────────────────────────────────────────────────────────
# Stock schemas
# ──────────────────────────────────────────────────────────────

class StockUniverseItem(BaseModel):
    symbol: str
    name: str
    type: str = "action"
    sector: str = ""
    country: str = ""
    isin: str = ""
    price: float | None = None
    change_pct: float | None = None
    change: float | None = None
    previous_close: float | None = None
    open: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    volume: float | None = None
    market_cap: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    currency: str = "EUR"
    exchange: str | None = None


class StockQuote(BaseModel):
    symbol: str
    name: str = ""
    type: str = "action"
    sector: str = ""
    country: str = ""
    isin: str = ""
    price: float | None = None
    change: float | None = None
    change_pct: float | None = None
    previous_close: float | None = None
    open: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    volume: float | None = None
    avg_volume: float | None = None
    market_cap: float | None = None
    pe_ratio: float | None = None
    eps: float | None = None
    dividend_yield: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    fifty_day_avg: float | None = None
    two_hundred_day_avg: float | None = None
    currency: str = "EUR"
    exchange: str | None = None
    market_state: str | None = None


class StockChartData(BaseModel):
    symbol: str
    timestamps: list[int] = []
    prices: list[float | None] = []
    volumes: list[float | None] = []
    currency: str = "EUR"


class StockSearchResult(BaseModel):
    symbol: str
    name: str
    exchange: str = ""
    type: str = "action"
    sector: str = ""


class StockSearchResponse(BaseModel):
    results: list[StockSearchResult] = []


# ──────────────────────────────────────────────────────────────
# Shared OHLCV
# ──────────────────────────────────────────────────────────────

class OHLCVCandle(BaseModel):
    time: str | int
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class OHLCVResponse(BaseModel):
    symbol: str
    interval: str = ""
    candles: list[OHLCVCandle] = []
    currency: str = "EUR"
    exchange: str = ""
    name: str = ""
    pair: str | None = None


# ──────────────────────────────────────────────────────────────
# Orderbook
# ──────────────────────────────────────────────────────────────

class OrderbookResponse(BaseModel):
    symbol: str
    pair: str | None = None
    bids: list[list[float]] = []
    asks: list[list[float]] = []
    spread: float = 0.0
    spread_pct: float = 0.0
    mid_price: float = 0.0
    bid_volume: float = 0.0
    ask_volume: float = 0.0
    imbalance: float = 0.0
    last_update_id: int | None = None


# ──────────────────────────────────────────────────────────────
# Screener
# ──────────────────────────────────────────────────────────────

class ScreenerResponse(BaseModel):
    results: list[StockUniverseItem] = []
    total: int = 0


# ──────────────────────────────────────────────────────────────
# Trades
# ──────────────────────────────────────────────────────────────

class TradeItem(BaseModel):
    id: int | None = None
    price: float = 0.0
    qty: float = 0.0
    time: int | None = None
    is_buyer_maker: bool = False


class TradesResponse(BaseModel):
    symbol: str
    pair: str
    trades: list[TradeItem] = []


# ──────────────────────────────────────────────────────────────
# Top Movers
# ──────────────────────────────────────────────────────────────

class TopMoverItem(BaseModel):
    id: str | None = None
    symbol: str | None = None
    name: str | None = None
    image: str | None = None
    price: float | None = None
    market_cap: float | None = None
    volume: float | None = None
    change_1h: float | None = None
    change_24h: float | None = None
    change_7d: float | None = None
    sparkline: list[float] = []


class TopMoversResponse(BaseModel):
    gainers: list[TopMoverItem] = []
    losers: list[TopMoverItem] = []
    volume_leaders: list[TopMoverItem] = []
    treemap: list[TopMoverItem] = []
    updated_at: int = 0


# ──────────────────────────────────────────────────────────────
# Fear & Greed
# ──────────────────────────────────────────────────────────────

class FearGreedHistoryItem(BaseModel):
    value: int = 50
    label: str = "Neutral"
    date: str | None = None


class FearGreedResponse(BaseModel):
    value: int = 50
    label: str = "Neutral"
    timestamp: str | None = None
    history: list[FearGreedHistoryItem] = []


# ──────────────────────────────────────────────────────────────
# News & Sentiment (F1.7-③)
# ──────────────────────────────────────────────────────────────

class NewsItem(BaseModel):
    title: str
    source: str = ""
    url: str = ""
    published_at: str = ""
    sentiment_score: float = 0.0
    sentiment_label: str = "neutral"


class SentimentResponse(BaseModel):
    symbol: str
    articles: list[NewsItem] = []
    sentiment_score: float = 0.0
    conviction: int = Field(default=50, ge=0, le=100)
    classification: str = "Neutre"
    trending_topics: list[str] = []
    article_count: int = 0


# ──────────────────────────────────────────────────────────────
# Walk Score (F1.7-④)
# ──────────────────────────────────────────────────────────────

class WalkScoreBreakdown(BaseModel):
    transport: int = 0
    commerce: int = 0
    education: int = 0
    health: int = 0
    leisure: int = 0


class WalkScoreResponse(BaseModel):
    score: int = Field(default=0, ge=0, le=100)
    label: str = "Car-Dependent"
    breakdown: WalkScoreBreakdown = WalkScoreBreakdown()
    poi_count: int = 0
    radius_m: int = 1500


# ──────────────────────────────────────────────────────────────
# Geocode (F1.7-⑤)
# ──────────────────────────────────────────────────────────────

class GeocodeResult(BaseModel):
    lat: float
    lng: float
    score: float = 0.0
    label: str = ""
    context: str = ""
    postcode: str = ""
    city: str = ""
    importance: float = 0.0


class GeocodeResponse(BaseModel):
    results: list[GeocodeResult] = []
    query: str = ""


# ──────────────────────────────────────────────────────────────
# POI (typed version of existing endpoint)
# ──────────────────────────────────────────────────────────────

class POIItem(BaseModel):
    category: str
    name: str
    type: str
    lat: float
    lng: float


class POIResponse(BaseModel):
    pois: list[POIItem] = []
    count: int = 0
    radius: int = 1000
