"""
OmniFlow — Nova Memory model for persistent AI knowledge.

Stores extracted facts, preferences, goals, and insights
across conversations so Nova can build long-term understanding
of each user's financial life and personality.
"""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class MemoryType(str, enum.Enum):
    FACT = "fact"                # Hard fact: "owns 2 properties", "has 3 children"
    PREFERENCE = "preference"   # "prefers ETFs over stocks", "risk-averse"
    GOAL = "goal"               # "wants to retire at 55", "saving for house down-payment"
    INSIGHT = "insight"         # AI-derived: "spending trend upward in restaurants"
    PERSONALITY = "personality"  # Communication style: "likes detailed explanations"


class MemoryCategory(str, enum.Enum):
    GENERAL = "general"
    FINANCE = "finance"
    INVESTMENT = "investment"
    BUDGET = "budget"
    LIFESTYLE = "lifestyle"
    TAX = "tax"
    RETIREMENT = "retirement"
    HERITAGE = "heritage"
    REAL_ESTATE = "real_estate"
    CAREER = "career"
    FAMILY = "family"


class NovaMemory(Base, UUIDMixin, TimestampMixin):
    """
    A persistent memory extracted from conversations or data analysis.
    Nova uses these to build long-term understanding of the user.
    """

    __tablename__ = "nova_memories"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    memory_type = Column(
        String(32),
        nullable=False,
        default="fact",
    )
    category = Column(
        String(64),
        nullable=False,
        default="general",
    )
    content = Column(Text, nullable=False)
    importance = Column(Integer, nullable=False, default=5)  # 1-10
    source_conversation_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    metadata_ = Column(JSONB, nullable=True)
