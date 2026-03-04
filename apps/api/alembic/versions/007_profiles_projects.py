"""007 — Profiles, Joint Accounts & Project Budgets

New tables:
  - profiles              : household member profiles
  - profile_account_links : M:N between profiles & accounts (joint accounts)
  - project_budgets       : savings goals
  - project_contributions : deposits towards goals

Revision ID: 007_profiles_projects
Revises: 006_ai_advisor
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "007_profiles_projects"
down_revision = "006_ai_advisor"


def upgrade() -> None:
    # ── Profiles ──────────────────────────────────────────
    op.create_table(
        "profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("avatar_color", sa.String(7), server_default="#6366f1", nullable=False),
        sa.Column("type", sa.String(20), server_default="personal", nullable=False),
        sa.Column("is_default", sa.Boolean, server_default=sa.text("false"), nullable=False),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── Profile ↔ Account links ───────────────────────────
    op.create_table(
        "profile_account_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("share_pct", sa.BigInteger, server_default="100", nullable=False),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("profile_id", "account_id", name="uq_profile_account"),
    )

    # ── Project Budgets ───────────────────────────────────
    op.create_table(
        "project_budgets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon", sa.String(50), server_default="target", nullable=False),
        sa.Column("color", sa.String(7), server_default="#6366f1", nullable=False),
        sa.Column("target_amount", sa.BigInteger, nullable=False),
        sa.Column("current_amount", sa.BigInteger, server_default="0", nullable=False),
        sa.Column("deadline", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("monthly_target", sa.BigInteger, nullable=True),
        sa.Column("is_archived", sa.Boolean, server_default=sa.text("false"), nullable=False),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # ── Project Contributions ─────────────────────────────
    op.create_table(
        "project_contributions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("project_budgets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("project_contributions")
    op.drop_table("project_budgets")
    op.drop_table("profile_account_links")
    op.drop_table("profiles")
