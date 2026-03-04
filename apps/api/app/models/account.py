"""
OmniFlow — Account model.
Stores aggregated bank accounts. Balance in centimes (BIGINT, never float).
"""

import enum

from sqlalchemy import (
    BigInteger,
    Column,
    Enum,
    ForeignKey,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class AccountType(str, enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    INVESTMENT = "investment"
    LOAN = "loan"
    CRYPTO = "crypto"
    CREDIT_CARD = "credit_card"
    DEPOSIT = "deposit"
    MARKET = "market"
    PEA = "pea"
    LIFE_INSURANCE = "life_insurance"
    MORTGAGE = "mortgage"
    REVOLVING_CREDIT = "revolving_credit"
    PER = "per"
    MADELIN = "madelin"
    OTHER = "other"


class Account(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "accounts"

    connection_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("bank_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(256), nullable=False)
    type = Column(Enum(AccountType, values_callable=lambda x: [e.value for e in x]), default=AccountType.CHECKING, nullable=False)
    label = Column(String(256), nullable=False)
    balance = Column(BigInteger, default=0, nullable=False)  # centimes!
    currency = Column(String(3), default="EUR", nullable=False)
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    connection = relationship("BankConnection", back_populates="accounts")
    transactions = relationship(
        "Transaction",
        back_populates="account",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
