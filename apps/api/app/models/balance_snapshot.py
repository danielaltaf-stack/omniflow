"""
OmniFlow — Balance Snapshot model.
Captures daily balance per account for Net Worth time-series.
"""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.models.base import Base, UUIDMixin


class BalanceSnapshot(Base, UUIDMixin):
    __tablename__ = "balance_snapshots"

    account_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    balance = Column(BigInteger, nullable=False)  # centimes
    currency = Column(String(3), default="EUR", nullable=False)
    captured_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_snapshots_account_date", "account_id", "captured_at"),
        Index("ix_snapshots_captured_at", "captured_at"),
    )
