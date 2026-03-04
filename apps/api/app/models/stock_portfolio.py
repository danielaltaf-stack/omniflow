"""
OmniFlow — Stock Portfolio model.
Groups stock positions by broker/account.
Supports envelope types (PEA, CTO, Assurance-Vie, PER).
"""

import enum

from sqlalchemy import BigInteger, Column, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Broker(str, enum.Enum):
    DEGIRO = "degiro"
    TRADE_REPUBLIC = "trade_republic"
    BOURSORAMA = "boursorama"
    MANUAL = "manual"


class EnvelopeType(str, enum.Enum):
    PEA = "pea"
    PEA_PME = "pea_pme"
    CTO = "cto"
    ASSURANCE_VIE = "assurance_vie"
    PER = "per"


# PEA ceiling in centimes (150 000 €)
PEA_CEILING_CENTIMES = 150_000 * 100
# PEA-PME ceiling in centimes (225 000 € combined with PEA)
PEA_PME_CEILING_CENTIMES = 225_000 * 100


class StockPortfolio(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "stock_portfolios"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label = Column(String(256), nullable=False)
    broker = Column(
        String(32),
        default=Broker.MANUAL.value,
        nullable=False,
    )

    # ── Phase B2: Envelope tracking ───────────────────────
    envelope_type = Column(
        String(16),
        default=EnvelopeType.CTO.value,
        nullable=True,
    )
    management_fee_pct = Column(Float, default=0.0, nullable=True)  # AV annual fee %
    total_deposits = Column(BigInteger, default=0, nullable=True)    # cumulative deposits (centimes)

    # Relationships
    positions = relationship(
        "StockPosition",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
