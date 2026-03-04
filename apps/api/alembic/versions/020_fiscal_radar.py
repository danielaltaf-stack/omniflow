"""
020 – Fiscal Radar tables.

Creates:
  - fiscal_profiles  (per-user fiscal configuration, envelopes, aggregates, score)

Revision ID: 020_fiscal_radar
Revises: 019_fee_negotiator
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "020_fiscal_radar"
down_revision = "019_fee_negotiator"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── fiscal_profiles ───────────────────────────────────────
    op.create_table(
        "fiscal_profiles",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        # ── Situation fiscale ──
        sa.Column("tax_household", sa.String(16), nullable=False, server_default="single"),
        sa.Column("parts_fiscales", sa.Float(), nullable=False, server_default=sa.text("1.0")),
        sa.Column("tmi_rate", sa.Float(), nullable=False, server_default=sa.text("30.0")),
        sa.Column("revenu_fiscal_ref", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── PEA ──
        sa.Column("pea_open_date", sa.Date(), nullable=True),
        sa.Column("pea_total_deposits", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── PER ──
        sa.Column("per_annual_deposits", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("per_plafond", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── Assurance-Vie ──
        sa.Column("av_open_date", sa.Date(), nullable=True),
        sa.Column("av_total_deposits", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── Immobilier agrégé ──
        sa.Column("total_revenus_fonciers", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_charges_deductibles", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("deficit_foncier_reportable", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── Crypto agrégé ──
        sa.Column("crypto_pv_annuelle", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("crypto_mv_annuelle", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── Dividendes CTO ──
        sa.Column("dividendes_bruts_annuels", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("pv_cto_annuelle", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        # ── Résultats moteur ──
        sa.Column("fiscal_score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_economy_estimate", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("analysis_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("alerts_data", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("export_data", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
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
    op.create_index("ix_fiscal_profiles_user_id", "fiscal_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_fiscal_profiles_user_id")
    op.drop_table("fiscal_profiles")
