"""
OmniFlow — Pydantic schemas for the OmniAlert unified alert system.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


VALID_ASSET_TYPES = {"stock", "crypto", "realestate", "index"}
VALID_CONDITIONS = {
    "price_above",
    "price_below",
    "pct_change_24h_above",
    "pct_change_24h_below",
    "volume_spike",
}


# ── Create / Update ────────────────────────────────────────

class AlertCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    asset_type: str = Field(..., description="stock | crypto | realestate | index")
    symbol: str = Field(..., min_length=1, max_length=50)
    condition: str = Field(..., description="price_above | price_below | pct_change_24h_above | pct_change_24h_below | volume_spike")
    threshold: float = Field(..., gt=0)
    cooldown_minutes: int = Field(default=60, ge=1, le=10080)
    notify_in_app: bool = True
    notify_push: bool = False
    notify_email: bool = False

    @field_validator("asset_type")
    @classmethod
    def validate_asset_type(cls, v: str) -> str:
        if v not in VALID_ASSET_TYPES:
            raise ValueError(f"asset_type must be one of {VALID_ASSET_TYPES}")
        return v

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, v: str) -> str:
        if v not in VALID_CONDITIONS:
            raise ValueError(f"condition must be one of {VALID_CONDITIONS}")
        return v


class AlertUpdateRequest(BaseModel):
    name: str | None = None
    threshold: float | None = Field(default=None, gt=0)
    is_active: bool | None = None
    cooldown_minutes: int | None = Field(default=None, ge=1, le=10080)
    notify_in_app: bool | None = None
    notify_push: bool | None = None
    notify_email: bool | None = None


# ── Response ───────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: str
    name: str
    asset_type: str
    symbol: str
    condition: str
    threshold: float
    is_active: bool
    cooldown_minutes: int
    last_triggered_at: str | None
    notify_in_app: bool
    notify_push: bool
    notify_email: bool
    trigger_count: int = 0
    created_at: str
    updated_at: str


class AlertHistoryResponse(BaseModel):
    id: str
    alert_id: str
    alert_name: str
    symbol: str
    asset_type: str
    condition: str
    threshold: float
    triggered_at: str
    price_at_trigger: float
    message: str


class AlertSuggestion(BaseModel):
    name: str
    asset_type: str
    symbol: str
    condition: str
    threshold: float
    reason: str


class AlertSuggestionsResponse(BaseModel):
    suggestions: list[AlertSuggestion]
