"""
OmniFlow — Categorizer tests.

30+ parametrized cases covering all 15 categories, merchant detection,
is_recurring flags, edge cases (Uber vs Uber Eats), and batch processing.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.woob_engine.categorizer import (
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    RULES,
    categorize_batch,
    categorize_transaction,
)
from app.woob_engine.normalizer import NormalizedTransaction


def _txn(label: str, raw_label: str = "") -> NormalizedTransaction:
    """Build a minimal NormalizedTransaction for categorization tests."""
    return NormalizedTransaction(
        external_id="test-001",
        date=date(2025, 6, 15),
        amount=-1500,  # -15.00€
        label=label,
        raw_label=raw_label,
        type="card",
    )


# ═══════════════════════════════════════════════════════════════════
#  PARAMETRIZED CATEGORY TESTS
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "label, expected_category, expected_subcategory, expected_merchant",
    [
        # Alimentation
        ("CARREFOUR PARIS 15", "Alimentation", "Courses", "Carrefour"),
        ("E.LECLERC DRIVE 234", "Alimentation", "Courses", "E.Leclerc"),
        ("LIDL MONTREUIL", "Alimentation", "Courses", "Lidl"),
        ("MCDO GARE DU NORD", "Alimentation", "Fast-food", "McDonald's"),
        ("BURGER KING BERCY", "Alimentation", "Fast-food", "Burger King"),
        ("REST BOULANGERIE PAUL", "Alimentation", "Boulangerie", None),
        ("UBER EATS PARIS", "Alimentation", "Livraison", None),
        ("STARBUCKS OPERA", "Alimentation", "Café", "Starbucks"),
        # Transport
        ("SNCF TGV 7801", "Transport", "Train", "SNCF"),
        ("RATP NAVIGO MENSUEL", "Transport", "Transport en commun", "RATP"),
        ("UBER BV PARIS", "Transport", "VTC", "Uber"),
        ("TOTALENERGIES SP95", "Transport", "Essence", None),
        ("AIR FRANCE CDG-JFK", "Transport", "Avion", None),
        # Logement
        ("LOYER JANVIER 2025", "Logement", "Loyer", None),
        ("IKEA VILLIERS", "Logement", "Ameublement", "IKEA"),
        # Énergie
        ("EDF MENSUALITE ELEC", "Énergie", "Électricité/Gaz", None),
        ("VEOLIA EAU PARIS", "Énergie", "Eau", None),
        # Télécom
        ("FREE MOBILE", "Télécom", "Mobile/Internet", "Free"),
        ("ORANGE SA", "Télécom", "Mobile/Internet", "Orange"),
        # Abonnements
        ("NETFLIX.COM", "Abonnements", "Streaming", "Netflix"),
        ("SPOTIFY AB", "Abonnements", "Musique", "Spotify"),
        ("CHATGPT PLUS", "Abonnements", "IA", "OpenAI"),
        # Shopping
        ("AMAZON EU SARL", "Shopping", "E-commerce", "Amazon"),
        ("FNAC CHATELET", "Shopping", "Culture/Tech", "Fnac"),
        ("DECATHLON EVRY", "Shopping", "Sport", "Décathlon"),
        # Santé
        ("PHARMACIE DU CENTRE", "Santé", "Pharmacie", None),
        # Loisirs
        ("UGC CINE CITE", "Loisirs", "Cinéma", None),
        # Banque
        ("FRAIS BANCAIRE MENSUEL", "Banque", "Frais bancaires", None),
        # Revenus — not tested as a debit (amount >0 normally)
        ("VIR SALAIRE EMPLOYEUR", "Revenus", "Salaire", None),
        # Épargne
        ("LIVRET A VIREMENT", "Épargne", "Livret réglementé", None),
        # Cash
        ("RETRAIT DAB 17/06", "Cash", "Retrait DAB", None),
    ],
)
def test_categorize_known_labels(
    label: str,
    expected_category: str,
    expected_subcategory: str,
    expected_merchant: str | None,
):
    txn = _txn(label)
    result = categorize_transaction(txn)
    assert result.category == expected_category, f"Label '{label}' → got {result.category}"
    assert result.subcategory == expected_subcategory
    if expected_merchant:
        assert result.merchant == expected_merchant


# ═══════════════════════════════════════════════════════════════════
#  EDGE CASES
# ═══════════════════════════════════════════════════════════════════


def test_unknown_label_defaults_to_autres():
    """Unknown transaction should be categorized as 'Autres'."""
    txn = _txn("RANDOM UNKNOWN TXN 999")
    result = categorize_transaction(txn)
    assert result.category == "Autres"
    assert result.subcategory == "Non catégorisé"


def test_uber_eats_not_transport():
    """'UBER EATS' should match Alimentation, not Transport."""
    txn = _txn("UBER EATS PARIS")
    result = categorize_transaction(txn)
    assert result.category == "Alimentation"
    assert result.subcategory == "Livraison"


def test_uber_vtc_not_alimentation():
    """'UBER BV' (without 'eats') should match Transport."""
    txn = _txn("UBER BV AMSTERDAM")
    result = categorize_transaction(txn)
    assert result.category == "Transport"
    assert result.subcategory == "VTC"


def test_is_recurring_flag_loyer():
    """Loyer should have is_recurring=True."""
    txn = _txn("LOYER MARS 2025")
    result = categorize_transaction(txn)
    assert result.is_recurring is True


def test_is_recurring_flag_netflix():
    """Netflix subscription should have is_recurring=True."""
    txn = _txn("NETFLIX.COM MONTHLY")
    result = categorize_transaction(txn)
    assert result.is_recurring is True


def test_is_recurring_flag_non_recurring():
    """Regular grocery shopping should not be marked recurring."""
    txn = _txn("CARREFOUR PARIS 15")
    result = categorize_transaction(txn)
    assert result.is_recurring is False


def test_raw_label_also_matched():
    """Categorizer should match against raw_label too."""
    txn = NormalizedTransaction(
        external_id="test-raw",
        date=date(2025, 6, 15),
        amount=-2000,
        label="PAIEMENT CB",  # generic label
        raw_label="CARREFOUR MARKET PARIS 15",  # specific raw_label
        type="card",
    )
    result = categorize_transaction(txn)
    assert result.category == "Alimentation"
    assert result.merchant == "Carrefour"


# ═══════════════════════════════════════════════════════════════════
#  BATCH PROCESSING
# ═══════════════════════════════════════════════════════════════════


def test_categorize_batch():
    """categorize_batch should produce same results as individual calls."""
    labels = ["CARREFOUR PARIS", "SNCF TGV", "NETFLIX.COM", "RANDOM UNKNOWN"]
    txns = [_txn(label) for label in labels]

    batch_results = categorize_batch(txns)
    individual_results = [categorize_transaction(t) for t in txns]

    assert len(batch_results) == len(individual_results)
    for b, i in zip(batch_results, individual_results):
        assert b.category == i.category
        assert b.subcategory == i.subcategory
        assert b.merchant == i.merchant


# ═══════════════════════════════════════════════════════════════════
#  METADATA CONSISTENCY
# ═══════════════════════════════════════════════════════════════════


def test_category_colors_covers_all_rules():
    """CATEGORY_COLORS should contain every category used in RULES."""
    rule_categories = {r.category for r in RULES}
    for cat in rule_categories:
        assert cat in CATEGORY_COLORS, f"Missing color for '{cat}'"


def test_category_icons_covers_all_rules():
    """CATEGORY_ICONS should contain every category used in RULES."""
    rule_categories = {r.category for r in RULES}
    for cat in rule_categories:
        assert cat in CATEGORY_ICONS, f"Missing icon for '{cat}'"


def test_category_colors_has_autres():
    """'Autres' (default) should have a color."""
    assert "Autres" in CATEGORY_COLORS


def test_category_icons_has_autres():
    """'Autres' (default) should have an icon."""
    assert "Autres" in CATEGORY_ICONS
