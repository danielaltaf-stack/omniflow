"""
OmniFlow — Crypto Wallet model.
Stores user's connections to crypto exchanges (Binance, Kraken) or on-chain addresses.
"""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CryptoPlatform(str, enum.Enum):
    BINANCE = "binance"
    KRAKEN = "kraken"
    ETHERSCAN = "etherscan"
    TRADE_REPUBLIC = "trade_republic"
    POLYGON = "polygon"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    BSC = "bsc"
    MANUAL = "manual"


class CryptoWalletStatus(str, enum.Enum):
    ACTIVE = "active"
    ERROR = "error"
    SYNCING = "syncing"
    DISABLED = "disabled"


class CryptoWallet(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "crypto_wallets"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    platform = Column(
        String(32),
        nullable=False,
    )
    label = Column(String(256), nullable=False)
    encrypted_api_key = Column(LargeBinary, nullable=True)
    encrypted_api_secret = Column(LargeBinary, nullable=True)
    address = Column(String(256), nullable=True)  # For on-chain wallets
    chain = Column(String(16), default="ethereum", nullable=False)  # B4: ethereum/polygon/arbitrum/optimism/bsc
    status = Column(
        String(32),
        default=CryptoWalletStatus.ACTIVE.value,
        nullable=False,
    )
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_error = Column(Text, nullable=True)

    # Relationships
    holdings = relationship(
        "CryptoHolding",
        back_populates="wallet",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    transactions = relationship(
        "CryptoTransaction",
        back_populates="wallet",
        cascade="all, delete-orphan",
        lazy="noload",
    )
