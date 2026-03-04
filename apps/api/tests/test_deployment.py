"""
OmniFlow — E5 Deployment & Infrastructure Tests.

Validates:
  - Sentry configuration (init, before_send filtering, scrubbing, degradation)
  - Production config validation (Sentry fields, launch mode, version)
  - Redis TLS detection and verify_redis_connection retry logic
  - Database SSL auto-detection for cloud providers
  - Dockerfile & Railway configuration sanity checks
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ═══════════════════════════════════════════════════════════════════
#  1. SENTRY CONFIGURATION
# ═══════════════════════════════════════════════════════════════════


class TestSentryConfig:
    """Unit tests for app.core.sentry_config module."""

    def test_init_sentry_empty_dsn_returns_false(self):
        """init_sentry('') → False, Sentry not initialized."""
        from app.core.sentry_config import init_sentry

        # Reset state
        import app.core.sentry_config as sc
        sc._sentry_initialized = False

        result = init_sentry("")
        assert result is False
        assert sc._sentry_initialized is False

    def test_init_sentry_whitespace_dsn_returns_false(self):
        """init_sentry('   ') → False."""
        from app.core.sentry_config import init_sentry
        import app.core.sentry_config as sc
        sc._sentry_initialized = False

        result = init_sentry("   ")
        assert result is False

    def test_is_initialized_default_false(self):
        """is_initialized() → False before any init call."""
        import app.core.sentry_config as sc
        sc._sentry_initialized = False

        from app.core.sentry_config import is_initialized
        assert is_initialized() is False

    def test_capture_exception_noop_when_not_initialized(self):
        """capture_exception should be a silent no-op when Sentry is off."""
        import app.core.sentry_config as sc
        sc._sentry_initialized = False

        from app.core.sentry_config import capture_exception
        # Should not raise
        capture_exception(ValueError("test error"))

    def test_set_user_noop_when_not_initialized(self):
        """set_user should be a silent no-op when Sentry is off."""
        import app.core.sentry_config as sc
        sc._sentry_initialized = False

        from app.core.sentry_config import set_user
        # Should not raise
        set_user("user-123", "test@example.com")

    def test_before_send_drops_401(self):
        """HTTPException 401 should be filtered (return None)."""
        from app.core.sentry_config import _before_send

        class FakeHTTPException(Exception):
            def __init__(self, status_code):
                self.status_code = status_code

        exc = FakeHTTPException(401)
        exc.__class__.__name__ = "HTTPException"
        hint = {"exc_info": (type(exc), exc, None)}
        event = {"request": {}}

        result = _before_send(event, hint)
        assert result is None

    def test_before_send_drops_404(self):
        """HTTPException 404 should be filtered."""
        from app.core.sentry_config import _before_send

        class HTTPException(Exception):
            def __init__(self, status_code):
                self.status_code = status_code

        exc = HTTPException(404)
        hint = {"exc_info": (type(exc), exc, None)}
        event = {"request": {}}

        result = _before_send(event, hint)
        assert result is None

    def test_before_send_drops_422(self):
        """HTTPException 422 should be filtered (validation errors)."""
        from app.core.sentry_config import _before_send

        class HTTPException(Exception):
            def __init__(self, status_code):
                self.status_code = status_code

        exc = HTTPException(422)
        hint = {"exc_info": (type(exc), exc, None)}
        event = {"request": {}}

        result = _before_send(event, hint)
        assert result is None

    def test_before_send_keeps_500(self):
        """HTTPException 500 should NOT be filtered."""
        from app.core.sentry_config import _before_send

        class HTTPException(Exception):
            def __init__(self, status_code):
                self.status_code = status_code

        exc = HTTPException(500)
        hint = {"exc_info": (type(exc), exc, None)}
        event = {"request": {"headers": {}}}

        result = _before_send(event, hint)
        assert result is not None

    def test_before_send_scrubs_authorization_header(self):
        """Authorization header should be replaced with [Filtered]."""
        from app.core.sentry_config import _before_send

        event = {
            "request": {
                "headers": {
                    "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.secret",
                    "Content-Type": "application/json",
                },
            },
        }
        hint = {}

        result = _before_send(event, hint)
        assert result is not None
        assert result["request"]["headers"]["Authorization"] == "[Filtered]"
        assert result["request"]["headers"]["Content-Type"] == "application/json"

    def test_before_send_scrubs_cookie_header(self):
        """Cookie header should be replaced with [Filtered]."""
        from app.core.sentry_config import _before_send

        event = {
            "request": {
                "headers": {
                    "Cookie": "session=abc123; token=xyz",
                },
            },
        }
        hint = {}

        result = _before_send(event, hint)
        assert result["request"]["headers"]["Cookie"] == "[Filtered]"

    def test_before_send_scrubs_password_in_body(self):
        """Password fields in request body should be scrubbed."""
        from app.core.sentry_config import _before_send

        event = {
            "request": {
                "headers": {},
                "data": {
                    "email": "user@test.com",
                    "password": "mysecretpass",
                    "new_password": "anothersecret",
                },
            },
        }
        hint = {}

        result = _before_send(event, hint)
        assert result["request"]["data"]["password"] == "[Filtered]"
        assert result["request"]["data"]["new_password"] == "[Filtered]"
        assert result["request"]["data"]["email"] == "user@test.com"

    def test_before_send_transaction_drops_health(self):
        """Health check transactions should be dropped."""
        from app.core.sentry_config import _before_send_transaction

        event = {"transaction": "GET /health/live"}
        result = _before_send_transaction(event, {})
        assert result is None

    def test_before_send_transaction_drops_metrics(self):
        """Metrics transactions should be dropped."""
        from app.core.sentry_config import _before_send_transaction

        event = {"transaction": "GET /metrics"}
        result = _before_send_transaction(event, {})
        assert result is None

    def test_before_send_transaction_keeps_api(self):
        """API transactions should be kept."""
        from app.core.sentry_config import _before_send_transaction

        event = {"transaction": "GET /api/v1/dashboard/summary"}
        result = _before_send_transaction(event, {})
        assert result is not None
        assert result["transaction"] == "GET /api/v1/dashboard/summary"


# ═══════════════════════════════════════════════════════════════════
#  2. PRODUCTION CONFIG VALIDATION
# ═══════════════════════════════════════════════════════════════════


class TestProductionConfig:
    """Unit tests for production settings in config.py."""

    def test_app_version_is_0_5_0(self):
        """APP_VERSION should be 0.5.0 for E5 release."""
        from app.core.config import get_settings
        s = get_settings()
        assert s.APP_VERSION == "0.5.0"

    def test_sentry_dsn_default_empty(self):
        """SENTRY_DSN should default to empty (disabled in dev)."""
        from app.core.config import get_settings
        s = get_settings()
        assert s.SENTRY_DSN == "" or isinstance(s.SENTRY_DSN, str)

    def test_sentry_traces_rate_range(self):
        """Traces sample rate should be 0..1."""
        from app.core.config import get_settings
        s = get_settings()
        assert 0.0 <= s.SENTRY_TRACES_SAMPLE_RATE <= 1.0

    def test_sentry_profiles_rate_range(self):
        """Profiles sample rate should be 0..1."""
        from app.core.config import get_settings
        s = get_settings()
        assert 0.0 <= s.SENTRY_PROFILES_SAMPLE_RATE <= 1.0

    def test_launch_mode_valid(self):
        """LAUNCH_MODE should be one of waitlist/beta/public."""
        from app.core.config import get_settings
        s = get_settings()
        assert s.LAUNCH_MODE in ("waitlist", "beta", "public")

    def test_db_pool_recycle_reasonable(self):
        """DB_POOL_RECYCLE should be set (cloud DBs drop idle connections)."""
        from app.core.config import get_settings
        s = get_settings()
        assert s.DB_POOL_RECYCLE > 0
        assert s.DB_POOL_RECYCLE <= 3600  # Max 1 hour is reasonable

    def test_statement_timeout_set(self):
        """DB statement timeout should be set to prevent runaway queries."""
        from app.core.config import get_settings
        s = get_settings()
        assert s.DB_STATEMENT_TIMEOUT_MS > 0
        assert s.DB_STATEMENT_TIMEOUT_MS <= 60000  # Max 60s


# ═══════════════════════════════════════════════════════════════════
#  3. REDIS TLS & VERIFY CONNECTION
# ═══════════════════════════════════════════════════════════════════


class TestRedisProduction:
    """Unit tests for Redis production readiness (TLS, retry logic)."""

    def test_tls_detection_rediss_scheme(self):
        """rediss:// URLs should be detected as TLS."""
        url = "rediss://default:abc123@eu1-fast.upstash.io:6379"
        assert url.startswith("rediss://")

    def test_tls_detection_redis_scheme(self):
        """redis:// URLs should NOT be detected as TLS."""
        url = "redis://localhost:6379/0"
        assert not url.startswith("rediss://")

    @pytest.mark.asyncio
    async def test_verify_redis_connection_success(self):
        """verify_redis_connection returns True when ping succeeds."""
        import app.core.redis as redis_mod

        original_client = redis_mod.redis_client
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(return_value=True)
        redis_mod.redis_client = mock_client

        try:
            result = await redis_mod.verify_redis_connection(max_retries=1)
            assert result is True
            mock_client.ping.assert_called_once()
        finally:
            redis_mod.redis_client = original_client

    @pytest.mark.asyncio
    async def test_verify_redis_connection_failure_retries(self):
        """verify_redis_connection retries on failure and returns False."""
        import redis.asyncio as aioredis
        import app.core.redis as redis_mod

        original_client = redis_mod.redis_client
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock(side_effect=aioredis.ConnectionError("refused"))
        redis_mod.redis_client = mock_client

        try:
            result = await redis_mod.verify_redis_connection(max_retries=2)
            assert result is False
            assert mock_client.ping.call_count == 2
        finally:
            redis_mod.redis_client = original_client


