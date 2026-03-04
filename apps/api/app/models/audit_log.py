"""
OmniFlow — Audit Log model.

Tracks all security-sensitive actions: login, register, logout,
data export, account deletion, bank sync, settings changes, etc.
RGPD Article 30 — Record of processing activities.
"""

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin

import uuid
from datetime import UTC, datetime


class AuditLog(Base, UUIDMixin):
    __tablename__ = "audit_log"

    # Nullable for system-level actions (e.g., scheduled tasks)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Action performed (e.g., "login_success", "data_export_requested")
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Resource affected
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Client context
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Additional context (flexible JSONB for extra details)
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True, default=dict
    )

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_audit_log_user_created", "user_id", "created_at"),
        Index("ix_audit_log_action_created", "action", "created_at"),
    )
