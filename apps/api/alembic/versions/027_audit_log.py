"""
027 – Audit Log & RGPD Consent Fields (Phase E3).

Adds:
- audit_log table for tracking security-sensitive actions
- consent_* boolean fields on users table (RGPD granular consent)

Revision ID: 027_audit_log
Revises: 026_push_subscriptions
"""

revision = "027_audit_log"
down_revision = "026_push_subscriptions"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    # ── Audit Log table ─────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Indexes for efficient querying
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index(
        "ix_audit_log_user_created", "audit_log", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_audit_log_action_created", "audit_log", ["action", "created_at"]
    )

    # ── RGPD Consent fields on users ────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "consent_analytics",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "consent_push_notifications",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "consent_ai_personalization",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "consent_data_sharing",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "consent_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "privacy_policy_version",
            sa.String(20),
            server_default=sa.text("'1.0'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "privacy_policy_version")
    op.drop_column("users", "consent_updated_at")
    op.drop_column("users", "consent_data_sharing")
    op.drop_column("users", "consent_ai_personalization")
    op.drop_column("users", "consent_push_notifications")
    op.drop_column("users", "consent_analytics")
    op.drop_index("ix_audit_log_action_created", table_name="audit_log")
    op.drop_index("ix_audit_log_user_created", table_name="audit_log")
    op.drop_index("ix_audit_log_action", table_name="audit_log")
    op.drop_index("ix_audit_log_user_id", table_name="audit_log")
    op.drop_table("audit_log")
