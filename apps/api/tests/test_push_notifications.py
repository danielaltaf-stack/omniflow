"""
OmniFlow — Push Notifications (Phase E1) integration + unit tests.

Covers:
- VAPID key endpoint (public, no auth)
- Subscribe / Unsubscribe lifecycle (auth required)
- Test push endpoint (auth required)
- Push service logic (send, broadcast, expired cleanup)
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.push_service import send_push_notification, broadcast_push

# ── Helpers ──────────────────────────────────────────────

_TEST_PASSWORD = "Str0ng!Pass#42"


def _unique_email() -> str:
    return f"push_test_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a user and return Authorization headers."""
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Push Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


_FAKE_ENDPOINT = "https://fcm.googleapis.com/fcm/send/fake-push-endpoint-12345"
_FAKE_P256DH = "BN" + "A" * 85
_FAKE_AUTH = "x" * 22


def _subscription_payload(endpoint: str = _FAKE_ENDPOINT) -> dict:
    return {
        "endpoint": endpoint,
        "keys": {
            "p256dh": _FAKE_P256DH,
            "auth": _FAKE_AUTH,
        },
        "user_agent": "OmniFlowTest/1.0",
    }


# ═══════════════════════════════════════════════════════════════════
#  VAPID PUBLIC KEY
# ═══════════════════════════════════════════════════════════════════


async def test_vapid_key_returns_public_key(client: httpx.AsyncClient):
    """GET /push/vapid-key → returns public_key (or 503 if not configured)."""
    resp = await client.get("/api/v1/push/vapid-key")
    # Depending on environment config, should be 200 or 503
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "public_key" in data
        assert len(data["public_key"]) > 10


async def test_vapid_key_no_auth_required(client: httpx.AsyncClient):
    """GET /push/vapid-key → should work without authentication."""
    resp = await client.get("/api/v1/push/vapid-key")
    # Should NOT be 401 (auth is not required)
    assert resp.status_code != 401


# ═══════════════════════════════════════════════════════════════════
#  SUBSCRIBE
# ═══════════════════════════════════════════════════════════════════


async def test_subscribe_unauthenticated(client: httpx.AsyncClient):
    """POST /push/subscribe without auth → 401."""
    resp = await client.post(
        "/api/v1/push/subscribe",
        json=_subscription_payload(),
    )
    assert resp.status_code == 401


