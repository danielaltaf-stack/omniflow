"""
OmniFlow — Phase C3: Fee Negotiator unit & integration tests.

Covers:
  UNIT  – fee type mapping, overcharge score, letter generation, seed data
  INTEG – API endpoints (/fees/analysis, /scan, /compare, /negotiate, etc.)
"""

from __future__ import annotations

import uuid

import httpx
import pytest

from app.services.fee_negotiator_engine import (
    ALL_FEE_FIELDS,
    FEE_TYPE_LABELS,
    FEE_TYPE_MAPPING,
    _map_subcategory_to_fee_field,
    compute_overcharge_score,
)

# ── Helpers ──────────────────────────────────────────────────────

_TEST_PASSWORD = "F33$Neg0t1@tor!"


def _unique_email() -> str:
    return f"fees_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Fee Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — pure functions (no DB)
# ═══════════════════════════════════════════════════════════════════


class TestFeeTypeMapping:
    """_map_subcategory_to_fee_field dispatches correctly."""

    def test_frais_bancaires(self):
        assert _map_subcategory_to_fee_field("Frais bancaires") == "fee_account_maintenance"

    def test_cotisation_carte(self):
        assert _map_subcategory_to_fee_field("Cotisation carte") == "fee_card_classic"

    def test_assurance_carte(self):
        assert _map_subcategory_to_fee_field("Assurance carte") == "fee_insurance_card"

    def test_agios(self):
        assert _map_subcategory_to_fee_field("Agios") == "fee_overdraft_commission"

    def test_fallback_rejet(self):
        assert _map_subcategory_to_fee_field(None, "Frais de rejet prélèvement") == "fee_reject"

    def test_fallback_premium_card(self):
        assert _map_subcategory_to_fee_field(None, "Cotisation Visa Premier") == "fee_card_premium"

    def test_fallback_unknown(self):
        assert _map_subcategory_to_fee_field(None, "something random") == "fee_account_maintenance"

    def test_mapping_complete(self):
        """Every mapped subcategory must correspond to a known fee field."""
        for subcat, field in FEE_TYPE_MAPPING.items():
            assert field in ALL_FEE_FIELDS, f"{subcat} maps to unknown field {field}"


class TestOverchargeScore:
    """compute_overcharge_score — percentile calculation."""

    def test_zero_total(self):
        assert compute_overcharge_score(0, [1000, 2000, 3000]) == 0

    def test_most_expensive(self):
        score = compute_overcharge_score(5000, [0, 0, 1000, 2000])
        assert score >= 80  # more expensive than most

    def test_cheapest(self):
        score = compute_overcharge_score(0, [1000, 2000, 3000, 4000])
        assert score == 0

    def test_middle(self):
        score = compute_overcharge_score(500, [0, 200, 800, 1000])
        assert 30 <= score <= 70

    def test_empty_schedules(self):
        assert compute_overcharge_score(5000, []) == 0


class TestFeeLabels:
    """All fee fields should have a human-readable label."""

    def test_all_fields_have_labels(self):
        for field in ALL_FEE_FIELDS:
            assert field in FEE_TYPE_LABELS, f"Missing label for {field}"

    def test_labels_not_empty(self):
        for field, label in FEE_TYPE_LABELS.items():
            assert len(label) > 2, f"Label too short for {field}: {label}"


class TestNegotiationLetterGeneration:
    """Letter generation returns valid markdown with key components."""

    @pytest.mark.asyncio
    async def test_letter_contains_amounts(self):
        from app.services.fee_negotiator_engine import generate_negotiation_letter

        user_fees = {
            "total_fees_annual": 15000,  # 150€
            "fees_by_type": [
                {"fee_type": "fee_account_maintenance", "label": "Tenue de compte",
                 "annual_total": 10000, "monthly_avg": 833, "count": 12},
                {"fee_type": "fee_card_classic", "label": "Carte bancaire",
                 "annual_total": 5000, "monthly_avg": 416, "count": 12},
            ],
        }
        alternatives = [
            {"bank_slug": "boursorama", "bank_name": "Boursorama Banque",
             "is_online": True, "total_there": 0, "saving": 15000, "pct_saving": 100.0},
        ]

        result = await generate_negotiation_letter(
            db=None,  # not used in generation
            user_id=uuid.uuid4(),
            user_fees=user_fees,
            alternatives=alternatives,
            user_name="Test User",
            bank_name="BNP Paribas",
        )

        assert "letter_markdown" in result
        assert "arguments" in result
        assert "150" in result["letter_markdown"]  # total amount mentioned
        assert "Boursorama" in result["letter_markdown"]

    @pytest.mark.asyncio
    async def test_letter_contains_legal_refs(self):
        from app.services.fee_negotiator_engine import generate_negotiation_letter

        result = await generate_negotiation_letter(
            db=None,
            user_id=uuid.uuid4(),
            user_fees={"total_fees_annual": 5000, "fees_by_type": []},
            alternatives=[],
        )

        md = result["letter_markdown"]
        assert "Loi Macron" in md
        assert "1104" in md or "Code Civil" in md
        assert any("Macron" in a for a in result["arguments"])


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — API endpoints (require DB + auth)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_analysis_creates_default(client: httpx.AsyncClient):
    """GET /fees/analysis should auto-create a default analysis."""
    headers = await _register_and_get_headers(client)
    resp = await client.get("/api/v1/fees/analysis", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["negotiation_status"] == "none"
    assert data["total_fees_annual"] == 0


@pytest.mark.asyncio
async def test_scan_fees(client: httpx.AsyncClient):
    """POST /fees/scan should return structured scan result."""
    headers = await _register_and_get_headers(client)
    resp = await client.post(
        "/api/v1/fees/scan",
        json={"months": 12},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_fees_annual" in data
    assert "fees_by_type" in data
    assert "overcharge_score" in data
    assert isinstance(data["top_alternatives"], list)


@pytest.mark.asyncio
async def test_compare_fees(client: httpx.AsyncClient):
    """GET /fees/compare should return alternatives list."""
    headers = await _register_and_get_headers(client)
    # Scan first
    await client.post("/api/v1/fees/scan", json={}, headers=headers)
    resp = await client.get("/api/v1/fees/compare", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "alternatives" in data


@pytest.mark.asyncio
async def test_generate_letter(client: httpx.AsyncClient):
    """POST /fees/negotiate should return markdown letter."""
    headers = await _register_and_get_headers(client)
    await client.post("/api/v1/fees/scan", json={}, headers=headers)
    resp = await client.post("/api/v1/fees/negotiate", json={}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "letter_markdown" in data
    assert "arguments" in data
    assert isinstance(data["arguments"], list)


@pytest.mark.asyncio
async def test_update_negotiation_status(client: httpx.AsyncClient):
    """PUT /fees/negotiation-status should update pipeline."""
    headers = await _register_and_get_headers(client)
    resp = await client.put(
        "/api/v1/fees/negotiation-status",
        json={"status": "sent", "result_amount": 0},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["negotiation_status"] == "sent"


@pytest.mark.asyncio
async def test_get_schedules(client: httpx.AsyncClient):
    """GET /fees/schedules should return 20 banks."""
    headers = await _register_and_get_headers(client)
    resp = await client.get("/api/v1/fees/schedules", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "schedules" in data
    assert data["count"] >= 20
    # Verify Boursorama is free
    bourso = next((s for s in data["schedules"] if s["bank_slug"] == "boursorama"), None)
    assert bourso is not None
    assert bourso["fee_account_maintenance"] == 0
    assert bourso["is_online"] is True
