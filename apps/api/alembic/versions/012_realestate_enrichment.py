"""
012 – Real Estate Enrichment (Phase B3).

Adds fiscal-yield columns, loan-detail columns, and a valuations history table.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "012_realestate_enrichment"
down_revision = "011_stock_enrichment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── New columns on real_estate_properties ──────────────────
    op.add_column("real_estate_properties", sa.Column("fiscal_regime", sa.String(16), server_default="micro_foncier", nullable=False))
    op.add_column("real_estate_properties", sa.Column("tmi_pct", sa.Float(), server_default="30.0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("taxe_fonciere", sa.BigInteger(), server_default="0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("assurance_pno", sa.BigInteger(), server_default="0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("vacancy_rate_pct", sa.Float(), server_default="0.0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("notary_fees_pct", sa.Float(), server_default="7.5", nullable=False))
    op.add_column("real_estate_properties", sa.Column("provision_travaux", sa.BigInteger(), server_default="0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("loan_interest_rate", sa.Float(), server_default="0.0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("loan_insurance_rate", sa.Float(), server_default="0.0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("loan_duration_months", sa.Integer(), server_default="0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("loan_start_date", sa.Date(), nullable=True))
    op.add_column("real_estate_properties", sa.Column("net_net_yield_pct", sa.Float(), server_default="0.0", nullable=False))
    op.add_column("real_estate_properties", sa.Column("annual_tax_burden", sa.BigInteger(), server_default="0", nullable=False))

    # ── Valuations history table ──────────────────────────────
    op.create_table(
        "real_estate_valuations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("real_estate_properties.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("price_m2_centimes", sa.BigInteger(), nullable=False),
        sa.Column("estimation_centimes", sa.BigInteger(), nullable=True),
        sa.Column("nb_transactions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recorded_at", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("real_estate_valuations")
    for col in [
        "fiscal_regime", "tmi_pct", "taxe_fonciere", "assurance_pno",
        "vacancy_rate_pct", "notary_fees_pct", "provision_travaux",
        "loan_interest_rate", "loan_insurance_rate", "loan_duration_months",
        "loan_start_date", "net_net_yield_pct", "annual_tax_burden",
    ]:
        op.drop_column("real_estate_properties", col)
