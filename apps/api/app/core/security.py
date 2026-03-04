"""
OmniFlow — Security utilities: JWT (PyJWT), password hashing, token blacklist.
"""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.redis import redis_client

settings = get_settings()

# ── Password hashing (bcrypt direct, no passlib) ────────────────
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT tokens (PyJWT) ─────────────────────────────────────────
def create_access_token(user_id: UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_hex(16),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "jti": secrets.token_hex(16),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.InvalidTokenError on failure."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


# ── Token blacklist (Redis) ────────────────────────────────────
async def blacklist_token(jti: str, exp: datetime) -> None:
    """Add a JTI to the blacklist with TTL = remaining token lifetime."""
    ttl = int((exp - datetime.now(UTC)).total_seconds())
    if ttl > 0:
        await redis_client.setex(f"bl:{jti}", ttl, "1")


async def is_token_blacklisted(jti: str) -> bool:
    """Check if a token JTI has been blacklisted."""
    return bool(await redis_client.exists(f"bl:{jti}"))


# ── Key generation ──────────────────────────────────────────────
def generate_master_key_salt() -> bytes:
    """Generate a random 32-byte salt for Argon2id key derivation."""
    return secrets.token_bytes(32)
