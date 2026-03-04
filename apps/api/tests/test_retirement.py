"""
OmniFlow — Retirement & FIRE API integration tests (Phase C1).

Covers:
  - Profile CRUD (get/update)
  - Monte-Carlo simulation endpoint
  - FIRE dashboard
  - Patrimoine snapshot
  - What-if simulation
  - Optimization levers
  - Unit: CNAV pension estimate
  - Unit: FIRE number, Coast FIRE, dynamic SWR
  - Unit: Monte-Carlo engine (deterministic seed)
"""

from __future__ import annotations

import random
import uuid

import httpx
import pytest

from app.services.retirement_engine import (
    compute_coast_fire,
    compute_fire_number,
    compute_swr_dynamic,
    estimate_pension_cnav,
    run_monte_carlo,
)

# ── Helpers ──────────────────────────────────────────────────────

_TEST_PASSWORD = "Str0ng!Pass#42"


def _unique_email() -> str:
    return f"retire_test_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a user and return Authorization headers."""
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Retirement Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════
#  UNIT TESTS — Pure functions (no DB)
# ═══════════════════════════════════════════════════════════════


class TestPensionCNAV:
    """Test French pension estimates."""

    def test_full_career(self):
        # 3000€/month, 172 quarters = full rate
        pension = estimate_pension_cnav(300_000, 172)
        # (3000*12*0.50) + (3000*12*0.25) = 18000 + 9000 = 27000/12 = 2250€
        assert pension == 225_000  # 2250€ in centimes

    def test_partial_career(self):
        # 86/172 quarters = 50% prorated
        pension = estimate_pension_cnav(300_000, 86)
        assert pension > 0
        full = estimate_pension_cnav(300_000, 172)
        assert pension == full // 2 or abs(pension - full // 2) <= 1

    def test_zero_income(self):
        assert estimate_pension_cnav(0, 172) == 0

    def test_negative_income(self):
        assert estimate_pension_cnav(-100, 172) == 0


class TestFIRECalculations:
    """Test FIRE number and variants."""

    def test_fire_number_standard(self):
        # 30 000€/year * 25 = 750 000€
        assert compute_fire_number(3_000_000) == 75_000_000

    def test_fire_number_zero(self):
        assert compute_fire_number(0) == 0

    def test_coast_fire(self):
        fire_num = 75_000_000  # 750 000€
        coast = compute_coast_fire(fire_num, 7.0, 20)
        # fire / (1.07^20)
        assert coast > 0
        assert coast < fire_num

    def test_coast_fire_zero_years(self):
        assert compute_coast_fire(100_000, 7.0, 0) == 100_000

    def test_swr_dynamic_conservative(self):
        swr = compute_swr_dynamic(50_000_000, 3_000_000, 40, 15.0)
        assert 0.03 <= swr <= 0.05

    def test_swr_dynamic_high_ratio(self):
        # Very wealthy: patrimoine/expenses > 33
        swr = compute_swr_dynamic(150_000_000, 3_000_000, 75, 8.0)
        # Should be closer to max
        assert swr > 0.035


class TestMonteCarloEngine:
    """Test Monte-Carlo simulation with fixed seed."""

    def test_basic_simulation(self):
        random.seed(42)
        result = run_monte_carlo(
            patrimoine_initial=50_000_000,  # 500k€
            monthly_savings=100_000,  # 1000€/month
            extra_monthly_savings=0,
            annual_expenses=3_000_000,  # 30k€/year
            pension_monthly=200_000,  # 2000€/month
            current_age=35,
            retirement_age=64,
            life_expectancy=90,
            inflation_rate_pct=2.0,
            portfolio_mean_pct=6.0,
            portfolio_std_pct=12.0,
            debt_end_events=[],
            num_simulations=100,
        )
        assert len(result.serie_by_age) == 56  # ages 35..90
        assert len(result.fire_ages) == 100
        assert len(result.ruin_ages) == 100
        assert len(result.final_patrimoines) == 100

    def test_accumulation_only(self):
        """Test behavior when current age < retirement age."""
        random.seed(42)
        result = run_monte_carlo(
            patrimoine_initial=10_000_000,
            monthly_savings=50_000,
            extra_monthly_savings=0,
            annual_expenses=2_400_000,
            pension_monthly=150_000,
            current_age=30,
            retirement_age=65,
            life_expectancy=65,
            inflation_rate_pct=2.0,
            portfolio_mean_pct=7.0,
            portfolio_std_pct=15.0,
            debt_end_events=[],
            num_simulations=50,
        )
        # All years are accumulation
        for ypd in result.serie_by_age:
            assert ypd.is_accumulation is True

    def test_ruin_probability_high_expenses(self):
        """Very high expenses should lead to high ruin probability."""
        random.seed(42)
        result = run_monte_carlo(
            patrimoine_initial=10_000_000,
            monthly_savings=10_000,
            extra_monthly_savings=0,
            annual_expenses=50_000_000,  # 500k€/year — way too high
            pension_monthly=100_000,
            current_age=60,
            retirement_age=62,
            life_expectancy=90,
            inflation_rate_pct=3.0,
            portfolio_mean_pct=5.0,
            portfolio_std_pct=12.0,
            debt_end_events=[],
            num_simulations=100,
        )
        ruin_count = sum(1 for r in result.ruin_ages if r is not None)
        assert ruin_count > 50  # majority should go bankrupt

    def test_debt_event_boosts_savings(self):
        """Debt end event should free cash for savings."""
        random.seed(42)
        result_no_debt = run_monte_carlo(
            patrimoine_initial=30_000_000,
            monthly_savings=80_000,
            extra_monthly_savings=0,
            annual_expenses=2_400_000,
            pension_monthly=150_000,
            current_age=40,
            retirement_age=65,
            life_expectancy=90,
            inflation_rate_pct=2.0,
            portfolio_mean_pct=6.0,
            portfolio_std_pct=12.0,
            debt_end_events=[],
            num_simulations=50,
        )

        random.seed(42)
        result_with_debt = run_monte_carlo(
            patrimoine_initial=30_000_000,
            monthly_savings=80_000,
            extra_monthly_savings=0,
            annual_expenses=2_400_000,
            pension_monthly=150_000,
            current_age=40,
            retirement_age=65,
            life_expectancy=90,
            inflation_rate_pct=2.0,
            portfolio_mean_pct=6.0,
            portfolio_std_pct=12.0,
            debt_end_events=[(2030, 50_000)],  # +500€/month freed from 2030
            num_simulations=50,
        )
        # Median final patrimoine should be higher with freed debt payment
        med_no = sorted(result_no_debt.final_patrimoines)[25]
        med_with = sorted(result_with_debt.final_patrimoines)[25]
        assert med_with >= med_no


