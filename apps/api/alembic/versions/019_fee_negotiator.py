"""
019 – Fee Negotiator tables.

Creates:
  - bank_fee_schedules  (reference grid for 20+ French banks)
  - fee_analyses        (per-user scan results + negotiation state)

Revision ID: 019_fee_negotiator
Revises: 018_heritage
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "019_fee_negotiator"
down_revision = "018_heritage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── bank_fee_schedules ────────────────────────────────────
    op.create_table(
        "bank_fee_schedules",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("bank_slug", sa.String(64), nullable=False, unique=True),
        sa.Column("bank_name", sa.String(128), nullable=False),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # Tarifs annuels en centimes
        sa.Column("fee_account_maintenance", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_card_classic", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_card_premium", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_card_international", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_overdraft_commission", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_transfer_sepa", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_transfer_intl", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_check", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_insurance_card", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_reject", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fee_atm_other_bank", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("valid_from", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── fee_analyses ──────────────────────────────────────────
    op.create_table(
        "fee_analyses",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        # Scan results
        sa.Column("total_fees_annual", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("fees_by_type", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("monthly_breakdown", JSONB, nullable=False, server_default=sa.text("'[]'")),
        # Comparison
        sa.Column("best_alternative_slug", sa.String(64), nullable=True),
        sa.Column("best_alternative_saving", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("top_alternatives", JSONB, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("overcharge_score", sa.Integer(), nullable=False, server_default=sa.text("50")),
        # Negotiation
        sa.Column("negotiation_status", sa.String(32), nullable=False, server_default=sa.text("'none'")),
        sa.Column("negotiation_letter", sa.Text(), nullable=True),
        sa.Column("negotiation_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("negotiation_result_amount", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── Seed 20 French banks ──────────────────────────────────
    op.execute(_seed_sql())


def downgrade() -> None:
    op.drop_table("fee_analyses")
    op.drop_table("bank_fee_schedules")


def _seed_sql() -> str:
    """Insert 20 reference bank fee schedules (amounts in centimes/year)."""
    rows = [
        # (slug, name, online, maint, card_classic, card_premium, card_intl, overdraft, sepa, intl, check, insurance, reject, atm_other)
        ("boursorama", "Boursorama Banque", True, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ("fortuneo", "Fortuneo", True, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ("hello_bank", "Hello Bank", True, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ("boursobank", "BoursoBank", True, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ("ing", "ING", True, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ("monabanq", "Monabanq", True, 0, 2400, 7200, 0, 0, 0, 0, 0, 0, 0, 0),
        ("orange_bank", "Orange Bank", True, 0, 0, 5988, 0, 0, 0, 0, 0, 0, 0, 0),
        ("n26", "N26", True, 0, 0, 11880, 0, 0, 0, 0, 0, 0, 0, 0),
        ("revolut", "Revolut", True, 0, 0, 9588, 0, 0, 0, 0, 0, 0, 0, 0),
        ("axa_banque", "AXA Banque", True, 0, 0, 9000, 0, 0, 0, 0, 0, 0, 0, 0),
        ("sg", "Société Générale", False, 2400, 4500, 13200, 1200, 9600, 0, 350, 0, 2400, 2000, 100),
        ("bnp", "BNP Paribas", False, 2100, 4200, 12600, 1200, 9600, 0, 350, 0, 2400, 2000, 100),
        ("credit_agricole", "Crédit Agricole", False, 2280, 4200, 12000, 1000, 9600, 0, 300, 0, 2200, 2000, 100),
        ("lcl", "LCL", False, 2160, 4200, 12000, 1000, 9600, 0, 350, 0, 2400, 2000, 100),
        ("credit_mutuel", "Crédit Mutuel", False, 1800, 3900, 11400, 1000, 9600, 0, 300, 0, 2200, 2000, 100),
        ("la_banque_postale", "La Banque Postale", False, 1800, 3000, 9600, 800, 8280, 0, 300, 0, 2000, 1600, 100),
        ("hsbc", "HSBC France", False, 3000, 4800, 14400, 1500, 9600, 0, 400, 0, 2800, 2000, 100),
        ("cic", "CIC", False, 2160, 4200, 12000, 1000, 9600, 0, 350, 0, 2400, 2000, 100),
        ("banque_populaire", "Banque Populaire", False, 2400, 4500, 12600, 1200, 9600, 0, 350, 0, 2400, 2000, 100),
        ("caisse_epargne", "Caisse d'Épargne", False, 2160, 4200, 12600, 1000, 9600, 0, 350, 0, 2400, 2000, 100),
    ]
    values = []
    for r in rows:
        slug, name, online, *fees = r
        bval = "true" if online else "false"
        fee_cols = ", ".join(str(f) for f in fees)
        safe_name = name.replace("'", "''")
        values.append(
            f"('{slug}', '{safe_name}', {bval}, {fee_cols})"
        )
    cols = (
        "bank_slug, bank_name, is_online, "
        "fee_account_maintenance, fee_card_classic, fee_card_premium, "
        "fee_card_international, fee_overdraft_commission, fee_transfer_sepa, "
        "fee_transfer_intl, fee_check, fee_insurance_card, fee_reject, fee_atm_other_bank"
    )
    return f"INSERT INTO bank_fee_schedules ({cols}) VALUES\n" + ",\n".join(values) + ";"
