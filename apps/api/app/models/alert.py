"""
OmniFlow — UserAlert + AlertHistory models.
Unified cross-asset alert system (stocks, crypto, realestate, indices).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


VALID_ASSET_TYPES = {"stock", "crypto", "realestate", "index"}
VALID_CONDITIONS = {
    "price_above",
    "price_below",
    "pct_change_24h_above",
    "pct_change_24h_below",
    "volume_spike",
}


class UserAlert(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "user_alerts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    condition: Mapped[str] = mapped_column(String(30), nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    notify_in_app: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_push: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    history: Mapped[list["AlertHistory"]] = relationship(
        back_populates="alert", cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_user_alerts_active_symbol", "user_id", "is_active", "symbol"),
    )


class AlertHistory(Base, UUIDMixin):
    __tablename__ = "alert_history"

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_alerts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(),
        server_default=func.now(),
        nullable=False,
    )
    price_at_trigger: Mapped[float] = mapped_column(Float, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    alert: Mapped["UserAlert"] = relationship(back_populates="history")
