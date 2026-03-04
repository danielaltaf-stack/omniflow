"""
OmniFlow — Analytics & Observability Endpoints.

GET  /metrics           — Prometheus-compatible metrics (no auth, internal network)
GET  /health/live       — Liveness probe (always 200 if process alive)
GET  /health/ready      — Readiness probe (checks DB + Redis)
POST /analytics/vitals  — Web Vitals reporting from frontend
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core.config import get_settings
from app.core.metrics import format_metrics

logger = logging.getLogger("omniflow.analytics")

router = APIRouter(tags=["Analytics & Monitoring"])

_start_time = time.monotonic()


# ═══════════════════════════════════════════════════════════════════
#  PROMETHEUS METRICS
# ═══════════════════════════════════════════════════════════════════


@router.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> PlainTextResponse:
    """Prometheus scrape endpoint — text/plain exposition format."""
    return PlainTextResponse(
        content=format_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


# ═══════════════════════════════════════════════════════════════════
#  HEALTH CHECKS — Kubernetes-ready
# ═══════════════════════════════════════════════════════════════════


@router.get("/health/live", tags=["Health"])
async def health_live() -> dict:
    """
    Liveness probe — always returns 200 if the process is running.
    Kubernetes: livenessProbe → restart container if this fails.
    """
    return {
        "status": "alive",
        "uptime_seconds": round(time.monotonic() - _start_time, 1),
    }


@router.get("/health/ready", tags=["Health"])
async def health_ready() -> JSONResponse:
    """
    Readiness probe — checks DB and Redis connectivity with latency.
    Kubernetes: readinessProbe → remove from LB if this returns 503.
    """
    from app.core.database import engine
    from app.core.redis import redis_client

    settings = get_settings()
    checks: dict = {}

    # Check database
    db_start = time.monotonic()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ms = (time.monotonic() - db_start) * 1000
        checks["database"] = {"status": "ok", "latency_ms": round(db_ms, 1)}
    except Exception as e:
        db_ms = (time.monotonic() - db_start) * 1000
        checks["database"] = {
            "status": "error",
            "latency_ms": round(db_ms, 1),
            "error": str(e)[:200],
        }

    # Check Redis
    redis_start = time.monotonic()
    try:
        await redis_client.ping()
        redis_ms = (time.monotonic() - redis_start) * 1000
        checks["redis"] = {"status": "ok", "latency_ms": round(redis_ms, 1)}
    except Exception as e:
        redis_ms = (time.monotonic() - redis_start) * 1000
        checks["redis"] = {
            "status": "error",
            "latency_ms": round(redis_ms, 1),
            "error": str(e)[:200],
        }

    all_ok = all(c["status"] == "ok" for c in checks.values())

    body = {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
        "uptime_seconds": round(time.monotonic() - _start_time, 1),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content=body,
    )


# ═══════════════════════════════════════════════════════════════════
#  WEB VITALS REPORTING
# ═══════════════════════════════════════════════════════════════════


class WebVitalEntry(BaseModel):
    """Single Web Vital metric from the frontend."""
    name: str = Field(..., description="Metric name: CLS, FID, FCP, LCP, TTFB, INP")
    value: float = Field(..., description="Metric value")
    delta: float = Field(0.0, description="Delta since last report")
    id: str = Field("", description="Unique metric ID")
    navigation_type: str = Field("", description="navigate, reload, back_forward, prerender")
    rating: str = Field("", description="good, needs-improvement, poor")


class WebVitalsPayload(BaseModel):
    """Batch of Web Vital metrics from the frontend."""
    entries: list[WebVitalEntry] = Field(..., min_length=1, max_length=50)
    url: str = Field("", description="Page URL where metrics were collected")
    user_agent: str = Field("", description="Browser user agent")


@router.post("/api/v1/analytics/vitals")
async def report_web_vitals(payload: WebVitalsPayload, request: Request) -> dict:
    """
    Receive Web Vitals from the frontend.
    Logs them as structured JSON for observability (no DB write).
    """
    client_ip = request.client.host if request.client else "unknown"

    for entry in payload.entries:
        logger.info(
            "WebVital: %s=%s (%s)",
            entry.name,
            entry.value,
            entry.rating,
            extra={
                "method": "VITAL",
                "path": payload.url,
                "client_ip": client_ip,
                "status_code": 0,
                "latency_ms": entry.value if entry.name in ("LCP", "FCP", "TTFB") else 0,
            },
        )

    return {"status": "recorded", "count": len(payload.entries)}
