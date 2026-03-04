"""create bank_connections, accounts, transactions tables

Revision ID: 002_bank_tables
Revises: 001_initial
Create Date: 2026-03-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "002_bank_tables"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── bank_connections ─────────────────────────────────────
    op.create_table(
        "bank_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("bank_module", sa.String(64), nullable=False),
        sa.Column("bank_name", sa.String(128), nullable=False),
        sa.Column("encrypted_credentials", sa.LargeBinary, nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "active", "error", "sca_required", "syncing", "disabled",
                name="connectionstatus",
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("is_demo", sa.Boolean, nullable=False, server_default="false"),
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

    # ── accounts ─────────────────────────────────────────────
    op.create_table(
        "accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("bank_connections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("external_id", sa.String(256), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "checking", "savings", "investment", "loan",
                "crypto", "credit_card", "other",
                name="accounttype",
            ),
            nullable=False,
            server_default="checking",
        ),
        sa.Column("label", sa.String(256), nullable=False),
        sa.Column("balance", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'")),
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

    # ── transactions ─────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("external_id", sa.String(256), nullable=False),
        sa.Column("date", sa.Date, nullable=False, index=True),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("label", sa.String(512), nullable=False),
        sa.Column("raw_label", sa.Text, nullable=True),
        sa.Column(
            "type",
            sa.Enum(
                "card", "transfer", "direct_debit", "check",
                "fee", "interest", "atm", "other",
                name="transactiontype",
            ),
            nullable=False,
            server_default="other",
        ),
        sa.Column("category", sa.String(128), nullable=True),
        sa.Column("subcategory", sa.String(128), nullable=True),
        sa.Column("merchant", sa.String(256), nullable=True),
        sa.Column("is_recurring", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'")),
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
    op.drop_table("transactions")
    op.drop_table("accounts")
    op.drop_table("bank_connections")
    op.execute("DROP TYPE IF EXISTS connectionstatus")
    op.execute("DROP TYPE IF EXISTS accounttype")
    op.execute("DROP TYPE IF EXISTS transactiontype")
