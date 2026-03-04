"""
OmniFlow — Stock Position model.
Individual equity/ETF positions within a portfolio.
Quantities as Numeric, values in centimes (BigInteger).
Phase B2: added country, isin, dividend fields.
"""

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class StockPosition(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "stock_positions"

    portfolio_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("stock_portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    symbol = Column(String(16), nullable=False, index=True)       # AAPL, MC.PA
    name = Column(String(256), nullable=False)                     # Apple Inc.
    quantity = Column(Numeric(precision=16, scale=6), nullable=False, default=0)
    avg_buy_price = Column(BigInteger, nullable=True)              # centimes
    current_price = Column(BigInteger, nullable=True)              # centimes
    value = Column(BigInteger, default=0, nullable=False)          # centimes
    pnl = Column(BigInteger, default=0, nullable=False)            # centimes
    pnl_pct = Column(Float, default=0.0, nullable=False)
    total_dividends = Column(BigInteger, default=0, nullable=False)  # centimes
    currency = Column(String(3), default="EUR", nullable=False)
    sector = Column(String(128), nullable=True)
    last_price_at = Column(DateTime(timezone=True), nullable=True)

    # ── Phase B2: Enrichment fields ───────────────────────
    country = Column(String(2), nullable=True)                     # ISO country code (US, FR, DE...)
    isin = Column(String(12), nullable=True)                       # ISIN code
    annual_dividend_yield = Column(Float, nullable=True)           # Annual yield %
    next_ex_date = Column(Date, nullable=True)                     # Next ex-dividend date
    dividend_frequency = Column(String(16), nullable=True)         # quarterly, semi_annual, annual, monthly

    # Relationships
    portfolio = relationship("StockPortfolio", back_populates="positions")
    dividends = relationship(
        "StockDividend",
        back_populates="position",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
