"""
OmniFlow — Auth endpoints (register, login, refresh, me, logout).
Logout is effective (JWT blacklist via Redis). Refresh uses token rotation.
Audit trail: login_success, login_failed, register, logout.
"""

from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    check_login_rate_limit,
    clear_login_attempts,
    get_current_user,
    increment_login_attempts,
)
from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_master_key_salt,
    hash_password,
    is_token_blacklisted,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthTokens,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    UserResponse,
)
from app.schemas.feedback import PasswordChangeRequest
from app.services.audit_service import get_client_ip, get_user_agent, log_action

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Register ────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau compte",
)
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte avec cet email existe déjà.",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name.strip(),
        master_key_salt=generate_master_key_salt(),
    )
    db.add(user)
    await db.flush()  # get the user.id before commit
    await db.commit()

    # Audit trail
    await log_action(
        db,
        action="register",
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    await db.commit()

    tokens = AuthTokens(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
    )


# ── Login ───────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Se connecter",
)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    # Rate limiting
    await check_login_rate_limit(body.email, redis)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        await increment_login_attempts(body.email, redis)
        # Audit: failed login
        await log_action(
            db,
            action="login_failed",
            user_id=user.id if user else None,
            resource_type="user",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={"email": body.email},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé.",
        )

    # Clear rate limit on success
    await clear_login_attempts(body.email, redis)

    # Audit: successful login
    await log_action(
        db,
        action="login_success",
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    await db.commit()

    tokens = AuthTokens(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
    )


# ── Refresh (with token rotation) ──────────────────────────────
@router.post(
    "/refresh",
    response_model=AuthTokens,
    summary="Rafraîchir le token d'accès (rotation)",
)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(body.refresh_token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expiré.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide.",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Type de token invalide.",
        )

    # Check if this refresh token was already used (replay/theft detection)
    old_jti = payload.get("jti")
    if old_jti and await is_token_blacklisted(old_jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token déjà utilisé — possible vol détecté.",
        )

    user_id = UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable.",
        )

    # Blacklist the old refresh token (rotation: one-time use)
    if old_jti:
        exp = datetime.fromtimestamp(payload["exp"], tz=UTC)
        await blacklist_token(old_jti, exp)

    return AuthTokens(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


# ── Me ──────────────────────────────────────────────────────────
@router.get(
    "/me",
    response_model=UserResponse,
    summary="Profil de l'utilisateur connecté",
)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


# ── Logout (effective — blacklists the access token JTI) ───────
@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Se déconnecter (révoque le token)",
)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    credentials=Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
):
    """Blacklist the current access token's JTI in Redis."""
    if credentials:
        try:
            payload = decode_token(credentials.credentials)
            jti = payload.get("jti")
            exp_ts = payload.get("exp")
            if jti and exp_ts:
                exp = datetime.fromtimestamp(exp_ts, tz=UTC)
                await blacklist_token(jti, exp)
        except jwt.InvalidTokenError:
            pass  # Token already validated by get_current_user

    # Audit: logout
    await log_action(
        db,
        action="logout",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(current_user.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    await db.commit()

    return MessageResponse(message="Déconnexion réussie. Token révoqué.")


# ── Password Change ─────────────────────────────────────────────
@router.put(
    "/password",
    response_model=MessageResponse,
    summary="Changer le mot de passe",
)
async def change_password(
    request: Request,
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password. Validates current password, applies strength rules, audits."""
    import re as _re

    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect.",
        )

    # Validate new password strength (same rules as register)
    pwd = body.new_password
    if len(pwd) < 8:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 8 caractères.")
    if not _re.search(r"[A-Z]", pwd):
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins une majuscule.")
    if not _re.search(r"\d", pwd):
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins un chiffre.")
    if not _re.search(r"[!@#$%^&*(),.?\":{}\'|<>_\-+=\[\]\\;/`~]", pwd):
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins un caractère spécial.")

    current_user.password_hash = hash_password(pwd)
    await db.flush()

    # Audit trail
    await log_action(
        db,
        action="password_change",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(current_user.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    await db.commit()

    return MessageResponse(message="Mot de passe mis à jour avec succès.")
