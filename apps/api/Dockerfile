# ═══════════════════════════════════════════════════════════════════
# OmniFlow API — Multi-Stage Production Dockerfile
# Stage 1: builder  — compile Python dependencies
# Stage 2: woob     — pre-install 34 bank modules
# Stage 3: runtime  — minimal image, non-root user, gunicorn
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Builder ────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps for compiling (bcrypt, asyncpg, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev git gpg \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install .


# ── Stage 2: Woob Module Installer ─────────────────────────────
FROM python:3.12-slim AS woob-init

WORKDIR /app

# Copy compiled packages from builder
COPY --from=builder /install /usr/local

# System deps for woob (gpg for repo auth, git for module install)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git gpg libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install 34 woob bank modules at build time
RUN python -c "\
from woob.core import Woob; w = Woob();\
modules = [\
  'bnp','boursorama','societegenerale','creditmutuel','cragr',\
  'caissedepargne','lcl','bp','cic','fortuneo','hellobank',\
  'banquepopulaire','bforbank','ing','n26','helios','greengot',\
  'orangebank','mafrenchbank','bred','cmb','cmso',\
  'creditcooperatif','creditdunord','axabanque','allianzbanque',\
  'ganassurances','groupama','milleis','ccf',\
  'carrefourbanque','banqueaccord','oney','paypal'\
];\
[w.repositories.install(w.repositories.get_module_info(m)) for m in modules];\
print(f'{len(modules)} woob modules installed')"

# Patch woob cragr module (add default= to Dict() calls for incomplete JSON)
# Cache-bust: changing patch_cragr.py content invalidates this layer
COPY patch_cragr.py /tmp/patch_cragr.py
RUN python /tmp/patch_cragr.py || echo "WARNING: build-time patch failed (runtime patch will retry)" && rm -f /tmp/patch_cragr.py


# ── Stage 3: Runtime (Production) ──────────────────────────────
FROM python:3.12-slim AS runtime

LABEL maintainer="CTO Office <cto@omniflow.app>"
LABEL org.opencontainers.image.source="https://github.com/omniflow/omniflow"
LABEL org.opencontainers.image.description="OmniFlow API — FastAPI + Woob + Gunicorn"

WORKDIR /app

# Minimal runtime deps only (no build-essential, no git)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl tini \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages + woob data
COPY --from=woob-init /usr/local /usr/local
COPY --from=woob-init /root/.local/share/woob /root/.local/share/woob

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Copy application source
COPY . .

# Copy gunicorn config
COPY gunicorn.conf.py .

# Transfer woob data to appuser home
RUN mkdir -p /home/appuser/.local/share && \
    cp -r /root/.local/share/woob /home/appuser/.local/share/woob && \
    chown -R appuser:appuser /app /home/appuser

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Sentry release tracking (overridden by CI with git sha)
    SENTRY_RELEASE=0.5.0

# Switch to non-root user
USER appuser

EXPOSE 8000

# Health check — Railway + Kubernetes compatible
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

# Use tini as PID 1 for proper signal handling (SIGTERM → graceful shutdown)
# Critical for Railway: ensures gunicorn receives SIGTERM correctly during deploys
ENTRYPOINT ["tini", "--"]

# Production: gunicorn with uvicorn workers
# Development: override with uvicorn --reload in docker-compose volumes
CMD ["gunicorn", "app.main:app", "-c", "gunicorn.conf.py"]
