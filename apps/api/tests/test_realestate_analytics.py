"""
OmniFlow — Phase B3 — Unit tests for realestate_analytics.

Tests for:
- compute_net_net_yield (brut / net / net-net with micro_foncier and réel)
- compute_amortization_schedule (French constant-payment amortization)
- _add_months helper
"""

from __future__ import annotations

import math
from datetime import date

import pytest

from app.services.realestate_analytics import (
    compute_net_net_yield,
    compute_amortization_schedule,
    _add_months,
)


# ═══════════════════════════════════════════════════════════
#  _add_months helper
# ═══════════════════════════════════════════════════════════

class TestAddMonths:
    def test_simple_add(self):
        assert _add_months(date(2024, 1, 15), 3) == date(2024, 4, 15)

    def test_year_wrap(self):
        assert _add_months(date(2024, 11, 1), 3) == date(2025, 2, 1)

    def test_clamp_end_of_month(self):
        # Jan 31 + 1 month → Feb 28 (or 29 in leap year)
        result = _add_months(date(2024, 1, 31), 1)
        assert result == date(2024, 2, 29)  # 2024 is leap year

    def test_zero_months(self):
        assert _add_months(date(2024, 6, 15), 0) == date(2024, 6, 15)

    def test_twelve_months(self):
        assert _add_months(date(2024, 3, 1), 12) == date(2025, 3, 1)


# ═══════════════════════════════════════════════════════════
#  compute_net_net_yield — micro-foncier
# ═══════════════════════════════════════════════════════════

class TestNetNetYieldMicroFoncier:
    """Test yield computation under micro-foncier regime."""

    @pytest.fixture
    def base_prop(self) -> dict:
        """200k€ purchase, 1000€/month rent, 200€ charges, 800€ loan, 150k remaining."""
        return {
            "purchase_price": 20_000_000,       # 200k€
            "current_value": 22_000_000,        # 220k€
            "monthly_rent": 100_000,            # 1000€
            "monthly_charges": 20_000,          # 200€
            "monthly_loan_payment": 80_000,     # 800€
            "loan_remaining": 15_000_000,       # 150k€
            "fiscal_regime": "micro_foncier",
            "tmi_pct": 30.0,
            "taxe_fonciere": 120_000,           # 1200€
            "assurance_pno": 20_000,            # 200€
            "vacancy_rate_pct": 5.0,
            "notary_fees_pct": 7.5,
            "provision_travaux": 50_000,        # 500€
        }

    def test_returns_all_keys(self, base_prop):
        result = compute_net_net_yield(base_prop)
        expected_keys = {
            "gross_yield_pct", "net_yield_pct", "net_net_yield_pct",
            "net_monthly_cashflow", "capital_gain", "annual_tax_burden",
        }
        assert expected_keys <= set(result.keys())

    def test_gross_yield(self, base_prop):
        result = compute_net_net_yield(base_prop)
        # gross = (1000*12) / 200000 * 100 = 6.0%
        assert abs(result["gross_yield_pct"] - 6.0) < 0.01

    def test_capital_gain(self, base_prop):
        result = compute_net_net_yield(base_prop)
        # 220000 - 200000 = 20000 → 2_000_000 centimes
        assert result["capital_gain"] == 2_000_000

    def test_net_yield_includes_vacancy(self, base_prop):
        result = compute_net_net_yield(base_prop)
        # effective_rent = 1000 * (1 - 5/100) = 950/m → 11400/year
        # total_invest = 200000 * (1 + 7.5/100) = 215000
        # net = (11400 - 200*12 - 1200 - 200 - 500) / 215000 * 100
        # net = (11400 - 2400 - 1200 - 200 - 500) / 215000 * 100
        # net = 7100 / 215000 * 100 ≈ 3.30%
        assert 3.0 < result["net_yield_pct"] < 4.0

    def test_net_net_lower_than_net(self, base_prop):
        """After tax, net-net must be <= net yield."""
        result = compute_net_net_yield(base_prop)
        assert result["net_net_yield_pct"] <= result["net_yield_pct"]

    def test_annual_tax_burden_positive(self, base_prop):
        result = compute_net_net_yield(base_prop)
        assert result["annual_tax_burden"] > 0

    def test_zero_tmi(self, base_prop):
        """With TMI=0, only CSG-CRDS applies."""
        base_prop["tmi_pct"] = 0.0
        result = compute_net_net_yield(base_prop)
        # Still has CSG-CRDS 17.2%
        assert result["annual_tax_burden"] > 0
        # But lower than TMI=30
        base_prop["tmi_pct"] = 30.0
        result_30 = compute_net_net_yield(base_prop)
        assert result["annual_tax_burden"] < result_30["annual_tax_burden"]


# ═══════════════════════════════════════════════════════════
#  compute_net_net_yield — régime réel
# ═══════════════════════════════════════════════════════════

