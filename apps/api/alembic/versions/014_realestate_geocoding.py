"""
Phase F1.4 — Real estate geocoding: add latitude/longitude to properties.
Enables precise map positioning instead of city-level approximation.
"""

from alembic import op
import sqlalchemy as sa

revision = "014_realestate_geocoding"
down_revision = "013_crypto_enrichment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("real_estate_properties", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("real_estate_properties", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("real_estate_properties", "longitude")
    op.drop_column("real_estate_properties", "latitude")
