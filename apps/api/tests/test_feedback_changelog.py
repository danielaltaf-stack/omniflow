"""
OmniFlow — Phase E4 tests: Feedback, Changelog & Password Change.

Unit tests (no DB):
  - Pydantic schema validation (FeedbackRequest, PasswordChangeRequest)
  - Changelog response structure

Integration tests (DB + httpx):
  - POST /api/v1/feedback (auth required, submission, validation)
  - GET  /api/v1/changelog (public, no auth)
  - PUT  /api/v1/auth/password (correct, wrong current, weak new)

Run unit only:  python -m pytest tests/test_feedback_changelog.py -k "unit" -v
Run all:        python -m pytest tests/test_feedback_changelog.py -v
"""

from __future__ import annotations

import uuid

import httpx
import pytest
from pydantic import ValidationError

from app.schemas.feedback import (
    ChangelogEntry,
    ChangelogResponse,
    ChangelogVersion,
    FeedbackRequest,
    PasswordChangeRequest,
)

# ── Helpers ──────────────────────────────────────────────

_TEST_PASSWORD = "Str0ng!Pass#42"
_NEW_PASSWORD = "N3wSecure!Pass#99"


def _unique_email() -> str:
    return f"e4_test_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a user and return Authorization headers."""
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "E4 Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════
#  UNIT TESTS — Pure validation (no DB)
# ═══════════════════════════════════════════════════════════


