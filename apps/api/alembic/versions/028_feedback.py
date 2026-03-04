"""
028 – Feedback Table (Phase E4).

Adds:
- feedback table for in-app user feedback (bug reports, feature requests)

Revision ID: 028_feedback
Revises: 027_audit_log
"""

revision = "028_feedback"
down_revision = "027_audit_log"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    op.create_table(
        "feedback",
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
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("screenshot", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="new",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_feedback_user_created",
        "feedback",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_feedback_user_created", table_name="feedback")
    op.drop_table("feedback")
