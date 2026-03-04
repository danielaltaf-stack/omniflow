"""
OmniFlow — HeritageSimulation model.
Stores user succession planning parameters (heirs, marital regime, insurance, donations).
One simulation profile per user (UNIQUE on user_id).
"""

from __future__ import annotations

from sqlalchemy import BigInteger, Boolean, Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class HeritageSimulation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "heritage_simulations"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Régime matrimonial ────────────────────────────────
    marital_regime = Column(
        String(32), nullable=False, default="communaute",
    )
    # Values: communaute, separation, pacs, concubinage, universel

    # ── Héritiers ─────────────────────────────────────────
    heirs = Column(JSONB, nullable=False, default=list)
    # Each entry: {"name": str, "relationship": str, "age": int|null, "handicap": bool}

    # ── Assurance-vie ─────────────────────────────────────
    life_insurance_before_70 = Column(BigInteger, nullable=False, default=0)
    life_insurance_after_70 = Column(BigInteger, nullable=False, default=0)

    # ── Historique de donations ───────────────────────────
    donation_history = Column(JSONB, nullable=False, default=list)
    # Each entry: {"heir_name": str, "amount": int, "date": str, "type": str}

    # ── Preferences ───────────────────────────────────────
    include_real_estate = Column(Boolean, nullable=False, default=True)
    include_life_insurance = Column(Boolean, nullable=False, default=True)
    custom_patrimoine_override = Column(BigInteger, nullable=True)

    # ── Cached result ─────────────────────────────────────
    last_simulation_result = Column(JSONB, nullable=True)

    # ── Metadata ──────────────────────────────────────────
    metadata_ = Column("metadata", JSONB, default=dict)
