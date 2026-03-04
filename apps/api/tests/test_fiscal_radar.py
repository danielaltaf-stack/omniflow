"""
OmniFlow — Phase C4: Fiscal Radar unit & integration tests.

Covers:
  UNIT  – IR barème 2026, PFU vs barème, PEA maturity, crypto abattement,
          micro vs réel, PER plafond, fiscal score, déficit foncier, AV maturity
  INTEG – API endpoints (/fiscal/profile, /analyze, /alerts, /export, /simulate-tmi, /score)
"""

from __future__ import annotations

import datetime as dt
import uuid

import httpx
import pytest

from app.models.fiscal_profile import (
    AV_ABATTEMENT_SINGLE_CENTIMES,
    CRYPTO_ABATTEMENT_CENTIMES,
    DEFICIT_FONCIER_CAP_CENTIMES,
    IR_BRACKETS_2026,
    PEA_CEILING_CENTIMES,
    FiscalProfile,
)
from app.services.fiscal_radar_engine import (
    analyze_assurance_vie,
    analyze_crypto,
    analyze_dividendes_cto,
    analyze_immobilier,
    analyze_pea,
    analyze_per,
    compute_fiscal_score,
    compute_ir_from_bareme,
    compute_tmi,
    generate_fiscal_alerts,
    simulate_tmi_impact,
)


# ── Helpers ──────────────────────────────────────────────────────

_TEST_PASSWORD = "F1sc@lR4d4r!2026"


def _unique_email() -> str:
    return f"fiscal_{uuid.uuid4().hex[:8]}@omniflow.dev"


def _make_profile(**kwargs) -> FiscalProfile:
    """Create an in-memory FiscalProfile with defaults for testing."""
    defaults = dict(
        user_id=uuid.uuid4(),
        tax_household="single",
        parts_fiscales=1.0,
        tmi_rate=30.0,
        revenu_fiscal_ref=4_000_000,  # 40 000€
        pea_open_date=None,
        pea_total_deposits=0,
        per_annual_deposits=0,
        per_plafond=500_000,  # 5 000€
        av_open_date=None,
        av_total_deposits=0,
        total_revenus_fonciers=0,
        total_charges_deductibles=0,
        deficit_foncier_reportable=0,
        crypto_pv_annuelle=0,
        crypto_mv_annuelle=0,
        dividendes_bruts_annuels=0,
        pv_cto_annuelle=0,
        fiscal_score=0,
        total_economy_estimate=0,
        analysis_data={},
        alerts_data=[],
        export_data={},
    )
    defaults.update(kwargs)
    p = FiscalProfile.__new__(FiscalProfile)
    for k, v in defaults.items():
        setattr(p, k, v)
    return p


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Fiscal Tester",
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


class TestIRBareme:
    """Test French income tax bracket computation (barème IR 2026)."""

    def test_ir_bareme_tranche_0(self):
        """Income 10 000€ → tranche 0% → IR = 0."""
        ir = compute_ir_from_bareme(1_000_000)  # 10 000€ in centimes
        assert ir == 0

    def test_ir_bareme_tranche_11(self):
        """Income 20 000€ → partly in 11% tranche."""
        ir = compute_ir_from_bareme(2_000_000)
        assert ir > 0
        # 11% * (20000 - 11497) * 100 = ~93553 centimes
        expected = int((2_000_000 - 1_149_700) * 0.11)
        assert ir == expected

    def test_ir_bareme_tranche_30(self):
        """Income 50 000€ → partly in 30% tranche."""
        ir = compute_ir_from_bareme(5_000_000)
        assert ir > 0
        # First bracket: 0
        # Second: 11% * (29315 - 11497) = 11% * 17818 = 1959.98€
        # Third: 30% * (50000 - 29315) = 30% * 20685 = 6205.5€
        # Total ≈ 8165€ = 816548 centimes (approx)
        assert 700_000 < ir < 900_000

    def test_ir_zero_income(self):
        ir = compute_ir_from_bareme(0)
        assert ir == 0

    def test_ir_negative_income(self):
        ir = compute_ir_from_bareme(-100)
        assert ir == 0

    def test_ir_with_parts(self):
        """2 parts → lower tax."""
        ir_1 = compute_ir_from_bareme(5_000_000, parts=1.0)
        ir_2 = compute_ir_from_bareme(5_000_000, parts=2.0)
        assert ir_2 < ir_1


class TestTMI:
    def test_tmi_zero(self):
        assert compute_tmi(0) == 0.0

    def test_tmi_low(self):
        assert compute_tmi(1_000_000) == 0.0  # 10 000€ → 0%

    def test_tmi_30(self):
        assert compute_tmi(5_000_000) == 30.0  # 50 000€ → TMI 30%


