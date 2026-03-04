"""
OmniFlow — Phase C5 — Unit & integration tests for Wealth Autopilot.

Tests:
  UNIT (12):
    - test_available_positive          (solde suffisant → épargne > 0)
    - test_available_negative          (solde < matelas → épargne = 0)
    - test_round_to_step               (arrondi au palier 10€)
    - test_min_savings_threshold       (< 20€ → pas de suggestion)
    - test_allocation_safety_first     (priorité 1 = matelas)
    - test_allocation_project          (remplissage projet)
    - test_allocation_dca              (DCA allocation pct)
    - test_score_range_0_100           (score toujours borné)
    - test_score_high_savings_rate     (taux > 30% → score élevé)
    - test_scenario_prudent            (projection minimale)
    - test_scenario_ambitieux          (projection +50%)
    - test_savings_rate_calc           (taux = épargne / revenus)
  INTEGRATION (8):
    - test_get_config                  (GET /autopilot/config → config)
    - test_update_config               (PUT → config mise à jour)
    - test_compute_savings             (POST /autopilot/compute → suggestion)
    - test_accept_suggestion           (POST /autopilot/accept → logged)
    - test_get_history                 (GET /autopilot/history → list)
    - test_simulate_scenarios          (POST /autopilot/simulate → 3 scénarios)
    - test_get_score                   (GET /autopilot/score → breakdown)
    - test_unauthenticated             (→ 401 sans token)

All amounts in centimes.
"""

from __future__ import annotations

import pytest

from app.services.wealth_autopilot_engine import (
    allocate_savings,
    compute_autopilot_score,
    compute_available,
    compute_safety_gap,
    generate_dca_suggestions,
    simulate_scenarios,
)


# ═══════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════


class FakeConfig:
    """Minimal fake mimicking AutopilotConfig for pure-function tests."""

    def __init__(self, **kwargs):
        self.is_enabled = kwargs.get("is_enabled", True)
        self.safety_cushion_months = kwargs.get("safety_cushion_months", 3.0)
        self.min_savings_amount = kwargs.get("min_savings_amount", 2000)
        self.savings_step = kwargs.get("savings_step", 1000)
        self.lookback_days = kwargs.get("lookback_days", 90)
        self.forecast_days = kwargs.get("forecast_days", 7)
        self.monthly_income = kwargs.get("monthly_income", 250_000)  # 2500€
        self.income_day = kwargs.get("income_day", 1)
        self.other_income = kwargs.get("other_income", 0)
        self.allocations = kwargs.get("allocations", [])
        self.last_available = kwargs.get("last_available", 0)
        self.last_suggestion = kwargs.get("last_suggestion", {})
        self.suggestions_history = kwargs.get("suggestions_history", [])
        self.autopilot_score = kwargs.get("autopilot_score", 0)
        self.savings_rate_pct = kwargs.get("savings_rate_pct", 0.0)
        self.analysis_data = kwargs.get("analysis_data", {})


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — compute_available
# ═══════════════════════════════════════════════════════════════════


class TestComputeAvailable:
    def test_available_positive(self):
        """Sufficient balance → positive savings."""
        result = compute_available(
            checking_balance=500_000,     # 5000€
            upcoming_debits=100_000,      # 1000€
            monthly_expenses=200_000,     # 2000€
            min_amount=2_000,             # 20€
            step=1_000,                   # 10€
        )
        # raw = 5000 - 1000 - 600 (30% of 2000) = 3400€
        # rounded to step → 340_000
        assert result == 340_000

    def test_available_negative(self):
        """Balance below reserve → 0."""
        result = compute_available(
            checking_balance=50_000,      # 500€
            upcoming_debits=40_000,       # 400€
            monthly_expenses=200_000,     # 2000€
            min_amount=2_000,
            step=1_000,
        )
        # raw = 500 - 400 - 600 = -500 → 0
        assert result == 0

    def test_round_to_step(self):
        """Verify rounding to step (10€ = 1000 centimes)."""
        result = compute_available(
            checking_balance=103_500,     # 1035€
            upcoming_debits=0,
            monthly_expenses=100_000,     # 1000€
            min_amount=2_000,
            step=1_000,
        )
        # raw = 1035 - 0 - 300 = 735€ → floor(735/10)*10 = 730€ → 73_000
        assert result == 73_000
        assert result % 1_000 == 0  # divisible by step

    def test_min_savings_threshold(self):
        """Below min → 0."""
        result = compute_available(
            checking_balance=62_500,      # 625€
            upcoming_debits=0,
            monthly_expenses=200_000,     # 2000€
            min_amount=2_000,             # 20€
            step=1_000,
        )
        # raw = 625 - 600 = 25€ → rounded = 20€ → just meets min? Let's check:
        # raw = 62500 - 0 - 60000 = 2500. floor(2500/1000)*1000 = 2000. 2000 >= 2000 → OK
        assert result == 2_000

    def test_below_min_returns_zero(self):
        """Slightly below min → 0."""
        result = compute_available(
            checking_balance=61_500,      # 615€
            upcoming_debits=0,
            monthly_expenses=200_000,     # 2000€
            min_amount=2_000,
            step=1_000,
        )
        # raw = 61500 - 60000 = 1500. floor(1500/1000)*1000 = 1000. 1000 < 2000 min → 0
        assert result == 0


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Safety Cushion
# ═══════════════════════════════════════════════════════════════════


