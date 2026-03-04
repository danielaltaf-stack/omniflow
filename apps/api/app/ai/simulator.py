"""
OmniFlow — Investment Simulator (Monte-Carlo + Compound Interest).

Simulates investment growth with:
- Compound interest with monthly contributions
- Monte-Carlo simulation (1000 paths, log-normal distribution)
- 3 preset scenarios (conservative, moderate, aggressive)
- Inflation adjustment
"""

from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np

logger = logging.getLogger("omniflow.ai.simulator")


# ── Preset scenarios ─────────────────────────────────────

SCENARIOS = {
    "conservative": {
        "label": "Prudent",
        "annual_return": 0.03,       # 3%
        "annual_volatility": 0.05,   # 5%
        "description": "Fonds euros, obligations, livrets",
        "color": "#06b6d4",          # cyan
    },
    "moderate": {
        "label": "Équilibré",
        "annual_return": 0.07,       # 7%
        "annual_volatility": 0.12,   # 12%
        "description": "ETF diversifiés, mix actions/obligations",
        "color": "#8b5cf6",          # violet
    },
    "aggressive": {
        "label": "Dynamique",
        "annual_return": 0.12,       # 12%
        "annual_volatility": 0.20,   # 20%
        "description": "Actions, crypto, startups",
        "color": "#f59e0b",          # amber
    },
}

DEFAULT_INFLATION = 0.02  # 2% annual
DEFAULT_MONTE_CARLO_PATHS = 1000


def simulate_investment(
    initial_amount: float,
    monthly_contribution: float,
    years: int,
    scenario: str = "moderate",
    custom_return: float | None = None,
    custom_volatility: float | None = None,
    inflation_rate: float = DEFAULT_INFLATION,
    n_paths: int = DEFAULT_MONTE_CARLO_PATHS,
) -> dict[str, Any]:
    """
    Run a full investment simulation.

    Args:
        initial_amount: Starting capital in EUR
        monthly_contribution: Monthly investment in EUR
        years: Investment horizon in years
        scenario: One of 'conservative', 'moderate', 'aggressive'
        custom_return: Override annual return (0-1)
        custom_volatility: Override annual volatility (0-1)
        inflation_rate: Annual inflation rate (default 2%)
        n_paths: Number of Monte-Carlo paths

    Returns:
        Dict with deterministic projections, Monte-Carlo bands,
        and scenario comparison.
    """
    if years < 1:
        years = 1
    if years > 50:
        years = 50

    sc = SCENARIOS.get(scenario, SCENARIOS["moderate"])
    annual_return = custom_return if custom_return is not None else sc["annual_return"]
    annual_vol = custom_volatility if custom_volatility is not None else sc["annual_volatility"]

    months = years * 12

    # ── 1. Deterministic projection (compound interest) ──
    deterministic = _compound_interest(
        initial_amount, monthly_contribution, annual_return, months
    )

    # ── 2. Inflation-adjusted projection ─────────────────
    real_return = (1 + annual_return) / (1 + inflation_rate) - 1
    deterministic_real = _compound_interest(
        initial_amount, monthly_contribution, real_return, months
    )

    # ── 3. Monte-Carlo simulation ─────────────────────────
    mc_result = _monte_carlo(
        initial_amount, monthly_contribution,
        annual_return, annual_vol,
        months, n_paths,
    )

    # ── 4. All three scenarios comparison ────────────────
    scenarios = {}
    for key, sc_data in SCENARIOS.items():
        proj = _compound_interest(
            initial_amount, monthly_contribution,
            sc_data["annual_return"], months,
        )
        # Inflation-adjusted final
        real_ret = (1 + sc_data["annual_return"]) / (1 + inflation_rate) - 1
        real_proj = _compound_interest(
            initial_amount, monthly_contribution, real_ret, months,
        )
        scenarios[key] = {
            "label": sc_data["label"],
            "description": sc_data["description"],
            "color": sc_data["color"],
            "annual_return_pct": round(sc_data["annual_return"] * 100, 1),
            "final_nominal": round(proj[-1]["value"], 2),
            "final_real": round(real_proj[-1]["value"], 2),
            "total_invested": round(initial_amount + monthly_contribution * months, 2),
            "total_gain_nominal": round(
                proj[-1]["value"] - (initial_amount + monthly_contribution * months), 2
            ),
        }

    total_invested = initial_amount + monthly_contribution * months

    return {
        "params": {
            "initial_amount": initial_amount,
            "monthly_contribution": monthly_contribution,
            "years": years,
            "scenario": scenario,
            "annual_return_pct": round(annual_return * 100, 1),
            "annual_volatility_pct": round(annual_vol * 100, 1),
            "inflation_rate_pct": round(inflation_rate * 100, 1),
            "monte_carlo_paths": n_paths,
        },
        "projection": {
            "nominal": _sample_projection(deterministic, months),
            "real": _sample_projection(deterministic_real, months),
        },
        "monte_carlo": mc_result,
        "scenarios": scenarios,
        "summary": {
            "total_invested": round(total_invested, 2),
            "final_value_nominal": round(deterministic[-1]["value"], 2),
            "final_value_real": round(deterministic_real[-1]["value"], 2),
            "total_gain_nominal": round(deterministic[-1]["value"] - total_invested, 2),
            "total_gain_real": round(deterministic_real[-1]["value"] - total_invested, 2),
            "gain_pct": round(
                (deterministic[-1]["value"] - total_invested) / max(1, total_invested) * 100, 1
            ),
            "monte_carlo_median": round(mc_result["percentiles"]["p50"][-1], 2),
            "monte_carlo_best_case": round(mc_result["percentiles"]["p90"][-1], 2),
            "monte_carlo_worst_case": round(mc_result["percentiles"]["p10"][-1], 2),
        },
    }