class TestPFUvsBareme:
    """Test PFU vs barème comparison for dividends."""

    def test_pfu_recommended_tmi30(self):
        """TMI 30% → PFU (30%) is better than barème (30% after 40% abattement ≈ 18% + 17.2%)."""
        profile = _make_profile(
            tmi_rate=30.0,
            dividendes_bruts_annuels=500_000,  # 5 000€
            pv_cto_annuelle=0,
        )
        result = analyze_dividendes_cto(profile)
        assert result["pfu_recommended"] is True

    def test_bareme_recommended_tmi11(self):
        """TMI 11% → barème is better (11% on 60% = 6.6% + 17.2% PS < 30% PFU)."""
        profile = _make_profile(
            tmi_rate=11.0,
            dividendes_bruts_annuels=500_000,
            pv_cto_annuelle=0,
        )
        result = analyze_dividendes_cto(profile)
        # At 11%, barème = 11%*60% + 17.2% = 6.6% + 17.2% = 23.8% < 30% PFU
        assert result["pfu_recommended"] is False


class TestPEA:
    def test_pea_days_remaining(self):
        today = dt.date(2026, 3, 3)
        profile = _make_profile(pea_open_date=dt.date(2022, 6, 1))
        result = analyze_pea(profile, today)
        # Maturity: 2027-05-31
        assert result["days_remaining"] is not None
        assert result["days_remaining"] > 0
        assert result["mature"] is False

    def test_pea_mature(self):
        today = dt.date(2030, 1, 1)
        profile = _make_profile(pea_open_date=dt.date(2020, 1, 1))
        result = analyze_pea(profile, today)
        assert result["mature"] is True
        assert result["days_remaining"] == 0

    def test_pea_no_date(self):
        profile = _make_profile(pea_open_date=None)
        result = analyze_pea(profile)
        assert result["has_pea"] is False


class TestCrypto:
    def test_crypto_abattement_305_under(self):
        """PV < 305€ → base imposable = 0."""
        profile = _make_profile(
            crypto_pv_annuelle=20_000,  # 200€
            crypto_mv_annuelle=0,
        )
        result = analyze_crypto(profile)
        assert result["base_imposable"] == 0
        assert result["flat_tax"] == 0

    def test_crypto_abattement_305_over(self):
        """PV > 305€ → base imposable = PV - 305€."""
        profile = _make_profile(
            crypto_pv_annuelle=1_280_000,  # 12 800€
            crypto_mv_annuelle=0,
        )
        result = analyze_crypto(profile)
        assert result["abattement_305"] == CRYPTO_ABATTEMENT_CENTIMES
        assert result["base_imposable"] == 1_280_000 - CRYPTO_ABATTEMENT_CENTIMES

    def test_crypto_mv_offset(self):
        """MV offsets PV."""
        profile = _make_profile(
            crypto_pv_annuelle=500_000,
            crypto_mv_annuelle=400_000,
        )
        result = analyze_crypto(profile)
        assert result["pv_nette"] == 100_000


class TestImmobilier:
    def test_micro_vs_reel_switch(self):
        """If charges > 30% of revenues → réel is better."""
        profile = _make_profile(
            total_revenus_fonciers=1_200_000,  # 12 000€
            total_charges_deductibles=500_000,  # 5 000€ > 30% of 12000 = 3600
        )
        result = analyze_immobilier(profile)
        assert result["micro_eligible"] is True
        assert result["reel_better"] is True
        assert result["economy_if_switch"] > 0

    def test_deficit_foncier_cap(self):
        """Deficit is capped at 10 700€."""
        profile = _make_profile(
            total_revenus_fonciers=500_000,  # 5 000€
            total_charges_deductibles=2_000_000,  # 20 000€ → deficit 15 000€
        )
        result = analyze_immobilier(profile)
        assert result["deficit_imputable"] == DEFICIT_FONCIER_CAP_CENTIMES


class TestPER:
    def test_per_plafond_gap(self):
        """Gap = plafond - versements YTD."""
        profile = _make_profile(
            per_annual_deposits=200_000,  # 2 000€
            per_plafond=500_000,  # 5 000€
        )
        result = analyze_per(profile)
        assert result["gap"] == 300_000  # 3 000€

    def test_per_economy_tmi30(self):
        profile = _make_profile(
            tmi_rate=30.0,
            per_annual_deposits=0,
            per_plafond=500_000,
        )
        result = analyze_per(profile)
        assert result["economy_if_max"] == int(500_000 * 0.30)  # 1 500€


class TestAV:
    def test_av_maturity_calc(self):
        """AV matures after 8 years."""
        today = dt.date(2026, 3, 3)
        profile = _make_profile(av_open_date=dt.date(2019, 6, 1))
        result = analyze_assurance_vie(profile, today)
        # 2019-06-01 + 8 years = 2027-05-30
        assert result["days_remaining"] is not None
        assert result["days_remaining"] > 0
        assert result["mature"] is False
        assert result["abattement"] == AV_ABATTEMENT_SINGLE_CENTIMES

    def test_av_mature(self):
        today = dt.date(2030, 1, 1)
        profile = _make_profile(av_open_date=dt.date(2020, 1, 1))
        result = analyze_assurance_vie(profile, today)
        assert result["mature"] is True


