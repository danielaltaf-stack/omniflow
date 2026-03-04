"""
OmniFlow — Structured Logging Configuration.

Production: JSON-formatted logs (one JSON object per line, parseable by ELK/Loki/CloudWatch).
Development: Human-readable colored logs.

Uses contextvars to propagate correlation_id across async tasks.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

# ── Context variable for correlation ID propagation ─────────────
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")


class JSONFormatter(logging.Formatter):
    """
    Structured JSON log formatter for production.
    One JSON object per line — compatible with every log aggregator.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds") + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }

        # Inject correlation_id from contextvar
        cid = correlation_id_var.get("-")
        if cid != "-":
            log_entry["correlation_id"] = cid

        # Extra fields passed via logger.info("msg", extra={...})
        for key in ("method", "path", "status_code", "latency_ms",
                     "client_ip", "user_agent", "content_length",
                     "user_id", "db_latency_ms", "redis_latency_ms"):
            val = getattr(record, key, None)
            if val is not None:
                log_entry[key] = val

        # Exception info
        if record.exc_info and record.exc_info[1] is not None:
            log_entry["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class HumanFormatter(logging.Formatter):
    """Human-readable format for development — concise, timestamped."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[1;31m",  # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        ts = datetime.now().strftime("%H:%M:%S")
        cid = correlation_id_var.get("-")
        cid_part = f" [{cid[:8]}]" if cid != "-" else ""
        return (
            f"{ts} {color}{record.levelname:<8}{self.RESET} "
            f"[{record.name}]{cid_part} {record.getMessage()}"
        )


def setup_logging(environment: str = "development", log_level: str = "INFO") -> None:
    """
    Configure root logger with the appropriate formatter.

    Args:
        environment: "development" → human format, anything else → JSON
        log_level: Python log level name (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    # Pick formatter based on environment
    if environment == "development":
        handler.setFormatter(HumanFormatter())
    else:
        handler.setFormatter(JSONFormatter())

    # Configure root logger
    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers to avoid duplicates
    for h in root.handlers[:]:
        root.removeHandler(h)

    root.addHandler(handler)

    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "uvicorn.error", "httpcore", "httpx",
                   "asyncio", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
