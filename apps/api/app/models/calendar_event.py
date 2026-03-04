"""
OmniFlow — CalendarEvent model.
User-created custom reminders & calendar entries.
All monetary values in centimes (BigInteger).
"""

import enum

from sqlalchemy import BigInteger, Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class CalendarEventType(str, enum.Enum):
    FISCAL_DEADLINE = "fiscal_deadline"
    GUARANTEE_EXPIRY = "guarantee_expiry"
    SUBSCRIPTION_TRIAL_END = "subscription_trial_end"
    CUSTOM_REMINDER = "custom_reminder"
    RENT_EXPECTED = "rent_expected"
    SALARY_EXPECTED = "salary_expected"
    INSURANCE_RENEWAL = "insurance_renewal"
    TAX_PAYMENT = "tax_payment"
    ADMIN_DEADLINE = "admin_deadline"


class RecurrenceRule(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"


class CalendarEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "calendar_events"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(40), nullable=False, default=CalendarEventType.CUSTOM_REMINDER.value)
    event_date = Column(Date, nullable=False, index=True)

    # Amount (optional, centimes)
    amount = Column(BigInteger, nullable=True)
    is_income = Column(Boolean, nullable=False, default=False)

    # Recurrence
    recurrence = Column(String(20), nullable=False, default=RecurrenceRule.NONE.value)
    recurrence_end_date = Column(Date, nullable=True)

    # Notification
    reminder_days_before = Column(Integer, nullable=False, default=1)
    is_acknowledged = Column(Boolean, nullable=False, default=False)

    # Styling
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)

    # Linked entity
    linked_entity_type = Column(String(50), nullable=True)  # debt, subscription, asset, property…
    linked_entity_id = Column(PG_UUID(as_uuid=True), nullable=True)

    # Extra
    extra_data = Column(JSONB, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
