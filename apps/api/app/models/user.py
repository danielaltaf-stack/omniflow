"""
OmniFlow — User model.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    master_key_salt: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── RGPD Consent fields (Phase E3) ──────────────────────────
    consent_analytics: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    consent_push_notifications: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    consent_ai_personalization: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )
    consent_data_sharing: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    consent_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    privacy_policy_version: Mapped[str] = mapped_column(
        String(20), default="1.0", server_default="1.0", nullable=False
    )
