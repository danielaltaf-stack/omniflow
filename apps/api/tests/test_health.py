"""
OmniFlow — Health endpoint & middleware tests.

Validates:
  - /health returns {api, database, redis} = ok
  - Security headers are present
  - X-Request-ID (correlation ID) middleware works
"""

from __future__ import annotations

import httpx
import pytest


# ═══════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════


async def test_health_ok(client: httpx.AsyncClient):
    """GET /health → 200 with all services ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["api"] == "ok"
    assert body["database"] == "ok"
    assert body["redis"] == "ok"


# ═══════════════════════════════════════════════════════════════════
#  SECURITY HEADERS
# ═══════════════════════════════════════════════════════════════════


async def test_security_headers_present(client: httpx.AsyncClient):
    """Every response should include hardened security headers."""
    resp = await client.get("/health")
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert resp.headers.get("x-xss-protection") == "1; mode=block"
    assert "camera=()" in resp.headers.get("permissions-policy", "")


# ═══════════════════════════════════════════════════════════════════
#  CORRELATION ID
# ═══════════════════════════════════════════════════════════════════


async def test_correlation_id_auto_generated(client: httpx.AsyncClient):
    """Responses should include an auto-generated X-Request-ID."""
    resp = await client.get("/health")
    request_id = resp.headers.get("x-request-id")
    assert request_id is not None
    assert len(request_id) > 8  # UUID format
