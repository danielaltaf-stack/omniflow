"""
OmniFlow — Settings & RGPD schemas.

Covers: data export, account deletion, audit log, consent tracking,
privacy policy.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
#  DATA EXPORT (RGPD Article 15 & 20)
# ═══════════════════════════════════════════════════════════════════


class ExportMetadata(BaseModel):
    total_records: int = Field(..., description="Total records exported")
    tables_exported: int = Field(..., description="Number of tables included")
    anonymized: bool = Field(False, description="Whether PII was anonymized")
    export_version: str = Field("1.0", description="Export format version")


class DataExportResponse(BaseModel):
    export_version: str = Field("1.0")
    exported_at: datetime
    user: dict[str, Any]
    data: dict[str, list[dict[str, Any]]]
    metadata: ExportMetadata


# ═══════════════════════════════════════════════════════════════════
#  ACCOUNT DELETION (RGPD Article 17)
# ═══════════════════════════════════════════════════════════════════


class AccountDeletionRequest(BaseModel):
    confirmation: str = Field(
        ...,
        description="Must be exactly 'SUPPRIMER MON COMPTE'",
        examples=["SUPPRIMER MON COMPTE"],
    )
    password: str = Field(
        ...,
        description="Current password for verification",
        min_length=1,
    )


class AccountDeletionResponse(BaseModel):
    message: str = Field(
        default="Compte supprimé définitivement. Toutes les données ont été effacées.",
    )
    deleted_records: int = Field(..., description="Total records deleted")
    tables_affected: int = Field(..., description="Tables cleaned")


# ═══════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ═══════════════════════════════════════════════════════════════════


class AuditLogEntry(BaseModel):
    id: UUID
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    ip_address: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    entries: list[AuditLogEntry]
    total: int
    limit: int
    offset: int


# ═══════════════════════════════════════════════════════════════════
#  CONSENT TRACKING (RGPD)
# ═══════════════════════════════════════════════════════════════════


class ConsentStatus(BaseModel):
    analytics: bool = Field(False, description="Web Vitals, usage statistics")
    push_notifications: bool = Field(False, description="Push notification consent")
    ai_personalization: bool = Field(True, description="Nova AI memories & insights")
    data_sharing: bool = Field(False, description="Anonymized data aggregation")
    updated_at: datetime | None = None
    privacy_policy_version: str = "1.0"

    model_config = {"from_attributes": True}


class ConsentUpdateRequest(BaseModel):
    analytics: bool | None = None
    push_notifications: bool | None = None
    ai_personalization: bool | None = None
    data_sharing: bool | None = None


# ═══════════════════════════════════════════════════════════════════
#  PRIVACY POLICY
# ═══════════════════════════════════════════════════════════════════


class PrivacyPolicySection(BaseModel):
    title: str
    content: str


class PrivacyPolicyResponse(BaseModel):
    version: str = "1.0"
    last_updated: str
    language: str = "fr"
    dpo_contact: str
    sections: list[PrivacyPolicySection]
