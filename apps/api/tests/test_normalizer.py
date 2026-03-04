"""
OmniFlow — Normalizer tests.

Validates the NormalizedAccount and NormalizedTransaction dataclasses:
  required fields, defaults, edge cases, equality semantics.
"""

from __future__ import annotations

from datetime import date

from app.woob_engine.normalizer import NormalizedAccount, NormalizedTransaction


# ═══════════════════════════════════════════════════════════════════
#  NormalizedAccount
# ═══════════════════════════════════════════════════════════════════


def test_account_required_fields():
    """NormalizedAccount should accept all required fields."""
    acc = NormalizedAccount(
        external_id="ACC001",
        type="checking",
        label="Compte courant",
        balance=150_000,  # 1500.00€
    )
    assert acc.external_id == "ACC001"
    assert acc.type == "checking"
    assert acc.label == "Compte courant"
    assert acc.balance == 150_000


def test_account_default_currency():
    """Default currency should be EUR."""
    acc = NormalizedAccount(
        external_id="ACC002",
        type="savings",
        label="Livret A",
        balance=500_000,
    )
    assert acc.currency == "EUR"


def test_account_custom_currency():
    """Currency can be overridden."""
    acc = NormalizedAccount(
        external_id="ACC003",
        type="checking",
        label="Dollar account",
        balance=100_000,
        currency="USD",
    )
    assert acc.currency == "USD"


def test_account_equality():
    """Two accounts with the same fields should be equal (dataclass)."""
    a = NormalizedAccount("X", "checking", "Test", 100)
    b = NormalizedAccount("X", "checking", "Test", 100)
    assert a == b


# ═══════════════════════════════════════════════════════════════════
#  NormalizedTransaction
# ═══════════════════════════════════════════════════════════════════


def test_transaction_required_fields():
    """NormalizedTransaction should accept all required fields."""
    txn = NormalizedTransaction(
        external_id="TXN001",
        date=date(2025, 6, 15),
        amount=-1500,  # -15.00€
        label="CARREFOUR PARIS",
        raw_label="CARTE 15/06 CARREFOUR",
        type="card",
    )
    assert txn.external_id == "TXN001"
    assert txn.amount == -1500
    assert txn.type == "card"


def test_transaction_defaults():
    """Optional fields should default to None/False."""
    txn = NormalizedTransaction(
        external_id="TXN002",
        date=date(2025, 1, 1),
        amount=300_000,
        label="VIR SALAIRE",
        raw_label="VIREMENT RECU",
        type="transfer",
    )
    assert txn.category is None
    assert txn.subcategory is None
    assert txn.merchant is None
    assert txn.is_recurring is False


def test_transaction_negative_debit():
    """Negative amounts (debits) should be stored as-is."""
    txn = NormalizedTransaction(
        external_id="TXN003",
        date=date(2025, 3, 10),
        amount=-99_99,
        label="ACHAT",
        raw_label="ACHAT EN LIGNE",
        type="card",
    )
    assert txn.amount < 0


def test_transaction_is_mutable():
    """NormalizedTransaction is a regular dataclass (not frozen)."""
    txn = NormalizedTransaction(
        external_id="TXN004",
        date=date(2025, 1, 1),
        amount=0,
        label="test",
        raw_label="test",
        type="card",
    )
    txn.category = "Alimentation"
    assert txn.category == "Alimentation"
