"""
Phase F1.5 — OmniAlert: unified cross-asset alert system.
Creates user_alerts and alert_history tables.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "015_user_alerts"
down_revision = "014_realestate_geocoding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("symbol", sa.String(50), nullable=False),
        sa.Column("condition", sa.String(30), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notify_in_app", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notify_push", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notify_email", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_user_alerts_active_symbol",
        "user_alerts",
        ["user_id", "is_active", "symbol"],
    )

    op.create_table(
        "alert_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "alert_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user_alerts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "triggered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("price_at_trigger", sa.Float(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("alert_history")
    op.drop_index("ix_user_alerts_active_symbol", table_name="user_alerts")
    op.drop_table("user_alerts")
