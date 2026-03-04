"""
Phase C1 — Retirement simulation.
Creates retirement_profiles table for FIRE / retirement planning.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "017_retirement"
down_revision = "016_watchlists"
branch_labels = None
depends_on = None

DEFAULT_ASSET_RETURNS = {
    "stocks": {"mean": 7.0, "std": 15.0},
    "bonds": {"mean": 2.5, "std": 5.0},
    "real_estate": {"mean": 3.5, "std": 8.0},
    "crypto": {"mean": 10.0, "std": 40.0},
    "savings": {"mean": 3.0, "std": 0.5},
    "cash": {"mean": 0.5, "std": 0.2},
}


def upgrade() -> None:
    op.create_table(
        "retirement_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("birth_year", sa.Integer(), nullable=False),
        sa.Column("target_retirement_age", sa.Integer(), nullable=False, server_default="64"),
        sa.Column("current_monthly_income", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("current_monthly_expenses", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("monthly_savings", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("pension_estimate_monthly", sa.BigInteger(), nullable=True),
        sa.Column("pension_quarters_acquired", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_lifestyle_pct", sa.Float(), nullable=False, server_default="80.0"),
        sa.Column("inflation_rate_pct", sa.Float(), nullable=False, server_default="2.0"),
        sa.Column("life_expectancy", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("include_real_estate", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("asset_returns", JSONB, nullable=False, server_default=sa.text(f"'{sa.text(str(DEFAULT_ASSET_RETURNS)).text}'::jsonb") if False else sa.text("'{}'::jsonb")),
        sa.Column("metadata", JSONB, nullable=True, server_default=sa.text("'{}'::jsonb")),
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


def downgrade() -> None:
    op.drop_table("retirement_profiles")
