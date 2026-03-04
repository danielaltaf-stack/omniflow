"""
OmniFlow — Peer Debt (IOU) model.
Track money lent to or borrowed from friends/family.
All monetary values in centimes (BigInteger).
"""

import enum

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class DebtDirection(str, enum.Enum):
    LENT = "lent"          # Someone owes me
    BORROWED = "borrowed"  # I owe someone


class PeerDebt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "peer_debts"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Counterparty
    counterparty_name = Column(String(255), nullable=False)
    counterparty_email = Column(String(255), nullable=True)
    counterparty_phone = Column(String(20), nullable=True)

    # Direction
    direction = Column(String(10), nullable=False)  # lent / borrowed

    # Amount (centimes)
    amount = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False, default="EUR")

    # Description
    description = Column(Text, nullable=True)

    # Dates
    date_created = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)

    # Settlement
    is_settled = Column(Boolean, nullable=False, default=False)
    settled_date = Column(Date, nullable=True)
    settled_amount = Column(BigInteger, nullable=True)  # centimes

    # Reminders
    reminder_enabled = Column(Boolean, nullable=False, default=True)
    reminder_interval_days = Column(Integer, nullable=False, default=7)
    last_reminder_at = Column(DateTime(timezone=True), nullable=True)

    # Details
    notes = Column(Text, nullable=True)
    extra_data = Column(JSONB, nullable=False, default=dict)
