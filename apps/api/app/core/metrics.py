"""
OmniFlow — Lightweight Prometheus-compatible Metrics.

Zero external dependencies — pure Python counters, gauges, and histograms.
Exposes GET /metrics in Prometheus exposition format.

Thread-safe via threading.Lock for multi-worker environments.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Sequence

from app.core.config import get_settings

_lock = threading.Lock()

# ── Histogram bucket boundaries (seconds) ───────────────────────
LATENCY_BUCKETS: tuple[float, ...] = (
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
)


class _Counter:
    """Monotonically increasing counter."""
    __slots__ = ("_value",)

    def __init__(self) -> None:
        self._value: float = 0.0

    def inc(self, amount: float = 1.0) -> None:
        with _lock:
            self._value += amount

    @property
    def value(self) -> float:
        return self._value


class _Gauge:
    """Value that can go up and down."""
    __slots__ = ("_value",)

    def __init__(self) -> None:
        self._value: float = 0.0

    def set(self, value: float) -> None:
        with _lock:
            self._value = value

    def inc(self, amount: float = 1.0) -> None:
        with _lock:
            self._value += amount

    def dec(self, amount: float = 1.0) -> None:
        with _lock:
            self._value -= amount

    @property
    def value(self) -> float:
        return self._value


class _Histogram:
    """
    Histogram with configurable buckets.
    Tracks count, sum, and per-bucket cumulative counts.
    """
    __slots__ = ("_buckets", "_bucket_counts", "_count", "_sum")

    def __init__(self, buckets: tuple[float, ...] = LATENCY_BUCKETS) -> None:
        self._buckets = buckets
        self._bucket_counts: list[int] = [0] * len(buckets)
        self._count: int = 0
        self._sum: float = 0.0

    def observe(self, value: float) -> None:
        with _lock:
            self._count += 1
            self._sum += value
            for i, boundary in enumerate(self._buckets):
                if value <= boundary:
                    self._bucket_counts[i] += 1

    @property
    def count(self) -> int:
        return self._count

    @property
    def total(self) -> float:
        return self._sum

    def buckets_cumulative(self) -> list[tuple[str, int]]:
        """Return cumulative bucket counts for Prometheus format.
        
        Note: _bucket_counts are already cumulative (observe increments all
        buckets where value <= boundary), so we return them as-is.
        """
        result: list[tuple[str, int]] = []
        for i, boundary in enumerate(self._buckets):
            result.append((str(boundary), self._bucket_counts[i]))
        result.append(("+Inf", self._count))
        return result


# ═══════════════════════════════════════════════════════════════════
#  METRICS REGISTRY — Global singleton
# ═══════════════════════════════════════════════════════════════════

# Labeled counters: key = (method, path_template, status_code)
_http_requests: dict[tuple[str, str, int], _Counter] = defaultdict(_Counter)
_http_duration: dict[tuple[str, str], _Histogram] = {}

# Simple counters
db_queries_total = _Counter()
cache_hits_total = _Counter()
cache_misses_total = _Counter()
push_sent_total = _Counter()
push_failed_total = _Counter()

# Gauges
db_pool_size = _Gauge()
db_pool_checked_out = _Gauge()
active_ws_connections = _Gauge()

# Global histogram for all request latencies
request_duration_global = _Histogram()

# App start time
_start_time = time.monotonic()


def record_request(method: str, path: str, status_code: int, duration_s: float) -> None:
    """Record an HTTP request metric."""
    key = (method, path, status_code)
    with _lock:
        if key not in _http_requests:
            _http_requests[key] = _Counter()
    _http_requests[key].inc()
    request_duration_global.observe(duration_s)

    duration_key = (method, path)
    with _lock:
        if duration_key not in _http_duration:
            _http_duration[duration_key] = _Histogram()
    _http_duration[duration_key].observe(duration_s)


def _normalize_path(path: str) -> str:
    """
    Normalize URL path to reduce cardinality.
    /api/v1/stocks/uuid-here → /api/v1/stocks/{id}
    """
    parts = path.strip("/").split("/")
    normalized: list[str] = []
    for part in parts:
        # UUID pattern or numeric ID
        if len(part) == 36 and part.count("-") == 4:
            normalized.append("{id}")
        elif part.isdigit():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)


def format_metrics() -> str:
    """
    Format all metrics in Prometheus exposition format.
    https://prometheus.io/docs/instrumenting/exposition_formats/
    """
    settings = get_settings()
    lines: list[str] = []

    # ── App info ────────────────────────────────────────────────
    lines.append(f'# HELP app_info Application metadata')
    lines.append(f'# TYPE app_info gauge')
    lines.append(
        f'app_info{{version="{settings.APP_VERSION}",'
        f'environment="{settings.ENVIRONMENT}"}} 1'
    )

    # ── Uptime ──────────────────────────────────────────────────
    uptime = time.monotonic() - _start_time
    lines.append(f'# HELP process_uptime_seconds Time since process start')
    lines.append(f'# TYPE process_uptime_seconds gauge')
    lines.append(f'process_uptime_seconds {uptime:.1f}')

    # ── HTTP requests ───────────────────────────────────────────
    lines.append(f'# HELP http_requests_total Total HTTP requests')
    lines.append(f'# TYPE http_requests_total counter')
    for (method, path, status), counter in sorted(_http_requests.items()):
        lines.append(
            f'http_requests_total{{method="{method}",path="{path}",'
            f'status="{status}"}} {counter.value:.0f}'
        )

    # ── HTTP duration histogram ─────────────────────────────────
    lines.append(f'# HELP http_request_duration_seconds Request duration')
    lines.append(f'# TYPE http_request_duration_seconds histogram')
    for bucket_le, count in request_duration_global.buckets_cumulative():
        lines.append(
            f'http_request_duration_seconds_bucket{{le="{bucket_le}"}} {count}'
        )
    lines.append(
        f'http_request_duration_seconds_sum {request_duration_global.total:.6f}'
    )
    lines.append(
        f'http_request_duration_seconds_count {request_duration_global.count}'
    )

    # ── DB ──────────────────────────────────────────────────────
    lines.append(f'# HELP db_queries_total Total database queries')
    lines.append(f'# TYPE db_queries_total counter')
    lines.append(f'db_queries_total {db_queries_total.value:.0f}')

    lines.append(f'# HELP db_pool_size Current DB pool size')
    lines.append(f'# TYPE db_pool_size gauge')
    lines.append(f'db_pool_size {db_pool_size.value:.0f}')

    lines.append(f'# HELP db_pool_checked_out DB connections in use')
    lines.append(f'# TYPE db_pool_checked_out gauge')
    lines.append(f'db_pool_checked_out {db_pool_checked_out.value:.0f}')

    # ── Cache ───────────────────────────────────────────────────
    lines.append(f'# HELP cache_hits_total Redis cache hits')
    lines.append(f'# TYPE cache_hits_total counter')
    lines.append(f'cache_hits_total {cache_hits_total.value:.0f}')

    lines.append(f'# HELP cache_misses_total Redis cache misses')
    lines.append(f'# TYPE cache_misses_total counter')
    lines.append(f'cache_misses_total {cache_misses_total.value:.0f}')

    # ── Push ────────────────────────────────────────────────────
    lines.append(f'# HELP push_notifications_sent_total Push notifications sent')
    lines.append(f'# TYPE push_notifications_sent_total counter')
    lines.append(f'push_notifications_sent_total {push_sent_total.value:.0f}')

    lines.append(f'# HELP push_notifications_failed_total Push notifications failed')
    lines.append(f'# TYPE push_notifications_failed_total counter')
    lines.append(f'push_notifications_failed_total {push_failed_total.value:.0f}')

    # ── WebSocket ───────────────────────────────────────────────
    lines.append(f'# HELP active_websocket_connections Active WS connections')
    lines.append(f'# TYPE active_websocket_connections gauge')
    lines.append(f'active_websocket_connections {active_ws_connections.value:.0f}')

    lines.append("")  # trailing newline
    return "\n".join(lines)
