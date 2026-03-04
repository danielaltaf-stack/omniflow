"""
OmniFlow — Pydantic schemas for bank connections, accounts, transactions.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Banks ─────────────────────────────────────────────────────
class BankField(BaseModel):
    id: str
    label: str
    type: str
    placeholder: str


class BankResponse(BaseModel):
    module: str
    name: str
    logo_url: str
    fields: list[BankField]
    sca_type: str


# ── Connections ──────────────────────────────────────────────
class CreateConnectionRequest(BaseModel):
    bank_module: str = Field(..., description="Woob module name (e.g. 'boursorama')")
    credentials: dict[str, str] = Field(
        default_factory=dict,
        description="Bank credentials as key-value pairs (login, password, etc.)",
    )


class ConnectionResponse(BaseModel):
    id: UUID
    bank_module: str
    bank_name: str
    status: str
    last_sync_at: datetime | None
    last_error: str | None
    created_at: datetime
    accounts_count: int = 0

    class Config:
        from_attributes = True


class SyncResponse(BaseModel):
    connection_id: UUID
    status: str
    accounts_synced: int = 0
    transactions_synced: int = 0
    error: str | None = None


# ── Accounts ────────────────────────────────────────────────
class AccountResponse(BaseModel):
    id: UUID
    connection_id: UUID
    external_id: str
    type: str
    label: str
    balance: int  # centimes
    currency: str
    bank_name: str = ""
    bank_module: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


# ── Transactions ────────────────────────────────────────────
class TransactionResponse(BaseModel):
    id: UUID
    account_id: UUID
    external_id: str
    date: date
    amount: int  # centimes
    label: str
    raw_label: str | None
    type: str
    category: str | None
    subcategory: str | None
    merchant: str | None
    is_recurring: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedTransactions(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    per_page: int
    pages: int
