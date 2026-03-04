"""
OmniFlow — Stock Analytics Service (Phase B2).
Performance vs Benchmark, Dividend Calendar, Allocation Analysis, Envelope Summary.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client
from app.models.stock_dividend import StockDividend
from app.models.stock_portfolio import (
    EnvelopeType,
    PEA_CEILING_CENTIMES,
    PEA_PME_CEILING_CENTIMES,
    StockPortfolio,
)
from app.models.stock_position import StockPosition
from app.services.stock_service import get_user_portfolios

logger = logging.getLogger(__name__)

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance"
PERF_CACHE_TTL = 3600  # 1 hour
DIV_CACHE_TTL = 3600


# ── Yahoo Finance Chart Helpers ───────────────────────────────

async def _fetch_chart(symbol: str, period: str = "1y", interval: str = "1d") -> list[dict]:
    """
    Fetch historical price data from Yahoo Finance Chart API.
    Returns list of {date: "YYYY-MM-DD", close: float}.
    """
    cache_key = f"yahoo:chart:{symbol}:{period}:{interval}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{YAHOO_BASE}/finance/chart/{symbol}"
    params = {"range": period, "interval": interval, "events": "div"}

    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo chart fetch failed for %s: %s", symbol, e)
        return []

    chart = data.get("chart", {}).get("result", [])
    if not chart:
        return []

    result_data = chart[0]
    timestamps = result_data.get("timestamp", [])
    quotes = result_data.get("indicators", {}).get("quote", [{}])[0]
    closes = quotes.get("close", [])

    series = []
    for ts, close in zip(timestamps, closes):
        if close is not None:
            dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            series.append({"date": dt, "close": round(close, 2)})

    await redis_client.set(cache_key, json.dumps(series), ex=PERF_CACHE_TTL)
    return series


async def _fetch_dividend_events(symbol: str) -> list[dict]:
    """
    Fetch dividend events from Yahoo Finance Chart API (5 year range).
    Returns list of {date: "YYYY-MM-DD", amount: float}.
    """
    cache_key = f"yahoo:dividends:{symbol}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    url = f"{YAHOO_BASE}/finance/chart/{symbol}"
    params = {"range": "5y", "interval": "1mo", "events": "div"}

    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo dividend fetch failed for %s: %s", symbol, e)
        return []

    chart = data.get("chart", {}).get("result", [])
    if not chart:
        return []

    events = chart[0].get("events", {}).get("dividends", {})
    divs = []
    for _ts, div_data in sorted(events.items(), key=lambda x: int(x[0])):
        ts = int(_ts)
        dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        divs.append({"date": dt, "amount": round(div_data.get("amount", 0), 4)})

    await redis_client.set(cache_key, json.dumps(divs), ex=DIV_CACHE_TTL)
    return divs


def _detect_frequency(dates: list[str]) -> str:
    """Detect dividend payment frequency from a list of dates."""
    if len(dates) < 2:
        return "annual"
    from datetime import datetime as dt
    parsed = sorted(dt.strptime(d, "%Y-%m-%d") for d in dates)
    gaps = [(parsed[i + 1] - parsed[i]).days for i in range(len(parsed) - 1)]
    avg_gap = sum(gaps) / len(gaps) if gaps else 365

    if avg_gap < 45:
        return "monthly"
    elif avg_gap < 120:
        return "quarterly"
    elif avg_gap < 240:
        return "semi_annual"
    return "annual"


# Map Yahoo Finance period params to our labels
PERIOD_MAP = {
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "YTD": "ytd",
    "1Y": "1y",
    "3Y": "3y",
    "5Y": "5y",
    "MAX": "max",
}

BENCHMARK_SYMBOLS = {
    "sp500": "^GSPC",
    "cac40": "^FCHI",
    "msci_world": "URTH",
}

# ── ISIN → Country mapping (first 2 chars of ISIN = country code) ──
# Also common symbol suffixes → country
SUFFIX_COUNTRY_MAP = {
    ".PA": "FR",
    ".DE": "DE",
    ".L": "GB",
    ".TO": "CA",
    ".AX": "AU",
    ".T": "JP",
    ".HK": "HK",
    ".MI": "IT",
    ".AS": "NL",
    ".SW": "CH",
    ".MC": "ES",
    ".BR": "BE",
    ".ST": "SE",
    ".OL": "NO",
    ".HE": "FI",
    ".CO": "DK",
}


def _infer_country(symbol: str, isin: str | None = None) -> str:
    """Infer country from ISIN or symbol suffix."""
    if isin and len(isin) >= 2:
        return isin[:2].upper()
    for suffix, country in SUFFIX_COUNTRY_MAP.items():
        if symbol.upper().endswith(suffix.upper()):
            return country
    # Default: US for symbols without suffix
    if "." not in symbol:
        return "US"
    return "XX"


def _normalize_base100(series: list[dict]) -> list[dict]:
    """Normalize a price series to base 100."""
    if not series:
        return []
    base = series[0]["close"]
    if base == 0:
        return series
    return [{"date": p["date"], "value": round(p["close"] / base * 100, 2)} for p in series]


def _compute_twr(series: list[dict]) -> float:
    """Compute TWR (time-weighted return) from a price series."""
    if len(series) < 2:
        return 0.0
    first = series[0]["close"]
    last = series[-1]["close"]
    if first == 0:
        return 0.0
    return round(((last / first) - 1) * 100, 2)


# ══════════════════════════════════════════════════════════════
# B2.1 — Performance vs Benchmark
# ══════════════════════════════════════════════════════════════

async def get_performance_vs_benchmark(
    db: AsyncSession,
    user_id: UUID,
    period: str = "1Y",
) -> dict[str, Any]:
    """
    Compare portfolio performance vs benchmark indices.
    Returns TWR, normalized series (base 100), and alpha.
    """
    yahoo_period = PERIOD_MAP.get(period, "1y")

    # Get all user positions to build a synthetic portfolio series
    portfolios = await get_user_portfolios(db, user_id)
    portfolio_ids = [p.id for p in portfolios]

    if not portfolio_ids:
        return {
            "portfolio_twr": 0.0,
            "benchmarks": {},
            "portfolio_series": [],
            "alpha": 0.0,
            "period": period,
        }

    result = await db.execute(
        select(StockPosition).where(StockPosition.portfolio_id.in_(portfolio_ids))
    )
    positions = list(result.scalars().all())

    if not positions:
        return {
            "portfolio_twr": 0.0,
            "benchmarks": {},
            "portfolio_series": [],
            "alpha": 0.0,
            "period": period,
        }

    # Build weighted portfolio series using each position's price history
    symbols = list(set(p.symbol for p in positions))
    weights: dict[str, float] = {}
    total_value = sum(p.value or 0 for p in positions)

    if total_value > 0:
        for p in positions:
            sym = p.symbol
            weights[sym] = weights.get(sym, 0) + ((p.value or 0) / total_value)

    # Fetch price series for all position symbols + benchmarks
    all_symbols = symbols + list(BENCHMARK_SYMBOLS.values())
    all_series: dict[str, list[dict]] = {}

    for sym in all_symbols:
        series = await _fetch_chart(sym, yahoo_period)
        if series:
            all_series[sym] = series

    # Build synthetic portfolio series (weighted average, base 100)
    portfolio_series: list[dict] = []
    if all_series and weights:
        # Find common date set from the first available symbol
        first_sym = next((s for s in symbols if s in all_series), None)
        if first_sym:
            date_index = [p["date"] for p in all_series[first_sym]]

            # Build day-by-day portfolio value index
            for i, dt in enumerate(date_index):
                weighted_val = 0.0
                for sym, w in weights.items():
                    sym_series = all_series.get(sym, [])
                    if i < len(sym_series):
                        base = sym_series[0]["close"] if sym_series[0]["close"] != 0 else 1
                        current = sym_series[i]["close"]
                        weighted_val += w * (current / base)
                portfolio_series.append({"date": dt, "close": round(weighted_val * 100, 2)})

    portfolio_twr = _compute_twr(portfolio_series) if portfolio_series else 0.0
    portfolio_normalized = _normalize_base100(portfolio_series)

    # Build benchmark data
    benchmarks: dict[str, dict] = {}
    for name, sym in BENCHMARK_SYMBOLS.items():
        series = all_series.get(sym, [])
        twr = _compute_twr(series)
        normalized = _normalize_base100(series)
        benchmarks[name] = {"twr": twr, "series": normalized}

    # Alpha = portfolio TWR - best benchmark TWR
    best_benchmark_twr = max((b["twr"] for b in benchmarks.values()), default=0.0)
    alpha = round(portfolio_twr - best_benchmark_twr, 2)

    return {
        "portfolio_twr": portfolio_twr,
        "benchmarks": benchmarks,
        "portfolio_series": portfolio_normalized,
        "alpha": alpha,
        "period": period,
    }


# ══════════════════════════════════════════════════════════════
# B2.2 — Dividend Calendar
# ══════════════════════════════════════════════════════════════

async def get_dividend_calendar(
    db: AsyncSession,
    user_id: UUID,
    year: int | None = None,
) -> dict[str, Any]:
    """
    Build dividend calendar: past dividends + projected future.
    Returns monthly breakdown, upcoming, and per-position details.
    """
    if year is None:
        year = date.today().year

    portfolios = await get_user_portfolios(db, user_id)
    portfolio_ids = [p.id for p in portfolios]

    if not portfolio_ids:
        return _empty_dividend_response(year)

    result = await db.execute(
        select(StockPosition).where(StockPosition.portfolio_id.in_(portfolio_ids))
    )
    positions = list(result.scalars().all())

    if not positions:
        return _empty_dividend_response(year)

    total_annual = 0
    total_portfolio_value = sum(p.value or 0 for p in positions)
    monthly_breakdown = {m: 0 for m in range(1, 13)}
    upcoming: list[dict] = []
    by_position: list[dict] = []

    for pos in positions:
        div_events = await _fetch_dividend_events(pos.symbol)
        if not div_events:
            continue

        qty = float(pos.quantity or 0)
        if qty <= 0:
            continue

        # Detect frequency
        div_dates = [d["date"] for d in div_events]
        frequency = _detect_frequency(div_dates)

        # Calculate annual dividend amount
        # Use last year's total as projection
        recent_year_divs = [
            d for d in div_events
            if d["date"][:4] in (str(year), str(year - 1))
        ]
        annual_per_share = sum(d["amount"] for d in recent_year_divs)

        # If we only have last year's data, use it for projection
        if not any(d["date"][:4] == str(year) for d in recent_year_divs):
            last_year_divs = [d for d in div_events if d["date"][:4] == str(year - 1)]
            annual_per_share = sum(d["amount"] for d in last_year_divs)

        annual_amount_centimes = int(annual_per_share * qty * 100)
        total_annual += annual_amount_centimes

        # Yield calculation
        div_yield = 0.0
        if pos.current_price and pos.current_price > 0:
            div_yield = round((annual_per_share * 100 / pos.current_price) * 100, 2)

        # Update position dividend fields in DB
        pos.annual_dividend_yield = div_yield
        pos.dividend_frequency = frequency

        # Monthly breakdown: project based on frequency
        _project_monthly(monthly_breakdown, div_events, qty, year, frequency)

        # Find next upcoming dividend
        today_str = date.today().isoformat()
        future_divs = [d for d in div_events if d["date"] >= today_str]
        next_ex = future_divs[0]["date"] if future_divs else None

        if next_ex:
            pos.next_ex_date = date.fromisoformat(next_ex)
            upcoming.append({
                "symbol": pos.symbol,
                "name": pos.name,
                "ex_date": next_ex,
                "pay_date": None,  # Yahoo doesn't always provide pay_date
                "amount_per_share": int(div_events[-1]["amount"] * 100) if div_events else 0,
                "total": int(div_events[-1]["amount"] * qty * 100) if div_events else 0,
            })

        by_position.append({
            "symbol": pos.symbol,
            "name": pos.name,
            "annual_amount": annual_amount_centimes,
            "yield_pct": div_yield,
            "frequency": frequency,
            "next_ex_date": next_ex,
        })

    await db.commit()

    # Portfolio weighted yield
    portfolio_yield = 0.0
    if total_portfolio_value > 0:
        portfolio_yield = round((total_annual / total_portfolio_value) * 100, 2)

    # Sort upcoming by date
    upcoming.sort(key=lambda d: d["ex_date"])

    return {
        "year": year,
        "total_annual_projected": total_annual,
        "portfolio_yield": portfolio_yield,
        "monthly_breakdown": [
            {"month": m, "amount": monthly_breakdown[m]} for m in range(1, 13)
        ],
        "upcoming": upcoming[:10],  # Next 10 dividends
        "by_position": sorted(by_position, key=lambda x: x["annual_amount"], reverse=True),
    }


def _project_monthly(
    breakdown: dict[int, int],
    div_events: list[dict],
    qty: float,
    year: int,
    frequency: str,
) -> None:
    """Project dividend payments into monthly buckets."""
    # Use actual events for the year
    for d in div_events:
        if d["date"][:4] == str(year):
            month = int(d["date"][5:7])
            amount = int(d["amount"] * qty * 100)
            breakdown[month] += amount

    # If no events yet for this year, project based on last year's pattern
    year_events = [d for d in div_events if d["date"][:4] == str(year)]
    if not year_events:
        last_year = [d for d in div_events if d["date"][:4] == str(year - 1)]
        for d in last_year:
            month = int(d["date"][5:7])
            amount = int(d["amount"] * qty * 100)
            breakdown[month] += amount


def _empty_dividend_response(year: int) -> dict[str, Any]:
    return {
        "year": year,
        "total_annual_projected": 0,
        "portfolio_yield": 0.0,
        "monthly_breakdown": [{"month": m, "amount": 0} for m in range(1, 13)],
        "upcoming": [],
        "by_position": [],
    }


# ══════════════════════════════════════════════════════════════
# B2.3 — Allocation & Diversification
# ══════════════════════════════════════════════════════════════

async def get_allocation_analysis(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Analyze portfolio allocation by sector, country, and currency.
    Compute HHI diversification score and generate alerts/suggestions.
    """
    portfolios = await get_user_portfolios(db, user_id)
    portfolio_ids = [p.id for p in portfolios]

    if not portfolio_ids:
        return _empty_allocation_response()

    result = await db.execute(
        select(StockPosition).where(StockPosition.portfolio_id.in_(portfolio_ids))
    )
    positions = list(result.scalars().all())

    if not positions:
        return _empty_allocation_response()

    total_value = sum(p.value or 0 for p in positions)
    if total_value == 0:
        return _empty_allocation_response()

    # ── Aggregate by sector ────────────────────────────────
    by_sector: dict[str, dict] = defaultdict(lambda: {"value": 0, "count": 0})
    by_country: dict[str, dict] = defaultdict(lambda: {"value": 0, "count": 0})
    by_currency: dict[str, dict] = defaultdict(lambda: {"value": 0})

    for p in positions:
        val = p.value or 0
        sector = p.sector or "Non classé"
        country = p.country or _infer_country(p.symbol, p.isin)
        currency = p.currency or "EUR"

        # Update country in DB if not set
        if not p.country:
            p.country = country

        by_sector[sector]["value"] += val
        by_sector[sector]["count"] += 1

        by_country[country]["value"] += val
        by_country[country]["count"] += 1

        by_currency[currency]["value"] += val

    await db.commit()

    # ── Format aggregations with weight_pct ────────────────
    sector_list = sorted(
        [
            {
                "sector": k,
                "value": v["value"],
                "weight_pct": round(v["value"] / total_value * 100, 1),
                "positions_count": v["count"],
            }
            for k, v in by_sector.items()
        ],
        key=lambda x: x["value"],
        reverse=True,
    )

    country_list = sorted(
        [
            {
                "country": k,
                "value": v["value"],
                "weight_pct": round(v["value"] / total_value * 100, 1),
                "positions_count": v["count"],
            }
            for k, v in by_country.items()
        ],
        key=lambda x: x["value"],
        reverse=True,
    )

    currency_list = sorted(
        [
            {
                "currency": k,
                "value": v["value"],
                "weight_pct": round(v["value"] / total_value * 100, 1),
            }
            for k, v in by_currency.items()
        ],
        key=lambda x: x["value"],
        reverse=True,
    )

    # ── HHI (Herfindahl-Hirschman Index) ───────────────────
    position_weights = [(p.value or 0) / total_value * 100 for p in positions]
    hhi = int(sum(w ** 2 for w in position_weights))

    # Diversification score: inversely proportional to HHI, scaled 0-100
    # Perfect diversification (equal weights with many positions) → HHI close to 0
    # Single position → HHI = 10000
    diversification_score = max(0, min(100, 100 - int(hhi / 100)))

    if diversification_score >= 75:
        grade = "Excellent"
    elif diversification_score >= 50:
        grade = "Bon"
    elif diversification_score >= 25:
        grade = "Modéré"
    else:
        grade = "Concentré"

    # ── Concentration alerts ───────────────────────────────
    alerts: list[str] = []
    suggestions: list[str] = []

    for s in sector_list:
        if s["weight_pct"] > 35:
            alerts.append(
                f"⚠️ Secteur \"{s['sector']}\" = {s['weight_pct']}% du portefeuille (seuil: 35%)"
            )

    for c in country_list:
        if c["weight_pct"] > 50:
            alerts.append(
                f"⚠️ Pays \"{c['country']}\" = {c['weight_pct']}% du portefeuille (seuil: 50%)"
            )

    # Top 3 concentration check
    top3 = sorted(positions, key=lambda p: p.value or 0, reverse=True)[:3]
    top3_pct = sum((p.value or 0) for p in top3) / total_value * 100
    if top3_pct > 60:
        top3_names = ", ".join(p.symbol for p in top3)
        alerts.append(
            f"⚠️ Top 3 positions ({top3_names}) = {round(top3_pct, 1)}% du portefeuille (seuil: 60%)"
        )

    # ── Suggestions ────────────────────────────────────────
    us_pct = sum(c["weight_pct"] for c in country_list if c["country"] == "US")
    tech_pct = sum(
        s["weight_pct"]
        for s in sector_list
        if "tech" in s["sector"].lower() or "technology" in s["sector"].lower()
    )

    if us_pct > 40:
        suggestions.append(
            f"US = {us_pct:.0f}% du portefeuille. Considérez des marchés européens ou émergents pour diversifier."
        )
    if tech_pct > 30:
        suggestions.append(
            f"Tech = {tech_pct:.0f}% du portefeuille. Envisagez Santé, Énergie ou Industrie."
        )
    if len(positions) < 10:
        suggestions.append(
            f"Seulement {len(positions)} positions. Un portefeuille diversifié en compte généralement 15-25."
        )
    if not suggestions and diversification_score >= 75:
        suggestions.append("Votre portefeuille est bien diversifié. Continuez ainsi !")

    # ── Top positions ──────────────────────────────────────
    top_positions = [
        {
            "symbol": p.symbol,
            "name": p.name,
            "weight_pct": round((p.value or 0) / total_value * 100, 1),
        }
        for p in sorted(positions, key=lambda p: p.value or 0, reverse=True)[:5]
    ]

    return {
        "by_sector": sector_list,
        "by_country": country_list,
        "by_currency": currency_list,
        "hhi_score": hhi,
        "diversification_score": diversification_score,
        "diversification_grade": grade,
        "concentration_alerts": alerts,
        "suggestions": suggestions,
        "top_positions": top_positions,
    }


