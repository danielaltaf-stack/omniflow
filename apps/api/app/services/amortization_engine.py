"""
OmniFlow — Amortization Engine.
Computes amortization tables, early repayment simulations,
invest-vs-repay comparisons, and debt consolidation analytics.

All amounts in centimes (int). Rates in percent (float).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any


@dataclass
class AmortizationRow:
    """Single row in an amortization schedule."""
    payment_number: int
    date: date | None
    total: int  # centimes
    principal: int  # centimes
    interest: int  # centimes
    insurance: int  # centimes
    remaining: int  # centimes


@dataclass
class AmortizationResult:
    """Full amortization schedule with summary metrics."""
    rows: list[AmortizationRow]
    total_interest: int  # centimes
    total_insurance: int  # centimes
    total_cost: int  # centimes (interest + insurance)
    total_paid: int  # centimes (capital + interest + insurance)
    end_date: date | None


@dataclass
class EarlyRepaymentScenario:
    """Result of an early repayment simulation."""
    name: str  # "reduced_duration" or "reduced_payment"
    new_monthly_payment: int  # centimes
    new_duration_months: int
    new_end_date: date | None
    interest_saved: int  # centimes
    penalty_amount: int  # centimes (IRA)
    net_savings: int  # centimes (interest_saved - penalty)


@dataclass
class EarlyRepaymentResult:
    """Both scenarios + reference values."""
    current_remaining: int
    repayment_amount: int
    at_month: int
    reduced_duration: EarlyRepaymentScenario
    reduced_payment: EarlyRepaymentScenario


@dataclass
class InvestVsRepayResult:
    """Comparison between investing surplus vs early repayment."""
    amount: int  # centimes
    return_rate_pct: float
    horizon_months: int
    # Invest scenario
    invest_gross_value: int  # centimes
    invest_gross_gain: int  # centimes
    invest_tax: int  # centimes (flat tax 30%)
    invest_net_gain: int  # centimes
    # Repay scenario
    repay_interest_saved: int  # centimes
    repay_penalty: int  # centimes
    repay_net_gain: int  # centimes
    # Verdict
    verdict: str  # "invest" or "repay"
    advantage: int  # centimes (absolute difference)


# ─────────────────────────────────────────────────────────────
# Core Amortization Computations
# ─────────────────────────────────────────────────────────────


def compute_amortization(
    *,
    principal: int,
    annual_rate_pct: float,
    duration_months: int,
    payment_type: str = "constant_annuity",
    insurance_rate_pct: float = 0.0,
    start_date: date | None = None,
) -> AmortizationResult:
    """
    Compute a full amortization schedule.

    Args:
        principal: Initial loan amount in centimes.
        annual_rate_pct: Annual nominal interest rate in percent (e.g. 2.1).
        duration_months: Total number of monthly payments.
        payment_type: One of constant_annuity, constant_amortization, in_fine, deferred.
        insurance_rate_pct: Annual insurance rate in percent.
        start_date: First payment date (optional, for date generation).

    Returns:
        AmortizationResult with rows and summary.
    """
    if duration_months <= 0:
        return AmortizationResult(rows=[], total_interest=0, total_insurance=0, total_cost=0, total_paid=0, end_date=start_date)

    monthly_rate = annual_rate_pct / 100 / 12
    monthly_insurance_amount = int(round(principal * (insurance_rate_pct / 100) / 12))

    if payment_type == "constant_annuity":
        return _amortize_constant_annuity(principal, monthly_rate, duration_months, monthly_insurance_amount, start_date)
    elif payment_type == "constant_amortization":
        return _amortize_constant_principal(principal, monthly_rate, duration_months, monthly_insurance_amount, start_date)
    elif payment_type == "in_fine":
        return _amortize_in_fine(principal, monthly_rate, duration_months, monthly_insurance_amount, start_date)
    elif payment_type == "deferred":
        # Deferred: first 1/4 of duration is grace (interest-only), then constant annuity
        grace_months = max(1, duration_months // 4)
        return _amortize_deferred(principal, monthly_rate, duration_months, grace_months, monthly_insurance_amount, start_date)
    else:
        return _amortize_constant_annuity(principal, monthly_rate, duration_months, monthly_insurance_amount, start_date)


def _next_month(d: date | None, months: int) -> date | None:
    """Advance date by N months."""
    if d is None:
        return None
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                       31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def _amortize_constant_annuity(
    principal: int,
    monthly_rate: float,
    duration_months: int,
    monthly_insurance: int,
    start_date: date | None,
) -> AmortizationResult:
    """French-style: fixed total payment, decreasing interest."""
    rows: list[AmortizationRow] = []
    remaining = principal
    total_interest = 0
    total_insurance = 0

    if monthly_rate > 0:
        # M = C × r / (1 - (1+r)^(-n))
        monthly_payment = int(round(
            principal * monthly_rate / (1 - math.pow(1 + monthly_rate, -duration_months))
        ))
    else:
        monthly_payment = int(round(principal / duration_months))

    for i in range(1, duration_months + 1):
        interest = int(round(remaining * monthly_rate))
        principal_part = monthly_payment - interest

        # Last payment adjustment to clear remaining
        if i == duration_months:
            principal_part = remaining
            interest = int(round(remaining * monthly_rate))

        remaining = max(0, remaining - principal_part)
        insurance = monthly_insurance if remaining > 0 or i == duration_months else 0
        total = principal_part + interest + insurance

        total_interest += interest
        total_insurance += insurance

        rows.append(AmortizationRow(
            payment_number=i,
            date=_next_month(start_date, i - 1),
            total=total,
            principal=principal_part,
            interest=interest,
            insurance=insurance,
            remaining=remaining,
        ))

    return AmortizationResult(
        rows=rows,
        total_interest=total_interest,
        total_insurance=total_insurance,
        total_cost=total_interest + total_insurance,
        total_paid=principal + total_interest + total_insurance,
        end_date=_next_month(start_date, duration_months - 1) if start_date else None,
    )


def _amortize_constant_principal(
    principal: int,
    monthly_rate: float,
    duration_months: int,
    monthly_insurance: int,
    start_date: date | None,
) -> AmortizationResult:
    """German-style: fixed principal portion, decreasing payments."""
    rows: list[AmortizationRow] = []
    remaining = principal
    total_interest = 0
    total_insurance = 0
    fixed_principal = int(round(principal / duration_months))

    for i in range(1, duration_months + 1):
        interest = int(round(remaining * monthly_rate))
        p = fixed_principal if i < duration_months else remaining
        remaining = max(0, remaining - p)
        insurance = monthly_insurance
        total = p + interest + insurance

        total_interest += interest
        total_insurance += insurance

        rows.append(AmortizationRow(
            payment_number=i,
            date=_next_month(start_date, i - 1),
            total=total,
            principal=p,
            interest=interest,
            insurance=insurance,
            remaining=remaining,
        ))

    return AmortizationResult(
        rows=rows,
        total_interest=total_interest,
        total_insurance=total_insurance,
        total_cost=total_interest + total_insurance,
        total_paid=principal + total_interest + total_insurance,
        end_date=_next_month(start_date, duration_months - 1) if start_date else None,
    )


def _amortize_in_fine(
    principal: int,
    monthly_rate: float,
    duration_months: int,
    monthly_insurance: int,
    start_date: date | None,
) -> AmortizationResult:
    """In fine: interest-only payments, capital at maturity."""
    rows: list[AmortizationRow] = []
    remaining = principal
    total_interest = 0
    total_insurance = 0

    for i in range(1, duration_months + 1):
        interest = int(round(remaining * monthly_rate))
        p = principal if i == duration_months else 0
        if i == duration_months:
            remaining = 0
        insurance = monthly_insurance
        total = p + interest + insurance

        total_interest += interest
        total_insurance += insurance

        rows.append(AmortizationRow(
            payment_number=i,
            date=_next_month(start_date, i - 1),
            total=total,
            principal=p,
            interest=interest,
            insurance=insurance,
            remaining=remaining if i < duration_months else 0,
        ))

    return AmortizationResult(
        rows=rows,
        total_interest=total_interest,
        total_insurance=total_insurance,
        total_cost=total_interest + total_insurance,
        total_paid=principal + total_interest + total_insurance,
        end_date=_next_month(start_date, duration_months - 1) if start_date else None,
    )


def _amortize_deferred(
    principal: int,
    monthly_rate: float,
    duration_months: int,
    grace_months: int,
    monthly_insurance: int,
    start_date: date | None,
) -> AmortizationResult:
    """Deferred: grace period (interest-only), then constant annuity."""
    rows: list[AmortizationRow] = []
    remaining = principal
    total_interest = 0
    total_insurance = 0

    # Grace period: interest-only
    for i in range(1, grace_months + 1):
        interest = int(round(remaining * monthly_rate))
        insurance = monthly_insurance
        total = interest + insurance
        total_interest += interest
        total_insurance += insurance
        rows.append(AmortizationRow(
            payment_number=i,
            date=_next_month(start_date, i - 1),
            total=total,
            principal=0,
            interest=interest,
            insurance=insurance,
            remaining=remaining,
        ))

    # Amortization phase: constant annuity on remaining months
    amort_months = duration_months - grace_months
    if amort_months > 0 and monthly_rate > 0:
        monthly_payment = int(round(
            remaining * monthly_rate / (1 - math.pow(1 + monthly_rate, -amort_months))
        ))
    elif amort_months > 0:
        monthly_payment = int(round(remaining / amort_months))
    else:
        monthly_payment = remaining

    for j in range(1, amort_months + 1):
        i = grace_months + j
        interest = int(round(remaining * monthly_rate))
        principal_part = monthly_payment - interest
        if j == amort_months:
            principal_part = remaining
        remaining = max(0, remaining - principal_part)
        insurance = monthly_insurance
        total = principal_part + interest + insurance
        total_interest += interest
        total_insurance += insurance
        rows.append(AmortizationRow(
            payment_number=i,
            date=_next_month(start_date, i - 1),
            total=total,
            principal=principal_part,
            interest=interest,
            insurance=insurance,
            remaining=remaining,
        ))

    return AmortizationResult(
        rows=rows,
        total_interest=total_interest,
        total_insurance=total_insurance,
        total_cost=total_interest + total_insurance,
        total_paid=principal + total_interest + total_insurance,
        end_date=_next_month(start_date, duration_months - 1) if start_date else None,
    )


# ─────────────────────────────────────────────────────────────
# Early Repayment Simulation
# ─────────────────────────────────────────────────────────────


def simulate_early_repayment(
    *,
    principal: int,
    remaining_amount: int,
    annual_rate_pct: float,
    duration_months: int,
    insurance_rate_pct: float = 0.0,
    monthly_payment: int,
    early_repayment_fee_pct: float = 3.0,
    repayment_amount: int,
    at_month: int,
    start_date: date | None = None,
    payment_type: str = "constant_annuity",
) -> EarlyRepaymentResult:
    """
    Simulate early repayment with two scenarios:
    1) Reduced duration (keep same monthly payment)
    2) Reduced payment (keep same duration)

    Returns both scenarios with savings comparison.
    """
    monthly_rate = annual_rate_pct / 100 / 12

    # Compute total interest without early repayment (baseline)
    baseline = compute_amortization(
        principal=remaining_amount,
        annual_rate_pct=annual_rate_pct,
        duration_months=max(1, duration_months - at_month),
        payment_type=payment_type,
        insurance_rate_pct=insurance_rate_pct,
        start_date=_next_month(start_date, at_month) if start_date else None,
    )
    baseline_interest = baseline.total_interest

    # Amount after early repayment
    new_remaining = max(0, remaining_amount - repayment_amount)

    # IRA (Indemnité de Remboursement Anticipé) — French law L.312-34
    six_months_interest = int(round(remaining_amount * monthly_rate * 6))
    three_pct_crd = int(round(remaining_amount * early_repayment_fee_pct / 100))
    penalty = min(six_months_interest, three_pct_crd)

    # ── Scenario 1: Reduced duration, same monthly payment ───
    if new_remaining <= 0:
        reduced_dur = EarlyRepaymentScenario(
            name="reduced_duration",
            new_monthly_payment=0,
            new_duration_months=0,
            new_end_date=_next_month(start_date, at_month) if start_date else None,
            interest_saved=baseline_interest,
            penalty_amount=penalty,
            net_savings=baseline_interest - penalty,
        )
    else:
        # How many months to repay new_remaining at the same monthly payment?
        if monthly_rate > 0 and monthly_payment > int(round(new_remaining * monthly_rate)):
            new_dur = math.ceil(
                -math.log(1 - (new_remaining * monthly_rate) / monthly_payment) / math.log(1 + monthly_rate)
            )
        else:
            new_dur = math.ceil(new_remaining / max(1, monthly_payment)) if monthly_payment > 0 else max(1, duration_months - at_month)

        new_dur = max(1, new_dur)
        amort_reduced = compute_amortization(
            principal=new_remaining,
            annual_rate_pct=annual_rate_pct,
            duration_months=new_dur,
            payment_type=payment_type,
            insurance_rate_pct=insurance_rate_pct,
            start_date=_next_month(start_date, at_month) if start_date else None,
        )
        interest_saved = baseline_interest - amort_reduced.total_interest

        reduced_dur = EarlyRepaymentScenario(
            name="reduced_duration",
            new_monthly_payment=monthly_payment,
            new_duration_months=at_month + new_dur,
            new_end_date=_next_month(start_date, at_month + new_dur - 1) if start_date else None,
            interest_saved=interest_saved,
            penalty_amount=penalty,
            net_savings=interest_saved - penalty,
        )

    # ── Scenario 2: Reduced payment, same duration ───────────
    remaining_months = max(1, duration_months - at_month)
    if new_remaining <= 0:
        reduced_pay = EarlyRepaymentScenario(
            name="reduced_payment",
            new_monthly_payment=0,
            new_duration_months=at_month,
            new_end_date=_next_month(start_date, at_month) if start_date else None,
            interest_saved=baseline_interest,
            penalty_amount=penalty,
            net_savings=baseline_interest - penalty,
        )
    else:
        amort_reduced_pay = compute_amortization(
            principal=new_remaining,
            annual_rate_pct=annual_rate_pct,
            duration_months=remaining_months,
            payment_type=payment_type,
            insurance_rate_pct=insurance_rate_pct,
            start_date=_next_month(start_date, at_month) if start_date else None,
        )
        interest_saved_pay = baseline_interest - amort_reduced_pay.total_interest
        new_mp = amort_reduced_pay.rows[0].total if amort_reduced_pay.rows else 0

        reduced_pay = EarlyRepaymentScenario(
            name="reduced_payment",
            new_monthly_payment=new_mp,
            new_duration_months=duration_months,
            new_end_date=_next_month(start_date, duration_months - 1) if start_date else None,
            interest_saved=interest_saved_pay,
            penalty_amount=penalty,
            net_savings=interest_saved_pay - penalty,
        )

    return EarlyRepaymentResult(
        current_remaining=remaining_amount,
        repayment_amount=repayment_amount,
        at_month=at_month,
        reduced_duration=reduced_dur,
        reduced_payment=reduced_pay,
    )


# ─────────────────────────────────────────────────────────────
# Invest vs Repay Comparison
# ─────────────────────────────────────────────────────────────


def compare_invest_vs_repay(
    *,
    amount: int,
    remaining_amount: int,
    annual_rate_pct: float,
    duration_months: int,
    monthly_payment: int,
    early_repayment_fee_pct: float = 3.0,
    return_rate_pct: float = 7.0,
    flat_tax_pct: float = 30.0,
    insurance_rate_pct: float = 0.0,
    payment_type: str = "constant_annuity",
    start_date: date | None = None,
) -> InvestVsRepayResult:
    """
    Compare investing the surplus vs using it for early repayment.
    Includes flat tax on investment gains (30% in France).
    """
    monthly_rate = annual_rate_pct / 100 / 12
    horizon = duration_months  # Compare over entire loan duration

    # ── Invest scenario ──────────────────────────────────
    annual_return = return_rate_pct / 100
    monthly_return = (1 + annual_return) ** (1 / 12) - 1
    # Compound growth: FV = PV × (1 + r_monthly)^n
    invest_fv = int(round(amount * math.pow(1 + monthly_return, horizon)))
    invest_gross_gain = invest_fv - amount
    invest_tax = int(round(invest_gross_gain * flat_tax_pct / 100))
    invest_net_gain = invest_gross_gain - invest_tax

    # ── Repay scenario ───────────────────────────────────
    sim = simulate_early_repayment(
        principal=remaining_amount,
        remaining_amount=remaining_amount,
        annual_rate_pct=annual_rate_pct,
        duration_months=duration_months,
        insurance_rate_pct=insurance_rate_pct,
        monthly_payment=monthly_payment,
        early_repayment_fee_pct=early_repayment_fee_pct,
        repayment_amount=amount,
        at_month=0,
        start_date=start_date,
        payment_type=payment_type,
    )
    # Use the best scenario (reduced duration typically saves more)
    best = sim.reduced_duration if sim.reduced_duration.net_savings >= sim.reduced_payment.net_savings else sim.reduced_payment

    if invest_net_gain > best.net_savings:
        verdict = "invest"
        advantage = invest_net_gain - best.net_savings
    else:
        verdict = "repay"
        advantage = best.net_savings - invest_net_gain

    return InvestVsRepayResult(
        amount=amount,
        return_rate_pct=return_rate_pct,
        horizon_months=horizon,
        invest_gross_value=invest_fv,
        invest_gross_gain=invest_gross_gain,
        invest_tax=invest_tax,
        invest_net_gain=invest_net_gain,
        repay_interest_saved=best.interest_saved,
        repay_penalty=best.penalty_amount,
        repay_net_gain=best.net_savings,
        verdict=verdict,
        advantage=advantage,
    )


# ─────────────────────────────────────────────────────────────
# Debt Consolidation Analytics
# ─────────────────────────────────────────────────────────────


def compute_consolidation(
    debts: list[dict[str, Any]],
    monthly_income: int = 0,
    extra_monthly: int = 0,
) -> dict[str, Any]:
    """
    Compute consolidated debt analytics.

    Args:
        debts: List of dicts with remaining_amount, interest_rate_pct, monthly_payment, duration_months, label.
        monthly_income: Monthly income in centimes (for ratio calculation).
        extra_monthly: Extra monthly budget available for accelerated payoff (centimes).

    Returns:
        Consolidation analytics with avalanche & snowball strategies.
    """
    if not debts:
        return {
            "total_remaining": 0,
            "total_monthly": 0,
            "weighted_avg_rate": 0.0,
            "debt_ratio_pct": 0.0,
            "debts_count": 0,
            "last_end_month": 0,
            "avalanche_order": [],
            "snowball_order": [],
            "months_saved_with_extra": 0,
        }

    total_remaining = sum(d["remaining_amount"] for d in debts)
    total_monthly = sum(d["monthly_payment"] for d in debts)

    # Weighted average rate
    if total_remaining > 0:
        weighted_avg_rate = sum(
            d["interest_rate_pct"] * d["remaining_amount"] for d in debts
        ) / total_remaining
    else:
        weighted_avg_rate = 0.0

    # Debt ratio
    debt_ratio_pct = (total_monthly / monthly_income * 100) if monthly_income > 0 else 0.0

    # Last end date (max across all debts)
    max_remaining_months = max((d.get("remaining_months", d.get("duration_months", 0)) for d in debts), default=0)

    # Avalanche strategy: highest rate first
    avalanche_order = sorted(debts, key=lambda d: -d["interest_rate_pct"])

    # Snowball strategy: smallest balance first
    snowball_order = sorted(debts, key=lambda d: d["remaining_amount"])

    # Estimate months saved with extra payment
    months_saved = 0
    if extra_monthly > 0 and total_remaining > 0:
        # Simplified: apply extra to highest-rate debt first (avalanche)
        # Recompute payoff time with the extra budget
        sim_debts = sorted(debts, key=lambda d: -d["interest_rate_pct"])
        original_months = max_remaining_months
        new_months = _simulate_payoff_with_extra(sim_debts, extra_monthly)
        months_saved = max(0, original_months - new_months)

    return {
        "total_remaining": total_remaining,
        "total_monthly": total_monthly,
        "weighted_avg_rate": round(weighted_avg_rate, 2),
        "debt_ratio_pct": round(debt_ratio_pct, 1),
        "debts_count": len(debts),
        "last_end_month": max_remaining_months,
        "avalanche_order": [d.get("label", d.get("id", "")) for d in avalanche_order],
        "snowball_order": [d.get("label", d.get("id", "")) for d in snowball_order],
        "months_saved_with_extra": months_saved,
    }


def _simulate_payoff_with_extra(debts: list[dict], extra: int) -> int:
    """Simulate avalanche payoff with extra monthly budget. Returns total months."""
    # Deep copy remaining amounts
    remaining = [d["remaining_amount"] for d in debts]
    rates = [d["interest_rate_pct"] / 100 / 12 for d in debts]
    payments = [d["monthly_payment"] for d in debts]

    month = 0
    max_months = 600  # Safety: 50 years max

    while any(r > 0 for r in remaining) and month < max_months:
        month += 1
        extra_left = extra

        for i in range(len(debts)):
            if remaining[i] <= 0:
                continue
            interest = int(round(remaining[i] * rates[i]))
            payment = payments[i] + extra_left
            principal = min(remaining[i], payment - interest)
            remaining[i] = max(0, remaining[i] - principal)

            if remaining[i] == 0:
                # Freed-up payment cascades to next debt
                extra_left += payments[i]
            else:
                extra_left = 0
                break

    return month


# ─────────────────────────────────────────────────────────────
# Chart Data Generator
# ─────────────────────────────────────────────────────────────


def generate_chart_data(
    debts_with_schedules: list[tuple[str, AmortizationResult]],
    max_months: int = 360,
) -> list[dict[str, Any]]:
    """
    Generate chart-friendly data for all debts stacked.
    Returns monthly data points with principal/interest/insurance breakdown.
    """
    if not debts_with_schedules:
        return []

    # Find the max duration across all debts
    max_rows = min(max_months, max(len(s.rows) for _, s in debts_with_schedules))

    chart: list[dict[str, Any]] = []
    for month_idx in range(max_rows):
        point: dict[str, Any] = {"month": month_idx + 1}
        total_principal = 0
        total_interest = 0
        total_insurance = 0
        total_remaining = 0

        for label, schedule in debts_with_schedules:
            if month_idx < len(schedule.rows):
                row = schedule.rows[month_idx]
                total_principal += row.principal
                total_interest += row.interest
                total_insurance += row.insurance
                total_remaining += row.remaining
                if row.date:
                    point["date"] = row.date.isoformat()

        point["principal"] = total_principal
        point["interest"] = total_interest
        point["insurance"] = total_insurance
        point["remaining"] = total_remaining
        chart.append(point)

    return chart
