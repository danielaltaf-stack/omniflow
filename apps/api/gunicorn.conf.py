"""
OmniFlow — Gunicorn Configuration for Production.

Uses UvicornWorker for async ASGI support.
Worker count driven by WEB_CONCURRENCY env var (default: CPU * 2 + 1, max 8).
Production-ready: Sentry integration, graceful shutdown, Railway-optimized.
"""

import multiprocessing
import os

# ── Worker configuration ────────────────────────────────────────
worker_class = "uvicorn.workers.UvicornWorker"

# WEB_CONCURRENCY env var overrides auto-detection
_default_workers = min(multiprocessing.cpu_count() * 2 + 1, 8)
workers = int(os.environ.get("WEB_CONCURRENCY", _default_workers))

# ── Network ─────────────────────────────────────────────────────
bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
keepalive = 5  # seconds between keep-alive pings

# ── Timeouts ────────────────────────────────────────────────────
timeout = 120          # worker timeout (patrimoine computations can be heavy)
graceful_timeout = 30  # time to finish requests on SIGTERM

# ── Memory leak prevention ──────────────────────────────────────
max_requests = 1000         # restart worker after N requests
max_requests_jitter = 50    # randomize to avoid thundering herd

# ── Logging ─────────────────────────────────────────────────────
# Access log handled by our AccessLogMiddleware (structured JSON)
accesslog = None  # disable gunicorn access log (avoid duplicates)
errorlog = "-"    # stderr (stdout in containers)
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")

# ── Pre-loading ─────────────────────────────────────────────────
preload_app = True  # share memory between workers, faster boot

# ── Process naming ──────────────────────────────────────────────
proc_name = "omniflow-api"

# ── Forwarded headers (Railway / Cloudflare) ────────────────────
# Trust X-Forwarded-For from reverse proxy (Railway ingress)
forwarded_allow_ips = "*"
proxy_protocol = False

# ── Server hooks ────────────────────────────────────────────────
def on_starting(server):
    """Log startup configuration."""
    server.log.info(
        "OmniFlow Gunicorn starting: %d workers, bind=%s, timeout=%ds, env=%s",
        workers, bind, timeout,
        os.environ.get("ENVIRONMENT", "development"),
    )


def post_worker_init(worker):
    """Log worker initialization."""
    worker.log.info("Worker %s (pid: %s) initialized", worker.age, worker.pid)


def worker_exit(server, worker):
    """
    Log worker exit and flush Sentry events.
    Ensures all captured errors/transactions are sent before process dies.
    """
    server.log.info("Worker %s (pid: %s) exiting — flushing Sentry...", worker.age, worker.pid)
    try:
        import sentry_sdk
        sentry_sdk.flush(timeout=2.0)
    except (ImportError, Exception):
        pass


def child_exit(server, worker):
    """Additional cleanup on child process exit (Railway SIGTERM)."""
    try:
        import sentry_sdk
        sentry_sdk.flush(timeout=2.0)
    except (ImportError, Exception):
        pass