# ═══════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — API endpoints
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_default_profile(client: httpx.AsyncClient):
    """GET /retirement/profile should create default profile."""
    headers = await _register_and_get_headers(client)
    resp = await client.get("/api/v1/retirement/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["birth_year"] == 1990
    assert data["target_retirement_age"] == 64
    assert "id" in data


@pytest.mark.asyncio
async def test_update_profile(client: httpx.AsyncClient):
    """PUT /retirement/profile should update fields."""
    headers = await _register_and_get_headers(client)
    # Create profile first
    await client.get("/api/v1/retirement/profile", headers=headers)
    # Update
    resp = await client.put(
        "/api/v1/retirement/profile",
        headers=headers,
        json={
            "birth_year": 1985,
            "current_monthly_income": 350_000,  # 3500€
            "monthly_savings": 80_000,  # 800€
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["birth_year"] == 1985
    assert data["current_monthly_income"] == 350_000
    assert data["monthly_savings"] == 80_000


@pytest.mark.asyncio
async def test_simulate(client: httpx.AsyncClient):
    """POST /retirement/simulate should return simulation results."""
    headers = await _register_and_get_headers(client)
    # Set up profile
    await client.put(
        "/api/v1/retirement/profile",
        headers=headers,
        json={
            "birth_year": 1990,
            "current_monthly_income": 300_000,
            "current_monthly_expenses": 200_000,
            "monthly_savings": 50_000,
        },
    )
    resp = await client.post(
        "/api/v1/retirement/simulate",
        headers=headers,
        json={"num_simulations": 100},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "success_rate_pct" in data
    assert "serie_by_age" in data
    assert "fire_number" in data
    assert len(data["serie_by_age"]) > 0


@pytest.mark.asyncio
async def test_fire_dashboard(client: httpx.AsyncClient):
    """GET /retirement/fire-dashboard should return FIRE metrics."""
    headers = await _register_and_get_headers(client)
    await client.put(
        "/api/v1/retirement/profile",
        headers=headers,
        json={
            "current_monthly_income": 400_000,
            "current_monthly_expenses": 250_000,
        },
    )
    resp = await client.get("/api/v1/retirement/fire-dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "fire_number" in data
    assert "coast_fire" in data
    assert "lean_fire" in data
    assert "fat_fire" in data
    assert data["fire_number"] > 0


@pytest.mark.asyncio
async def test_patrimoine_snapshot(client: httpx.AsyncClient):
    """GET /retirement/patrimoine should return asset breakdown."""
    headers = await _register_and_get_headers(client)
    resp = await client.get("/api/v1/retirement/patrimoine", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "stocks" in data
    assert "crypto" in data
    assert "real_estate" in data


@pytest.mark.asyncio
async def test_what_if(client: httpx.AsyncClient):
    """POST /retirement/what-if should accept overrides."""
    headers = await _register_and_get_headers(client)
    await client.put(
        "/api/v1/retirement/profile",
        headers=headers,
        json={
            "current_monthly_income": 300_000,
            "current_monthly_expenses": 200_000,
            "monthly_savings": 50_000,
        },
    )
    resp = await client.post(
        "/api/v1/retirement/what-if",
        headers=headers,
        json={
            "retirement_age": 55,
            "num_simulations": 100,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "success_rate_pct" in data
    assert "fire_number" in data