class TestFeedbackSchemaUnit:
    """unit — FeedbackRequest Pydantic validation."""

    def test_valid_feedback_bug(self):
        fb = FeedbackRequest(category="bug", message="Something is broken in dashboard")
        assert fb.category == "bug"
        assert len(fb.message) >= 5

    def test_valid_feedback_feature(self):
        fb = FeedbackRequest(
            category="feature",
            message="Please add dark mode",
            metadata={"screen": "1920x1080"},
        )
        assert fb.category == "feature"
        assert fb.metadata == {"screen": "1920x1080"}

    def test_valid_feedback_with_screenshot(self):
        fb = FeedbackRequest(
            category="improvement",
            message="Chart colors could be better",
            screenshot_b64="iVBORw0KGgo=",
        )
        assert fb.screenshot_b64 is not None

    def test_invalid_category_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            FeedbackRequest(category="spam", message="This should fail")
        assert "category" in str(exc_info.value).lower() or "literal" in str(exc_info.value).lower()

    def test_message_too_short(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(category="bug", message="ab")

    def test_message_at_min_length(self):
        fb = FeedbackRequest(category="bug", message="abcde")
        assert len(fb.message) == 5

    def test_all_categories(self):
        for cat in ("bug", "feature", "improvement", "other"):
            fb = FeedbackRequest(category=cat, message="Valid message here")
            assert fb.category == cat


class TestPasswordSchemaUnit:
    """unit — PasswordChangeRequest Pydantic validation."""

    def test_valid_password_change(self):
        req = PasswordChangeRequest(
            current_password="OldPass!123",
            new_password="N3wSecure!X",
        )
        assert req.current_password == "OldPass!123"
        assert req.new_password == "N3wSecure!X"

    def test_new_password_too_short(self):
        with pytest.raises(ValidationError):
            PasswordChangeRequest(
                current_password="OldPass!123",
                new_password="Sh0rt!",
            )

    def test_new_password_exactly_8_chars(self):
        req = PasswordChangeRequest(
            current_password="anything",
            new_password="Abcdef1!",
        )
        assert len(req.new_password) == 8


class TestChangelogSchemaUnit:
    """unit — Changelog schemas structure."""

    def test_changelog_entry(self):
        entry = ChangelogEntry(
            type="feature",
            title="New page",
            description="Added settings page",
        )
        assert entry.type == "feature"

    def test_changelog_entry_invalid_type(self):
        with pytest.raises(ValidationError):
            ChangelogEntry(type="unknown", title="X", description="Y")

    def test_changelog_version(self):
        version = ChangelogVersion(
            version="1.0.0",
            date="2026-01-01",
            entries=[
                ChangelogEntry(type="feature", title="A", description="B"),
                ChangelogEntry(type="fix", title="C", description="D"),
            ],
        )
        assert len(version.entries) == 2

    def test_changelog_response(self):
        resp = ChangelogResponse(
            versions=[
                ChangelogVersion(
                    version="1.0.0",
                    date="2026-01-01",
                    entries=[
                        ChangelogEntry(type="security", title="E", description="F"),
                    ],
                ),
            ]
        )
        assert len(resp.versions) == 1
        assert resp.versions[0].entries[0].type == "security"


class TestFeedbackModelUnit:
    """unit — Feedback model instantiation (no DB)."""

    def test_feedback_model_creation(self):
        from app.models.feedback import Feedback

        fb = Feedback(
            user_id=uuid.uuid4(),
            category="bug",
            message="Test bug report",
            metadata_={"url": "/dashboard"},
        )
        assert fb.category == "bug"
        assert fb.message == "Test bug report"
        assert fb.metadata_ == {"url": "/dashboard"}
        assert fb.screenshot is None

    def test_feedback_model_repr(self):
        from app.models.feedback import Feedback

        fb = Feedback(category="feature", message="Test", status="new")
        r = repr(fb)
        assert "Feedback" in r
        assert "feature" in r


# ═══════════════════════════════════════════════════════════
#  INTEGRATION TESTS — DB + httpx
# ═══════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestChangelogEndpoint:
    """integration — GET /api/v1/changelog (public)."""

    async def test_changelog_returns_200(self, client: httpx.AsyncClient):
        resp = await client.get("/api/v1/changelog")
        assert resp.status_code == 200

    async def test_changelog_has_versions(self, client: httpx.AsyncClient):
        resp = await client.get("/api/v1/changelog")
        data = resp.json()
        assert "versions" in data
        assert len(data["versions"]) >= 3

    async def test_changelog_version_structure(self, client: httpx.AsyncClient):
        resp = await client.get("/api/v1/changelog")
        v = resp.json()["versions"][0]
        assert "version" in v
        assert "date" in v
        assert "entries" in v
        assert len(v["entries"]) >= 1

    async def test_changelog_entry_structure(self, client: httpx.AsyncClient):
        resp = await client.get("/api/v1/changelog")
        entry = resp.json()["versions"][0]["entries"][0]
        assert "type" in entry
        assert "title" in entry
        assert "description" in entry
        assert entry["type"] in ("feature", "fix", "security", "performance")

    async def test_changelog_no_auth_required(self, client: httpx.AsyncClient):
        """Changelog should be publicly accessible without any token."""
        resp = await client.get("/api/v1/changelog")
        assert resp.status_code == 200


@pytest.mark.asyncio
class TestFeedbackEndpoint:
    """integration — POST /api/v1/feedback."""

    async def test_feedback_requires_auth(self, client: httpx.AsyncClient):
        resp = await client.post(
            "/api/v1/feedback",
            json={"category": "bug", "message": "No auth feedback"},
        )
        assert resp.status_code == 401

    async def test_submit_feedback_success(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/feedback",
            json={
                "category": "bug",
                "message": "The chart doesn't render properly on mobile",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert "message" in data

    async def test_submit_feedback_with_metadata(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/feedback",
            json={
                "category": "feature",
                "message": "Please add multi-currency support for crypto",
                "metadata": {"screen_size": "1920x1080", "route": "/crypto"},
            },
            headers=headers,
        )
        assert resp.status_code == 201

    async def test_submit_feedback_invalid_category(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/feedback",
            json={"category": "spam", "message": "Invalid category test"},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_submit_feedback_message_too_short(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/feedback",
            json={"category": "bug", "message": "ab"},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_submit_feedback_all_categories(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        for cat in ("bug", "feature", "improvement", "other"):
            resp = await client.post(
                "/api/v1/feedback",
                json={"category": cat, "message": f"Testing {cat} category submission"},
                headers=headers,
            )
            assert resp.status_code == 201, f"Failed for category: {cat}"


@pytest.mark.asyncio
class TestPasswordChangeEndpoint:
    """integration — PUT /api/v1/auth/password."""

    async def test_password_change_requires_auth(self, client: httpx.AsyncClient):
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": _NEW_PASSWORD,
            },
        )
        assert resp.status_code == 401

    async def test_password_change_success(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": _NEW_PASSWORD,
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data

    async def test_password_change_wrong_current(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": "WrongOldPass!123",
                "new_password": _NEW_PASSWORD,
            },
            headers=headers,
        )
        assert resp.status_code == 400
        assert "incorrect" in resp.json()["detail"].lower()

    async def test_password_change_weak_no_uppercase(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": "alllowercase1!",
            },
            headers=headers,
        )
        assert resp.status_code == 422
        assert "majuscule" in resp.json()["detail"].lower()

    async def test_password_change_weak_no_digit(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": "NoDigitHere!",
            },
            headers=headers,
        )
        assert resp.status_code == 422
        assert "chiffre" in resp.json()["detail"].lower()

    async def test_password_change_weak_no_special(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": "NoSpecial1A",
            },
            headers=headers,
        )
        assert resp.status_code == 422
        assert "spécial" in resp.json()["detail"].lower() or "special" in resp.json()["detail"].lower()

    async def test_password_change_too_short(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": "Sh0r!",
            },
            headers=headers,
        )
        # Pydantic rejects < 8 chars → 422
        assert resp.status_code == 422

    async def test_password_change_then_login_with_new(self, client: httpx.AsyncClient):
        """After changing password, the new password should work for login."""
        email = _unique_email()
        # Register
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "name": "PwdChange Tester",
                "email": email,
                "password": _TEST_PASSWORD,
                "password_confirm": _TEST_PASSWORD,
            },
        )
        assert reg.status_code == 201
        token = reg.json()["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Change password
        change = await client.put(
            "/api/v1/auth/password",
            json={
                "current_password": _TEST_PASSWORD,
                "new_password": _NEW_PASSWORD,
            },
            headers=headers,
        )
        assert change.status_code == 200

        # Login with new password
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": _NEW_PASSWORD},
        )
        assert login.status_code == 200
        assert "access_token" in login.json()["tokens"]
