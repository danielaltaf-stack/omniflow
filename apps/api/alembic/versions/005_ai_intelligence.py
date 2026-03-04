"""005 — Phase 4A: AI Intelligence tables (budgets, ai_insights)

Revision ID: 005_ai_intelligence
Revises: 004_multi_assets
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "005_ai_intelligence"
down_revision = "004_multi_assets"


def upgrade() -> None:
    # ── Budgets table ─────────────────────────────────────
    op.create_table(
        "budgets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("category", sa.String(128), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),  # "YYYY-MM"
        sa.Column("amount_limit", sa.BigInteger, nullable=False),
        sa.Column("amount_spent", sa.BigInteger, default=0, nullable=False),
        sa.Column("level", sa.Enum('comfortable', 'optimized', 'aggressive', name='budgetlevel'), default="optimized", nullable=False),
        sa.Column("is_auto", sa.Boolean, default=True, nullable=False),
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
    op.create_index(
        "ix_budgets_user_month",
        "budgets",
        ["user_id", "month"],
    )
    op.create_index(
        "ix_budgets_user_category_month",
        "budgets",
        ["user_id", "category", "month"],
        unique=True,
    )

    # ── AI Insights table ─────────────────────────────────
    op.create_table(
        "ai_insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("type", sa.Enum('spending_trend', 'savings_opportunity', 'achievement', 'warning', 'tip', 'anomaly_unusual_amount', 'anomaly_duplicate', 'anomaly_new_recurring', 'anomaly_hidden_fee', name='insighttype'), nullable=False),
        sa.Column("severity", sa.Enum('info', 'warning', 'critical', name='insightseverity'), default="info", nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("data", JSONB, default={}, nullable=False),
        sa.Column("confidence", sa.Float, default=1.0, nullable=False),
        sa.Column("is_read", sa.Boolean, default=False, nullable=False),
        sa.Column("is_dismissed", sa.Boolean, default=False, nullable=False),
        sa.Column(
            "related_transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("valid_until", sa.Date, nullable=True),
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
    op.create_index(
        "ix_ai_insights_user_type",
        "ai_insights",
        ["user_id", "type"],
    )
    op.create_index(
        "ix_ai_insights_severity",
        "ai_insights",
        ["severity"],
    )


def downgrade() -> None:
    op.drop_table("ai_insights")
    op.drop_table("budgets")

    sa.Enum(name="insightseverity").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="insighttype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="budgetlevel").drop(op.get_bind(), checkfirst=True)
