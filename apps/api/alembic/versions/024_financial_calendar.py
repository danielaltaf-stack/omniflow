"""
024 – Financial Calendar: custom events & reminders.

Adds calendar_events table for user-created events (fiscal deadlines,
guarantee expiries, rent reminders, custom entries).
The calendar service also aggregates events dynamically from existing
tables (transactions, subscriptions, debts, dividends, etc.).

Revision ID: 024_financial_calendar
Revises: 023_image_url_text
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "024_financial_calendar"
down_revision = "023_image_url_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calendar_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        # Core
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("event_type", sa.String(40), nullable=False, server_default="custom_reminder"),
        sa.Column("event_date", sa.Date, nullable=False, index=True),
        # Amount (centimes)
        sa.Column("amount", sa.BigInteger, nullable=True),
        sa.Column("is_income", sa.Boolean, nullable=False, server_default=sa.text("false")),
        # Recurrence
        sa.Column("recurrence", sa.String(20), nullable=False, server_default="none"),
        sa.Column("recurrence_end_date", sa.Date, nullable=True),
        # Notification
        sa.Column("reminder_days_before", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("is_acknowledged", sa.Boolean, nullable=False, server_default=sa.text("false")),
        # Styling
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        # Linked entity
        sa.Column("linked_entity_type", sa.String(50), nullable=True),
        sa.Column("linked_entity_id", UUID(as_uuid=True), nullable=True),
        # Extra
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("calendar_events")
