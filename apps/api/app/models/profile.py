"""
OmniFlow — Profile model for multi-profile & joint account management.

A Profile represents a financial identity within a household:
  - "Personnel" (auto-created, undeletable) — the main user
  - "Conjoint(e)" — partner
  - "Enfant" — child
  - "Projet" — a virtual profile for project-based tracking

Accounts can be linked to one or many profiles. When an account is shared
across 2+ profiles, it is considered a "joint account" (compte joint).
"""

import enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ProfileType(str, enum.Enum):
    PERSONAL = "personal"
    PARTNER = "partner"
    CHILD = "child"
    OTHER = "other"


class Profile(Base, UUIDMixin, TimestampMixin):
    """A financial identity within the user's household."""

    __tablename__ = "profiles"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    avatar_color = Column(String(7), default="#6366f1", nullable=False)  # hex
    type = Column(
        String(20),
        default=ProfileType.PERSONAL.value,
        nullable=False,
    )
    is_default = Column(Boolean, default=False, nullable=False)

    # Relationships
    account_links = relationship(
        "ProfileAccountLink",
        back_populates="profile",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ProfileAccountLink(Base, UUIDMixin, TimestampMixin):
    """
    M:N link between Profile and Account.
    If an account appears in 2+ profiles → it's a "joint account".
    The `share_pct` field allows custom split (default 100%).
    """

    __tablename__ = "profile_account_links"
    __table_args__ = (
        UniqueConstraint("profile_id", "account_id", name="uq_profile_account"),
    )

    profile_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    share_pct = Column(BigInteger, default=100, nullable=False)  # 0-100

    # Relationships
    profile = relationship("Profile", back_populates="account_links")
    account = relationship("Account")
