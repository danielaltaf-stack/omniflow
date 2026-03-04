"""
OmniFlow — Real Estate Property model.
Manual entry with optional DVF API estimation, rental yield calculations,
fiscal net-net yield, and loan amortisation data (Phase B3).
"""

import enum

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class PropertyType(str, enum.Enum):
    APARTMENT = "apartment"
    HOUSE = "house"
    PARKING = "parking"
    COMMERCIAL = "commercial"
    LAND = "land"
    OTHER = "other"


class FiscalRegime(str, enum.Enum):
    MICRO_FONCIER = "micro_foncier"
    REEL = "reel"


# French income-tax brackets 2026
VALID_TMI_RATES = [0.0, 11.0, 30.0, 41.0, 45.0]
CSG_CRDS_RATE = 17.2  # %
MICRO_FONCIER_ABATEMENT = 0.30  # 30 % flat deduction
MICRO_FONCIER_CEILING_CENTIMES = 1_500_000  # 15 000 € annual rent


class RealEstateProperty(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "real_estate_properties"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label = Column(String(256), nullable=False)                    # "Appartement Paris 11e"
    address = Column(Text, nullable=True)
    city = Column(String(128), nullable=True)
    postal_code = Column(String(10), nullable=True)
    latitude = Column(Float, nullable=True)                         # BAN geocoding
    longitude = Column(Float, nullable=True)                        # BAN geocoding
    property_type = Column(
        Enum(PropertyType, values_callable=lambda x: [e.value for e in x]),
        default=PropertyType.APARTMENT,
        nullable=False,
    )
    surface_m2 = Column(Float, nullable=True)

    # Financials — all in centimes
    purchase_price = Column(BigInteger, nullable=False)
    purchase_date = Column(Date, nullable=True)
    current_value = Column(BigInteger, nullable=False)             # user estimation
    dvf_estimation = Column(BigInteger, nullable=True)             # DVF API estimation

    # Rental income & expenses — monthly, centimes
    monthly_rent = Column(BigInteger, default=0, nullable=False)
    monthly_charges = Column(BigInteger, default=0, nullable=False)
    monthly_loan_payment = Column(BigInteger, default=0, nullable=False)
    loan_remaining = Column(BigInteger, default=0, nullable=False)

    # ── Phase B3: Fiscal & loan detail ────────────────────
    fiscal_regime = Column(String(16), default="micro_foncier", nullable=False)
    tmi_pct = Column(Float, default=30.0, nullable=False)
    taxe_fonciere = Column(BigInteger, default=0, nullable=False)      # annual, centimes
    assurance_pno = Column(BigInteger, default=0, nullable=False)      # monthly, centimes
    vacancy_rate_pct = Column(Float, default=0.0, nullable=False)      # % of rent
    notary_fees_pct = Column(Float, default=7.5, nullable=False)       # % of purchase price
    provision_travaux = Column(BigInteger, default=0, nullable=False)   # monthly, centimes
    loan_interest_rate = Column(Float, default=0.0, nullable=False)    # annual %
    loan_insurance_rate = Column(Float, default=0.0, nullable=False)   # annual %
    loan_duration_months = Column(Integer, default=0, nullable=False)
    loan_start_date = Column(Date, nullable=True)

    # Computed B3 fields
    net_net_yield_pct = Column(Float, default=0.0, nullable=False)
    annual_tax_burden = Column(BigInteger, default=0, nullable=False)  # impôts+PS annual centimes

    # Computed fields stored for fast queries
    net_monthly_cashflow = Column(BigInteger, default=0, nullable=False)
    gross_yield_pct = Column(Float, default=0.0, nullable=False)   # (rent*12)/purchase_price
    net_yield_pct = Column(Float, default=0.0, nullable=False)     # ((rent-charges-loan)*12)/purchase_price
    capital_gain = Column(BigInteger, default=0, nullable=False)   # current_value - purchase_price

    # Relationship to valuation history
    valuations = relationship(
        "RealEstateValuation",
        back_populates="property",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="RealEstateValuation.recorded_at.desc()",
    )
