"""
OmniFlow — Unit tests for the amortization engine.

Pure math tests — no DB, no HTTP, no async.
Covers all 4 payment modes, early repayment, invest-vs-repay, consolidation.
"""

from __future__ import annotations

from datetime import date

from app.services.amortization_engine import (
    AmortizationRow,
    AmortizationResult,
    compute_amortization,
    simulate_early_repayment,
    compare_invest_vs_repay,
    compute_consolidation,
    generate_chart_data,
)


# ═════════════════════════════════════════════════════════════════
#  AMORTIZATION — constant_annuity (French system)
# ═════════════════════════════════════════════════════════════════


def test_constant_annuity_basic():
    """100 000€ à 2% sur 120 mois — vérifie structure & convergence."""
    result = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=2.0,
        duration_months=120,
        insurance_rate_pct=0.0,
        payment_type="constant_annuity",
        start_date=date(2024, 1, 1),
    )
    assert len(result.rows) == 120
    # Last row should have remaining ≈ 0 (centimes rounding)
    assert result.rows[-1].remaining <= 100  # <1€ residual
    # Total paid > principal (interest cost)
    assert result.total_paid > 10_000_000
    assert result.total_interest > 0
    # Rows should be monotonically decreasing in remaining
    for i in range(1, len(result.rows)):
        assert result.rows[i].remaining <= result.rows[i - 1].remaining


def test_constant_annuity_zero_rate():
    """0% interest — total paid == principal, no interest."""
    result = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=0.0,
        duration_months=100,
        insurance_rate_pct=0.0,
        payment_type="constant_annuity",
    )
    assert result.total_interest == 0
    assert abs(result.total_paid - 10_000_000) <= 100  # rounding tolerance


def test_constant_annuity_with_insurance():
    """Check insurance adds to total cost."""
    without = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=2.0,
        duration_months=120,
        insurance_rate_pct=0.0,
        payment_type="constant_annuity",
    )
    with_ins = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=2.0,
        duration_months=120,
        insurance_rate_pct=0.3,
        payment_type="constant_annuity",
    )
    assert with_ins.total_insurance > 0
    assert with_ins.total_cost > without.total_cost


# ═════════════════════════════════════════════════════════════════
#  AMORTIZATION — constant_amortization (German system)
# ═════════════════════════════════════════════════════════════════


def test_constant_amortization():
    """Principal portion should be constant each month."""
    result = compute_amortization(
        principal=12_000_000,
        annual_rate_pct=3.0,
        duration_months=120,
        insurance_rate_pct=0.0,
        payment_type="constant_amortization",
    )
    assert len(result.rows) == 120
    assert result.rows[-1].remaining <= 100
    # Principal portion per month should be roughly principal/duration
    expected_principal = 12_000_000 // 120
    for row in result.rows:
        assert abs(row.principal - expected_principal) <= 2  # centimes tolerance


# ═════════════════════════════════════════════════════════════════
#  AMORTIZATION — in_fine
# ═════════════════════════════════════════════════════════════════


def test_in_fine():
    """Only interest until last month, then full capital."""
    result = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=2.0,
        duration_months=60,
        insurance_rate_pct=0.0,
        payment_type="in_fine",
    )
    assert len(result.rows) == 60
    # All months before last: principal == 0
    for row in result.rows[:-1]:
        assert row.principal == 0
    # Last month: full repayment
    assert result.rows[-1].principal == 10_000_000
    assert result.rows[-1].remaining == 0


# ═════════════════════════════════════════════════════════════════
#  AMORTIZATION — deferred
# ═════════════════════════════════════════════════════════════════


def test_deferred():
    """Deferred: grace period, then constant annuity. No principal in grace."""
    result = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=2.0,
        duration_months=60,
        insurance_rate_pct=0.0,
        payment_type="deferred",
    )
    assert len(result.rows) == 60
    # Grace period = 60 // 4 = 15 months: principal == 0
    grace_months = 60 // 4
    for row in result.rows[:grace_months]:
        assert row.principal == 0
    # After grace, principal should decrease
    assert result.rows[-1].remaining <= 200  # small residual


# ═════════════════════════════════════════════════════════════════
#  EARLY REPAYMENT
# ═════════════════════════════════════════════════════════════════


def test_early_repayment_basic():
    """Simulate early repayment and check savings are positive."""
    result = simulate_early_repayment(
        principal=10_000_000,
        remaining_amount=8_000_000,
        annual_rate_pct=2.0,
        duration_months=240,
        insurance_rate_pct=0.3,
        monthly_payment=50_000,
        early_repayment_fee_pct=3.0,
        repayment_amount=2_000_000,
        at_month=24,
        start_date=date(2024, 1, 1),
        payment_type="constant_annuity",
    )
    # Both scenarios should save interest
    assert result.reduced_duration.interest_saved > 0
    assert result.reduced_payment.interest_saved > 0
    # Penalty should be calculated
    assert result.reduced_duration.penalty_amount >= 0
    # Reduced duration should have shorter duration
    assert result.reduced_duration.new_duration_months < (240 - 24)


