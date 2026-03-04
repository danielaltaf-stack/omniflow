"""
OmniFlow — RetirementProfile model.
Stores user retirement planning parameters for Monte-Carlo simulation.
One profile per user (UNIQUE on user_id).
"""

from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


DEFAULT_ASSET_RETURNS: dict = {
    "stocks": {"mean": 7.0, "std": 15.0},
    "bonds": {"mean": 2.5, "std": 5.0},
    "real_estate": {"mean": 3.5, "std": 8.0},
    "crypto": {"mean": 10.0, "std": 40.0},
    "savings": {"mean": 3.0, "std": 0.5},
    "cash": {"mean": 0.5, "std": 0.2},
}


class RetirementProfile(Base, UUIDMixin, TimestampMixin):
    """One retirement planning profile per user."""

    __tablename__ = "retirement_profiles"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Demographics ──────────────────────────────────────
    birth_year = Column(Integer, nullable=False)
    target_retirement_age = Column(Integer, nullable=False, default=64)
    life_expectancy = Column(Integer, nullable=False, default=90)

    # ── Financial inputs (centimes) ───────────────────────
    current_monthly_income = Column(BigInteger, nullable=False, default=0)
    current_monthly_expenses = Column(BigInteger, nullable=False, default=0)
    monthly_savings = Column(BigInteger, nullable=False, default=0)
    pension_estimate_monthly = Column(BigInteger, nullable=True)
    pension_quarters_acquired = Column(Integer, nullable=False, default=0)

    # ── Simulation parameters ─────────────────────────────
    target_lifestyle_pct = Column(Float, nullable=False, default=80.0)
    inflation_rate_pct = Column(Float, nullable=False, default=2.0)
    include_real_estate = Column(Boolean, nullable=False, default=True)

    # ── Per-asset-class return assumptions (JSONB) ────────
    asset_returns = Column(JSONB, nullable=False, default=DEFAULT_ASSET_RETURNS)

    # ── Extensible metadata ───────────────────────────────
    metadata_ = Column("metadata", JSONB, default=dict)
