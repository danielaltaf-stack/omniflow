"""
Phase B4 — Crypto enrichment: tax engine, staking, multi-chain.
- ADD columns on crypto_holdings (staking, PMPA, PV)
- ADD chain column on crypto_wallets
- CREATE TABLE crypto_transactions
"""

from alembic import op
import sqlalchemy as sa

revision = "013_crypto_enrichment"
down_revision = "012_realestate_enrichment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── crypto_wallets: add chain ──────────────────────────
    op.add_column(
        "crypto_wallets",
        sa.Column("chain", sa.String(16), server_default="ethereum", nullable=False),
    )

    # ── crypto_holdings: staking + PMPA + PV columns ──────
    op.add_column(
        "crypto_holdings",
        sa.Column("avg_buy_price_computed", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("total_invested", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("realized_pnl", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("unrealized_pnl", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("staking_rewards_total", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("is_staked", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("staking_apy", sa.Float(), server_default="0", nullable=False),
    )
    op.add_column(
        "crypto_holdings",
        sa.Column("staking_source", sa.String(32), nullable=True),
    )

    # ── crypto_transactions: full transaction history ─────
    op.create_table(
        "crypto_transactions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "wallet_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("crypto_wallets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tx_type", sa.String(16), nullable=False),
        sa.Column("token_symbol", sa.String(16), nullable=False, index=True),
        sa.Column("quantity", sa.Numeric(precision=24, scale=10), nullable=False, server_default="0"),
        sa.Column("price_eur", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_eur", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("fee_eur", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("counterpart", sa.String(16), nullable=True),
        sa.Column("tx_hash", sa.String(128), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(32), nullable=False, server_default="manual"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("crypto_transactions")

    for col in [
        "staking_source", "staking_apy", "is_staked",
        "staking_rewards_total", "unrealized_pnl", "realized_pnl",
        "total_invested", "avg_buy_price_computed",
    ]:
        op.drop_column("crypto_holdings", col)

    op.drop_column("crypto_wallets", "chain")
