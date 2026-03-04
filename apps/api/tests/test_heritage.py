"""
OmniFlow — Phase C2: Heritage / Succession Simulator tests.

Covers:
  UNIT  – pure tax/abattement functions (no DB)
  INTEG – heritage API endpoints (/heritage/profile, simulate, etc.)
"""

from __future__ import annotations

import uuid

import httpx
import pytest

from app.services.heritage_engine import (
    compute_abattement,
    compute_demembrement,
    compute_life_insurance_tax,
    compute_succession_tax,
    compute_succession_tax_frere_soeur,
    compute_succession_tax_ligne_directe,
)

# ── Helpers ──────────────────────────────────────────────────────

_TEST_PASSWORD = "H3rit@ge!Pass99"


def _unique_email() -> str:
    return f"heritage_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Heritage Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — pure functions (no DB / no async)
# ═══════════════════════════════════════════════════════════════════


class TestAbattements:
    """compute_abattement — French succession deductions (art. 779 CGI)."""

    def test_enfant(self):
        assert compute_abattement("enfant") == 10_000_000  # 100 000 €

    def test_conjoint_exonerated(self):
        """Surviving spouse is fully exempt (art. 796-0 bis)."""
        assert compute_abattement("conjoint") == 0

    def test_frere_soeur(self):
        assert compute_abattement("frere_soeur") == 1_593_200  # 15 932 €

    def test_handicap_cumul(self):
        """Handicap deduction adds 159 325 € (art. 779 II)."""
        base = compute_abattement("enfant")
        with_h = compute_abattement("enfant", handicap=True)
        assert with_h == base + 15_932_500  # 159 325 €

    def test_tiers(self):
        assert compute_abattement("tiers") == 159_400  # 1 594 €

    def test_unknown_relationship(self):
        assert compute_abattement("cousin_germain") == 159_400  # fallback = tiers


class TestBaremeLigneDirecte:
    """compute_succession_tax_ligne_directe — 7-bracket progressive scale."""

    def test_zero(self):
        assert compute_succession_tax_ligne_directe(0) == 0

    def test_first_bracket_5pct(self):
        # 8 072 € → 5% = 403.60 € ≈ 40 360 cts
        assert compute_succession_tax_ligne_directe(807_200) == 40_360

    def test_landmark_100k(self):
        # 100 000 € (10 000 000 cts) — well-known reference
        tax = compute_succession_tax_ligne_directe(10_000_000)
        # Manually: 8072*5% + 4037*10% + 3823*15% + 84177*20% (overflow into 4th)
        # Bracket1: 807200 @ 5%   = 40360
        # Bracket2: 403700 @ 10%  = 40370
        # Bracket3: 382300 @ 15%  = 57345
        # Bracket4: rest = 10000000-807200-403700-382300 = 8406800 @ 20% = 1681360
        expected = 40360 + 40370 + 57345 + 1681360
        assert tax == expected

    def test_very_large(self):
        """Above 1 805 677 € → 45% marginal."""
        tax = compute_succession_tax_ligne_directe(200_000_000)  # 2 M€
        assert tax > 0
        # Effective rate must be between 30-45%
        eff = tax / 200_000_000
        assert 0.30 < eff < 0.45


