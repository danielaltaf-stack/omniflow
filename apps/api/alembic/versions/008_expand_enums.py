"""expand accounttype and transactiontype enums for woob bank sync

Revision ID: 008_expand_enums
Revises: 007_profiles_projects
Create Date: 2026-03-02
"""

from alembic import op

revision = "008_expand_enums"
down_revision = "007_profiles_projects"
branch_labels = None
depends_on = None

# New values to add to each enum (only values not already present)
NEW_ACCOUNT_TYPES = [
    "deposit",
    "market",
    "pea",
    "life_insurance",
    "mortgage",
    "revolving_credit",
    "per",
    "madelin",
]

NEW_TRANSACTION_TYPES = [
    "order",
    "deposit",
    "payback",
    "withdrawal",
    "loan_payment",
    "insurance",
    "bank",
    "cash_deposit",
    "card_summary",
    "deferred_card",
]


def upgrade() -> None:
    for val in NEW_ACCOUNT_TYPES:
        op.execute(f"ALTER TYPE accounttype ADD VALUE IF NOT EXISTS '{val}'")
    for val in NEW_TRANSACTION_TYPES:
        op.execute(f"ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS '{val}'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # A full enum recreation would be needed; left as-is for safety.
    pass
