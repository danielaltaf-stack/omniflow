"""
OmniFlow — Vault Document model.
Secure storage of document metadata (IDs, diplomas, certificates).
Document numbers are AES-256 encrypted at rest.
"""

import enum

from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUIDMixin


class DocumentCategory(str, enum.Enum):
    IDENTITY = "identity"
    DIPLOMA = "diploma"
    CERTIFICATE = "certificate"
    INSURANCE = "insurance"
    CONTRACT = "contract"
    TAX = "tax"
    MEDICAL = "medical"
    OTHER = "other"


# Default reminder days by category
CATEGORY_REMINDER_DEFAULTS = {
    DocumentCategory.IDENTITY: 90,      # Passport, CNI → 3 months
    DocumentCategory.DIPLOMA: 0,         # No expiry
    DocumentCategory.CERTIFICATE: 0,     # No expiry
    DocumentCategory.INSURANCE: 30,      # 1 month
    DocumentCategory.CONTRACT: 30,
    DocumentCategory.TAX: 0,
    DocumentCategory.MEDICAL: 30,
    DocumentCategory.OTHER: 30,
}


class VaultDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vault_documents"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Identification
    name = Column(String(255), nullable=False)
    category = Column(String(30), nullable=False, default=DocumentCategory.OTHER.value)
    document_type = Column(String(100), nullable=False)

    # Issuer
    issuer = Column(String(255), nullable=True)

    # Dates
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)

    # Reference (encrypted via AES-256-GCM)
    document_number = Column(String(512), nullable=True)

    # Alert
    reminder_days = Column(Integer, nullable=False, default=30)

    # Details
    notes = Column(Text, nullable=True)
    extra_data = Column(JSONB, nullable=False, default=dict)
