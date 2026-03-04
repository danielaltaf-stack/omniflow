"""
OmniFlow — Transaction model.
Stores financial transactions. Amount in centimes (negative = debit).
"""

import enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TransactionType(str, enum.Enum):
    CARD = "card"
    TRANSFER = "transfer"
    DIRECT_DEBIT = "direct_debit"
    CHECK = "check"
    FEE = "fee"
    INTEREST = "interest"
    ATM = "atm"
    ORDER = "order"
    DEPOSIT = "deposit"
    PAYBACK = "payback"
    WITHDRAWAL = "withdrawal"
    LOAN_PAYMENT = "loan_payment"
    INSURANCE = "insurance"
    BANK = "bank"
    CASH_DEPOSIT = "cash_deposit"
    CARD_SUMMARY = "card_summary"
    DEFERRED_CARD = "deferred_card"
    OTHER = "other"


class Transaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "transactions"

    account_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(256), nullable=False)
    date = Column(Date, nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)  # centimes, negative = debit
    label = Column(String(512), nullable=False)
    raw_label = Column(Text, nullable=True)
    type = Column(Enum(TransactionType, values_callable=lambda x: [e.value for e in x]), default=TransactionType.OTHER, nullable=False)
    category = Column(String(128), nullable=True)
    subcategory = Column(String(128), nullable=True)
    merchant = Column(String(256), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    account = relationship("Account", back_populates="transactions")
