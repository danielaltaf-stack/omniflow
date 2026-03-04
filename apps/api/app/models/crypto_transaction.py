"""
OmniFlow — Crypto Transaction model.
Records every buy/sell/swap/transfer/staking_reward/airdrop event.
All monetary amounts in EUR centimes (BigInteger).
"""

from __future__ import annotations

import enum

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class TxType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"
    SWAP = "swap"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    STAKING_REWARD = "staking_reward"
    AIRDROP = "airdrop"


class CryptoTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "crypto_transactions"

    wallet_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("crypto_wallets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tx_type = Column(String(16), nullable=False)               # buy/sell/swap/…
    token_symbol = Column(String(16), nullable=False, index=True)
    quantity = Column(Numeric(precision=24, scale=10), nullable=False, default=0)
    price_eur = Column(BigInteger, nullable=False, default=0)   # centimes per unit
    total_eur = Column(BigInteger, nullable=False, default=0)   # centimes total
    fee_eur = Column(BigInteger, nullable=False, default=0)     # centimes
    counterpart = Column(String(16), nullable=True)             # swap counterpart token
    tx_hash = Column(String(128), nullable=True)                # blockchain hash
    executed_at = Column(DateTime(timezone=True), nullable=False)
    source = Column(String(32), nullable=False, default="manual")

    # Relationships
    wallet = relationship("CryptoWallet", back_populates="transactions")