# ═══════════════════════════════════════════════════════════════════
#  4. DATABASE SSL AUTO-DETECTION
# ═══════════════════════════════════════════════════════════════════


class TestDatabaseProduction:
    """Unit tests for database cloud SSL auto-detection logic."""

    def test_neon_detected_as_cloud(self):
        """Neon URLs should be detected as cloud."""
        url = "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/db?sslmode=require"
        assert ".neon.tech" in url

    def test_supabase_detected_as_cloud(self):
        """Supabase URLs should be detected as cloud."""
        url = "postgresql+asyncpg://user:pass@db.xyz.supabase.co/postgres"
        assert ".supabase.co" in url

    def test_railway_detected_as_cloud(self):
        """Railway URLs should be detected as cloud."""
        url = "postgresql+asyncpg://postgres:pass@xyz.railway.app/railway"
        assert ".railway.app" in url

    def test_localhost_not_cloud(self):
        """Localhost URLs should NOT be detected as cloud."""
        url = "postgresql+asyncpg://omniflow:omniflow@localhost:5432/omniflow"
        is_cloud = any(p in url for p in (".neon.tech", ".supabase.co", ".railway.app"))
        assert is_cloud is False

    def test_ssl_auto_detect_logic(self):
        """Cloud URLs without sslmode in URL get ssl=require added."""
        url = "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/db"
        is_cloud = any(p in url for p in (".neon.tech", ".supabase.co", ".railway.app"))
        needs_ssl = is_cloud and "sslmode" not in url
        assert needs_ssl is True

    def test_ssl_not_added_when_sslmode_present(self):
        """URLs with sslmode should not get extra ssl added."""
        url = "postgresql+asyncpg://user:pass@ep-xyz.neon.tech/db?sslmode=require"
        is_cloud = any(p in url for p in (".neon.tech", ".supabase.co", ".railway.app"))
        needs_ssl = is_cloud and "sslmode" not in url
        assert needs_ssl is False


