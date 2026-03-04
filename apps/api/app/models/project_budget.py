"""
OmniFlow — Project Budget models.

A ProjectBudget is a savings goal:
  - "Vacances été 2026"    target = 3000€   deadline = 2026-07-01
  - "Apport maison"        target = 50000€  deadline = 2028-01-01
  - "MacBook Pro"           target = 2500€   deadline = None (open-ended)

Contributions track each deposit towards the goal.
"""

import enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class ProjectBudget(Base, UUIDMixin, TimestampMixin):
    """A savings project / goal with a target amount and optional deadline."""

    __tablename__ = "project_budgets"

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="target", nullable=False)  # Lucide icon name
    color = Column(String(7), default="#6366f1", nullable=False)  # hex
    target_amount = Column(BigInteger, nullable=False)  # centimes
    current_amount = Column(BigInteger, default=0, nullable=False)  # centimes
    deadline = Column(Date, nullable=True)
    status = Column(
        String(20),
        default=ProjectStatus.ACTIVE.value,
        nullable=False,
    )
    monthly_target = Column(BigInteger, nullable=True)  # auto-computed: centimes/month to meet deadline
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    contributions = relationship(
        "ProjectContribution",
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProjectContribution.date.desc()",
    )


class ProjectContribution(Base, UUIDMixin, TimestampMixin):
    """A single contribution (deposit) towards a project goal."""

    __tablename__ = "project_contributions"

    project_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("project_budgets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount = Column(BigInteger, nullable=False)  # centimes (positive = deposit, negative = withdrawal)
    date = Column(Date, nullable=False)
    note = Column(String(500), nullable=True)

    # Relationships
    project = relationship("ProjectBudget", back_populates="contributions")
