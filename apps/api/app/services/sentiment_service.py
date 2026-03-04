"""
OmniFlow — Sentiment Analysis Service.
Phase F1.7-③: Multi-source news fetching + keyword-based NLP scoring.

Sources (free, no API key):
  - Google News RSS feed (via feedparser-style parsing with httpx)
  - Yahoo Finance embedded news (already proxied)
  - CoinGecko sentiment data (already in coin detail)

Pipeline:
  1. Fetch 20 latest news articles for a symbol
  2. Score each headline with weighted keywords
  3. Compute aggregate conviction score (0-100)
  4. Classify: Très Positif / Positif / Neutre / Négatif / Très Négatif
  5. Extract trending topics (top 5 recurring keywords)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

# ── Keyword dictionaries with weights ────────────────────────

POSITIVE_KEYWORDS: dict[str, int] = {
    # Strong positive (+3)
    "surges": 3, "soars": 3, "skyrockets": 3, "record high": 3,
    "all-time high": 3, "breakout": 3, "moon": 3,
    # Medium positive (+2)
    "rally": 2, "beats": 2, "upgrade": 2, "bullish": 2,
    "outperforms": 2, "growth": 2, "profit": 2, "gains": 2,
    "jumps": 2, "climbs": 2, "strong": 2, "boom": 2,
    "hausse": 2, "dépasse": 2, "record": 2, "croissance": 2,
    # Mild positive (+1)
    "rises": 1, "up": 1, "positive": 1, "buy": 1, "recovery": 1,
    "rebounds": 1, "higher": 1, "improve": 1, "advancement": 1,
    "optimistic": 1, "momentum": 1, "support": 1,
}

NEGATIVE_KEYWORDS: dict[str, int] = {
    # Strong negative (-3)
    "crash": 3, "plunges": 3, "collapses": 3, "hack": 3,
    "fraud": 3, "bankruptcy": 3, "delisted": 3, "scam": 3,
    # Medium negative (-2)
    "downgrade": 2, "bearish": 2, "lawsuit": 2, "warning": 2,
    "loss": 2, "falls": 2, "drops": 2, "slumps": 2,
    "decline": 2, "sell-off": 2, "recession": 2,
    "baisse": 2, "chute": 2, "perte": 2, "scandale": 2,
    # Mild negative (-1)
    "dips": 1, "down": 1, "negative": 1, "sell": 1, "risk": 1,
    "concern": 1, "lower": 1, "weak": 1, "volatility": 1,
    "uncertainty": 1, "pressure": 1,
}

# Stop words to exclude from trending topics
STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "not", "no", "nor", "so", "yet", "both", "each", "few", "more",
    "most", "other", "some", "such", "than", "too", "very", "just",
    "about", "its", "it", "this", "that", "these", "those", "stock",
    "shares", "market", "price", "trading", "today", "new", "says",
    "report", "company", "inc", "ltd", "corp",
}


def _score_headline(headline: str) -> tuple[float, str]:
    """Score a single headline. Returns (score, label)."""
    text = headline.lower()
    total = 0.0

    for kw, weight in POSITIVE_KEYWORDS.items():
        if kw in text:
            total += weight

    for kw, weight in NEGATIVE_KEYWORDS.items():
        if kw in text:
            total -= weight

    if total >= 2:
        label = "positive"
    elif total >= 0.5:
        label = "slightly_positive"
    elif total <= -2:
        label = "negative"
    elif total <= -0.5:
        label = "slightly_negative"
    else:
        label = "neutral"

    return total, label


def _compute_conviction(scores: list[float]) -> int:
    """Normalize aggregate scores to 0-100 conviction scale."""
    if not scores:
        return 50
    avg = sum(scores) / len(scores)
    # Map [-6, +6] range to [0, 100]
    normalized = (avg + 6) / 12 * 100
    return max(0, min(100, int(normalized)))


def _classify(conviction: int) -> str:
    """Classify conviction score into human-readable label."""
    if conviction >= 80:
        return "Très Positif"
    if conviction >= 60:
        return "Positif"
    if conviction >= 40:
        return "Neutre"
    if conviction >= 20:
        return "Négatif"
    return "Très Négatif"


def _extract_trending_topics(headlines: list[str], top_n: int = 5) -> list[str]:
    """Extract top N recurring meaningful words from headlines."""
    word_counts: dict[str, int] = {}
    for headline in headlines:
        words = re.findall(r"[a-zA-Z]{4,}", headline.lower())
        for word in words:
            if word not in STOP_WORDS:
                word_counts[word] = word_counts.get(word, 0) + 1

    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    return [w for w, _ in sorted_words[:top_n]]


async def _fetch_google_news_rss(symbol: str, company_name: str = "") -> list[dict]:
    """Fetch news from Google News RSS feed (no API key needed)."""
    query = f"{symbol} stock" if company_name == "" else f"{company_name} {symbol}"
    url = "https://news.google.com/rss/search"
    params = {"q": query, "hl": "en", "gl": "US", "ceid": "US:en"}

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            xml_text = resp.text
    except Exception as e:
        logger.warning("Google News RSS fetch failed for %s: %s", symbol, e)
        return []

    # Simple XML parsing without external dependency
    articles: list[dict] = []
    items = re.findall(r"<item>(.*?)</item>", xml_text, re.DOTALL)

    for item_xml in items[:20]:
        title_match = re.search(r"<title>(.*?)</title>", item_xml)
        source_match = re.search(r"<source[^>]*>(.*?)</source>", item_xml)
        link_match = re.search(r"<link/>\s*(.*?)[\s<]", item_xml)
        pub_match = re.search(r"<pubDate>(.*?)</pubDate>", item_xml)

        if not title_match:
            continue

        title = title_match.group(1).strip()
        # Unescape HTML entities
        title = title.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        title = title.replace("&#39;", "'").replace("&quot;", '"')

        source = source_match.group(1).strip() if source_match else ""
        url_str = link_match.group(1).strip() if link_match else ""
        pub_date = pub_match.group(1).strip() if pub_match else ""

        score, label = _score_headline(title)

        articles.append({
            "title": title,
            "source": source,
            "url": url_str,
            "published_at": pub_date,
            "sentiment_score": score,
            "sentiment_label": label,
        })

    return articles


async def get_sentiment_for_symbol(
    symbol: str,
    company_name: str = "",
    redis_client=None,
) -> dict:
    """
    Main entry point: fetch news + compute sentiment for a symbol.
    Returns dict matching SentimentResponse schema.
    """
    # Check cache
    cache_key = f"sentiment:{symbol.upper()}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    # Fetch news
    articles = await _fetch_google_news_rss(symbol, company_name)

    if not articles:
        result = {
            "symbol": symbol.upper(),
            "articles": [],
            "sentiment_score": 0.0,
            "conviction": 50,
            "classification": "Neutre",
            "trending_topics": [],
            "article_count": 0,
        }
    else:
        scores = [a["sentiment_score"] for a in articles]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        conviction = _compute_conviction(scores)
        classification = _classify(conviction)
        headlines = [a["title"] for a in articles]
        trending = _extract_trending_topics(headlines)

        result = {
            "symbol": symbol.upper(),
            "articles": articles,
            "sentiment_score": round(avg_score, 2),
            "conviction": conviction,
            "classification": classification,
            "trending_topics": trending,
            "article_count": len(articles),
        }

    # Cache for 15 minutes
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(result), ex=900)
        except Exception:
            pass

    return result
