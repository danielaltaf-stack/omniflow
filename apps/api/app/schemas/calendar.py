"""
OmniFlow — Pydantic schemas for the Financial Calendar.
Validation, serialization, and response models.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Request Schemas ──────────────────────────────────────────


class CreateCalendarEventRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    event_type: str = Field(default="custom_reminder")
    event_date: date
    amount: int | None = Field(default=None, description="In centimes")
    is_income: bool = False
    recurrence: str = Field(default="none")
    recurrence_end_date: date | None = None
    reminder_days_before: int = Field(default=1, ge=0, le=90)
    color: str | None = Field(default=None, max_length=7)
    icon: str | None = Field(default=None, max_length=50)
    linked_entity_type: str | None = None
    linked_entity_id: UUID | None = None


class UpdateCalendarEventRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    event_type: str | None = None
    event_date: date | None = None
    amount: int | None = None
    is_income: bool | None = None
    recurrence: str | None = None
    recurrence_end_date: date | None = None
    reminder_days_before: int | None = Field(default=None, ge=0, le=90)
    color: str | None = None
    icon: str | None = None
    is_acknowledged: bool | None = None
    is_active: bool | None = None


class CalendarQueryParams(BaseModel):
    start_date: date
    end_date: date
    event_types: list[str] | None = None


# ── Response Schemas ─────────────────────────────────────────


class CalendarEventResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    event_type: str
    event_date: date
    amount: int | None
    is_income: bool
    recurrence: str
    recurrence_end_date: date | None
    reminder_days_before: int
    is_acknowledged: bool
    color: str | None
    icon: str | None
    linked_entity_type: str | None
    linked_entity_id: UUID | None
    extra_data: dict
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AggregatedCalendarEvent(BaseModel):
    """A single event entry on the calendar — comes from any source."""
    id: str  # "{source}:{original_id}" or uuid for custom
    source: str  # transaction, subscription, debt, dividend, realestate, guarantee, fiscal, custom, salary, rent_income
    title: str
    description: str | None = None
    date: date
    amount: int | None = None  # centimes
    is_income: bool = False
    category: str = "other"
    color: str | None = None
    icon: str | None = None
    linked_entity_type: str | None = None
    linked_entity_id: str | None = None
    extra: dict = Field(default_factory=dict)
    is_essential: bool = True
    urgency: str = "normal"  # normal, warning, critical


class DaySummary(BaseModel):
    """Summary for one calendar day."""
    date: date
    total_income: int = 0  # centimes
    total_expenses: int = 0  # centimes
    net: int = 0
    projected_balance: int = 0  # centimes
    is_green_day: bool = True  # no non-essential spending
    events: list[AggregatedCalendarEvent] = []
    alert_level: str = "ok"  # ok, warning, danger


class CashflowLifelinePoint(BaseModel):
    """One point on the 30-day cashflow projection curve."""
    date: date
    projected_balance: int  # centimes
    day_income: int = 0
    day_expenses: int = 0
    alert: bool = False  # True if balance below threshold


class GreenDayStreak(BaseModel):
    """Green-day gamification stats for the month."""
    current_streak: int = 0
    best_streak: int = 0
    total_green_days: int = 0
    total_days_elapsed: int = 0
    pct: float = 0.0


class PaydayCountdown(BaseModel):
    """Payday countdown widget data."""
    next_payday: date | None = None
    days_remaining: int = 0
    daily_budget: int = 0  # centimes — how much user can spend per day until payday
    remaining_budget: int = 0  # centimes — total left to spend
    payday_amount: int = 0  # centimes


class RentTrackerEntry(BaseModel):
    """Rental income tracking per property."""
    property_id: str
    property_name: str
    expected_date: date
    expected_amount: int  # centimes
    received: bool = False
    days_overdue: int = 0
    status: str = "pending"  # pending, received, overdue


class CalendarMonthResponse(BaseModel):
    """Complete response for a month view."""
    month: str  # "2026-03"
    days: list[DaySummary]
    lifeline: list[CashflowLifelinePoint]
    green_streak: GreenDayStreak
    payday: PaydayCountdown
    rent_tracker: list[RentTrackerEntry]
    total_income: int = 0
    total_expenses: int = 0
    net: int = 0
    upcoming_alerts: list[AggregatedCalendarEvent] = []
