"""
OmniFlow — Debt models.
Tracks all user debts: mortgages, consumer loans, student loans, credit cards, etc.
All monetary values in centimes (BigInteger, never float).
"""

import enum

from sqlalchemy import BigInteger, Boolean, Column, Date, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class DebtType(str, enum.Enum):
    MORTGAGE = "mortgage"
    CONSUMER = "consumer"
    STUDENT = "student"
    CREDIT_CARD = "credit_card"
    LOC = "loc"  # leasing / LOA / LLD
    LOMBARD = "lombard"
    OTHER = "other"


class PaymentType(str, enum.Enum):
    CONSTANT_ANNUITY = "constant_annuity"  # French-style (fixed payment)
    CONSTANT_AMORTIZATION = "constant_amortization"  # German-style (fixed principal)
    IN_FINE = "in_fine"  # Interest-only, capital at maturity
    DEFERRED = "deferred"  # Grace period, then standard amortization


class Debt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "debts"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(256), nullable=False)
    debt_type = Column(
        Enum(DebtType, values_callable=lambda x: [e.value for e in x]),
        default=DebtType.OTHER,
        nullable=False,
    )
    creditor = Column(String(256), nullable=True)
    initial_amount = Column(BigInteger, nullable=False)  # centimes
    remaining_amount = Column(BigInteger, nullable=False)  # centimes
    interest_rate_pct = Column(Float, nullable=False, default=0.0)  # annual nominal rate %
    insurance_rate_pct = Column(Float, nullable=True, default=0.0)  # annual insurance rate %
    monthly_payment = Column(BigInteger, nullable=False)  # centimes
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    duration_months = Column(Integer, nullable=False, default=12)
    early_repayment_fee_pct = Column(Float, default=3.0, nullable=False)
    payment_type = Column(
        Enum(PaymentType, values_callable=lambda x: [e.value for e in x]),
        default=PaymentType.CONSTANT_ANNUITY,
        nullable=False,
    )
    is_deductible = Column(Boolean, default=False, nullable=False)
    linked_property_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("real_estate_properties.id", ondelete="SET NULL"),
        nullable=True,
    )
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    payments = relationship("DebtPayment", back_populates="debt", cascade="all, delete-orphan", lazy="selectin")


class DebtPayment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "debt_payments"

    debt_id = Column(PG_UUID(as_uuid=True), ForeignKey("debts.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False)
    payment_number = Column(Integer, nullable=False)
    total_amount = Column(BigInteger, nullable=False)  # centimes
    principal_amount = Column(BigInteger, nullable=False, default=0)  # centimes
    interest_amount = Column(BigInteger, nullable=False, default=0)  # centimes
    insurance_amount = Column(BigInteger, nullable=False, default=0)  # centimes
    remaining_after = Column(BigInteger, nullable=False, default=0)  # centimes
    is_actual = Column(Boolean, default=False, nullable=False)  # True = real payment, False = projected
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    debt = relationship("Debt", back_populates="payments")
