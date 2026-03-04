"""
022 – Digital Vault & Shadow Wealth tables.

Creates:
  - tangible_assets   (cars, tech, collectibles, furniture, jewelry)
  - nft_assets        (NFTs with floor price tracking)
  - card_wallet       (bank cards — last 4 digits only, recommendations)
  - loyalty_programs  (points, miles, fidélité → EUR conversion)
  - subscriptions     (contracts, auto-renew alerts, cancellation tracking)
  - vault_documents   (IDs, diplomas, certificates, encrypted references)
  - peer_debts        (P2P IOUs with reminders)

Revision ID: 022_digital_vault
Revises: 021_wealth_autopilot
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "022_digital_vault"
down_revision = "021_wealth_autopilot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tangible_assets ───────────────────────────────────────
    op.create_table(
        "tangible_assets",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Identification
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        sa.Column("subcategory", sa.String(100), nullable=True),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("model", sa.String(255), nullable=True),
        # Values (centimes)
        sa.Column("purchase_price", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("current_value", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # Depreciation
        sa.Column("depreciation_type", sa.String(20), nullable=False, server_default="linear"),
        sa.Column("depreciation_rate", sa.Float(), nullable=False, server_default=sa.text("20.0")),
        sa.Column("residual_pct", sa.Float(), nullable=False, server_default=sa.text("10.0")),
        # Warranty
        sa.Column("warranty_expires", sa.Date(), nullable=True),
        sa.Column("warranty_provider", sa.String(255), nullable=True),
        # Details
        sa.Column("condition", sa.String(20), nullable=False, server_default="good"),
        sa.Column("serial_number", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tangible_assets_user_id", "tangible_assets", ["user_id"])

    # ── nft_assets ────────────────────────────────────────────
    op.create_table(
        "nft_assets",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Identification
        sa.Column("collection_name", sa.String(255), nullable=False),
        sa.Column("token_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("blockchain", sa.String(20), nullable=False, server_default="ethereum"),
        sa.Column("contract_address", sa.String(255), nullable=True),
        # Values
        sa.Column("purchase_price_eth", sa.Float(), nullable=True),
        sa.Column("purchase_price_eur", sa.BigInteger(), nullable=True),
        sa.Column("current_floor_eur", sa.BigInteger(), nullable=True),
        # Marketplace
        sa.Column("marketplace", sa.String(100), nullable=True),
        sa.Column("marketplace_url", sa.String(500), nullable=True),
        # Media
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("animation_url", sa.String(500), nullable=True),
        # Tracking
        sa.Column("last_price_update", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rarity_rank", sa.Integer(), nullable=True),
        sa.Column("traits", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_nft_assets_user_id", "nft_assets", ["user_id"])

    # ── card_wallet ───────────────────────────────────────────
    op.create_table(
        "card_wallet",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Identification (non-sensitive only)
        sa.Column("card_name", sa.String(255), nullable=False),
        sa.Column("bank_name", sa.String(100), nullable=False),
        sa.Column("card_type", sa.String(20), nullable=False, server_default="visa"),
        sa.Column("card_tier", sa.String(20), nullable=False, server_default="standard"),
        sa.Column("last_four", sa.String(4), nullable=False),
        # Dates
        sa.Column("expiry_month", sa.Integer(), nullable=False),
        sa.Column("expiry_year", sa.Integer(), nullable=False),
        # Cost & Benefits
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("monthly_fee", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("annual_fee", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("cashback_pct", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("insurance_level", sa.String(20), nullable=False, server_default="none"),
        sa.Column("benefits", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_card_wallet_user_id", "card_wallet", ["user_id"])

    # ── loyalty_programs ──────────────────────────────────────
    op.create_table(
        "loyalty_programs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Program
        sa.Column("program_name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("program_type", sa.String(20), nullable=False, server_default="other"),
        # Balance
        sa.Column("points_balance", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("points_unit", sa.String(50), nullable=False, server_default="'points'"),
        # Conversion
        sa.Column("eur_per_point", sa.Float(), nullable=False, server_default=sa.text("0.01")),
        sa.Column("estimated_value", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # Expiry
        sa.Column("expiry_date", sa.Date(), nullable=True),
        # Details
        sa.Column("account_number", sa.String(255), nullable=True),
        sa.Column("tier_status", sa.String(50), nullable=True),
        sa.Column("last_updated", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_loyalty_programs_user_id", "loyalty_programs", ["user_id"])

    # ── subscriptions ─────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Identification
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        # Cost (centimes)
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("billing_cycle", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="'EUR'"),
        # Dates
        sa.Column("next_billing_date", sa.Date(), nullable=False),
        sa.Column("contract_start_date", sa.Date(), nullable=False),
        sa.Column("contract_end_date", sa.Date(), nullable=True),
        sa.Column("cancellation_deadline", sa.Date(), nullable=True),
        # Renewal
        sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("cancellation_notice_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # Status
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_essential", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # Details
        sa.Column("url", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])

    # ── vault_documents ───────────────────────────────────────
    op.create_table(
        "vault_documents",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Identification
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        sa.Column("document_type", sa.String(100), nullable=False),
        # Issuer
        sa.Column("issuer", sa.String(255), nullable=True),
        # Dates
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        # Reference (encrypted)
        sa.Column("document_number", sa.String(512), nullable=True),
        # Alert
        sa.Column("reminder_days", sa.Integer(), nullable=False, server_default=sa.text("30")),
        # Details
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_vault_documents_user_id", "vault_documents", ["user_id"])

    # ── peer_debts ────────────────────────────────────────────
    op.create_table(
        "peer_debts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Counterparty
        sa.Column("counterparty_name", sa.String(255), nullable=False),
        sa.Column("counterparty_email", sa.String(255), nullable=True),
        sa.Column("counterparty_phone", sa.String(20), nullable=True),
        # Direction
        sa.Column("direction", sa.String(10), nullable=False),  # lent / borrowed
        # Amount (centimes)
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="'EUR'"),
        # Description
        sa.Column("description", sa.Text(), nullable=True),
        # Dates
        sa.Column("date_created", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        # Settlement
        sa.Column("is_settled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("settled_date", sa.Date(), nullable=True),
        sa.Column("settled_amount", sa.BigInteger(), nullable=True),
        # Reminders
        sa.Column("reminder_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("reminder_interval_days", sa.Integer(), nullable=False, server_default=sa.text("7")),
        sa.Column("last_reminder_at", sa.DateTime(timezone=True), nullable=True),
        # Details
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("extra_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_peer_debts_user_id", "peer_debts", ["user_id"])


def downgrade() -> None:
    op.drop_table("peer_debts")
    op.drop_table("vault_documents")
    op.drop_table("subscriptions")
    op.drop_table("loyalty_programs")
    op.drop_table("card_wallet")
    op.drop_table("nft_assets")
    op.drop_table("tangible_assets")
