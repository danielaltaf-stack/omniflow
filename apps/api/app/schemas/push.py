"""
OmniFlow — Pydantic schemas for Web Push subscription endpoints.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., description="P-256 Diffie-Hellman public key")
    auth: str = Field(..., description="Authentication secret")


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., description="Push service endpoint URL")
    keys: PushSubscriptionKeys
    user_agent: str | None = Field(None, max_length=500)


class PushSubscriptionUnsubscribe(BaseModel):
    endpoint: str = Field(..., description="Push service endpoint URL to remove")


class PushSubscriptionResponse(BaseModel):
    id: UUID
    endpoint: str
    user_agent: str | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class PushTestRequest(BaseModel):
    title: str = Field(default="Test OmniFlow", max_length=255)
    body: str = Field(
        default="Les notifications push fonctionnent ! 🎉",
        max_length=500,
    )
    url: str = Field(default="/dashboard")
