"""
OmniFlow — FastAPI application entry point.
Security-hardened: headers middleware, structured JSON logging, rate limiting,
correlation ID tracking, GZip compression, Prometheus metrics, Kubernetes health probes.
"""

import logging
import time
import uuid as uuid_mod
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import router as v1_router
from app.api.v1.analytics import router as analytics_router
from app.core.config import get_settings
from app.core.database import engine
from app.core.logging_config import correlation_id_var, setup_logging
from app.core.metrics import record_request, _normalize_path
from app.core.redis import redis_client, verify_redis_connection
from app.core.sentry_config import init_sentry, capture_exception as sentry_capture
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.realtime.market_hub import market_hub

settings = get_settings()

# ── Structured logging ──────────────────────────────────────────
setup_logging(environment=settings.ENVIRONMENT, log_level=settings.LOG_LEVEL)
logger = logging.getLogger("omniflow.api")


# ── Rate limiter (slowapi) ─────────────────────────────────────
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)


# ── Lifespan (startup / shutdown) ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("%s v%s starting (env=%s)...", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    # Runtime-patch woob cragr module (safety net if Docker build-time patch failed)
    try:
        from app.woob_engine.patch_cragr_runtime import patch_cragr_pages
        patch_cragr_pages()
    except Exception as e:
        logger.warning("Runtime cragr patch failed (non-fatal): %s", e)

    # Initialize Sentry (no-op if DSN not configured)
    sentry_env = settings.SENTRY_ENVIRONMENT or settings.ENVIRONMENT
    init_sentry(
        dsn=settings.SENTRY_DSN,
        environment=sentry_env,
        release=settings.APP_VERSION,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
    )

    # Verify Redis connectivity (fail-fast in production)
    redis_ok = await verify_redis_connection()
    if not redis_ok and settings.ENVIRONMENT == "production":
        logger.critical("Redis connection failed — cannot start in production without Redis.")
        raise RuntimeError("Redis connection failed")

    try:
        start_scheduler()
        logger.info("APScheduler started — sync every %dh", settings.SYNC_INTERVAL_HOURS)
    except Exception as e:
        logger.warning("Scheduler failed to start: %s", e)

    # Start real-time market hub
    try:
        await market_hub.start()
        logger.info("MarketHub started — real-time market data active")
    except Exception as e:
        logger.warning("MarketHub failed to start: %s", e)

    yield
    # Shutdown
    await market_hub.stop()
    stop_scheduler()
    await engine.dispose()
    await redis_client.close()
    logger.info("OmniFlow API shut down gracefully.")


# ── App factory ─────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Attach limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Correlation ID + Access Log + Metrics middleware ────────────
@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Inject correlation ID, measure latency, log access, record metrics."""
    correlation_id = request.headers.get("X-Request-ID", str(uuid_mod.uuid4()))
    request.state.correlation_id = correlation_id

    # Set contextvar for structured logging propagation
    token = correlation_id_var.set(correlation_id)

    start = time.monotonic()
    response = await call_next(request)
    elapsed_s = time.monotonic() - start
    elapsed_ms = elapsed_s * 1000

    # Response headers
    response.headers["X-Request-ID"] = correlation_id
    response.headers["X-Process-Time"] = f"{elapsed_ms:.1f}ms"

    # Prometheus metrics (skip /metrics and /health paths to reduce noise)
    path = request.url.path
    if not path.startswith("/metrics") and not path.startswith("/health"):
        normalized = _normalize_path(path)
        record_request(request.method, normalized, response.status_code, elapsed_s)

    # Structured access log (skip health probes to reduce noise)
    if not path.startswith("/health"):
        logger.info(
            "%s %s %d %.1fms",
            request.method, path, response.status_code, elapsed_ms,
            extra={
                "method": request.method,
                "path": path,
                "status_code": response.status_code,
                "latency_ms": round(elapsed_ms, 1),
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "")[:200],
                "content_length": response.headers.get("content-length", "0"),
            },
        )

    correlation_id_var.reset(token)
    return response


# ── Security headers middleware ─────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "camera=(), microphone=()"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
    return response


# ── CORS (explicit methods & headers) ──────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)

# ── GZip compression (responses > 500 bytes) ──────────────────
app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Global exception handler ───────────────────────────────────
def _add_cors_headers(request: Request, response: JSONResponse) -> JSONResponse:
    """Ensure CORS headers on error responses (Starlette CORSMiddleware can miss them)."""
    origin = request.headers.get("origin", "")
    if origin and origin in settings.ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
    return _add_cors_headers(request, response)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    logger.exception(
        "Unhandled error on %s %s [correlation_id=%s]",
        request.method, request.url, correlation_id,
    )
    # Report to Sentry with correlation ID tag
    sentry_capture(exc)
    content: dict = {
        "detail": "Erreur interne du serveur.",
        "correlation_id": correlation_id,
    }
    if settings.DEBUG:
        content["traceback"] = str(exc)

    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
    )

    return _add_cors_headers(request, response)


# ── Health check (legacy → redirect to /health/ready) ──────────
@app.get("/health", tags=["Health"])
async def health():
    """Legacy health check — redirects to /health/ready for backward compat."""
    from app.api.v1.analytics import health_ready
    return await health_ready()


# ── Security.txt (RFC 9116) ─────────────────────────────────────
_SECURITY_TXT = """\
Contact: mailto:security@omniflow.app
Expires: 2027-03-04T00:00:00.000Z
Preferred-Languages: fr, en
Canonical: https://omniflow.app/.well-known/security.txt
Policy: https://omniflow.app/security-policy
"""


@app.get("/.well-known/security.txt", tags=["Security"], include_in_schema=False)
async def security_txt():
    """RFC 9116 — Internet Security Reporting Format."""
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(_SECURITY_TXT, media_type="text/plain")


# ── Routers ─────────────────────────────────────────────────────
app.include_router(analytics_router)
app.include_router(v1_router)
