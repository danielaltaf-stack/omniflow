"""
021 – Wealth Autopilot table.

Creates:
  - autopilot_configs  (per-user autopilot config, allocations, engine results)

Revision ID: 021_wealth_autopilot
Revises: 020_fiscal_radar
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "021_wealth_autopilot"
down_revision = "020_fiscal_radar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── autopilot_configs ─────────────────────────────────────
    op.create_table(
        "autopilot_configs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        # ── Global settings ──
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("safety_cushion_months", sa.Float(), nullable=False, server_default=sa.text("3.0")),
        sa.Column("min_savings_amount", sa.BigInteger(), nullable=False, server_default=sa.text("2000")),
        sa.Column("savings_step", sa.BigInteger(), nullable=False, server_default=sa.text("1000")),
        sa.Column("lookback_days", sa.Integer(), nullable=False, server_default=sa.text("90")),
        sa.Column("forecast_days", sa.Integer(), nullable=False, server_default=sa.text("7")),
        # ── Income ──
        sa.Column("monthly_income", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("income_day", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("other_income", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── Allocations JSONB ──
        sa.Column("allocations", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        # ── Engine results ──
        sa.Column("last_available", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_suggestion", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("suggestions_history", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("autopilot_score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("savings_rate_pct", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("analysis_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # ── Timestamps ──
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
    op.create_index("ix_autopilot_configs_user_id", "autopilot_configs", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_autopilot_configs_user_id")
    op.drop_table("autopilot_configs")
