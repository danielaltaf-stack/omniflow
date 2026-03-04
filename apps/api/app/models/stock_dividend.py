"""
OmniFlow — Stock Dividend model.
Tracks dividend events (past and projected) per position.
Amounts in centimes (BigInteger).
"""

from sqlalchemy import BigInteger, Column, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class StockDividend(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "stock_dividends"

    position_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("stock_positions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    symbol = Column(String(16), nullable=False, index=True)
    ex_date = Column(Date, nullable=False)
    pay_date = Column(Date, nullable=True)
    amount_per_share = Column(BigInteger, nullable=False)  # centimes
    currency = Column(String(3), default="EUR", nullable=False)
    total_amount = Column(BigInteger, nullable=False)  # centimes (qty * amount_per_share)

    # Relationships
    position = relationship("StockPosition", back_populates="dividends")
