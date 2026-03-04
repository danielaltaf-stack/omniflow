"""Phase C2 — Heritage / Succession simulator."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "018_heritage"
down_revision = "017_retirement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "heritage_simulations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, unique=True, index=True),

        # Régime matrimonial
        sa.Column("marital_regime", sa.String(32), nullable=False,
                  server_default="communaute"),

        # Héritiers (JSONB array)
        sa.Column("heirs", JSONB, nullable=False, server_default="[]"),

        # Assurance-vie
        sa.Column("life_insurance_before_70", sa.BigInteger, nullable=False,
                  server_default="0"),
        sa.Column("life_insurance_after_70", sa.BigInteger, nullable=False,
                  server_default="0"),

        # Historique donations
        sa.Column("donation_history", JSONB, nullable=False,
                  server_default="[]"),

        # Preferences
        sa.Column("include_real_estate", sa.Boolean, nullable=False,
                  server_default=sa.text("true")),
        sa.Column("include_life_insurance", sa.Boolean, nullable=False,
                  server_default=sa.text("true")),
        sa.Column("custom_patrimoine_override", sa.BigInteger, nullable=True),

        # Cached result
        sa.Column("last_simulation_result", JSONB, nullable=True),

        # Metadata
        sa.Column("metadata", JSONB, server_default="{}"),

        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("heritage_simulations")
