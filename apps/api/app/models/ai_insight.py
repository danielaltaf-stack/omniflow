"""
OmniFlow — Budget & AI Insight models.
"""

import enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


# ── Budget ────────────────────────────────────────────────


class BudgetLevel(str, enum.Enum):
    COMFORTABLE = "comfortable"
    OPTIMIZED = "optimized"
    AGGRESSIVE = "aggressive"


class Budget(Base, UUIDMixin, TimestampMixin):
    """Monthly budget per category, auto-generated or user-adjusted."""

    __tablename__ = "budgets"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(String(128), nullable=False)
    month = Column(String(7), nullable=False)  # "YYYY-MM"
    amount_limit = Column(BigInteger, nullable=False)  # centimes
    amount_spent = Column(BigInteger, default=0, nullable=False)  # centimes
    level = Column(
        Enum(BudgetLevel, values_callable=lambda x: [e.value for e in x]),
        default=BudgetLevel.OPTIMIZED,
        nullable=False,
    )
    is_auto = Column(Boolean, default=True, nullable=False)


# ── AI Insights ───────────────────────────────────────────


class InsightType(str, enum.Enum):
    SPENDING_TREND = "spending_trend"
    SAVINGS_OPPORTUNITY = "savings_opportunity"
    ACHIEVEMENT = "achievement"
    WARNING = "warning"
    TIP = "tip"
    ANOMALY_UNUSUAL_AMOUNT = "anomaly_unusual_amount"
    ANOMALY_DUPLICATE = "anomaly_duplicate"
    ANOMALY_NEW_RECURRING = "anomaly_new_recurring"
    ANOMALY_HIDDEN_FEE = "anomaly_hidden_fee"


class InsightSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AIInsight(Base, UUIDMixin, TimestampMixin):
    """AI-generated financial insight / anomaly / recommendation."""

    __tablename__ = "ai_insights"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(
        Enum(InsightType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    severity = Column(
        Enum(InsightSeverity, values_callable=lambda x: [e.value for e in x]),
        default=InsightSeverity.INFO,
        nullable=False,
    )
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    data = Column(JSONB, default=dict, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    is_dismissed = Column(Boolean, default=False, nullable=False)
    related_transaction_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    valid_until = Column(Date, nullable=True)
