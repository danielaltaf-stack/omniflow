"""
OmniFlow — BankFeeSchedule model.
Reference grid for French bank fees (20+ banks, amounts in centimes/year).
"""

from sqlalchemy import BigInteger, Boolean, Column, Date, String
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base, TimestampMixin, UUIDMixin


class BankFeeSchedule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bank_fee_schedules"

    bank_slug = Column(String(64), nullable=False, unique=True, index=True)
    bank_name = Column(String(128), nullable=False)
    is_online = Column(Boolean, nullable=False, default=False)

    # ── Tarifs annuels en centimes ────────────────────────────
    fee_account_maintenance = Column(BigInteger, nullable=False, default=0)
    fee_card_classic = Column(BigInteger, nullable=False, default=0)
    fee_card_premium = Column(BigInteger, nullable=False, default=0)
    fee_card_international = Column(BigInteger, nullable=False, default=0)
    fee_overdraft_commission = Column(BigInteger, nullable=False, default=0)
    fee_transfer_sepa = Column(BigInteger, nullable=False, default=0)
    fee_transfer_intl = Column(BigInteger, nullable=False, default=0)
    fee_check = Column(BigInteger, nullable=False, default=0)
    fee_insurance_card = Column(BigInteger, nullable=False, default=0)
    fee_reject = Column(BigInteger, nullable=False, default=0)
    fee_atm_other_bank = Column(BigInteger, nullable=False, default=0)

    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)
    valid_from = Column(Date, nullable=True)
