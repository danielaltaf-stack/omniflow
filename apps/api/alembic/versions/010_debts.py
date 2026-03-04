"""debts and debt_payments tables (Phase B1 — Module Dettes)

Revision ID: 010_debts
Revises: 009_notifications
Create Date: 2026-03-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = "010_debts"
down_revision = "009_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── debts table ───────────────────────────────────────────
    op.create_table(
        "debts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(256), nullable=False),
        sa.Column(
            "debt_type",
            sa.String(32),
            nullable=False,
            server_default="other",
        ),
        sa.Column("creditor", sa.String(256), nullable=True),
        sa.Column("initial_amount", sa.BigInteger, nullable=False),
        sa.Column("remaining_amount", sa.BigInteger, nullable=False),
        sa.Column("interest_rate_pct", sa.Float, nullable=False, server_default="0"),
        sa.Column("insurance_rate_pct", sa.Float, nullable=True, server_default="0"),
        sa.Column("monthly_payment", sa.BigInteger, nullable=False),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("duration_months", sa.Integer, nullable=False, server_default="12"),
        sa.Column(
            "early_repayment_fee_pct",
            sa.Float,
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "payment_type",
            sa.String(32),
            nullable=False,
            server_default="constant_annuity",
        ),
        sa.Column("is_deductible", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "linked_property_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("real_estate_properties.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
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
    op.create_index("ix_debts_user_id", "debts", ["user_id"])
    op.create_index("ix_debts_user_type", "debts", ["user_id", "debt_type"])

    # ── debt_payments table ───────────────────────────────────
    op.create_table(
        "debt_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "debt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("debts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("payment_date", sa.Date, nullable=False),
        sa.Column("payment_number", sa.Integer, nullable=False),
        sa.Column("total_amount", sa.BigInteger, nullable=False),
        sa.Column("principal_amount", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("interest_amount", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("insurance_amount", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("remaining_after", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("is_actual", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", postgresql.JSONB, nullable=False, server_default="{}"),
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
    op.create_index("ix_debt_payments_debt_date", "debt_payments", ["debt_id", "payment_date"])


def downgrade() -> None:
    op.drop_index("ix_debt_payments_debt_date", table_name="debt_payments")
    op.drop_table("debt_payments")
    op.drop_index("ix_debts_user_type", table_name="debts")
    op.drop_index("ix_debts_user_id", table_name="debts")
    op.drop_table("debts")
