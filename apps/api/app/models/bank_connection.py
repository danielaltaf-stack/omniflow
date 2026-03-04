"""
OmniFlow — Bank Connection model.
Stores the user's connection to a bank via Woob module.
"""

import enum

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ConnectionStatus(str, enum.Enum):
    ACTIVE = "active"
    ERROR = "error"
    SCA_REQUIRED = "sca_required"
    SYNCING = "syncing"
    DISABLED = "disabled"


class BankConnection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bank_connections"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bank_module = Column(String(64), nullable=False)
    bank_name = Column(String(128), nullable=False)
    encrypted_credentials = Column(LargeBinary, nullable=False)
    status = Column(
        Enum(ConnectionStatus, values_callable=lambda x: [e.value for e in x]),
        default=ConnectionStatus.ACTIVE,
        nullable=False,
    )
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    sync_error = Column(Text, nullable=True)

    # Relationships
    accounts = relationship(
        "Account",
        back_populates="connection",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