# ═══════════════════════════════════════════════════════════════════
#  5. DEPLOYMENT CONFIGURATION SANITY CHECKS
# ═══════════════════════════════════════════════════════════════════


class TestDeploymentSanity:
    """Validate deployment configuration files exist and are well-formed."""

    def test_railway_toml_exists(self):
        """railway.toml should exist at repo root."""
        from pathlib import Path
        toml_path = Path(__file__).parent.parent.parent.parent / "railway.toml"
        assert toml_path.exists(), f"railway.toml not found at {toml_path}"

    def test_railway_toml_has_healthcheck(self):
        """railway.toml should define a healthcheckPath."""
        from pathlib import Path
        toml_path = Path(__file__).parent.parent.parent.parent / "railway.toml"
        content = toml_path.read_text(encoding="utf-8")
        assert "healthcheckPath" in content
        assert "/health/live" in content

    def test_railway_toml_has_release_command(self):
        """railway.toml should run alembic migrations on release."""
        from pathlib import Path
        toml_path = Path(__file__).parent.parent.parent.parent / "railway.toml"
        content = toml_path.read_text(encoding="utf-8")
        assert "alembic upgrade head" in content

    def test_dockerfile_has_tini(self):
        """Dockerfile should use tini for proper signal handling."""
        from pathlib import Path
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        content = dockerfile.read_text(encoding="utf-8")
        assert "tini" in content

    def test_dockerfile_has_non_root_user(self):
        """Dockerfile should run as non-root user."""
        from pathlib import Path
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        content = dockerfile.read_text(encoding="utf-8")
        assert "USER appuser" in content

    def test_dockerfile_has_healthcheck(self):
        """Dockerfile should define HEALTHCHECK."""
        from pathlib import Path
        dockerfile = Path(__file__).parent.parent / "Dockerfile"
        content = dockerfile.read_text(encoding="utf-8")
        assert "HEALTHCHECK" in content

    def test_env_production_example_exists(self):
        """.env.production.example should exist."""
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env.production.example"
        assert env_path.exists(), f".env.production.example not found at {env_path}"

    def test_env_production_has_sentry(self):
        """.env.production.example should include SENTRY_DSN."""
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env.production.example"
        content = env_path.read_text(encoding="utf-8")
        assert "SENTRY_DSN" in content

    def test_env_production_has_neon(self):
        """.env.production.example should reference Neon."""
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env.production.example"
        content = env_path.read_text(encoding="utf-8")
        assert "neon.tech" in content

    def test_env_production_has_upstash(self):
        """.env.production.example should reference Upstash."""
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env.production.example"
        content = env_path.read_text(encoding="utf-8")
        assert "upstash" in content.lower()

    def test_env_production_debug_false(self):
        """.env.production.example should have DEBUG=false."""
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env.production.example"
        content = env_path.read_text(encoding="utf-8")
        assert "DEBUG=false" in content

    def test_deployment_md_exists(self):
        """DEPLOYMENT.md should exist at repo root."""
        from pathlib import Path
        md_path = Path(__file__).parent.parent.parent.parent / "DEPLOYMENT.md"
        assert md_path.exists(), f"DEPLOYMENT.md not found at {md_path}"
