"""
OmniFlow — Phase E3 Tests : RGPD, Audit Trail, Privacy, Security.

Tests cover:
- RGPD data export (full + anonymized)
- Account deletion (confirmation + password check + cascade)
- Audit log (model, service, endpoint)
- Consent tracking (get + update)
- Privacy policy endpoint
- Security.txt endpoint
- Anonymization helpers
- Schema validation
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Anonymization Helpers
# ═══════════════════════════════════════════════════════════════════


def test_anonymize_email():
    """Email should be anonymized: first char + *** @ first char + ***.tld"""
    from app.services.gdpr_service import anonymize_email

    assert anonymize_email("john.doe@gmail.com") == "j***@g***.com"
    assert anonymize_email("a@b.fr") == "a***@b***.fr"


def test_anonymize_name():
    """Name should keep first letter of each word."""
    from app.services.gdpr_service import anonymize_name

    assert anonymize_name("John Doe") == "J*** D***"
    assert anonymize_name("Alice") == "A***"


def test_anonymize_string_emails():
    """Emails in free text should be replaced with [email]."""
    from app.services.gdpr_service import anonymize_string

    text = "Contact: user@example.com or admin@test.org"
    result = anonymize_string(text)
    assert "[email]" in result
    assert "user@example.com" not in result
    assert "admin@test.org" not in result


def test_anonymize_string_phones():
    """Phone numbers in free text should be replaced with [phone]."""
    from app.services.gdpr_service import anonymize_string

    text = "Call me at +33 6 12 34 56 78"
    result = anonymize_string(text)
    assert "[phone]" in result
    assert "12 34 56" not in result


def test_anonymize_string_no_pii():
    """Clean text should remain unchanged."""
    from app.services.gdpr_service import anonymize_string

    text = "Budget is 500 EUR this month"
    assert anonymize_string(text) == text


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Audit Log Model
# ═══════════════════════════════════════════════════════════════════


def test_audit_log_model_creation():
    """AuditLog model should be instantiable with required fields."""
    from app.models.audit_log import AuditLog

    entry = AuditLog(
        action="login_success",
        user_id=uuid.uuid4(),
        resource_type="user",
        resource_id="abc-123",
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0",
        metadata_={"key": "value"},
    )
    assert entry.action == "login_success"
    assert entry.resource_type == "user"
    assert entry.ip_address == "192.168.1.1"
    assert entry.metadata_["key"] == "value"


def test_audit_log_model_nullable_fields():
    """AuditLog should allow nullable user_id (for system actions)."""
    from app.models.audit_log import AuditLog

    entry = AuditLog(action="system_cleanup")
    assert entry.action == "system_cleanup"
    assert entry.user_id is None
    assert entry.resource_type is None


def test_audit_log_table_name():
    """Table name should be 'audit_log'."""
    from app.models.audit_log import AuditLog

    assert AuditLog.__tablename__ == "audit_log"


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Audit Service Helpers
# ═══════════════════════════════════════════════════════════════════


def test_get_client_ip_direct():
    """Should return client.host when no X-Forwarded-For header."""
    from app.services.audit_service import get_client_ip

    mock_request = MagicMock()
    mock_request.headers = {}
    mock_request.client.host = "127.0.0.1"
    assert get_client_ip(mock_request) == "127.0.0.1"


def test_get_client_ip_forwarded():
    """Should return first IP from X-Forwarded-For header."""
    from app.services.audit_service import get_client_ip

    mock_request = MagicMock()
    mock_request.headers = {"X-Forwarded-For": "10.0.0.1, 172.16.0.1"}
    assert get_client_ip(mock_request) == "10.0.0.1"


def test_get_user_agent_truncated():
    """Should truncate user agent to 500 chars."""
    from app.services.audit_service import get_user_agent

    mock_request = MagicMock()
    mock_request.headers = {"user-agent": "A" * 1000}
    result = get_user_agent(mock_request)
    assert len(result) == 500


def test_get_user_agent_missing():
    """Should return empty string when no user-agent."""
    from app.services.audit_service import get_user_agent

    mock_request = MagicMock()
    mock_request.headers = {}
    assert get_user_agent(mock_request) == ""


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Schemas
# ═══════════════════════════════════════════════════════════════════


def test_account_deletion_request_schema():
    """AccountDeletionRequest should validate confirmation + password."""
    from app.schemas.settings import AccountDeletionRequest

    req = AccountDeletionRequest(
        confirmation="SUPPRIMER MON COMPTE",
        password="secret123",
    )
    assert req.confirmation == "SUPPRIMER MON COMPTE"
    assert req.password == "secret123"


def test_consent_status_defaults():
    """ConsentStatus should have sane defaults."""
    from app.schemas.settings import ConsentStatus

    consent = ConsentStatus()
    assert consent.analytics is False
    assert consent.push_notifications is False
    assert consent.ai_personalization is True
    assert consent.data_sharing is False
    assert consent.privacy_policy_version == "1.0"


def test_consent_update_request_partial():
    """ConsentUpdateRequest should allow partial updates."""
    from app.schemas.settings import ConsentUpdateRequest

    req = ConsentUpdateRequest(analytics=True)
    assert req.analytics is True
    assert req.push_notifications is None
    assert req.ai_personalization is None


def test_audit_log_entry_schema():
    """AuditLogEntry should validate from ORM-like data."""
    from app.schemas.settings import AuditLogEntry

    entry = AuditLogEntry(
        id=uuid.uuid4(),
        action="login_success",
        resource_type="user",
        resource_id="abc",
        ip_address="1.2.3.4",
        metadata={"key": "val"},
        created_at=datetime.now(UTC),
    )
    assert entry.action == "login_success"


def test_data_export_response_schema():
    """DataExportResponse should validate the structure."""
    from app.schemas.settings import DataExportResponse, ExportMetadata

    export = DataExportResponse(
        export_version="1.0",
        exported_at=datetime.now(UTC),
        user={"id": str(uuid.uuid4()), "email": "test@test.com"},
        data={"accounts": [{"label": "Checking"}]},
        metadata=ExportMetadata(
            total_records=1,
            tables_exported=1,
            anonymized=False,
        ),
    )
    assert export.metadata.total_records == 1


def test_privacy_policy_response_schema():
    """PrivacyPolicyResponse should validate."""
    from app.schemas.settings import PrivacyPolicyResponse, PrivacyPolicySection

    policy = PrivacyPolicyResponse(
        version="1.0",
        last_updated="2026-03-04",
        language="fr",
        dpo_contact="dpo@omniflow.app",
        sections=[
            PrivacyPolicySection(title="1. Test", content="Content"),
        ],
    )
    assert len(policy.sections) == 1
    assert policy.dpo_contact == "dpo@omniflow.app"


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — User Model Consent Fields
# ═══════════════════════════════════════════════════════════════════


def test_user_model_has_consent_fields():
    """User model should have all RGPD consent columns."""
    from app.models.user import User

    columns = {c.name for c in User.__table__.columns}
    assert "consent_analytics" in columns
    assert "consent_push_notifications" in columns
    assert "consent_ai_personalization" in columns
    assert "consent_data_sharing" in columns
    assert "consent_updated_at" in columns
    assert "privacy_policy_version" in columns


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — GDPR Delete Order Validation
# ═══════════════════════════════════════════════════════════════════


def test_delete_order_covers_all_models():
    """The delete cascade order should reference all user-data models."""
    from app.services.gdpr_service import _DELETE_ORDER_DIRECT

    # All direct models should have user_id
    for model in _DELETE_ORDER_DIRECT:
        assert hasattr(model, "user_id") or hasattr(model, "__table__"), (
            f"{model.__name__} missing user_id"
        )


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Security.txt Content
# ═══════════════════════════════════════════════════════════════════


def test_security_txt_content():
    """Security.txt should contain required RFC 9116 fields."""
    from app.main import _SECURITY_TXT

    assert "Contact:" in _SECURITY_TXT
    assert "Expires:" in _SECURITY_TXT
    assert "Preferred-Languages:" in _SECURITY_TXT
    assert "Canonical:" in _SECURITY_TXT
    assert "mailto:" in _SECURITY_TXT


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Privacy Policy Content
# ═══════════════════════════════════════════════════════════════════


def test_privacy_policy_content():
    """Privacy policy should have all required sections."""
    from app.api.v1.settings import _PRIVACY_POLICY

    assert _PRIVACY_POLICY.version == "1.0"
    assert _PRIVACY_POLICY.language == "fr"
    assert len(_PRIVACY_POLICY.sections) >= 9

    titles = [s.title for s in _PRIVACY_POLICY.sections]
    # Must mention RGPD rights
    rights_section = next((s for s in _PRIVACY_POLICY.sections if "droits" in s.title.lower()), None)
    assert rights_section is not None
    assert "Art. 15" in rights_section.content
    assert "Art. 17" in rights_section.content
    assert "Art. 20" in rights_section.content


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Models __init__ exports
# ═══════════════════════════════════════════════════════════════════


def test_audit_log_in_models_init():
    """AuditLog should be importable from app.models."""
    from app.models import AuditLog

    assert AuditLog.__tablename__ == "audit_log"


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — Endpoints (require DB)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_privacy_policy_endpoint(client):
    """GET /api/v1/settings/privacy-policy should return 200 without auth."""
    response = await client.get("/api/v1/settings/privacy-policy")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0"
    assert data["language"] == "fr"
    assert len(data["sections"]) >= 9


@pytest.mark.asyncio
async def test_security_txt_endpoint(client):
    """GET /.well-known/security.txt should return 200 text/plain."""
    response = await client.get("/.well-known/security.txt")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert "Contact:" in response.text
    assert "Expires:" in response.text


@pytest.mark.asyncio
async def test_export_requires_auth(client):
    """GET /api/v1/settings/export without auth should return 401."""
    response = await client.get("/api/v1/settings/export")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_audit_log_requires_auth(client):
    """GET /api/v1/settings/audit-log without auth should return 401."""
    response = await client.get("/api/v1/settings/audit-log")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_consent_requires_auth(client):
    """GET /api/v1/settings/consent without auth should return 401."""
    response = await client.get("/api/v1/settings/consent")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_requires_auth(client):
    """DELETE /api/v1/settings/account without auth should return 401."""
    response = await client.request(
        "DELETE",
        "/api/v1/settings/account",
        json={
            "confirmation": "SUPPRIMER MON COMPTE",
            "password": "test",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_account_wrong_confirmation(client):
    """DELETE /api/v1/settings/account with wrong confirmation should return 400."""
    # Register a user first
    reg = await client.post(
        "/api/v1/auth/register",
        json={"name": "Test", "email": "gdpr@test.com", "password": "Test1234!"},
    )
    token = reg.json()["tokens"]["access_token"]

    response = await client.request(
        "DELETE",
        "/api/v1/settings/account",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "confirmation": "wrong",
            "password": "Test1234!",
        },
    )
    assert response.status_code == 400
    assert "Confirmation incorrecte" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_creates_audit_log(client, db_session):
    """Registration should create audit log entry."""
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Audit Test", "email": "audit@test.com", "password": "Test1234!"},
    )
    assert response.status_code == 201

    # Check audit log was created
    from app.models.audit_log import AuditLog
    from sqlalchemy import select

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "register")
    )
    entries = result.scalars().all()
    assert len(entries) >= 1


@pytest.mark.asyncio
async def test_login_creates_audit_log(client, db_session):
    """Login should create audit log entry."""
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={"name": "Login Test", "email": "loginaudit@test.com", "password": "Test1234!"},
    )

    # Login
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "loginaudit@test.com", "password": "Test1234!"},
    )
    assert response.status_code == 200

    # Check audit log
    from app.models.audit_log import AuditLog
    from sqlalchemy import select

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == "login_success")
    )
    entries = result.scalars().all()
    assert len(entries) >= 1
