"""
OmniFlow — Stock Service.
Yahoo Finance API for positions & prices, CSV import for Degiro/Trade Republic/Boursorama.
TWR (Time-Weighted Return) calculation per position.
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client
from app.models.stock_portfolio import StockPortfolio, Broker
from app.models.stock_position import StockPosition

logger = logging.getLogger(__name__)

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance"
PRICE_CACHE_TTL = 300  # 5 min


# ── Yahoo Finance API ─────────────────────────────────────────

async def get_stock_quote(symbol: str) -> dict[str, Any] | None:
    """
    Get real-time quote for a stock from Yahoo Finance.
    Returns {price, name, sector, change, change_pct, currency, market_cap}.
    """
    cache_key = f"yahoo:quote:{symbol}"
    cached = await redis_client.get(cache_key)
    if cached:
        import json
        return json.loads(cached)

    url = f"{YAHOO_BASE}/finance/quote"
    params = {"symbols": symbol, "fields": "regularMarketPrice,longName,sector,currency,marketCap"}

    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo Finance quote failed for %s: %s", symbol, e)
        return None

    quotes = data.get("quoteResponse", {}).get("result", [])
    if not quotes:
        return None

    q = quotes[0]
    result = {
        "symbol": symbol,
        "name": q.get("longName") or q.get("shortName", symbol),
        "price_centimes": int(q.get("regularMarketPrice", 0) * 100),
        "change": round(q.get("regularMarketChange", 0), 2),
        "change_pct": round(q.get("regularMarketChangePercent", 0), 2),
        "currency": q.get("currency", "EUR"),
        "sector": q.get("sector", ""),
        "market_cap": q.get("marketCap", 0),
    }

    import json
    await redis_client.set(cache_key, json.dumps(result), ex=PRICE_CACHE_TTL)
    return result


async def get_stock_quotes_batch(symbols: list[str]) -> dict[str, dict[str, Any]]:
    """Get quotes for multiple symbols at once."""
    if not symbols:
        return {}

    cache_key = f"yahoo:batch:{','.join(sorted(symbols))}"
    cached = await redis_client.get(cache_key)
    if cached:
        import json
        return json.loads(cached)

    url = f"{YAHOO_BASE}/finance/quote"
    params = {"symbols": ",".join(symbols)}

    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Yahoo Finance batch quote failed: %s", e)
        return {}

    quotes = data.get("quoteResponse", {}).get("result", [])
    result: dict[str, dict[str, Any]] = {}

    for q in quotes:
        sym = q.get("symbol", "")
        result[sym] = {
            "symbol": sym,
            "name": q.get("longName") or q.get("shortName", sym),
            "price_centimes": int(q.get("regularMarketPrice", 0) * 100),
            "change": round(q.get("regularMarketChange", 0), 2),
            "change_pct": round(q.get("regularMarketChangePercent", 0), 2),
            "currency": q.get("currency", "EUR"),
            "sector": q.get("sector", ""),
        }

    import json
    await redis_client.set(cache_key, json.dumps(result), ex=PRICE_CACHE_TTL)
    return result


# ── CSV Import ─────────────────────────────────────────────────

def parse_degiro_csv(content: str) -> list[dict[str, Any]]:
    """
    Parse Degiro CSV export (Portfolio).
    Columns: Produit, ISIN, Quantité, Cours de clôture, Valeur en EUR
    """
    reader = csv.DictReader(io.StringIO(content), delimiter=",")
    positions = []

    for row in reader:
        try:
            name = row.get("Produit") or row.get("Product", "")
            isin = row.get("ISIN") or row.get("Symbol/ISIN", "")
            qty = _parse_decimal(row.get("Quantité") or row.get("Quantity", "0"))
            price = _parse_decimal(row.get("Cours de clôture") or row.get("Closing Price", "0"))
            value = _parse_decimal(row.get("Valeur en EUR") or row.get("Value in EUR", "0"))

            if qty > 0:
                positions.append({
                    "symbol": isin,
                    "name": name,
                    "quantity": float(qty),
                    "avg_buy_price": int(price * 100),  # centimes
                    "value": int(value * 100),
                    "broker": "degiro",
                })
        except (ValueError, KeyError) as e:
            logger.warning("Skipping Degiro CSV row: %s", e)
            continue

    return positions


def parse_trade_republic_csv(content: str) -> list[dict[str, Any]]:
    """
    Parse Trade Republic CSV export.
    Columns: ISIN, Name, Quantity, Average Buy Price, Current Price
    """
    reader = csv.DictReader(io.StringIO(content), delimiter=",")
    positions = []

    for row in reader:
        try:
            isin = row.get("ISIN") or row.get("isin", "")
            name = row.get("Name") or row.get("name", "")
            qty = _parse_decimal(row.get("Quantity") or row.get("quantity", "0"))
            avg_price = _parse_decimal(
                row.get("Average Buy Price") or row.get("averageBuyPrice", "0")
            )

            if qty > 0:
                positions.append({
                    "symbol": isin,
                    "name": name,
                    "quantity": float(qty),
                    "avg_buy_price": int(avg_price * 100),
                    "broker": "trade_republic",
                })
        except (ValueError, KeyError) as e:
            logger.warning("Skipping Trade Republic CSV row: %s", e)
            continue

    return positions


def parse_boursorama_csv(content: str) -> list[dict[str, Any]]:
    """
    Parse Boursorama CSV export (Portefeuille).
    Columns: Libellé, ISIN, Quantité, Cours, +/- value
    """
    reader = csv.DictReader(io.StringIO(content), delimiter=";")
    positions = []

    for row in reader:
        try:
            name = row.get("Libellé") or row.get("Libelle", "")
            isin = row.get("ISIN") or row.get("Code ISIN", "")
            qty = _parse_decimal(row.get("Quantité") or row.get("Qté", "0"))
            price = _parse_decimal(row.get("Cours") or row.get("Dernier cours", "0"))

            if qty > 0:
                positions.append({
                    "symbol": isin,
                    "name": name,
                    "quantity": float(qty),
                    "avg_buy_price": int(price * 100),
                    "broker": "boursorama",
                })
        except (ValueError, KeyError) as e:
            logger.warning("Skipping Boursorama CSV row: %s", e)
            continue

    return positions


def _parse_decimal(value: str) -> Decimal:
    """Parse a decimal from French or English format."""
    cleaned = value.strip().replace(" ", "").replace("\xa0", "")
    cleaned = cleaned.replace(",", ".")
    return Decimal(cleaned) if cleaned else Decimal("0")


CSV_PARSERS = {
    "degiro": parse_degiro_csv,
    "trade_republic": parse_trade_republic_csv,
    "boursorama": parse_boursorama_csv,
}


# ── Portfolio Management ───────────────────────────────────────

async def create_portfolio(
    db: AsyncSession,
    user_id: UUID,
    label: str,
    broker: str = "manual",
    envelope_type: str = "cto",
    management_fee_pct: float = 0.0,
    total_deposits: int = 0,
) -> StockPortfolio:
    """Create a new stock portfolio with envelope type."""
    portfolio = StockPortfolio(
        user_id=user_id,
        label=label,
        broker=broker,
        envelope_type=envelope_type,
        management_fee_pct=management_fee_pct,
        total_deposits=total_deposits,
    )
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


async def import_csv(
    db: AsyncSession,
    portfolio_id: UUID,
    user_id: UUID,
    broker: str,
    csv_content: str,
) -> int:
    """
    Import positions from a CSV file into a portfolio.
    Returns number of positions imported.
    """
    parser = CSV_PARSERS.get(broker)
    if not parser:
        raise ValueError(f"Format CSV non supporté: {broker}")

    positions = parser(csv_content)
    if not positions:
        raise ValueError("Aucune position trouvée dans le fichier CSV.")

    # Verify portfolio ownership
    result = await db.execute(
        select(StockPortfolio).where(
            StockPortfolio.id == portfolio_id,
            StockPortfolio.user_id == user_id,
        )
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise ValueError("Portfolio non trouvé.")

    # Delete existing positions and import fresh
    await db.execute(
        delete(StockPosition).where(StockPosition.portfolio_id == portfolio_id)
    )

    count = 0
    now = datetime.now(timezone.utc)

    for pos in positions:
        position = StockPosition(
            portfolio_id=portfolio_id,
            symbol=pos["symbol"],
            name=pos["name"],
            quantity=Decimal(str(pos["quantity"])),
            avg_buy_price=pos.get("avg_buy_price"),
            currency="EUR",
        )
        db.add(position)
        count += 1

    await db.commit()

    # Update prices for imported positions
    await refresh_portfolio_prices(db, portfolio_id)
    return count


async def add_position(
    db: AsyncSession,
    portfolio_id: UUID,
    user_id: UUID,
    symbol: str,
    name: str,
    quantity: float,
    avg_buy_price: int | None = None,
) -> StockPosition:
    """Add a single position to a portfolio."""
    # Verify ownership
    result = await db.execute(
        select(StockPortfolio).where(
            StockPortfolio.id == portfolio_id,
            StockPortfolio.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise ValueError("Portfolio non trouvé.")

    # Fetch current price
    quote = await get_stock_quote(symbol)
    current_price = quote["price_centimes"] if quote else 0
    value = int(Decimal(str(quantity)) * current_price)
    pnl = value - int(Decimal(str(quantity)) * (avg_buy_price or current_price)) if avg_buy_price else 0
    cost = int(Decimal(str(quantity)) * (avg_buy_price or 1))
    pnl_pct = round((pnl / cost) * 100, 2) if cost > 0 else 0.0

    position = StockPosition(
        portfolio_id=portfolio_id,
        symbol=symbol,
        name=name or (quote["name"] if quote else symbol),
        quantity=Decimal(str(quantity)),
        avg_buy_price=avg_buy_price,
        current_price=current_price,
        value=value,
        pnl=pnl,
        pnl_pct=pnl_pct,
        currency=quote.get("currency", "EUR") if quote else "EUR",
        sector=quote.get("sector", "") if quote else "",
        last_price_at=datetime.now(timezone.utc),
    )
    db.add(position)
    await db.commit()
    await db.refresh(position)
    return position


async def refresh_portfolio_prices(db: AsyncSession, portfolio_id: UUID) -> int:
    """Refresh all position prices in a portfolio from Yahoo Finance."""
    result = await db.execute(
        select(StockPosition).where(StockPosition.portfolio_id == portfolio_id)
    )
    positions = list(result.scalars().all())
    if not positions:
        return 0

    symbols = [p.symbol for p in positions]
    quotes = await get_stock_quotes_batch(symbols)
    now = datetime.now(timezone.utc)
    count = 0

    for pos in positions:
        quote = quotes.get(pos.symbol)
        if not quote:
            continue

        current_price = quote["price_centimes"]
        qty = Decimal(str(pos.quantity))
        value = int(qty * current_price)
        cost = int(qty * (pos.avg_buy_price or current_price))
        pnl = value - cost if pos.avg_buy_price else 0
        pnl_pct = round((pnl / cost) * 100, 2) if cost > 0 else 0.0

        pos.current_price = current_price
        pos.value = value
        pos.pnl = pnl
        pos.pnl_pct = pnl_pct
        pos.sector = quote.get("sector") or pos.sector
        pos.last_price_at = now
        count += 1

    await db.commit()
    return count


async def get_user_portfolios(db: AsyncSession, user_id: UUID) -> list[StockPortfolio]:
    """Get all stock portfolios for a user."""
    result = await db.execute(
        select(StockPortfolio)
        .where(StockPortfolio.user_id == user_id)
        .order_by(StockPortfolio.created_at)
    )
    return list(result.scalars().all())


async def get_portfolio_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """Aggregate all stock portfolios: total value, P&L, positions."""
    portfolios = await get_user_portfolios(db, user_id)
    portfolio_ids = [p.id for p in portfolios]

    if not portfolio_ids:
        return {"total_value": 0, "total_pnl": 0, "total_pnl_pct": 0.0, "total_dividends": 0, "positions": [], "portfolios": []}

    result = await db.execute(
        select(StockPosition)
        .where(StockPosition.portfolio_id.in_(portfolio_ids))
        .order_by(StockPosition.value.desc())
    )
    positions = result.scalars().all()

    total_value = sum(p.value or 0 for p in positions)
    total_pnl = sum(p.pnl or 0 for p in positions)
    total_dividends = sum(p.total_dividends or 0 for p in positions)
    total_cost = sum(int(Decimal(str(p.quantity)) * (p.avg_buy_price or 0)) for p in positions)
    total_pnl_pct = round((total_pnl / total_cost) * 100, 2) if total_cost > 0 else 0.0

    return {
        "total_value": total_value,
        "total_pnl": total_pnl,
        "total_pnl_pct": total_pnl_pct,
        "total_dividends": total_dividends,
        "positions": [
            {
                "id": str(p.id),
                "portfolio_id": str(p.portfolio_id),
                "symbol": p.symbol,
                "name": p.name,
                "quantity": float(p.quantity),
                "avg_buy_price": p.avg_buy_price,
                "current_price": p.current_price,
                "value": p.value,
                "pnl": p.pnl,
                "pnl_pct": p.pnl_pct,
                "total_dividends": p.total_dividends,
                "sector": p.sector,
                "currency": p.currency,
                "allocation_pct": round((p.value / total_value) * 100, 2) if total_value > 0 else 0.0,
                "country": p.country,
                "isin": p.isin,
                "annual_dividend_yield": p.annual_dividend_yield,
                "dividend_frequency": p.dividend_frequency,
            }
            for p in positions
        ],
        "portfolios": [
            {
                "id": str(p.id),
                "label": p.label,
                "broker": p.broker.value if hasattr(p.broker, "value") else str(p.broker),
                "envelope_type": p.envelope_type or "cto",
                "positions_count": sum(1 for pos in positions if pos.portfolio_id == p.id),
                "total_value": sum(pos.value or 0 for pos in positions if pos.portfolio_id == p.id),
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in portfolios
        ],
    }


async def delete_portfolio(db: AsyncSession, portfolio_id: UUID, user_id: UUID) -> bool:
    """Delete a portfolio and all its positions."""
    result = await db.execute(
        select(StockPortfolio).where(
            StockPortfolio.id == portfolio_id,
            StockPortfolio.user_id == user_id,
        )
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        return False

    await db.delete(portfolio)
    await db.commit()
    return True
