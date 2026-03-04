"""
OmniFlow — Profiles & Joint Accounts API.
CRUD for financial profiles, link/unlink accounts, view joint accounts.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.profile import Profile, ProfileAccountLink, ProfileType
from app.models.account import Account
from app.models.user import User

router = APIRouter(prefix="/profiles", tags=["Profiles"])


# ── Schemas ─────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="personal")
    avatar_color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: str | None = None
    avatar_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class LinkAccountRequest(BaseModel):
    account_id: uuid.UUID
    share_pct: int = Field(default=100, ge=0, le=100)


class ProfileResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    avatar_color: str
    is_default: bool
    accounts: list[dict]
    created_at: str

    class Config:
        from_attributes = True


class JointAccountResponse(BaseModel):
    account_id: uuid.UUID
    account_label: str
    account_number: str | None
    balance: int
    profiles: list[dict]


# ── Helpers ─────────────────────────────────────────────────

def _profile_to_response(profile: Profile) -> dict:
    return {
        "id": str(profile.id),
        "name": profile.name,
        "type": profile.type,
        "avatar_color": profile.avatar_color,
        "is_default": profile.is_default,
        "accounts": [
            {
                "link_id": str(link.id),
                "account_id": str(link.account_id),
                "share_pct": link.share_pct,
            }
            for link in (profile.account_links or [])
        ],
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


async def _ensure_default_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    """Auto-create the default 'Personnel' profile if none exist."""
    result = await db.execute(
        select(Profile).where(
            and_(Profile.user_id == user_id, Profile.is_default == True)
        )
    )
    default = result.scalar_one_or_none()
    if default:
        return default

    profile = Profile(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Personnel",
        type=ProfileType.PERSONAL.value,
        avatar_color="#6366f1",
        is_default=True,
    )
    db.add(profile)
    await db.flush()
    return profile


# ── Routes ──────────────────────────────────────────────────

@router.get("")
async def list_profiles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all profiles for the current user (auto-creates default if needed)."""
    await _ensure_default_profile(db, user.id)
    await db.commit()  # persist auto-created default if any

    result = await db.execute(
        select(Profile)
        .where(Profile.user_id == user.id)
        .options(selectinload(Profile.account_links))
        .order_by(Profile.is_default.desc(), Profile.created_at)
    )
    profiles = result.scalars().all()
    return [_profile_to_response(p) for p in profiles]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: ProfileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new profile."""
    # Ensure default profile exists first
    await _ensure_default_profile(db, user.id)

    # Validate type
    valid_types = [t.value for t in ProfileType]
    if body.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type invalide. Choisissez : {', '.join(valid_types)}",
        )

    profile = Profile(
        id=uuid.uuid4(),
        user_id=user.id,
        name=body.name,
        type=body.type,
        avatar_color=body.avatar_color,
        is_default=False,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return _profile_to_response(profile)


@router.put("/{profile_id}")
async def update_profile(
    profile_id: uuid.UUID,
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a profile's name, type, or color."""
    result = await db.execute(
        select(Profile).where(
            and_(Profile.id == profile_id, Profile.user_id == user.id)
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil introuvable.")

    if body.name is not None:
        profile.name = body.name
    if body.type is not None:
        valid_types = [t.value for t in ProfileType]
        if body.type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type invalide. Choisissez : {', '.join(valid_types)}",
            )
        profile.type = body.type
    if body.avatar_color is not None:
        profile.avatar_color = body.avatar_color

    await db.commit()
    await db.refresh(profile)
    return _profile_to_response(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a profile (cannot delete the default 'Personnel' profile)."""
    result = await db.execute(
        select(Profile).where(
            and_(Profile.id == profile_id, Profile.user_id == user.id)
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil introuvable.")

    if profile.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer le profil par défaut.",
        )

    await db.delete(profile)
    await db.commit()


@router.post("/{profile_id}/accounts", status_code=status.HTTP_201_CREATED)
async def link_account(
    profile_id: uuid.UUID,
    body: LinkAccountRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a bank account to a profile (creates joint account if already linked elsewhere)."""
    # Verify profile belongs to user
    result = await db.execute(
        select(Profile).where(
            and_(Profile.id == profile_id, Profile.user_id == user.id)
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil introuvable.")

    # Verify account exists and belongs to user (through connection)
    result = await db.execute(
        select(Account).where(Account.id == body.account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    # Check if link already exists
    result = await db.execute(
        select(ProfileAccountLink).where(
            and_(
                ProfileAccountLink.profile_id == profile_id,
                ProfileAccountLink.account_id == body.account_id,
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce compte est déjà lié à ce profil.",
        )

    link = ProfileAccountLink(
        id=uuid.uuid4(),
        profile_id=profile_id,
        account_id=body.account_id,
        share_pct=body.share_pct,
    )
    db.add(link)
    await db.commit()

    return {
        "link_id": str(link.id),
        "profile_id": str(profile_id),
        "account_id": str(body.account_id),
        "share_pct": body.share_pct,
    }


@router.delete(
    "/{profile_id}/accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_account(
    profile_id: uuid.UUID,
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink a bank account from a profile."""
    # Verify profile belongs to user
    result = await db.execute(
        select(Profile).where(
            and_(Profile.id == profile_id, Profile.user_id == user.id)
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Profil introuvable.")

    result = await db.execute(
        select(ProfileAccountLink).where(
            and_(
                ProfileAccountLink.profile_id == profile_id,
                ProfileAccountLink.account_id == account_id,
            )
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Lien introuvable.")

    await db.delete(link)
    await db.commit()


@router.get("/joint-accounts")
async def list_joint_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List accounts linked to 2+ profiles (= joint accounts).
    Returns each joint account with its linked profiles and shares.
    """
    # Find account_ids linked to multiple profiles for this user
    subq = (
        select(ProfileAccountLink.account_id)
        .join(Profile, ProfileAccountLink.profile_id == Profile.id)
        .where(Profile.user_id == user.id)
        .group_by(ProfileAccountLink.account_id)
        .having(func.count(ProfileAccountLink.profile_id) >= 2)
    ).subquery()

    result = await db.execute(
        select(Account).where(Account.id.in_(select(subq.c.account_id)))
    )
    joint_accounts = result.scalars().all()

    response = []
    for account in joint_accounts:
        # Get all links for this account
        link_result = await db.execute(
            select(ProfileAccountLink)
            .options(selectinload(ProfileAccountLink.profile))
            .where(ProfileAccountLink.account_id == account.id)
        )
        links = link_result.scalars().all()

        response.append({
            "account_id": str(account.id),
            "account_label": account.label or "",
            "account_number": account.number,
            "balance": account.balance or 0,
            "profiles": [
                {
                    "profile_id": str(link.profile_id),
                    "profile_name": link.profile.name if link.profile else "?",
                    "avatar_color": link.profile.avatar_color if link.profile else "#ccc",
                    "share_pct": link.share_pct,
                }
                for link in links
            ],
        })

    return response
