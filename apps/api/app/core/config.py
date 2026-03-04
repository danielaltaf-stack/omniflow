"""
OmniFlow — Core Configuration
Pydantic Settings v2, env-driven, validated at startup.
Fail-fast boot guard: refuses to start with default secrets in non-dev environments.
"""

import logging
import sys
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_security_log = logging.getLogger("omniflow.security")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ──────────────────────────────────────────
    APP_NAME: str = "OmniFlow API"
    APP_VERSION: str = "0.5.0"
    DEBUG: bool = False
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    API_V1_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    LOG_LEVEL: str = "INFO"
    LAUNCH_MODE: Literal["waitlist", "beta", "public"] = "beta"

    # ── Database ─────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://omniflow:omniflow@localhost:5432/omniflow"

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False
    DB_POOL_RECYCLE: int = 1800  # 30 min — avoids stale connections on cloud DBs
    DB_STATEMENT_TIMEOUT_MS: int = 30000  # 30s — kills runaway queries

    # ── Redis ────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 20

    # ── Workers (Gunicorn) ───────────────────────────
    WEB_CONCURRENCY: int = 4

    # ── JWT ──────────────────────────────────────────
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION-USE-openssl-rand-hex-64"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── Security ─────────────────────────────────────
    BCRYPT_ROUNDS: int = 12
    LOGIN_RATE_LIMIT: int = 5  # attempts per window
    LOGIN_RATE_WINDOW_SECONDS: int = 900  # 15 min
    ENCRYPTION_KEY: str = "CHANGE-ME-IN-PRODUCTION-USE-openssl-rand-hex-32"
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_AUTH_PER_MINUTE: int = 30

    # ── Scheduler ─────────────────────────────────────
    SYNC_INTERVAL_HOURS: int = 6
    SYNC_MAX_CONCURRENT: int = 5

    # ── External APIs (optional) ─────────────────────
    ETHERSCAN_API_KEY: str = ""
    COINGECKO_API_KEY: str = ""  # Pro key if needed

    # ── AI / LLM (Phase 4B — Nova) ──────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_BASE_URL: str = ""  # Custom base URL for OpenAI-compatible APIs
    AI_PROVIDERS: str = "[]"  # JSON list: [{"name","base_url","api_key","model"}]
    AI_DAILY_LIMIT: int = 20  # questions per user per day

    # ── Cache TTLs (seconds) ─────────────────────────
    CACHE_TTL_DASHBOARD: int = 60       # 1 min
    CACHE_TTL_NETWORTH: int = 120       # 2 min
    CACHE_TTL_NETWORTH_HISTORY: int = 300  # 5 min
    CACHE_TTL_CASHFLOW: int = 300       # 5 min
    CACHE_TTL_OMNISCORE: int = 86400    # 24h
    CACHE_TTL_BUDGET: int = 300         # 5 min
    CACHE_TTL_RETIREMENT: int = 600     # 10 min
    CACHE_TTL_HERITAGE: int = 600       # 10 min
    CACHE_TTL_FEE_NEGOTIATOR: int = 600
    CACHE_TTL_FISCAL_RADAR: int = 600  # 10 min
    CACHE_TTL_WEALTH_AUTOPILOT: int = 300  # 5 min
    CACHE_TTL_DIGITAL_VAULT: int = 300      # 5 min

    # ── Push Notifications (VAPID) ─────────────────────
    VAPID_PRIVATE_KEY: str = "CHANGE-ME-GENERATE-WITH-PYWEBPUSH"
    VAPID_PUBLIC_KEY: str = "CHANGE-ME-GENERATE-WITH-PYWEBPUSH"
    VAPID_SUBJECT: str = "mailto:contact@omniflow.app"

    # ── Sentry (Error Tracking & APM) ────────────────────
    SENTRY_DSN: str = ""  # Empty = disabled. Set in production.
    SENTRY_TRACES_SAMPLE_RATE: float = 0.2   # 20% of requests traced
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1  # 10% of traces profiled
    SENTRY_ENVIRONMENT: str = ""  # Override ENVIRONMENT for Sentry (empty = use ENVIRONMENT)

    @property
    def database_url_sync(self) -> str:
        """Sync URL for Alembic migrations."""
        return self.DATABASE_URL.replace("+asyncpg", "")

    @model_validator(mode="after")
    def _validate_security(self) -> "Settings":
        """Fail-fast boot guard — refuse to start with dangerous defaults."""
        secret_weak = "CHANGE-ME" in self.SECRET_KEY
        enc_weak = "CHANGE-ME" in self.ENCRYPTION_KEY

        if self.ENVIRONMENT != "development":
            errors: list[str] = []
            if secret_weak:
                errors.append("SECRET_KEY contains default placeholder")
            if enc_weak:
                errors.append("ENCRYPTION_KEY contains default placeholder")
            if len(self.ENCRYPTION_KEY) < 32:
                errors.append(
                    f"ENCRYPTION_KEY too short ({len(self.ENCRYPTION_KEY)} chars, need >=32)"
                )
            if len(self.SECRET_KEY) < 64:
                errors.append(
                    f"SECRET_KEY too short ({len(self.SECRET_KEY)} chars, need >=64)"
                )
            if self.DEBUG:
                _security_log.warning(
                    "DEBUG=True in %s environment — disable for production",
                    self.ENVIRONMENT,
                )
            if errors:
                for err in errors:
                    _security_log.critical("BOOT GUARD FAILURE: %s", err)
                _security_log.critical(
                    "Refusing to start in '%s' with insecure configuration. "
                    "Set proper secrets or use ENVIRONMENT=development.",
                    self.ENVIRONMENT,
                )
                sys.exit(1)
        else:
            # Development warnings
            if secret_weak:
                _security_log.warning(
                    "SECRET_KEY uses default placeholder — change before deploying"
                )
            if enc_weak:
                _security_log.warning(
                    "ENCRYPTION_KEY uses default placeholder — change before deploying"
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