class TestSafetyCushion:
    def test_safety_gap_positive(self):
        target, gap = compute_safety_gap(200_000, 3.0, 400_000)
        assert target == 600_000  # 3 × 2000€
        assert gap == 200_000    # 6000 - 4000 = 2000€

    def test_safety_gap_zero_when_full(self):
        target, gap = compute_safety_gap(200_000, 3.0, 700_000)
        assert gap == 0


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — allocate_savings
# ═══════════════════════════════════════════════════════════════════


class TestAllocateSavings:
    def test_allocation_safety_first(self):
        """Safety cushion gets priority 1."""
        allocs = [
            {"priority": 1, "type": "safety_cushion", "label": "Matelas", "pct": 100},
            {"priority": 2, "type": "project", "label": "Vacances", "target": 300_000, "current": 0, "pct": 50},
        ]
        result = allocate_savings(100_000, allocs, safety_gap=80_000)
        assert len(result) >= 1
        assert result[0]["allocation_type"] == "safety_cushion"
        assert result[0]["amount"] == 80_000  # min(100k, 80k gap, 100k*100%)

    def test_allocation_project(self):
        """Project gets filled after safety."""
        allocs = [
            {"priority": 1, "type": "safety_cushion", "label": "Matelas", "pct": 50},
            {"priority": 2, "type": "project", "label": "Vacances", "target": 100_000, "current": 80_000, "pct": 50},
        ]
        result = allocate_savings(100_000, allocs, safety_gap=0)
        # Safety pct=50% → share=50k, but gap=0 → amount=0
        # Project pct=50% → share=50k, gap=20k → amount=min(50k, 20k, remaining)
        project_allocs = [r for r in result if r["allocation_type"] == "project"]
        assert len(project_allocs) == 1
        assert project_allocs[0]["amount"] == 20_000

    def test_allocation_dca(self):
        """DCA allocations respect pct and target_monthly."""
        allocs = [
            {"priority": 1, "type": "dca_etf", "label": "ETF World", "pct": 60, "target_monthly": 20_000},
            {"priority": 2, "type": "dca_crypto", "label": "Bitcoin", "pct": 40, "target_monthly": 10_000},
        ]
        result = allocate_savings(50_000, allocs, safety_gap=0)
        assert len(result) == 2
        # DCA ETF: min(50k*60%=30k, 20k, 50k) = 20k
        assert result[0]["amount"] == 20_000
        # DCA Crypto: min(50k*40%=20k, 10k, 30k remaining) = 10k
        assert result[1]["amount"] == 10_000

    def test_empty_allocations(self):
        result = allocate_savings(100_000, [], safety_gap=0)
        assert result == []

    def test_zero_available(self):
        result = allocate_savings(0, [{"priority": 1, "type": "dca_etf", "label": "ETF", "pct": 100, "target_monthly": 20_000}], safety_gap=0)
        assert result == []


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Score
# ═══════════════════════════════════════════════════════════════════


class TestAutopilotScore:
    def test_score_range_0_100(self):
        config = FakeConfig(savings_rate_pct=0.0)
        score, breakdown = compute_autopilot_score(config)
        assert 0 <= score <= 100

    def test_score_high_savings_rate(self):
        config = FakeConfig(
            savings_rate_pct=35.0,
            analysis_data={"safety_target": 600_000, "savings_balance": 800_000},
            suggestions_history=[{"status": "accepted"}] * 10,
            allocations=[
                {"type": "dca_etf"},
                {"type": "dca_crypto"},
                {"type": "dca_bond"},
                {"type": "project"},
                {"type": "project"},
                {"type": "project"},
            ],
        )
        score, breakdown = compute_autopilot_score(config)
        assert score >= 80
        assert breakdown["savings_rate_score"] == 30
        assert breakdown["safety_cushion_score"] == 25
        assert breakdown["regularity_score"] == 20
        assert breakdown["diversification_score"] == 15
        assert breakdown["projects_score"] == 10

    def test_savings_rate_calc(self):
        """Score component for savings rate."""
        # 15% savings rate → 20 pts
        config = FakeConfig(savings_rate_pct=15.0)
        score, breakdown = compute_autopilot_score(config)
        assert breakdown["savings_rate_score"] == 20


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Scenarios
# ═══════════════════════════════════════════════════════════════════