def test_early_repayment_zero_fee():
    """With 0% fee, net savings == interest saved."""
    result = simulate_early_repayment(
        principal=10_000_000,
        remaining_amount=10_000_000,
        annual_rate_pct=3.0,
        duration_months=120,
        insurance_rate_pct=0.0,
        monthly_payment=97_000,
        early_repayment_fee_pct=0.0,
        repayment_amount=5_000_000,
        at_month=1,
        payment_type="constant_annuity",
    )
    assert result.reduced_duration.penalty_amount == 0
    assert result.reduced_duration.net_savings == result.reduced_duration.interest_saved


# ═════════════════════════════════════════════════════════════════
#  INVEST VS REPAY
# ═════════════════════════════════════════════════════════════════


def test_invest_vs_repay_high_return():
    """With very high return rate, investing should be the verdict."""
    result = compare_invest_vs_repay(
        amount=5_000_000,
        remaining_amount=10_000_000,
        annual_rate_pct=1.0,
        duration_months=120,
        monthly_payment=90_000,
        early_repayment_fee_pct=3.0,
        return_rate_pct=10.0,
        insurance_rate_pct=0.0,
        payment_type="constant_annuity",
    )
    assert result.verdict == "invest"
    assert result.invest_net_gain > result.repay_net_gain


def test_invest_vs_repay_low_return():
    """With very low return and high loan rate, repaying should win."""
    result = compare_invest_vs_repay(
        amount=5_000_000,
        remaining_amount=10_000_000,
        annual_rate_pct=8.0,
        duration_months=120,
        monthly_payment=122_000,
        early_repayment_fee_pct=0.0,
        return_rate_pct=2.0,
        insurance_rate_pct=0.0,
        payment_type="constant_annuity",
    )
    assert result.verdict == "repay"
    assert result.repay_net_gain > result.invest_net_gain


# ═════════════════════════════════════════════════════════════════
#  CONSOLIDATION
# ═════════════════════════════════════════════════════════════════


def test_consolidation_avalanche_order():
    """Avalanche orders debts by descending interest rate."""
    debts = [
        {"label": "Low", "remaining_amount": 5_000_000, "interest_rate_pct": 1.0, "monthly_payment": 50_000, "remaining_months": 100},
        {"label": "High", "remaining_amount": 3_000_000, "interest_rate_pct": 5.0, "monthly_payment": 40_000, "remaining_months": 80},
        {"label": "Mid", "remaining_amount": 8_000_000, "interest_rate_pct": 3.0, "monthly_payment": 70_000, "remaining_months": 120},
    ]
    result = compute_consolidation(debts, monthly_income=300_000, extra_monthly=10_000)
    # Avalanche: High (5%) → Mid (3%) → Low (1%)
    assert result["avalanche_order"][0] == "High"
    assert result["avalanche_order"][-1] == "Low"


def test_consolidation_snowball_order():
    """Snowball orders debts by ascending remaining balance."""
    debts = [
        {"label": "Big", "remaining_amount": 10_000_000, "interest_rate_pct": 2.0, "monthly_payment": 80_000, "remaining_months": 120},
        {"label": "Small", "remaining_amount": 1_000_000, "interest_rate_pct": 2.0, "monthly_payment": 20_000, "remaining_months": 60},
    ]
    result = compute_consolidation(debts, monthly_income=300_000, extra_monthly=0)
    # Snowball: Small → Big
    assert result["snowball_order"][0] == "Small"
    assert result["snowball_order"][1] == "Big"


def test_consolidation_debt_ratio():
    """Debt ratio should be (total_monthly / monthly_income) * 100."""
    debts = [
        {"label": "A", "remaining_amount": 10_000_000, "interest_rate_pct": 2.0, "monthly_payment": 100_000, "remaining_months": 120},
    ]
    result = compute_consolidation(debts, monthly_income=300_000, extra_monthly=0)
    expected_ratio = (100_000 / 300_000) * 100
    assert abs(result["debt_ratio_pct"] - expected_ratio) < 0.1


# ═════════════════════════════════════════════════════════════════
#  CHART DATA
# ═════════════════════════════════════════════════════════════════


def test_chart_data_length():
    """Chart data should have one entry per month."""
    schedule = compute_amortization(
        principal=10_000_000,
        annual_rate_pct=2.0,
        duration_months=60,
        insurance_rate_pct=0.0,
        payment_type="constant_annuity",
        start_date=date(2024, 1, 1),
    )
    data = generate_chart_data([("test_loan", schedule)])
    assert len(data) == 60
    # First month remaining should be close to principal
    assert data[0]["remaining"] < 10_000_000
    # Last month remaining should be near 0
    assert data[-1]["remaining"] <= 100
