"""
OmniFlow — Autopilot Config model.
Per-user wealth autopilot configuration: safety cushion, income, allocations,
and engine results (score, suggestions, history).
All monetary values in **centimes** (BigInteger).
"""

import enum

from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class AllocationType(str, enum.Enum):
    SAFETY_CUSHION = "safety_cushion"
    PROJECT = "project"
    DCA_ETF = "dca_etf"
    DCA_CRYPTO = "dca_crypto"
    DCA_SCPI = "dca_scpi"
    DCA_BOND = "dca_bond"
    DCA_CUSTOM = "dca_custom"


class AutopilotConfig(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "autopilot_configs"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Global settings ────────────────────────────────────
    is_enabled = Column(Boolean, default=True, nullable=False)
    safety_cushion_months = Column(Float, default=3.0, nullable=False)
    min_savings_amount = Column(BigInteger, default=2000, nullable=False)   # 20€
    savings_step = Column(BigInteger, default=1000, nullable=False)         # 10€
    lookback_days = Column(Integer, default=90, nullable=False)
    forecast_days = Column(Integer, default=7, nullable=False)

    # ── Income ─────────────────────────────────────────────
    monthly_income = Column(BigInteger, default=0, nullable=False)
    income_day = Column(Integer, default=1, nullable=False)
    other_income = Column(BigInteger, default=0, nullable=False)

    # ── Allocations (JSONB list) ───────────────────────────
    allocations = Column(JSONB, default=list, nullable=False)

    # ── Engine results ─────────────────────────────────────
    last_available = Column(BigInteger, default=0, nullable=False)
    last_suggestion = Column(JSONB, default=dict, nullable=False)
    suggestions_history = Column(JSONB, default=list, nullable=False)
    autopilot_score = Column(Integer, default=0, nullable=False)
    savings_rate_pct = Column(Float, default=0.0, nullable=False)
    analysis_data = Column(JSONB, default=dict, nullable=False)
