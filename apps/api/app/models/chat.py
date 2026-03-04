"""
OmniFlow — Chat models for Nova AI Advisor.
Persists conversation history for contextual follow-ups.
Enhanced with metadata, pinning, and summary support.
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


class ChatRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatConversation(Base, UUIDMixin, TimestampMixin):
    """A conversation thread between a user and Nova."""

    __tablename__ = "chat_conversations"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(256), default="Nouvelle conversation", nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    summary = Column(Text, nullable=True)
    message_count = Column(Integer, default=0, nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    context_snapshot = Column(JSONB, nullable=True)


class ChatMessage(Base, UUIDMixin, TimestampMixin):
    """A single message in a conversation."""

    __tablename__ = "chat_messages"

    conversation_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(
        Enum(ChatRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    tokens_used = Column(Integer, nullable=True)
    model_used = Column(String(64), nullable=True)
    metadata_ = Column(JSONB, nullable=True)
