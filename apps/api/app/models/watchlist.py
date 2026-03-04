"""
OmniFlow — UserWatchlist model.
Phase F1.7-②: Cross-asset persistent watchlists with ordering.
"""

import uuid

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


VALID_WATCHLIST_ASSET_TYPES = {"stock", "crypto", "realestate", "index"}


class UserWatchlist(Base, UUIDMixin, TimestampMixin):
    """Persisted user watchlist item — cross-asset favourites."""

    __tablename__ = "user_watchlists"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
    )
    symbol: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False, default="",
    )
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
    )
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    target_price: Mapped[float | None] = mapped_column(
        Float, nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "asset_type", "symbol", name="uq_watchlist_user_asset_symbol"),
        Index("ix_watchlist_user_order", "user_id", "display_order"),
    )