async def test_subscribe_success(client: httpx.AsyncClient):
    """POST /push/subscribe with valid data → 200 with subscription details."""
    headers = await _register_and_get_headers(client)
    resp = await client.post(
        "/api/v1/push/subscribe",
        json=_subscription_payload(),
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["endpoint"] == _FAKE_ENDPOINT
    assert data["user_agent"] == "OmniFlowTest/1.0"


async def test_subscribe_upsert(client: httpx.AsyncClient):
    """POST /push/subscribe twice with same endpoint → upsert, no duplicate."""
    headers = await _register_and_get_headers(client)
    payload = _subscription_payload()

    resp1 = await client.post("/api/v1/push/subscribe", json=payload, headers=headers)
    assert resp1.status_code == 200
    id1 = resp1.json()["id"]

    # Same endpoint, different user_agent — should update
    payload["user_agent"] = "UpdatedAgent/2.0"
    resp2 = await client.post("/api/v1/push/subscribe", json=payload, headers=headers)
    assert resp2.status_code == 200
    id2 = resp2.json()["id"]

    # Same subscription row (upsert)
    assert id1 == id2
    assert resp2.json()["user_agent"] == "UpdatedAgent/2.0"


async def test_subscribe_invalid_payload(client: httpx.AsyncClient):
    """POST /push/subscribe with missing keys → 422."""
    headers = await _register_and_get_headers(client)
    resp = await client.post(
        "/api/v1/push/subscribe",
        json={"endpoint": _FAKE_ENDPOINT},  # missing keys
        headers=headers,
    )
    assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════
#  UNSUBSCRIBE
# ═══════════════════════════════════════════════════════════════════


async def test_unsubscribe_success(client: httpx.AsyncClient):
    """DELETE /push/unsubscribe → removes a previously created subscription."""
    headers = await _register_and_get_headers(client)

    # Subscribe first
    await client.post(
        "/api/v1/push/subscribe",
        json=_subscription_payload(),
        headers=headers,
    )

    # Unsubscribe
    resp = await client.request(
        "DELETE",
        "/api/v1/push/unsubscribe",
        json={"endpoint": _FAKE_ENDPOINT},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "unsubscribed"


async def test_unsubscribe_not_found(client: httpx.AsyncClient):
    """DELETE /push/unsubscribe for non-existent endpoint → 404."""
    headers = await _register_and_get_headers(client)
    resp = await client.request(
        "DELETE",
        "/api/v1/push/unsubscribe",
        json={"endpoint": "https://example.com/nonexistent"},
        headers=headers,
    )
    assert resp.status_code == 404


async def test_unsubscribe_unauthenticated(client: httpx.AsyncClient):
    """DELETE /push/unsubscribe without auth → 401."""
    resp = await client.request(
        "DELETE",
        "/api/v1/push/unsubscribe",
        json={"endpoint": _FAKE_ENDPOINT},
    )
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════
#  TEST PUSH ENDPOINT
# ═══════════════════════════════════════════════════════════════════


async def test_send_test_push_no_subscriptions(client: httpx.AsyncClient):
    """POST /push/test with no subscriptions → returns no_subscriptions status."""
    headers = await _register_and_get_headers(client)
    resp = await client.post("/api/v1/push/test", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "no_subscriptions"
    assert data["sent"] == 0


async def test_send_test_push_unauthenticated(client: httpx.AsyncClient):
    """POST /push/test without auth → 401."""
    resp = await client.post("/api/v1/push/test")
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════
#  PUSH SERVICE UNIT TESTS
# ═══════════════════════════════════════════════════════════════════


async def test_send_push_notification_no_pywebpush(db_session):
    """send_push_notification without pywebpush installed → returns 0."""
    with patch("app.services.push_service._get_webpush", return_value=(None, None)):
        result = await send_push_notification(
            db=db_session,
            user_id=uuid.uuid4(),
            title="Test",
            body="Hello",
        )
        assert result == 0


async def test_send_push_notification_no_vapid_config(db_session):
    """send_push_notification with CHANGE-ME VAPID keys → returns 0."""
    mock_webpush = MagicMock()
    with patch("app.services.push_service._get_webpush", return_value=(mock_webpush, Exception)):
        with patch("app.services.push_service.get_settings") as mock_settings:
            mock_settings.return_value.VAPID_PRIVATE_KEY = "CHANGE-ME"
            mock_settings.return_value.VAPID_PUBLIC_KEY = "CHANGE-ME"
            result = await send_push_notification(
                db=db_session,
                user_id=uuid.uuid4(),
                title="Test",
                body="Hello",
            )
            assert result == 0


async def test_send_push_notification_no_subscriptions(db_session):
    """send_push_notification for a user with no subscriptions → returns 0."""
    mock_webpush = MagicMock()
    with patch("app.services.push_service._get_webpush", return_value=(mock_webpush, Exception)):
        with patch("app.services.push_service.get_settings") as mock_settings:
            mock_settings.return_value.VAPID_PRIVATE_KEY = "real-private-key"
            mock_settings.return_value.VAPID_PUBLIC_KEY = "real-public-key"
            mock_settings.return_value.VAPID_SUBJECT = "mailto:test@omniflow.dev"
            result = await send_push_notification(
                db=db_session,
                user_id=uuid.uuid4(),
                title="Test",
                body="Hello",
            )
            assert result == 0


async def test_broadcast_push_empty_list(db_session):
    """broadcast_push with empty user list → returns 0."""
    with patch("app.services.push_service._get_webpush", return_value=(None, None)):
        result = await broadcast_push(
            db=db_session,
            user_ids=[],
            title="Broadcast",
            body="Hello",
        )
        assert result == 0