class TestNetNetYieldReel:
    """Test yield computation under régime réel."""

    @pytest.fixture
    def reel_prop(self) -> dict:
        return {
            "purchase_price": 30_000_000,       # 300k€
            "current_value": 28_000_000,        # 280k€ (loss)
            "monthly_rent": 150_000,            # 1500€
            "monthly_charges": 30_000,          # 300€
            "monthly_loan_payment": 120_000,    # 1200€
            "loan_remaining": 25_000_000,       # 250k€
            "fiscal_regime": "reel",
            "tmi_pct": 41.0,
            "taxe_fonciere": 200_000,           # 2000€
            "assurance_pno": 30_000,            # 300€
            "vacancy_rate_pct": 3.0,
            "notary_fees_pct": 8.0,
            "provision_travaux": 100_000,       # 1000€
        }

    def test_reel_regime_deducts_charges(self, reel_prop):
        result = compute_net_net_yield(reel_prop)
        assert "net_net_yield_pct" in result
        # Régime réel allows full charge deduction
        assert result["annual_tax_burden"] >= 0

    def test_capital_loss(self, reel_prop):
        result = compute_net_net_yield(reel_prop)
        # 280000 - 300000 = -20000 → -2_000_000 centimes
        assert result["capital_gain"] == -2_000_000

    def test_reel_can_differ_from_micro(self, reel_prop):
        """Same property: reel vs micro should give different net-net."""
        result_reel = compute_net_net_yield(reel_prop)
        reel_prop["fiscal_regime"] = "micro_foncier"
        result_micro = compute_net_net_yield(reel_prop)
        assert result_reel["net_net_yield_pct"] != result_micro["net_net_yield_pct"]


# ═══════════════════════════════════════════════════════════
#  compute_net_net_yield — edge cases
# ═══════════════════════════════════════════════════════════

class TestNetNetYieldEdgeCases:
    def test_zero_purchase_price(self):
        """Division by zero guard."""
        prop = {
            "purchase_price": 0,
            "current_value": 0,
            "monthly_rent": 0,
            "monthly_charges": 0,
            "monthly_loan_payment": 0,
            "loan_remaining": 0,
            "fiscal_regime": "micro_foncier",
            "tmi_pct": 30.0,
            "taxe_fonciere": 0,
            "assurance_pno": 0,
            "vacancy_rate_pct": 0,
            "notary_fees_pct": 7.5,
            "provision_travaux": 0,
        }
        result = compute_net_net_yield(prop)
        assert result["gross_yield_pct"] == 0.0
        assert result["net_yield_pct"] == 0.0
        assert result["net_net_yield_pct"] == 0.0

    def test_no_rent(self):
        """Property with no rental income → yield = 0."""
        prop = {
            "purchase_price": 10_000_000,
            "current_value": 10_000_000,
            "monthly_rent": 0,
            "monthly_charges": 5_000,
            "monthly_loan_payment": 50_000,
            "loan_remaining": 5_000_000,
            "fiscal_regime": "micro_foncier",
            "tmi_pct": 30.0,
            "taxe_fonciere": 50_000,
            "assurance_pno": 10_000,
            "vacancy_rate_pct": 0,
            "notary_fees_pct": 7.5,
            "provision_travaux": 0,
        }
        result = compute_net_net_yield(prop)
        assert result["gross_yield_pct"] == 0.0
        # Net yield can be negative (charges with no income)
        assert result["net_yield_pct"] <= 0.0


# ═══════════════════════════════════════════════════════════
#  compute_amortization_schedule
# ═══════════════════════════════════════════════════════════

class TestAmortizationSchedule:
    def test_basic_schedule(self):
        """200k€ over 240 months at 1.5% + 0.35% insurance."""
        schedule = compute_amortization_schedule(
            principal=200_000,
            annual_rate=1.5,
            duration_months=240,
            insurance_rate=0.35,
        )
        assert len(schedule) == 240
        # First row
        row0 = schedule[0]
        assert row0["month"] == 1
        assert row0["remaining_capital"] < 200_000
        # Last row should have ~0 remaining capital
        last = schedule[-1]
        assert last["remaining_capital"] < 1.0  # < 1€

    def test_total_principal_equals_loan(self):
        """Sum of principal repayments ≈ original loan amount."""
        schedule = compute_amortization_schedule(
            principal=150_000,
            annual_rate=2.0,
            duration_months=180,
            insurance_rate=0.0,
        )
        total_principal = sum(r["loan_principal"] for r in schedule)
        assert abs(total_principal - 150_000) < 1.0

    def test_constant_monthly_payment(self):
        """In French amortization, total payment (excl. insurance) should be constant."""
        schedule = compute_amortization_schedule(
            principal=100_000,
            annual_rate=3.0,
            duration_months=120,
            insurance_rate=0.0,
        )
        payments = [r["loan_principal"] + r["loan_interest"] for r in schedule]
        # All should be within 0.01€ of each other
        for p in payments:
            assert abs(p - payments[0]) < 0.02

    def test_zero_rate(self):
        """At 0% interest, all payment is principal."""
        schedule = compute_amortization_schedule(
            principal=120_000,
            annual_rate=0.0,
            duration_months=120,
            insurance_rate=0.0,
        )
        assert len(schedule) == 120
        for row in schedule:
            assert row["loan_interest"] == 0.0
            assert abs(row["loan_principal"] - 1_000) < 0.01

    def test_zero_duration(self):
        """0-month duration returns empty schedule."""
        schedule = compute_amortization_schedule(
            principal=100_000,
            annual_rate=2.0,
            duration_months=0,
            insurance_rate=0.0,
        )
        assert schedule == []

    def test_insurance_separate(self):
        """Insurance is an additional monthly cost."""
        schedule = compute_amortization_schedule(
            principal=200_000,
            annual_rate=1.5,
            duration_months=240,
            insurance_rate=0.35,
        )
        # Insurance per month = 200000 * 0.35% / 12
        expected_ins = 200_000 * 0.35 / 100 / 12
        for row in schedule:
            assert abs(row["loan_insurance"] - expected_ins) < 0.01
