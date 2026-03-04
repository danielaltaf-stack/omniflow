"""
OmniFlow — Loyalty Program model.
Points, miles, fidélité — converted to EUR for shadow wealth.
"""

import enum

from sqlalchemy import BigInteger, Column, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class ProgramType(str, enum.Enum):
    AIRLINE = "airline"
    HOTEL = "hotel"
    RETAIL = "retail"
    BANK = "bank"
    FUEL = "fuel"
    OTHER = "other"


# Default conversion rates (EUR per point)
DEFAULT_CONVERSION_RATES = {
    "Air France Flying Blue": 0.01,
    "Amex Membership Rewards": 0.008,
    "Accor Live Limitless": 0.002,
    "Marriott Bonvoy": 0.006,
    "Hilton Honors": 0.004,
    "British Airways Avios": 0.012,
    "Miles & More": 0.03,
    "Carrefour": 0.01,
    "Leclerc": 0.01,
    "Total Energies": 0.002,
    "Fnac+": 0.01,
    "SFR Points": 0.005,
}


class LoyaltyProgram(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "loyalty_programs"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Program
    program_name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False)
    program_type = Column(String(20), nullable=False, default=ProgramType.OTHER.value)

    # Balance
    points_balance = Column(BigInteger, nullable=False, default=0)
    points_unit = Column(String(50), nullable=False, default="points")

    # Conversion
    eur_per_point = Column(Float, nullable=False, default=0.01)
    estimated_value = Column(BigInteger, nullable=False, default=0)  # centimes

    # Expiry
    expiry_date = Column(Date, nullable=True)

    # Details
    account_number = Column(String(255), nullable=True)
    tier_status = Column(String(50), nullable=True)
    last_updated = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    extra_data = Column(JSONB, nullable=False, default=dict)
