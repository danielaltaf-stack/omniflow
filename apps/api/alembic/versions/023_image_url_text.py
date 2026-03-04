"""
023 – Widen image_url / animation_url columns to TEXT.

The vault wizard stores base64 data-URLs for uploaded photos, which far
exceed the original VARCHAR(500) limit.  This migration converts the
relevant columns to TEXT (unlimited length in Postgres).

Affected tables: tangible_assets, nft_assets.

Revision ID: 023_image_url_text
Revises: 022_digital_vault
"""

from alembic import op
import sqlalchemy as sa

revision = "023_image_url_text"
down_revision = "022_digital_vault"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tangible_assets.image_url  VARCHAR(500) → TEXT
    op.alter_column(
        "tangible_assets",
        "image_url",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=True,
    )

    # nft_assets.image_url  VARCHAR(500) → TEXT
    op.alter_column(
        "nft_assets",
        "image_url",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=True,
    )

    # nft_assets.animation_url  VARCHAR(500) → TEXT
    op.alter_column(
        "nft_assets",
        "animation_url",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "nft_assets",
        "animation_url",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=True,
    )
    op.alter_column(
        "nft_assets",
        "image_url",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=True,
    )
    op.alter_column(
        "tangible_assets",
        "image_url",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=True,
    )
