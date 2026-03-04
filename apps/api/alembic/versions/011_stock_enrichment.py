"""011 — Phase B2: Stock Enrichment (Performance, Dividends, Allocation, Envelopes)

Revision ID: 011_stock_enrichment
Revises: 010_debts
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "011_stock_enrichment"
down_revision = "010_debts"


def upgrade() -> None:
    # ── New columns on stock_positions ─────────────────────
    op.add_column("stock_positions", sa.Column("country", sa.String(2), nullable=True))
    op.add_column("stock_positions", sa.Column("isin", sa.String(12), nullable=True))
    op.add_column("stock_positions", sa.Column("annual_dividend_yield", sa.Float, nullable=True))
    op.add_column("stock_positions", sa.Column("next_ex_date", sa.Date, nullable=True))
    op.add_column("stock_positions", sa.Column("dividend_frequency", sa.String(16), nullable=True))

    # ── New columns on stock_portfolios ────────────────────
    op.add_column("stock_portfolios", sa.Column("envelope_type", sa.String(16), nullable=True, server_default="cto"))
    op.add_column("stock_portfolios", sa.Column("management_fee_pct", sa.Float, nullable=True, server_default="0.0"))
    op.add_column("stock_portfolios", sa.Column("total_deposits", sa.BigInteger, nullable=True, server_default="0"))

    # ── New table: stock_dividends ─────────────────────────
    op.create_table(
        "stock_dividends",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "position_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stock_positions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("symbol", sa.String(16), nullable=False, index=True),
        sa.Column("ex_date", sa.Date, nullable=False),
        sa.Column("pay_date", sa.Date, nullable=True),
        sa.Column("amount_per_share", sa.BigInteger, nullable=False),  # centimes
        sa.Column("currency", sa.String(3), default="EUR", nullable=False),
        sa.Column("total_amount", sa.BigInteger, nullable=False),  # centimes
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
    op.drop_table("stock_dividends")

    op.drop_column("stock_portfolios", "total_deposits")
    op.drop_column("stock_portfolios", "management_fee_pct")
    op.drop_column("stock_portfolios", "envelope_type")

    op.drop_column("stock_positions", "dividend_frequency")
    op.drop_column("stock_positions", "next_ex_date")
    op.drop_column("stock_positions", "annual_dividend_yield")
    op.drop_column("stock_positions", "isin")
    op.drop_column("stock_positions", "country")
