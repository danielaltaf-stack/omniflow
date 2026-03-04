"""
026 – Push Subscriptions for Web Push Notifications (PWA Phase E1).

Adds push_subscriptions table to store Web Push API VAPID subscriptions
per user/device. Enables native push notifications for sync completion,
anomaly alerts, budget warnings, price alerts, etc.

Revision ID: 026_push_subscriptions
Revises: 025_nova_omniscient
"""

revision = "026_push_subscriptions"
down_revision = "025_nova_omniscient"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh_key", sa.Text(), nullable=False),
        sa.Column("auth_key", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_push_subscriptions_user_endpoint",
        "push_subscriptions",
        ["user_id", "endpoint"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_user_endpoint")
    op.drop_table("push_subscriptions")
