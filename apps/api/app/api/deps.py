"""
OmniFlow — Shared API dependencies (DB session, current user, rate limiter).
Token blacklist check integrated into authentication flow.
"""

from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import decode_token, is_token_blacklisted
from app.models.user import User

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the JWT, check blacklist, return the User ORM object."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant.",
        )
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expiré.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide.",
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Type de token invalide.",
        )

    # Check blacklist BEFORE hitting the database
    jti = payload.get("jti")
    if jti and await is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token révoqué.",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide.",
        )

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable ou désactivé.",
        )

    return user


async def check_login_rate_limit(
    email: str,
    redis: Redis = Depends(get_redis),
) -> None:
    """Rate-limit login attempts: max N per window per email."""
    key = f"omniflow:rate_limit:login:{email}"
    attempts = await redis.get(key)

    if attempts and int(attempts) >= settings.LOGIN_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de tentatives. Réessayez dans 15 minutes.",
        )


async def increment_login_attempts(email: str, redis: Redis) -> None:
    """Increment the failed login counter."""
    key = f"omniflow:rate_limit:login:{email}"
    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, settings.LOGIN_RATE_WINDOW_SECONDS)
    await pipe.execute()


async def clear_login_attempts(email: str, redis: Redis) -> None:
    """Clear the counter on successful login."""
    key = f"omniflow:rate_limit:login:{email}"
    await redis.delete(key)
