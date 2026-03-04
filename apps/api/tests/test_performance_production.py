"""
OmniFlow — Performance Production (Phase E2) integration + unit tests.

Covers:
- Health probes: /health/live and /health/ready
- Prometheus metrics: /metrics endpoint format
- Structured logging: JSON formatter and Human formatter
- Metrics recording: counters, gauges, histograms
- Analytics: Web Vitals ingestion endpoint
- Config: new settings (REDIS_MAX_CONNECTIONS, WEB_CONCURRENCY)
"""

from __future__ import annotations

import json
import logging
import time

import httpx
import pytest

from app.core.logging_config import JSONFormatter, HumanFormatter, setup_logging, correlation_id_var
from app.core.metrics import (
    _Counter,
    _Gauge,
    _Histogram,
    record_request,
    format_metrics,
    _normalize_path,
    request_duration_global,
    cache_hits_total,
    cache_misses_total,
    db_queries_total,
)


# ═══════════════════════════════════════════════════════════════════
#  HEALTH PROBES
# ═══════════════════════════════════════════════════════════════════


async def test_health_live(client: httpx.AsyncClient):
    """GET /health/live → always 200 with uptime."""
    resp = await client.get("/health/live")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "alive"
    assert "uptime_seconds" in data
    assert isinstance(data["uptime_seconds"], (int, float))


async def test_health_ready(client: httpx.AsyncClient):
    """GET /health/ready → 200 with DB + Redis checks and latency."""
    resp = await client.get("/health/ready")
    assert resp.status_code in (200, 503)
    data = resp.json()
    assert "checks" in data
    assert "database" in data["checks"]
    assert "redis" in data["checks"]
    # Each check has status and latency_ms
    for check_name in ("database", "redis"):
        check = data["checks"][check_name]
        assert "status" in check
        assert "latency_ms" in check
    assert "version" in data
    assert "environment" in data
    assert "uptime_seconds" in data


async def test_health_legacy_redirect(client: httpx.AsyncClient):
    """GET /health → returns same structure as /health/ready (backward compat)."""
    resp = await client.get("/health")
    assert resp.status_code in (200, 503)
    data = resp.json()
    assert "checks" in data


# ═══════════════════════════════════════════════════════════════════
#  PROMETHEUS METRICS
# ═══════════════════════════════════════════════════════════════════


async def test_metrics_endpoint_returns_text(client: httpx.AsyncClient):
    """GET /metrics → text/plain Prometheus format."""
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers.get("content-type", "")
    body = resp.text
    # Must contain standard Prometheus lines
    assert "app_info" in body
    assert "process_uptime_seconds" in body
    assert "http_requests_total" in body
    assert "http_request_duration_seconds" in body


async def test_metrics_no_auth_required(client: httpx.AsyncClient):
    """GET /metrics → should work without authentication."""
    resp = await client.get("/metrics")
    assert resp.status_code != 401


# ═══════════════════════════════════════════════════════════════════
#  METRICS UNIT TESTS
# ═══════════════════════════════════════════════════════════════════


def test_counter_increment():
    """Counter should increment correctly."""
    c = _Counter()
    assert c.value == 0.0
    c.inc()
    assert c.value == 1.0
    c.inc(5.0)
    assert c.value == 6.0


def test_gauge_set_inc_dec():
    """Gauge should set, increment, and decrement."""
    g = _Gauge()
    assert g.value == 0.0
    g.set(42.0)
    assert g.value == 42.0
    g.inc(8.0)
    assert g.value == 50.0
    g.dec(10.0)
    assert g.value == 40.0


def test_histogram_observe():
    """Histogram should track count, sum, and buckets."""
    h = _Histogram(buckets=(0.1, 0.5, 1.0))
    h.observe(0.05)
    h.observe(0.3)
    h.observe(0.8)
    h.observe(2.0)

    assert h.count == 4
    assert abs(h.total - 3.15) < 0.001

    buckets = h.buckets_cumulative()
    # 0.05 fits <= 0.1
    assert buckets[0] == ("0.1", 1)
    # 0.05 + 0.3 fit <= 0.5
    assert buckets[1] == ("0.5", 2)
    # 0.05 + 0.3 + 0.8 fit <= 1.0
    assert buckets[2] == ("1.0", 3)
    # +Inf contains all
    assert buckets[3] == ("+Inf", 4)


def test_normalize_path_uuid():
    """UUID segments should be normalized to {id}."""
    assert _normalize_path("/api/v1/stocks/550e8400-e29b-41d4-a716-446655440000") == \
           "/api/v1/stocks/{id}"


def test_normalize_path_numeric():
    """Numeric segments should be normalized to {id}."""
    assert _normalize_path("/api/v1/accounts/12345") == \
           "/api/v1/accounts/{id}"


def test_normalize_path_no_change():
    """Non-ID segments should pass through unchanged."""
    assert _normalize_path("/api/v1/dashboard") == "/api/v1/dashboard"


def test_record_request():
    """record_request should update counters and histogram."""
    initial_count = request_duration_global.count
    record_request("GET", "/api/v1/test", 200, 0.042)
    assert request_duration_global.count == initial_count + 1


def test_format_metrics_output():
    """format_metrics should produce valid Prometheus text."""
    output = format_metrics()
    lines = output.strip().split("\n")
    # Should have TYPE and HELP comments
    type_lines = [l for l in lines if l.startswith("# TYPE")]
    help_lines = [l for l in lines if l.startswith("# HELP")]
    assert len(type_lines) > 5
    assert len(help_lines) > 5
    # Should have actual metric values
    metric_lines = [l for l in lines if not l.startswith("#") and l.strip()]
    assert len(metric_lines) > 5


