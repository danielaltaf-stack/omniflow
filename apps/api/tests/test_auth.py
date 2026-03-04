"""
OmniFlow — Auth flow tests.

Covers the full lifecycle:
  register → login → /me → refresh (rotation) → logout → blacklisted
"""

from __future__ import annotations

import uuid

import httpx
import pytest

# ── Helpers ──────────────────────────────────────────────────────

_TEST_PASSWORD = "Str0ng!Pass#42"


def _unique_email() -> str:
    """Generate a unique email per test to avoid 409 Conflict."""
    return f"test_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register(client: httpx.AsyncClient, email: str | None = None) -> dict:
    """Helper: register a new user, return the full response JSON."""
    if email is None:
        email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    return {"status": resp.status_code, "body": resp.json(), "email": email}


# ═══════════════════════════════════════════════════════════════════
#  REGISTRATION
# ═══════════════════════════════════════════════════════════════════


async def test_register_success(client: httpx.AsyncClient):
    """POST /auth/register → 201 with user + tokens."""
    res = await _register(client)
    assert res["status"] == 201
    body = res["body"]
    assert "user" in body
    assert "tokens" in body
    assert body["user"]["email"] == res["email"]
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    assert body["tokens"]["token_type"] == "bearer"


async def test_register_duplicate_email(client: httpx.AsyncClient):
    """POST /auth/register with existing email → 409."""
    email = _unique_email()
    first = await _register(client, email=email)
    assert first["status"] == 201

    second = await _register(client, email=email)
    assert second["status"] == 409
    assert "existe déjà" in second["body"]["detail"]


async def test_register_weak_password(client: httpx.AsyncClient):
    """POST /auth/register with weak password → 422 (validation error)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test Weak",
            "email": _unique_email(),
            "password": "short",
            "password_confirm": "short",
        },
    )
    assert resp.status_code == 422


async def test_register_password_mismatch(client: httpx.AsyncClient):
    """POST /auth/register with mismatched passwords → 422."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test Mismatch",
            "email": _unique_email(),
            "password": _TEST_PASSWORD,
            "password_confirm": "Different!Pass1",
        },
    )
    assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════
#  LOGIN
# ═══════════════════════════════════════════════════════════════════


async def test_login_success(client: httpx.AsyncClient):
    """POST /auth/login → 200 with user + tokens."""
    email = _unique_email()
    await _register(client, email=email)

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": _TEST_PASSWORD},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == email
    assert body["tokens"]["access_token"]


async def test_login_bad_password(client: httpx.AsyncClient):
    """POST /auth/login with wrong password → 401."""
    email = _unique_email()
    await _register(client, email=email)

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPass!123"},
    )
    assert resp.status_code == 401
    assert "incorrect" in resp.json()["detail"]


# ═══════════════════════════════════════════════════════════════════
#  /ME (authenticated)
# ═══════════════════════════════════════════════════════════════════


async def test_me_with_token(client: httpx.AsyncClient):
    """GET /auth/me with valid Bearer → 200."""
    res = await _register(client)
    token = res["body"]["tokens"]["access_token"]

    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == res["email"]


async def test_me_without_token(client: httpx.AsyncClient):
    """GET /auth/me without token → 401."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════
#  REFRESH (token rotation + replay detection)
# ═══════════════════════════════════════════════════════════════════


async def test_refresh_rotation(client: httpx.AsyncClient):
    """POST /auth/refresh → 200, returns new tokens (old RT blacklisted)."""
    res = await _register(client)
    old_rt = res["body"]["tokens"]["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_rt},
    )
    assert resp.status_code == 200
    new_tokens = resp.json()
    assert new_tokens["access_token"] != res["body"]["tokens"]["access_token"]
    assert new_tokens["refresh_token"] != old_rt


async def test_refresh_replay_blocked(client: httpx.AsyncClient):
    """Replaying a used refresh token → 401 (theft detection)."""
    res = await _register(client)
    old_rt = res["body"]["tokens"]["refresh_token"]

    # First use → OK
    resp1 = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_rt},
    )
    assert resp1.status_code == 200

    # Second use (replay) → 401
    resp2 = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_rt},
    )
    assert resp2.status_code == 401
    assert "déjà utilisé" in resp2.json()["detail"]


# ═══════════════════════════════════════════════════════════════════
#  LOGOUT (effective — blacklists access token)
# ═══════════════════════════════════════════════════════════════════


async def test_logout_and_token_revoked(client: httpx.AsyncClient):
    """POST /auth/logout → 200, then GET /auth/me → 401 (token revoked)."""
    res = await _register(client)
    token = res["body"]["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Logout
    resp = await client.post("/api/v1/auth/logout", headers=headers)
    assert resp.status_code == 200
    assert "révoqué" in resp.json()["message"]

    # Token is now blacklisted → /me should fail
    resp2 = await client.get("/api/v1/auth/me", headers=headers)
    assert resp2.status_code == 401
    assert "révoqué" in resp2.json()["detail"]
