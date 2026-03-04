"""
OmniFlow — Pydantic schemas for Feedback & Changelog endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Feedback ─────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    category: Literal["bug", "feature", "improvement", "other"]
    message: str = Field(..., min_length=5, max_length=5000)
    metadata: dict | None = None
    screenshot_b64: str | None = Field(
        None, max_length=2_000_000, description="Base64-encoded screenshot"
    )


class FeedbackResponse(BaseModel):
    id: UUID
    message: str

    model_config = {"from_attributes": True}


# ── Changelog ────────────────────────────────────────────────────

class ChangelogEntry(BaseModel):
    type: Literal["feature", "fix", "security", "performance"]
    title: str
    description: str


class ChangelogVersion(BaseModel):
    version: str
    date: str
    entries: list[ChangelogEntry]


class ChangelogResponse(BaseModel):
    versions: list[ChangelogVersion]


# ── Password Change ─────────────────────────────────────────────

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class PasswordChangeResponse(BaseModel):
    message: str