# ═══════════════════════════════════════════════════════════════════
#  STRUCTURED LOGGING
# ═══════════════════════════════════════════════════════════════════


def test_json_formatter():
    """JSONFormatter should produce valid JSON with required fields."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="omniflow.test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Test message %s",
        args=("hello",),
        exc_info=None,
    )
    output = formatter.format(record)
    parsed = json.loads(output)
    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "omniflow.test"
    assert parsed["msg"] == "Test message hello"
    assert "ts" in parsed


def test_json_formatter_with_extra():
    """JSONFormatter should include extra fields."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="omniflow.api",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Request",
        args=(),
        exc_info=None,
    )
    record.method = "GET"  # type: ignore
    record.path = "/api/v1/dashboard"  # type: ignore
    record.status_code = 200  # type: ignore
    record.latency_ms = 42.1  # type: ignore

    output = formatter.format(record)
    parsed = json.loads(output)
    assert parsed["method"] == "GET"
    assert parsed["path"] == "/api/v1/dashboard"
    assert parsed["status_code"] == 200
    assert parsed["latency_ms"] == 42.1


def test_json_formatter_with_correlation_id():
    """JSONFormatter should include correlation_id from contextvar."""
    formatter = JSONFormatter()
    token = correlation_id_var.set("test-cid-123")

    record = logging.LogRecord(
        name="omniflow.test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="With CID",
        args=(),
        exc_info=None,
    )
    output = formatter.format(record)
    parsed = json.loads(output)
    assert parsed["correlation_id"] == "test-cid-123"

    correlation_id_var.reset(token)


def test_human_formatter():
    """HumanFormatter should produce readable output."""
    formatter = HumanFormatter()
    record = logging.LogRecord(
        name="omniflow.test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Human test",
        args=(),
        exc_info=None,
    )
    output = formatter.format(record)
    assert "INFO" in output
    assert "omniflow.test" in output
    assert "Human test" in output


def test_setup_logging_development():
    """setup_logging with development should use HumanFormatter."""
    setup_logging(environment="development", log_level="INFO")
    root = logging.getLogger()
    assert len(root.handlers) > 0
    handler = root.handlers[-1]
    assert isinstance(handler.formatter, HumanFormatter)


def test_setup_logging_production():
    """setup_logging with production should use JSONFormatter."""
    setup_logging(environment="production", log_level="INFO")
    root = logging.getLogger()
    assert len(root.handlers) > 0
    handler = root.handlers[-1]
    assert isinstance(handler.formatter, JSONFormatter)
    # Restore development logging for other tests
    setup_logging(environment="development", log_level="INFO")


# ═══════════════════════════════════════════════════════════════════
#  RESPONSE HEADERS
# ═══════════════════════════════════════════════════════════════════


async def test_correlation_id_header(client: httpx.AsyncClient):
    """Every response should have X-Request-ID header."""
    resp = await client.get("/health/live")
    assert "X-Request-ID" in resp.headers
    assert len(resp.headers["X-Request-ID"]) > 10


async def test_process_time_header(client: httpx.AsyncClient):
    """Every response should have X-Process-Time header."""
    resp = await client.get("/health/live")
    assert "X-Process-Time" in resp.headers
    assert "ms" in resp.headers["X-Process-Time"]


async def test_security_headers(client: httpx.AsyncClient):
    """Responses should include security headers."""
    resp = await client.get("/health/live")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


async def test_custom_correlation_id_propagated(client: httpx.AsyncClient):
    """X-Request-ID from request should be propagated to response."""
    custom_id = "test-omniflow-123-abc"
    resp = await client.get(
        "/health/live",
        headers={"X-Request-ID": custom_id},
    )
    assert resp.headers.get("X-Request-ID") == custom_id


# ═══════════════════════════════════════════════════════════════════
#  WEB VITALS ENDPOINT
# ═══════════════════════════════════════════════════════════════════


async def test_web_vitals_success(client: httpx.AsyncClient):
    """POST /api/v1/analytics/vitals → accepts valid payload."""
    payload = {
        "entries": [
            {
                "name": "LCP",
                "value": 1234.5,
                "delta": 100.0,
                "id": "v1-lcp-1",
                "navigation_type": "navigate",
                "rating": "good",
            },
            {
                "name": "CLS",
                "value": 0.05,
                "delta": 0.01,
                "id": "v1-cls-1",
                "navigation_type": "navigate",
                "rating": "good",
            },
        ],
        "url": "/dashboard",
        "user_agent": "TestBot/1.0",
    }
    resp = await client.post("/api/v1/analytics/vitals", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "recorded"
    assert data["count"] == 2


async def test_web_vitals_empty_entries(client: httpx.AsyncClient):
    """POST /api/v1/analytics/vitals with empty entries → 422."""
    resp = await client.post(
        "/api/v1/analytics/vitals",
        json={"entries": [], "url": "/", "user_agent": ""},
    )
    assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════════
#  CONFIG VALIDATION
# ═══════════════════════════════════════════════════════════════════


def test_config_redis_max_connections():
    """Config should expose REDIS_MAX_CONNECTIONS."""
    from app.core.config import get_settings
    settings = get_settings()
    assert hasattr(settings, "REDIS_MAX_CONNECTIONS")
    assert settings.REDIS_MAX_CONNECTIONS >= 1


def test_config_web_concurrency():
    """Config should expose WEB_CONCURRENCY."""
    from app.core.config import get_settings
    settings = get_settings()
    assert hasattr(settings, "WEB_CONCURRENCY")
    assert settings.WEB_CONCURRENCY >= 1
