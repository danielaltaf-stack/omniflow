"""
OmniFlow — Card Wallet model.
Bank cards with LAST 4 DIGITS ONLY for identification.
No full card numbers are ever stored. Security first.
"""

import enum

from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class CardType(str, enum.Enum):
    VISA = "visa"
    MASTERCARD = "mastercard"
    AMEX = "amex"
    CB = "cb"
    OTHER = "other"


class CardTier(str, enum.Enum):
    STANDARD = "standard"
    GOLD = "gold"
    PLATINUM = "platinum"
    PREMIUM = "premium"
    INFINITE = "infinite"
    OTHER = "other"


class InsuranceLevel(str, enum.Enum):
    NONE = "none"
    BASIC = "basic"
    EXTENDED = "extended"
    PREMIUM = "premium"


# Insurance benefits by tier (for recommendation engine)
TIER_BENEFITS = {
    CardTier.STANDARD: {
        "warranty_extension": False,
        "travel_insurance": False,
        "car_rental_insurance": False,
        "purchase_protection": False,
        "lounge_access": False,
        "fx_fee_pct": 2.0,
        "cashback_typical": 0.0,
    },
    CardTier.GOLD: {
        "warranty_extension": True,
        "travel_insurance": True,
        "car_rental_insurance": False,
        "purchase_protection": True,
        "lounge_access": False,
        "fx_fee_pct": 1.5,
        "cashback_typical": 0.5,
    },
    CardTier.PLATINUM: {
        "warranty_extension": True,
        "travel_insurance": True,
        "car_rental_insurance": True,
        "purchase_protection": True,
        "lounge_access": True,
        "fx_fee_pct": 0.0,
        "cashback_typical": 1.0,
    },
    CardTier.PREMIUM: {
        "warranty_extension": True,
        "travel_insurance": True,
        "car_rental_insurance": True,
        "purchase_protection": True,
        "lounge_access": True,
        "fx_fee_pct": 0.0,
        "cashback_typical": 1.5,
    },
    CardTier.INFINITE: {
        "warranty_extension": True,
        "travel_insurance": True,
        "car_rental_insurance": True,
        "purchase_protection": True,
        "lounge_access": True,
        "fx_fee_pct": 0.0,
        "cashback_typical": 2.0,
    },
}


class CardWallet(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "card_wallet"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identification (non-sensitive)
    card_name = Column(String(255), nullable=False)
    bank_name = Column(String(100), nullable=False)
    card_type = Column(String(20), nullable=False, default=CardType.VISA.value)
    card_tier = Column(String(20), nullable=False, default=CardTier.STANDARD.value)
    last_four = Column(String(4), nullable=False)

    # Dates
    expiry_month = Column(Integer, nullable=False)
    expiry_year = Column(Integer, nullable=False)

    # Cost & Benefits
    is_active = Column(Boolean, nullable=False, default=True)
    monthly_fee = Column(BigInteger, nullable=False, default=0)  # centimes
    annual_fee = Column(BigInteger, nullable=False, default=0)   # centimes
    cashback_pct = Column(Float, nullable=False, default=0.0)
    insurance_level = Column(String(20), nullable=False, default=InsuranceLevel.NONE.value)
    benefits = Column(JSONB, nullable=False, default=list)
    color = Column(String(7), nullable=True)
    notes = Column(Text, nullable=True)
