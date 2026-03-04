"""
OmniFlow — Watchlist API endpoints.
Phase F1.7-②: Cross-asset persistent favourites with live enrichment.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.watchlist import VALID_WATCHLIST_ASSET_TYPES, UserWatchlist
from app.schemas.watchlist import (
    WatchlistCreateRequest,
    WatchlistEnrichedResponse,
    WatchlistReorderRequest,
    WatchlistResponse,
    WatchlistUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


# ── Helpers ───────────────────────────────────────────────────

COINGECKO_BASE = "https://api.coingecko.com/api/v3"


async def _enrich_stock_prices(symbols: list[str]) -> dict[str, dict]:
    """Fetch live stock quotes from Yahoo Finance."""
    if not symbols:
        return {}
    url = "https://query1.finance.yahoo.com/v7/finance/quote"
    params = {"symbols": ",".join(symbols)}
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        result = {}
        for q in data.get("quoteResponse", {}).get("result", []):
            sym = q.get("symbol", "")
            result[sym] = {
                "current_price": q.get("regularMarketPrice"),
                "change_pct": q.get("regularMarketChangePercent"),
                "change": q.get("regularMarketChange"),
                "currency": q.get("currency", "EUR"),
            }
        return result
    except Exception as e:
        logger.warning("Yahoo enrichment failed: %s", e)
        return {}


async def _enrich_crypto_prices(symbols: list[str]) -> dict[str, dict]:
    """Fetch live crypto prices from CoinGecko."""
    if not symbols:
        return {}
    ids_str = ",".join(s.lower() for s in symbols)
    url = f"{COINGECKO_BASE}/simple/price"
    params = {
        "ids": ids_str,
        "vs_currencies": "eur",
        "include_24hr_change": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        result = {}
        for coin_id, prices in data.items():
            result[coin_id.upper()] = {
                "current_price": prices.get("eur"),
                "change_pct": prices.get("eur_24h_change"),
                "change": None,
                "currency": "EUR",
            }
        return result
    except Exception as e:
        logger.warning("CoinGecko enrichment failed: %s", e)
        return {}


# ── Endpoints ─────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WatchlistResponse)
async def create_watchlist_item(
    body: WatchlistCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an asset to the user's watchlist."""
    if body.asset_type not in VALID_WATCHLIST_ASSET_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid asset_type. Must be one of: {', '.join(sorted(VALID_WATCHLIST_ASSET_TYPES))}",
        )

    # Check for duplicate
    existing = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == user.id,
            UserWatchlist.asset_type == body.asset_type,
            UserWatchlist.symbol == body.symbol.upper(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cet actif est déjà dans votre watchlist.")

    # Get next display_order
    max_order_result = await db.execute(
        select(UserWatchlist.display_order)
        .where(UserWatchlist.user_id == user.id)
        .order_by(UserWatchlist.display_order.desc())
        .limit(1)
    )
    max_order = max_order_result.scalar_one_or_none() or 0

    item = UserWatchlist(
        user_id=user.id,
        asset_type=body.asset_type,
        symbol=body.symbol.upper(),
        name=body.name or body.symbol.upper(),
        display_order=max_order + 1,
        notes=body.notes,
        target_price=body.target_price,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("", response_model=list[WatchlistResponse])
async def list_watchlist(
    asset_type: str | None = Query(None, description="Filter by asset_type"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's watchlist items, optionally filtered by asset type."""
    query = (
        select(UserWatchlist)
        .where(UserWatchlist.user_id == user.id)
        .order_by(UserWatchlist.display_order)
    )
    if asset_type:
        query = query.where(UserWatchlist.asset_type == asset_type)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/enriched", response_model=list[WatchlistEnrichedResponse])
async def list_watchlist_enriched(
    asset_type: str | None = Query(None, description="Filter by asset_type"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List watchlist items with live prices injected."""
    query = (
        select(UserWatchlist)
        .where(UserWatchlist.user_id == user.id)
        .order_by(UserWatchlist.display_order)
    )
    if asset_type:
        query = query.where(UserWatchlist.asset_type == asset_type)

    result = await db.execute(query)
    items = list(result.scalars().all())

    if not items:
        return []

    # Group by asset type for batch enrichment
    stock_symbols = [it.symbol for it in items if it.asset_type in ("stock", "index")]
    crypto_symbols = [it.symbol for it in items if it.asset_type == "crypto"]

    stock_prices = await _enrich_stock_prices(stock_symbols) if stock_symbols else {}
    crypto_prices = await _enrich_crypto_prices(crypto_symbols) if crypto_symbols else {}

    enriched = []
    for item in items:
        price_data: dict = {}
        if item.asset_type in ("stock", "index"):
            price_data = stock_prices.get(item.symbol, {})
        elif item.asset_type == "crypto":
            price_data = crypto_prices.get(item.symbol, {})

        current_price = price_data.get("current_price")
        distance_to_target = None
        if current_price and item.target_price and item.target_price > 0:
            distance_to_target = round(
                (item.target_price - current_price) / current_price * 100, 2
            )

        enriched.append(
            WatchlistEnrichedResponse(
                id=item.id,
                asset_type=item.asset_type,
                symbol=item.symbol,
                name=item.name,
                display_order=item.display_order,
                notes=item.notes,
                target_price=item.target_price,
                created_at=item.created_at,
                updated_at=item.updated_at,
                current_price=current_price,
                change_pct=price_data.get("change_pct"),
                change=price_data.get("change"),
                currency=price_data.get("currency", "EUR"),
                distance_to_target_pct=distance_to_target,
            )
        )

    return enriched


@router.put("/{item_id}", response_model=WatchlistResponse)
async def update_watchlist_item(
    item_id: UUID,
    body: WatchlistUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a watchlist item (notes, target price, order)."""
    result = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.id == item_id,
            UserWatchlist.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item non trouvé.")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist_item(
    item_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an asset from the watchlist."""
    result = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.id == item_id,
            UserWatchlist.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item non trouvé.")

    await db.delete(item)
    await db.commit()


@router.put("/reorder", response_model=list[WatchlistResponse])
async def reorder_watchlist(
    body: WatchlistReorderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reorder watchlist items (drag-and-drop support)."""
    for reorder_item in body.items:
        await db.execute(
            update(UserWatchlist)
            .where(
                UserWatchlist.id == reorder_item.id,
                UserWatchlist.user_id == user.id,
            )
            .values(display_order=reorder_item.display_order)
        )

    await db.commit()

    # Return updated list
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == user.id)
        .order_by(UserWatchlist.display_order)
    )
    return list(result.scalars().all())
