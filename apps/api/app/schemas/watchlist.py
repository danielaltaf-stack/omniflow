"""
OmniFlow — Pydantic schemas for Watchlist CRUD operations.
Phase F1.7-②: Cross-asset watchlists.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WatchlistCreateRequest(BaseModel):
    asset_type: str = Field(..., description="stock, crypto, realestate, index")
    symbol: str = Field(..., min_length=1, max_length=50)
    name: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    target_price: float | None = None


class WatchlistUpdateRequest(BaseModel):
    display_order: int | None = None
    notes: str | None = None
    target_price: float | None = None
    name: str | None = None


class WatchlistResponse(BaseModel):
    id: UUID
    asset_type: str
    symbol: str
    name: str
    display_order: int
    notes: str | None = None
    target_price: float | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WatchlistEnrichedResponse(WatchlistResponse):
    """Extended response with live market data injected."""
    current_price: float | None = None
    change_pct: float | None = None
    change: float | None = None
    currency: str = "EUR"
    distance_to_target_pct: float | None = None


class ReorderItem(BaseModel):
    id: UUID
    display_order: int


class WatchlistReorderRequest(BaseModel):
    items: list[ReorderItem] = Field(..., min_length=1)