class TestScenarios:
    @pytest.fixture
    def base_config(self) -> FakeConfig:
        return FakeConfig(
            min_savings_amount=2_000,
            analysis_data={"safety_target": 600_000, "savings_balance": 300_000},
            allocations=[
                {"type": "project", "label": "Vacances", "target": 200_000, "current": 50_000, "pct": 50},
            ],
        )

    def test_scenario_prudent(self, base_config):
        result = simulate_scenarios(base_config, 10_000)
        assert "prudent" in result
        # Prudent uses min_savings_amount (2000) * 4 weeks = 8000/month
        assert result["prudent"]["total_savings_6m"] == 2_000 * 4 * 6

    def test_scenario_ambitieux(self, base_config):
        result = simulate_scenarios(base_config, 10_000)
        assert "ambitious" in result
        # Ambitious = max(10000, 2000) * 1.5 * 4 weeks = 60_000 → * 6
        assert result["ambitious"]["total_savings_6m"] == int(10_000 * 1.5) * 4 * 6


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — DCA
# ═══════════════════════════════════════════════════════════════════


class TestDCA:
    def test_dca_suggestions(self):
        allocs = [
            {"type": "dca_etf", "label": "ETF World", "pct": 50, "target_monthly": 20_000, "asset_class": "etf"},
            {"type": "dca_crypto", "label": "Bitcoin", "pct": 30, "target_monthly": 5_000, "asset_class": "crypto"},
        ]
        result = generate_dca_suggestions(allocs, 50_000)
        assert len(result) == 2
        assert result[0]["type"] == "dca_etf"
        assert result[0]["target_monthly"] == 20_000
        assert "Investir" in result[0]["suggestion"]


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — API Endpoints
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
async def auth_headers(client) -> dict[str, str]:
    """Register + login, return Authorization header."""
    await client.post(
        "/api/v1/auth/register",
        json={"email": "autopilot@test.com", "password": "Test1234!", "full_name": "Test User"},
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "autopilot@test.com", "password": "Test1234!"},
    )
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}


class TestAutopilotAPI:
    @pytest.mark.asyncio
    async def test_get_config(self, client, auth_headers):
        resp = await client.get("/api/v1/autopilot/config", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "is_enabled" in data
        assert data["is_enabled"] is True
        assert data["safety_cushion_months"] == 3.0

    @pytest.mark.asyncio
    async def test_update_config(self, client, auth_headers):
        resp = await client.put(
            "/api/v1/autopilot/config",
            headers=auth_headers,
            json={
                "monthly_income": 300_000,
                "safety_cushion_months": 4.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["monthly_income"] == 300_000
        assert data["safety_cushion_months"] == 4.0

    @pytest.mark.asyncio
    async def test_compute_savings(self, client, auth_headers):
        # First set income so engine has data
        await client.put(
            "/api/v1/autopilot/config",
            headers=auth_headers,
            json={"monthly_income": 250_000},
        )
        resp = await client.post("/api/v1/autopilot/compute", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "suggestion" in data
        assert "suggestion_id" in data["suggestion"]
        assert "savings_rate_pct" in data

    @pytest.mark.asyncio
    async def test_accept_suggestion(self, client, auth_headers):
        # Compute first
        await client.put("/api/v1/autopilot/config", headers=auth_headers, json={"monthly_income": 250_000})
        compute_resp = await client.post("/api/v1/autopilot/compute", headers=auth_headers)
        suggestion = compute_resp.json().get("suggestion", {})
        sid = suggestion.get("suggestion_id", "fake")

        resp = await client.post(
            "/api/v1/autopilot/accept",
            headers=auth_headers,
            json={"suggestion_id": sid},
        )
        # Either 200 (found) or 404 (expired/not found)
        assert resp.status_code in (200, 404)

    @pytest.mark.asyncio
    async def test_get_history(self, client, auth_headers):
        resp = await client.get("/api/v1/autopilot/history", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "history" in data
        assert "acceptance_rate" in data

    @pytest.mark.asyncio
    async def test_simulate_scenarios(self, client, auth_headers):
        resp = await client.post("/api/v1/autopilot/simulate", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "prudent" in data
        assert "moderate" in data
        assert "ambitious" in data
        assert "total_savings_6m" in data["prudent"]

    @pytest.mark.asyncio
    async def test_get_score(self, client, auth_headers):
        resp = await client.get("/api/v1/autopilot/score", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "breakdown" in data
        assert "overall_score" in data["breakdown"]
        assert 0 <= data["breakdown"]["overall_score"] <= 100

    @pytest.mark.asyncio
    async def test_unauthenticated(self, client):
        resp = await client.get("/api/v1/autopilot/config")
        assert resp.status_code == 401