class TestFiscalScore:
    def test_fiscal_score_range(self):
        """Score is always 0-100."""
        profile = _make_profile(
            pea_open_date=dt.date(2020, 1, 1),
            crypto_pv_annuelle=100_000,
            total_revenus_fonciers=500_000,
            total_charges_deductibles=100_000,
            per_annual_deposits=200_000,
            per_plafond=500_000,
            av_open_date=dt.date(2015, 1, 1),
            dividendes_bruts_annuels=300_000,
        )
        alerts = generate_fiscal_alerts(profile)
        score, domains = compute_fiscal_score(profile, alerts)
        assert 0 <= score <= 100
        assert len(domains) > 0

    def test_fiscal_score_empty_profile(self):
        """Empty profile → default score."""
        profile = _make_profile()
        alerts = generate_fiscal_alerts(profile)
        score, domains = compute_fiscal_score(profile, alerts)
        assert 0 <= score <= 100


class TestAlerts:
    def test_generate_alerts_pea_soon(self):
        """PEA approaching maturity → urgent alert."""
        today = dt.date(2026, 3, 3)
        profile = _make_profile(pea_open_date=dt.date(2021, 6, 1))
        alerts = generate_fiscal_alerts(profile, today)
        pea_alerts = [a for a in alerts if a["alert_type"] == "pea_maturity_soon"]
        assert len(pea_alerts) == 1
        assert pea_alerts[0]["priority"] == "urgent"

    def test_generate_alerts_per_yearend(self):
        """PER gap in October → urgent alert."""
        today = dt.date(2026, 10, 15)
        profile = _make_profile(
            per_annual_deposits=200_000,
            per_plafond=500_000,
        )
        alerts = generate_fiscal_alerts(profile, today)
        per_alerts = [a for a in alerts if a["alert_type"] == "per_year_end_gap"]
        assert len(per_alerts) == 1
        assert per_alerts[0]["priority"] == "urgent"


class TestTMISimulation:
    def test_simulate_same_bracket(self):
        profile = _make_profile(
            revenu_fiscal_ref=4_000_000,  # 40 000€ → TMI 30%
            parts_fiscales=1.0,
        )
        result = simulate_tmi_impact(profile, 500_000)  # +5 000€
        assert result["current_tmi"] == 30.0
        assert result["new_tmi"] == 30.0
        assert result["marginal_tax"] > 0


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — API endpoints (need running app)
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.anyio
class TestFiscalAPI:
    """Integration tests against the real FastAPI app."""

    async def test_get_profile(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.get("/api/v1/fiscal/profile", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "tax_household" in data
        assert data["tmi_rate"] == 30.0  # default

    async def test_update_profile(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.put(
            "/api/v1/fiscal/profile",
            headers=headers,
            json={
                "tax_household": "couple",
                "parts_fiscales": 2.0,
                "tmi_rate": 41.0,
                "revenu_fiscal_ref": 9_000_000,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tax_household"] == "couple"
        assert data["parts_fiscales"] == 2.0
        assert data["tmi_rate"] == 41.0

    async def test_run_analysis(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/fiscal/analyze",
            headers=headers,
            json={"year": 2026},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "fiscal_score" in data
        assert 0 <= data["fiscal_score"] <= 100

    async def test_get_alerts(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.get("/api/v1/fiscal/alerts", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "alerts" in data
        assert "count" in data

    async def test_export_year(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.get("/api/v1/fiscal/export/2026", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == 2026
        assert "revenus_fonciers" in data
        assert "crypto_actifs" in data
        assert "synthese" in data

    async def test_simulate_tmi(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.post(
            "/api/v1/fiscal/simulate-tmi",
            headers=headers,
            json={"extra_income": 500_000, "income_type": "salaire"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "current_tmi" in data
        assert "new_tmi" in data
        assert "marginal_tax" in data

    async def test_get_score(self, client: httpx.AsyncClient):
        headers = await _register_and_get_headers(client)
        resp = await client.get("/api/v1/fiscal/score", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "breakdown" in data
        assert "overall_score" in data["breakdown"]

    async def test_unauthenticated(self, client: httpx.AsyncClient):
        resp = await client.get("/api/v1/fiscal/profile")
        assert resp.status_code in (401, 403)

    async def test_default_profile(self, client: httpx.AsyncClient):
        """Fresh user gets auto-created profile with defaults."""
        headers = await _register_and_get_headers(client)
        resp = await client.get("/api/v1/fiscal/profile", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["tax_household"] == "single"
        assert data["parts_fiscales"] == 1.0
        assert data["fiscal_score"] == 0
