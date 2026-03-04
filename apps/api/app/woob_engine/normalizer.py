"""
OmniFlow — Normalized data classes for Woob output.
All amounts in centimes (int). No floats. No mocks.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass
class NormalizedAccount:
    """Normalized bank account from Woob."""
    external_id: str
    type: str          # matches AccountType values: checking, savings, etc.
    label: str
    balance: int       # centimes (1 EUR = 100)
    currency: str = "EUR"


@dataclass
class NormalizedTransaction:
    """Normalized transaction from Woob."""
    external_id: str
    date: date
    amount: int        # centimes, negative = debit
    label: str
    raw_label: str
    type: str          # matches TransactionType values: card, transfer, etc.
    category: str | None = None
    subcategory: str | None = None
    merchant: str | None = None
    is_recurring: bool = False
