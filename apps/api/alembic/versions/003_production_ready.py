"""003 — Production-ready: drop is_demo, create balance_snapshots.

Revision ID: 003_production_ready
Revises: 002_bank_tables
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "003_production_ready"
down_revision = "002_bank_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Delete all demo data before dropping the column
    op.execute("DELETE FROM bank_connections WHERE is_demo = true")

    # 2. Drop is_demo column
    op.drop_column("bank_connections", "is_demo")

    # 3. Add sync_error column
    op.add_column(
        "bank_connections",
        sa.Column("sync_error", sa.Text(), nullable=True),
    )

    # 4. Create balance_snapshots table
    op.create_table(
        "balance_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("balance", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="EUR", nullable=False),
        sa.Column(
            "captured_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # 5. Indexes for performance
    op.create_index(
        "ix_snapshots_account_date",
        "balance_snapshots",
        ["account_id", "captured_at"],
    )
    op.create_index(
        "ix_snapshots_captured_at",
        "balance_snapshots",
        ["captured_at"],
    )

    # 6. Add composite index for transaction search
    op.create_index(
        "ix_transactions_account_date",
        "transactions",
        ["account_id", "date"],
    )
    op.create_index(
        "ix_transactions_category",
        "transactions",
        ["category"],
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_category", table_name="transactions")
    op.drop_index("ix_transactions_account_date", table_name="transactions")
    op.drop_index("ix_snapshots_captured_at", table_name="balance_snapshots")
    op.drop_index("ix_snapshots_account_date", table_name="balance_snapshots")
    op.drop_table("balance_snapshots")
    op.drop_column("bank_connections", "sync_error")
    op.add_column(
        "bank_connections",
        sa.Column("is_demo", sa.Boolean(), server_default="false", nullable=False),
    )
