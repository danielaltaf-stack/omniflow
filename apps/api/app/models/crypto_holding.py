"""
OmniFlow — Crypto Holding model.
Individual token positions within a crypto wallet.
Quantities stored as high-precision Numeric, values in centimes (BigInteger).
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CryptoHolding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "crypto_holdings"

    wallet_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("crypto_wallets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_symbol = Column(String(16), nullable=False, index=True)   # BTC, ETH, SOL
    token_name = Column(String(128), nullable=False)                # Bitcoin, Ethereum
    quantity = Column(Numeric(precision=24, scale=10), nullable=False, default=0)
    avg_buy_price = Column(BigInteger, nullable=True)               # centimes per unit
    current_price = Column(BigInteger, nullable=True)               # centimes per unit
    value = Column(BigInteger, default=0, nullable=False)           # centimes (qty * price)
    pnl = Column(BigInteger, default=0, nullable=False)             # centimes
    pnl_pct = Column(Float, default=0.0, nullable=False)
    currency = Column(String(3), default="EUR", nullable=False)
    last_price_at = Column(DateTime(timezone=True), nullable=True)

    # B4: PMPA & PV tracking
    avg_buy_price_computed = Column(BigInteger, default=0, nullable=False)   # centimes — PMPA
    total_invested = Column(BigInteger, default=0, nullable=False)          # centimes
    realized_pnl = Column(BigInteger, default=0, nullable=False)            # centimes
    unrealized_pnl = Column(BigInteger, default=0, nullable=False)          # centimes
    staking_rewards_total = Column(BigInteger, default=0, nullable=False)   # centimes

    # B4: Staking
    is_staked = Column(Boolean, default=False, nullable=False)
    staking_apy = Column(Float, default=0.0, nullable=False)
    staking_source = Column(String(32), nullable=True)  # binance_earn, kraken_staking, …

    # Relationships
    wallet = relationship("CryptoWallet", back_populates="holdings")
