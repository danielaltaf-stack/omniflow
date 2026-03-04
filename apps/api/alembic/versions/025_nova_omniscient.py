"""
025 – Nova Omniscient: persistent memory & enhanced conversations.

Adds nova_memories table for persistent fact/preference/goal extraction
from conversations. Also adds metadata columns to chat_conversations
for pinning, summarization, and context tracking.

Revision ID: 025_nova_omniscient
Revises: 024_financial_calendar
"""

revision = "025_nova_omniscient"
down_revision = "024_financial_calendar"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    # ── nova_memories ─────────────────────────────────────
    op.create_table(
        "nova_memories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("memory_type", sa.String(32), nullable=False, server_default="fact"),  # fact / preference / goal / insight / personality
        sa.Column("category", sa.String(64), nullable=False, server_default="general"),  # finance / investment / budget / lifestyle / tax / retirement / heritage / general
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("importance", sa.Integer(), nullable=False, server_default="5"),  # 1-10
        sa.Column("source_conversation_id", UUID(as_uuid=True), sa.ForeignKey("chat_conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("metadata_", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_nova_memories_user_type", "nova_memories", ["user_id", "memory_type"])
    op.create_index("ix_nova_memories_user_category", "nova_memories", ["user_id", "category"])

    # ── Enhance chat_conversations ────────────────────────
    op.add_column("chat_conversations", sa.Column("is_pinned", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("chat_conversations", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("chat_conversations", sa.Column("message_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("chat_conversations", sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chat_conversations", sa.Column("context_snapshot", JSONB, nullable=True))

    # ── Enhance chat_messages ─────────────────────────────
    op.add_column("chat_messages", sa.Column("tokens_used", sa.Integer(), nullable=True))
    op.add_column("chat_messages", sa.Column("model_used", sa.String(64), nullable=True))
    op.add_column("chat_messages", sa.Column("metadata_", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "metadata_")
    op.drop_column("chat_messages", "model_used")
    op.drop_column("chat_messages", "tokens_used")
    op.drop_column("chat_conversations", "context_snapshot")
    op.drop_column("chat_conversations", "last_message_at")
    op.drop_column("chat_conversations", "message_count")
    op.drop_column("chat_conversations", "summary")
    op.drop_column("chat_conversations", "is_pinned")
    op.drop_index("ix_nova_memories_user_category", table_name="nova_memories")
    op.drop_index("ix_nova_memories_user_type", table_name="nova_memories")
    op.drop_table("nova_memories")
