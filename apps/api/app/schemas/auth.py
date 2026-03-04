"""
OmniFlow — Pydantic schemas for Auth endpoints.
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


# ── Request schemas ─────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    password_confirm: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Le nom doit contenir au moins 2 caractères.")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule.")
        if not re.search(r"\d", v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial.")
        return v

    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        password = info.data.get("password")
        if password and v != password:
            raise ValueError("Les mots de passe ne correspondent pas.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Response schemas ────────────────────────────────────────────
class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: AuthTokens


class MessageResponse(BaseModel):
    message: str
