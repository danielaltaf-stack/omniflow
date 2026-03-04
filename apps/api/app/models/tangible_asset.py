"""
OmniFlow — Tangible Asset model.
Physical possessions: vehicles, tech, collectibles, furniture, jewelry.
All monetary values in centimes (BigInteger).
"""

import enum

from sqlalchemy import BigInteger, Column, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class AssetCategory(str, enum.Enum):
    VEHICLE = "vehicle"
    TECH = "tech"
    COLLECTIBLE = "collectible"
    FURNITURE = "furniture"
    JEWELRY = "jewelry"
    OTHER = "other"


class DepreciationType(str, enum.Enum):
    LINEAR = "linear"
    DECLINING = "declining"
    NONE = "none"
    MARKET = "market"


class AssetCondition(str, enum.Enum):
    MINT = "mint"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


# Default depreciation rates by category
CATEGORY_DEFAULTS = {
    AssetCategory.VEHICLE: {"depreciation_type": "linear", "rate": 15.0, "residual": 10.0},
    AssetCategory.TECH: {"depreciation_type": "declining", "rate": 25.0, "residual": 5.0},
    AssetCategory.COLLECTIBLE: {"depreciation_type": "market", "rate": 0.0, "residual": 0.0},
    AssetCategory.FURNITURE: {"depreciation_type": "linear", "rate": 10.0, "residual": 15.0},
    AssetCategory.JEWELRY: {"depreciation_type": "none", "rate": 0.0, "residual": 100.0},
    AssetCategory.OTHER: {"depreciation_type": "linear", "rate": 10.0, "residual": 10.0},
}


class TangibleAsset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tangible_assets"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identification
    name = Column(String(255), nullable=False)
    category = Column(String(30), nullable=False, default=AssetCategory.OTHER.value)
    subcategory = Column(String(100), nullable=True)
    brand = Column(String(100), nullable=True)
    model = Column(String(255), nullable=True)

    # Values (centimes)
    purchase_price = Column(BigInteger, nullable=False, default=0)
    purchase_date = Column(Date, nullable=False)
    current_value = Column(BigInteger, nullable=False, default=0)

    # Depreciation
    depreciation_type = Column(String(20), nullable=False, default=DepreciationType.LINEAR.value)
    depreciation_rate = Column(Float, nullable=False, default=20.0)
    residual_pct = Column(Float, nullable=False, default=10.0)

    # Warranty
    warranty_expires = Column(Date, nullable=True)
    warranty_provider = Column(String(255), nullable=True)

    # Details
    condition = Column(String(20), nullable=False, default=AssetCondition.GOOD.value)
    serial_number = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    extra_data = Column(JSONB, nullable=False, default=dict)
