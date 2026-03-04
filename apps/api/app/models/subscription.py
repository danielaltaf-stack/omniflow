"""
OmniFlow — Subscription model.
Contracts and recurring payments with auto-renew alerts.
All monetary values in centimes (BigInteger).
"""

import enum

from sqlalchemy import BigInteger, Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class SubscriptionCategory(str, enum.Enum):
    STREAMING = "streaming"
    FITNESS = "fitness"
    TELECOM = "telecom"
    INSURANCE = "insurance"
    SOFTWARE = "software"
    PRESS = "press"
    FOOD = "food"
    CLOUD = "cloud"
    TRANSPORT = "transport"
    OTHER = "other"


class BillingCycle(str, enum.Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"


# Billing cycle → monthly multiplier
CYCLE_TO_MONTHLY = {
    BillingCycle.WEEKLY: 52 / 12,      # ~4.33
    BillingCycle.MONTHLY: 1.0,
    BillingCycle.QUARTERLY: 1 / 3,
    BillingCycle.SEMI_ANNUAL: 1 / 6,
    BillingCycle.ANNUAL: 1 / 12,
}

CYCLE_TO_ANNUAL = {
    BillingCycle.WEEKLY: 52.0,
    BillingCycle.MONTHLY: 12.0,
    BillingCycle.QUARTERLY: 4.0,
    BillingCycle.SEMI_ANNUAL: 2.0,
    BillingCycle.ANNUAL: 1.0,
}


class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identification
    name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False)
    category = Column(String(30), nullable=False, default=SubscriptionCategory.OTHER.value)

    # Cost (centimes)
    amount = Column(BigInteger, nullable=False)
    billing_cycle = Column(String(20), nullable=False, default=BillingCycle.MONTHLY.value)
    currency = Column(String(3), nullable=False, default="EUR")

    # Dates
    next_billing_date = Column(Date, nullable=False)
    contract_start_date = Column(Date, nullable=False)
    contract_end_date = Column(Date, nullable=True)
    cancellation_deadline = Column(Date, nullable=True)

    # Renewal
    auto_renew = Column(Boolean, nullable=False, default=True)
    cancellation_notice_days = Column(Integer, nullable=False, default=0)

    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_essential = Column(Boolean, nullable=False, default=False)

    # Details
    url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    extra_data = Column(JSONB, nullable=False, default=dict)