class TestBaremeFreresSoeurs:
    """compute_succession_tax_frere_soeur — 2-bracket scale (35% / 45%)."""

    def test_low_bracket(self):
        # 10 000 € (1_000_000 cts) → 35%
        assert compute_succession_tax_frere_soeur(1_000_000) == 350_000

    def test_above_threshold(self):
        # 30 000 € = 3_000_000 cts  (24 430 @ 35% + 5 570 @ 45%)
        tax = compute_succession_tax_frere_soeur(3_000_000)
        # Threshold = 24 430 € = 2_443_000 cts
        assert tax == (2_443_000 * 35 // 100) + ((3_000_000 - 2_443_000) * 45 // 100)


class TestComputeSuccessionTax:
    """compute_succession_tax dispatches correctly."""

    def test_dispatch_enfant(self):
        result = compute_succession_tax(10_000_000, "enfant")
        expected = compute_succession_tax_ligne_directe(10_000_000)
        assert result == expected

    def test_dispatch_conjoint(self):
        assert compute_succession_tax(50_000_000, "conjoint") == 0

    def test_dispatch_frere(self):
        result = compute_succession_tax(5_000_000, "frere_soeur")
        expected = compute_succession_tax_frere_soeur(5_000_000)
        assert result == expected

    def test_dispatch_neveu_niece(self):
        # 55% flat
        assert compute_succession_tax(1_000_000, "neveu_niece") == 550_000

    def test_dispatch_tiers(self):
        # 60% flat
        assert compute_succession_tax(1_000_000, "tiers") == 600_000


class TestLifeInsuranceTax:
    """compute_life_insurance_tax — art. 990 I & 757 B CGI."""

    def test_before_70_below_abattement(self):
        # 100 000 € per beneficiary → below 152 500 € deduction
        tax = compute_life_insurance_tax(
            amount_before_70=10_000_000,
            amount_after_70=0,
            nb_beneficiaries=1,
        )
        assert tax == 0

    def test_before_70_above_abattement(self):
        # 200 000 € for 1 beneficiary: first 152 500 € exempt, rest taxed 20%
        tax = compute_life_insurance_tax(
            amount_before_70=20_000_000,
            amount_after_70=0,
            nb_beneficiaries=1,
        )
        excess = 20_000_000 - 15_250_000  # 4 750 000 cts = 47 500 €
        expected = excess * 20 // 100  # 20% bracket (< 700 000 €)
        assert tax == expected

    def test_after_70_basic(self):
        # 50 000 € after 70 → deduction 30 500 € → taxable 19 500 €
        # Taxable at succession rates (ligne_directe by default approximation)
        tax = compute_life_insurance_tax(
            amount_before_70=0,
            amount_after_70=5_000_000,
            nb_beneficiaries=1,
        )
        taxable = 5_000_000 - 3_050_000  # 1 950 000 cts
        expected = compute_succession_tax_ligne_directe(taxable)
        assert tax == expected


class TestDemembrement:
    """compute_demembrement — art. 669 CGI dismemberment table."""

    def test_young_owner(self):
        result = compute_demembrement(100_000_000, 25)
        # Age 21-30 → usufruit 80%
        assert result["usufruit_pct"] == 80
        assert result["nue_propriete_pct"] == 20
        assert result["usufruit_value"] == 80_000_000
        assert result["nue_propriete_value"] == 20_000_000

    def test_senior_owner(self):
        result = compute_demembrement(100_000_000, 85)
        # Age 81-90 → usufruit 20%
        assert result["usufruit_pct"] == 20
        assert result["nue_propriete_pct"] == 80

    def test_very_old(self):
        result = compute_demembrement(100_000_000, 95)
        # Age > 90 → usufruit 10%
        assert result["usufruit_pct"] == 10
        assert result["nue_propriete_pct"] == 90


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — API endpoints (require DB + auth)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_profile_creates_default(client: httpx.AsyncClient):
    """GET /heritage/profile should auto-create a default profile."""
    headers = await _register_and_get_headers(client)
    resp = await client.get("/api/v1/heritage/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["marital_regime"] == "communaute"
    assert data["heirs"] == []


@pytest.mark.asyncio
async def test_update_profile(client: httpx.AsyncClient):
    """PUT /heritage/profile should persist heirs and regime."""
    headers = await _register_and_get_headers(client)
    payload = {
        "marital_regime": "separation",
        "heirs": [
            {"name": "Alice", "relationship": "enfant", "handicap": False},
            {"name": "Bob", "relationship": "enfant", "handicap": True},
        ],
        "life_insurance_before_70": 15_000_000,
    }
    resp = await client.put("/api/v1/heritage/profile", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["marital_regime"] == "separation"
    assert len(data["heirs"]) == 2
    assert data["heirs"][1]["handicap"] is True
    assert data["life_insurance_before_70"] == 15_000_000


@pytest.mark.asyncio
async def test_simulate_succession(client: httpx.AsyncClient):
    """POST /heritage/simulate should return structured result."""
    headers = await _register_and_get_headers(client)
    # Set up profile first
    await client.put(
        "/api/v1/heritage/profile",
        json={
            "heirs": [{"name": "Emma", "relationship": "enfant"}],
        },
        headers=headers,
    )
    resp = await client.post("/api/v1/heritage/simulate", json={}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "patrimoine_brut" in data
    assert "total_droits" in data
    assert "total_net_transmis" in data
    assert "taux_effectif_global_pct" in data
    assert isinstance(data["heirs_detail"], list)


@pytest.mark.asyncio
async def test_optimize_donations(client: httpx.AsyncClient):
    """POST /heritage/optimize-donations should return scenarios."""
    headers = await _register_and_get_headers(client)
    await client.put(
        "/api/v1/heritage/profile",
        json={
            "heirs": [{"name": "Léa", "relationship": "enfant"}],
        },
        headers=headers,
    )
    resp = await client.post("/api/v1/heritage/optimize-donations", json={}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "scenarios" in data
    assert "best_scenario" in data
    assert "economy_max" in data


@pytest.mark.asyncio
async def test_timeline(client: httpx.AsyncClient):
    """GET /heritage/timeline should return points array."""
    headers = await _register_and_get_headers(client)
    resp = await client.get(
        "/api/v1/heritage/timeline?years=10&inflation=2.0",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "points" in data
    assert len(data["points"]) == 11  # years 0..10
    assert "donation_renewal_years" in data