def _compound_interest(
    initial: float,
    monthly: float,
    annual_return: float,
    months: int,
) -> list[dict[str, Any]]:
    """Calculate compound interest month by month."""
    monthly_rate = (1 + annual_return) ** (1 / 12) - 1
    balance = initial
    result = [{"month": 0, "value": initial, "invested": initial}]

    for m in range(1, months + 1):
        balance = balance * (1 + monthly_rate) + monthly
        result.append({
            "month": m,
            "value": balance,
            "invested": initial + monthly * m,
        })

    return result


def _monte_carlo(
    initial: float,
    monthly: float,
    annual_return: float,
    annual_vol: float,
    months: int,
    n_paths: int,
) -> dict[str, Any]:
    """
    Run Monte-Carlo simulation with log-normal distribution.
    Returns percentile bands (p10, p25, p50, p75, p90) sampled monthly.
    """
    # Monthly params for log-normal
    monthly_mu = annual_return / 12
    monthly_sigma = annual_vol / math.sqrt(12)

    # Drift and diffusion for geometric Brownian motion
    dt = 1.0  # one month
    drift = monthly_mu - 0.5 * monthly_sigma ** 2

    rng = np.random.default_rng(42)  # reproducible
    # Generate all random returns at once: shape (n_paths, months)
    z = rng.normal(0, 1, (n_paths, months))
    log_returns = drift * dt + monthly_sigma * np.sqrt(dt) * z

    # Build paths
    paths = np.zeros((n_paths, months + 1))
    paths[:, 0] = initial

    for m in range(1, months + 1):
        # Growth factor for this month
        growth = np.exp(log_returns[:, m - 1])
        paths[:, m] = paths[:, m - 1] * growth + monthly

    # Sample at reasonable intervals
    if months <= 60:
        sample_indices = list(range(0, months + 1, max(1, months // 30)))
    else:
        sample_indices = list(range(0, months + 1, max(1, months // 40)))
    if months not in sample_indices:
        sample_indices.append(months)

    # Calculate percentiles at sample points
    percentiles = {
        "p10": [],
        "p25": [],
        "p50": [],
        "p75": [],
        "p90": [],
    }
    months_sampled = []

    for idx in sample_indices:
        col = paths[:, idx]
        percentiles["p10"].append(round(float(np.percentile(col, 10)), 2))
        percentiles["p25"].append(round(float(np.percentile(col, 25)), 2))
        percentiles["p50"].append(round(float(np.percentile(col, 50)), 2))
        percentiles["p75"].append(round(float(np.percentile(col, 75)), 2))
        percentiles["p90"].append(round(float(np.percentile(col, 90)), 2))
        months_sampled.append(idx)

    return {
        "months": months_sampled,
        "percentiles": percentiles,
        "paths_count": n_paths,
    }


def _sample_projection(
    full_projection: list[dict[str, Any]],
    total_months: int,
) -> list[dict[str, Any]]:
    """
    Sample the full monthly projection to a reasonable number of points
    for the frontend chart (max ~40 points).
    """
    if total_months <= 60:
        step = max(1, total_months // 30)
    else:
        step = max(1, total_months // 40)

    sampled = full_projection[::step]

    # Always include the last point
    if sampled[-1]["month"] != total_months:
        sampled.append(full_projection[-1])

    return [
        {
            "month": p["month"],
            "value": round(p["value"], 2),
            "invested": round(p["invested"], 2),
        }
        for p in sampled
    ]
