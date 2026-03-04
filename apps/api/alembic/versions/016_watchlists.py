"""
Phase F1.7 — Watchlists: cross-asset persistent favourites.
Creates user_watchlists table with unique constraint and ordering index.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "016_watchlists"
down_revision = "015_user_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_watchlists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("symbol", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("target_price", sa.Float(), nullable=True),
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
    op.create_unique_constraint(
        "uq_watchlist_user_asset_symbol",
        "user_watchlists",
        ["user_id", "asset_type", "symbol"],
    )
    op.create_index(
        "ix_watchlist_user_order",
        "user_watchlists",
        ["user_id", "display_order"],
    )


def downgrade() -> None:
    op.drop_index("ix_watchlist_user_order", table_name="user_watchlists")
    op.drop_constraint("uq_watchlist_user_asset_symbol", "user_watchlists", type_="unique")
    op.drop_table("user_watchlists")