def _empty_allocation_response() -> dict[str, Any]:
    return {
        "by_sector": [],
        "by_country": [],
        "by_currency": [],
        "hhi_score": 0,
        "diversification_score": 100,
        "diversification_grade": "Excellent",
        "concentration_alerts": [],
        "suggestions": [],
        "top_positions": [],
    }


# ══════════════════════════════════════════════════════════════
# B2.4 — Enveloppes Fiscales
# ══════════════════════════════════════════════════════════════

# Tax rates by envelope type
ENVELOPE_TAX_RATES = {
    "pea": 17.2,        # Prélèvements sociaux only after 5 years
    "pea_pme": 17.2,
    "cto": 30.0,        # Flat tax (PFU)
    "assurance_vie": 24.7,  # After 8y: 7.5% IR + 17.2% PS (< 150k)
    "per": 30.0,        # Taxed at exit (IR + PS), but deductible at entry
}

ENVELOPE_LABELS = {
    "pea": "PEA",
    "pea_pme": "PEA-PME",
    "cto": "Compte-Titres (CTO)",
    "assurance_vie": "Assurance-Vie",
    "per": "Plan Épargne Retraite (PER)",
}


async def get_envelope_summary(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Aggregate stock portfolios by fiscal envelope type.
    Compute ceiling usage (PEA), management fees (AV), and optimization tips.
    """
    portfolios = await get_user_portfolios(db, user_id)

    if not portfolios:
        return {"envelopes": [], "total_value": 0, "fiscal_optimization_tips": []}

    # Load all positions
    portfolio_ids = [p.id for p in portfolios]
    result = await db.execute(
        select(StockPosition).where(StockPosition.portfolio_id.in_(portfolio_ids))
    )
    all_positions = list(result.scalars().all())

    # Group positions by portfolio_id
    pos_by_portfolio: dict[UUID, list[StockPosition]] = defaultdict(list)
    for p in all_positions:
        pos_by_portfolio[p.portfolio_id].append(p)

    # Aggregate by envelope type
    envelopes: dict[str, dict] = defaultdict(
        lambda: {
            "total_value": 0,
            "total_pnl": 0,
            "total_deposits": 0,
            "positions_count": 0,
            "portfolios": [],
        }
    )

    for portfolio in portfolios:
        env_type = portfolio.envelope_type or "cto"
        positions = pos_by_portfolio.get(portfolio.id, [])
        port_value = sum(p.value or 0 for p in positions)
        port_pnl = sum(p.pnl or 0 for p in positions)
        deposits = portfolio.total_deposits or 0

        envelopes[env_type]["total_value"] += port_value
        envelopes[env_type]["total_pnl"] += port_pnl
        envelopes[env_type]["total_deposits"] += deposits
        envelopes[env_type]["positions_count"] += len(positions)
        envelopes[env_type]["portfolios"].append(portfolio.label)

    total_value = sum(e["total_value"] for e in envelopes.values())

    # Build response
    envelope_list = []
    for env_type, data in envelopes.items():
        ceiling = None
        ceiling_usage_pct = None
        management_fee_annual = None

        if env_type == "pea":
            ceiling = PEA_CEILING_CENTIMES
            if data["total_deposits"] > 0:
                ceiling_usage_pct = round(data["total_deposits"] / ceiling * 100, 1)
            else:
                ceiling_usage_pct = 0.0

        elif env_type == "pea_pme":
            ceiling = PEA_PME_CEILING_CENTIMES
            if data["total_deposits"] > 0:
                ceiling_usage_pct = round(data["total_deposits"] / ceiling * 100, 1)
            else:
                ceiling_usage_pct = 0.0

        elif env_type == "assurance_vie":
            # Estimate annual management fees
            av_portfolios = [
                p for p in portfolios
                if (p.envelope_type or "cto") == "assurance_vie"
            ]
            avg_fee = sum(p.management_fee_pct or 0 for p in av_portfolios)
            if av_portfolios:
                avg_fee /= len(av_portfolios)
            management_fee_annual = int(data["total_value"] * avg_fee / 100) if avg_fee else 0

        envelope_list.append({
            "type": env_type,
            "label": ENVELOPE_LABELS.get(env_type, env_type.upper()),
            "total_value": data["total_value"],
            "total_pnl": data["total_pnl"],
            "total_deposits": data["total_deposits"],
            "positions_count": data["positions_count"],
            "portfolios": data["portfolios"],
            "ceiling": ceiling,
            "ceiling_usage_pct": ceiling_usage_pct,
            "management_fee_annual": management_fee_annual,
            "tax_rate": ENVELOPE_TAX_RATES.get(env_type, 30.0),
        })

    # Sort by value descending
    envelope_list.sort(key=lambda e: e["total_value"], reverse=True)

    # ── Fiscal optimization tips ───────────────────────────
    tips: list[str] = []

    cto_value = sum(e["total_value"] for e in envelope_list if e["type"] == "cto")
    pea_data = next((e for e in envelope_list if e["type"] == "pea"), None)
    pea_deposits = pea_data["total_deposits"] if pea_data else 0
    pea_ceiling_remaining = PEA_CEILING_CENTIMES - pea_deposits

    if cto_value > 0 and pea_ceiling_remaining > 0:
        # Estimate tax savings if transferred to PEA
        cto_pnl = sum(e["total_pnl"] for e in envelope_list if e["type"] == "cto")
        if cto_pnl > 0:
            tax_cto = int(cto_pnl * 0.30)  # 30% flat tax
            tax_pea = int(cto_pnl * 0.172)  # 17.2% social levies only
            savings = tax_cto - tax_pea
            if savings > 0:
                tips.append(
                    f"💡 Transférez vos titres éligibles du CTO vers le PEA "
                    f"(encore {_fmt_eur(pea_ceiling_remaining)} de plafond disponible). "
                    f"Économie fiscale estimée : {_fmt_eur(savings)}/an sur les plus-values."
                )

    av_data = next((e for e in envelope_list if e["type"] == "assurance_vie"), None)
    if av_data and av_data["management_fee_annual"] and av_data["management_fee_annual"] > 50000:
        tips.append(
            f"💡 Frais de gestion Assurance-Vie estimés à {_fmt_eur(av_data['management_fee_annual'])}/an. "
            f"Comparez avec des contrats en ligne (0.5% vs {av_data.get('tax_rate', 0.6):.1f}% moyen)."
        )

    if not pea_data and cto_value > 0:
        tips.append(
            "💡 Aucun PEA détecté. Ouvrez un PEA pour bénéficier d'une fiscalité réduite "
            "(17.2% vs 30% flat tax) sur vos plus-values après 5 ans."
        )

    return {
        "envelopes": envelope_list,
        "total_value": total_value,
        "fiscal_optimization_tips": tips,
    }


def _fmt_eur(centimes: int) -> str:
    """Format centimes to EUR string."""
    return f"{centimes / 100:,.0f} €".replace(",", " ")
