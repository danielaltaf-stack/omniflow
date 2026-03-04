"""004 — Phase 2B: Multi-Assets tables (crypto, stocks, real estate)

Revision ID: 004_multi_assets
Revises: 003_production_ready
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "004_multi_assets"
down_revision = "003_production_ready"


def upgrade() -> None:
    # ── Crypto Wallets ────────────────────────────────────
    op.create_table(
        "crypto_wallets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("label", sa.String(256), nullable=False),
        sa.Column("encrypted_api_key", sa.LargeBinary, nullable=True),
        sa.Column("encrypted_api_secret", sa.LargeBinary, nullable=True),
        sa.Column("address", sa.String(256), nullable=True),
        sa.Column("status", sa.String(32), default="active", nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── Crypto Holdings ───────────────────────────────────
    op.create_table(
        "crypto_holdings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("wallet_id", UUID(as_uuid=True), sa.ForeignKey("crypto_wallets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("token_symbol", sa.String(16), nullable=False, index=True),
        sa.Column("token_name", sa.String(128), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=24, scale=10), nullable=False, default=0),
        sa.Column("avg_buy_price", sa.BigInteger, nullable=True),
        sa.Column("current_price", sa.BigInteger, nullable=True),
        sa.Column("value", sa.BigInteger, default=0, nullable=False),
        sa.Column("pnl", sa.BigInteger, default=0, nullable=False),
        sa.Column("pnl_pct", sa.Float, default=0.0, nullable=False),
        sa.Column("currency", sa.String(3), default="EUR", nullable=False),
        sa.Column("last_price_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── Stock Portfolios ──────────────────────────────────
    op.create_table(
        "stock_portfolios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("label", sa.String(256), nullable=False),
        sa.Column("broker", sa.String(32), default="manual", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── Stock Positions ───────────────────────────────────
    op.create_table(
        "stock_positions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("stock_portfolios.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("symbol", sa.String(16), nullable=False, index=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=16, scale=6), nullable=False, default=0),
        sa.Column("avg_buy_price", sa.BigInteger, nullable=True),
        sa.Column("current_price", sa.BigInteger, nullable=True),
        sa.Column("value", sa.BigInteger, default=0, nullable=False),
        sa.Column("pnl", sa.BigInteger, default=0, nullable=False),
        sa.Column("pnl_pct", sa.Float, default=0.0, nullable=False),
        sa.Column("total_dividends", sa.BigInteger, default=0, nullable=False),
        sa.Column("currency", sa.String(3), default="EUR", nullable=False),
        sa.Column("sector", sa.String(128), nullable=True),
        sa.Column("last_price_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── Real Estate Properties ────────────────────────────
    op.create_table(
        "real_estate_properties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("label", sa.String(256), nullable=False),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("city", sa.String(128), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("property_type", sa.String(32), default="apartment", nullable=False),
        sa.Column("surface_m2", sa.Float, nullable=True),
        sa.Column("purchase_price", sa.BigInteger, nullable=False),
        sa.Column("purchase_date", sa.Date, nullable=True),
        sa.Column("current_value", sa.BigInteger, nullable=False),
        sa.Column("dvf_estimation", sa.BigInteger, nullable=True),
        sa.Column("monthly_rent", sa.BigInteger, default=0, nullable=False),
        sa.Column("monthly_charges", sa.BigInteger, default=0, nullable=False),
        sa.Column("monthly_loan_payment", sa.BigInteger, default=0, nullable=False),
        sa.Column("loan_remaining", sa.BigInteger, default=0, nullable=False),
        sa.Column("net_monthly_cashflow", sa.BigInteger, default=0, nullable=False),
        sa.Column("gross_yield_pct", sa.Float, default=0.0, nullable=False),
        sa.Column("net_yield_pct", sa.Float, default=0.0, nullable=False),
        sa.Column("capital_gain", sa.BigInteger, default=0, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── Performance indexes ───────────────────────────────
    op.create_index("ix_crypto_holdings_wallet_symbol", "crypto_holdings", ["wallet_id", "token_symbol"])
    op.create_index("ix_stock_positions_portfolio_symbol", "stock_positions", ["portfolio_id", "symbol"])


def downgrade() -> None:
    op.drop_index("ix_stock_positions_portfolio_symbol")
    op.drop_index("ix_crypto_holdings_wallet_symbol")
    op.drop_table("real_estate_properties")
    op.drop_table("stock_positions")
    op.drop_table("stock_portfolios")
    op.drop_table("crypto_holdings")
    op.drop_table("crypto_wallets")
