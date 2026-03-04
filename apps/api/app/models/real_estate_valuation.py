"""
OmniFlow — Real Estate Valuation snapshot model (Phase B3).
Stores historical DVF/manual estimation snapshots for a property.
"""

from __future__ import annotations

from sqlalchemy import BigInteger, Column, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class RealEstateValuation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "real_estate_valuations"

    property_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("real_estate_properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source = Column(String(32), nullable=False)          # dvf_cquest, dvf_cerema, manual
    price_m2_centimes = Column(BigInteger, nullable=False)
    estimation_centimes = Column(BigInteger, nullable=True)
    nb_transactions = Column(Integer, default=0, nullable=False)
    recorded_at = Column(Date, nullable=False)

    # Relationship
    property = relationship("RealEstateProperty", back_populates="valuations")
