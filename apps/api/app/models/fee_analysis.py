"""
OmniFlow — FeeAnalysis model.
Per-user fee scan results, comparison, and negotiation state.
"""

from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy import ForeignKey

from app.models.base import Base, TimestampMixin, UUIDMixin


class FeeAnalysis(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "fee_analyses"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Scan results (centimes) ──────────────────────────────
    total_fees_annual = Column(BigInteger, nullable=False, default=0)
    fees_by_type = Column(JSONB, nullable=False, default=dict)
    monthly_breakdown = Column(JSONB, nullable=False, default=list)

    # ── Comparison ───────────────────────────────────────────
    best_alternative_slug = Column(String(64), nullable=True)
    best_alternative_saving = Column(BigInteger, nullable=False, default=0)
    top_alternatives = Column(JSONB, nullable=False, default=list)
    overcharge_score = Column(Integer, nullable=False, default=50)

    # ── Negotiation ──────────────────────────────────────────
    negotiation_status = Column(String(32), nullable=False, default="none")
    negotiation_letter = Column(Text, nullable=True)
    negotiation_sent_at = Column(DateTime(timezone=True), nullable=True)
    negotiation_result_amount = Column(BigInteger, nullable=False, default=0)

    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)
