"""
OmniFlow — Retirement & FIRE Simulation Engine (Phase C1).

Monte-Carlo simulation with:
  - 6 asset classes (stocks, bonds, real_estate, crypto, savings, cash)
  - Log-normal return model per class
  - Accumulation + Decumulation phases
  - Pension CNAV (French system) integration
  - FIRE Number, Coast FIRE, Lean/Fat FIRE, dynamic SWR
  - Optimization levers (extra savings, earlier retirement)

All monetary values in centimes (int).  Rates in percent (float).
"""

from __future__ import annotations

import logging
import math
import random
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.crypto_holding import CryptoHolding
from app.models.crypto_wallet import CryptoWallet
from app.models.debt import Debt
from app.models.real_estate import RealEstateProperty
from app.models.retirement_simulation import DEFAULT_ASSET_RETURNS, RetirementProfile
from app.models.stock_portfolio import StockPortfolio
from app.models.stock_position import StockPosition

logger = logging.getLogger("omniflow.retirement_engine")


# ── Constants ─────────────────────────────────────────────────

REQUIRED_QUARTERS_FULL_RATE = 172  # born >= 1973
LEGAL_RETIREMENT_AGE = 64  # post-reform 2023
COMPLEMENTARY_RATIO = 0.25  # AGIRC-ARRCO ≈ 25% of last salary
FIRE_SWR_BASE = 0.04  # 4% rule
SWR_MIN = 0.03
SWR_MAX = 0.05


# ── Dataclasses ───────────────────────────────────────────────

@dataclass
class YearProjectionData:
    age: int
    year: int
    values: list[int]  # one patrimoine value per simulation path
    is_accumulation: bool
    pension_income: int = 0  # centimes
    withdrawal: int = 0  # centimes


@dataclass
class SimulationResult:
    serie_by_age: list[YearProjectionData]
    fire_ages: list[int | None]  # one per path
    ruin_ages: list[int | None]  # one per path
    final_patrimoines: list[int]  # one per path
    patrimoine_at_retirement: list[int]


@dataclass
class PatrimoineSnapshot:
    total: int  # centimes
    stocks: int = 0
    bonds: int = 0
    real_estate: int = 0
    crypto: int = 0
    savings: int = 0
    cash: int = 0


# ── Patrimoine Collection ─────────────────────────────────────

async def collect_patrimoine(
    db: AsyncSession,
    user_id: UUID,
    include_real_estate: bool = True,
) -> PatrimoineSnapshot:
    """
    Fetch current patrimoine from ALL asset classes, grouped into
    the 6 retirement model classes.
    """
    snap = PatrimoineSnapshot(total=0)

    # ── Bank accounts ──────────────────────────────────────
    result = await db.execute(
        select(Account.type, func.sum(Account.balance))
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
        .group_by(Account.type)
    )
    for row in result.all():
        acc_type, balance_sum = row[0], int(row[1] or 0)
        if acc_type in ("checking",):
            snap.cash += balance_sum
        elif acc_type in ("savings", "deposit", "life_insurance"):
            snap.savings += balance_sum
        elif acc_type in ("market", "pea"):
            snap.stocks += balance_sum
        elif acc_type in ("loan", "mortgage", "credit"):
            # Negative — handled by debts below
            pass

    # ── Stocks ─────────────────────────────────────────────
    result = await db.execute(
        select(func.sum(StockPosition.value))
        .join(StockPortfolio, StockPosition.portfolio_id == StockPortfolio.id)
        .where(StockPortfolio.user_id == user_id)
    )
    stock_val = int(result.scalar() or 0)
    snap.stocks += stock_val

    # ── Crypto ─────────────────────────────────────────────
    result = await db.execute(
        select(func.sum(CryptoHolding.value))
        .join(CryptoWallet, CryptoHolding.wallet_id == CryptoWallet.id)
        .where(CryptoWallet.user_id == user_id)
    )
    snap.crypto = int(result.scalar() or 0)

    # ── Real estate ────────────────────────────────────────
    if include_real_estate:
        result = await db.execute(
            select(func.sum(RealEstateProperty.current_value))
            .where(RealEstateProperty.user_id == user_id)
        )
        snap.real_estate = int(result.scalar() or 0)

    # ── Debts (subtract from total) ────────────────────────
    result = await db.execute(
        select(func.sum(Debt.remaining_amount))
        .where(Debt.user_id == user_id)
    )
    debt_total = int(result.scalar() or 0)

    snap.total = (
        snap.cash + snap.savings + snap.stocks
        + snap.crypto + snap.real_estate - debt_total
    )

    return snap


# ── Pension CNAV Estimate ─────────────────────────────────────

def estimate_pension_cnav(
    monthly_income: int,
    quarters_acquired: int,
) -> int:
    """
    Simplified French pension estimate (CNAV + AGIRC-ARRCO).
    Returns monthly pension in centimes.
    """
    if monthly_income <= 0:
        return 0

    annual_income = monthly_income * 12
    # SAM = Salaire Annuel Moyen (simplified: use current annual)
    sam = annual_income

    # Base CNAV: 50% of SAM prorated by quarters
    quarter_ratio = min(quarters_acquired / REQUIRED_QUARTERS_FULL_RATE, 1.0)
    base_pension_annual = int(sam * 0.50 * quarter_ratio)

    # AGIRC-ARRCO complementary ≈ 25% of salary
    complementary_annual = int(annual_income * COMPLEMENTARY_RATIO * quarter_ratio)

    total_annual = base_pension_annual + complementary_annual
    return max(total_annual // 12, 0)


# ── FIRE Calculations ─────────────────────────────────────────

def compute_fire_number(annual_expenses: int) -> int:
    """FIRE Number = annual expenses / 4% = annual expenses × 25."""
    return int(annual_expenses / FIRE_SWR_BASE) if annual_expenses > 0 else 0


def compute_coast_fire(
    fire_number: int,
    mean_return_pct: float,
    years_to_retirement: int,
) -> int:
    """Coast FIRE = FIRE Number / (1 + r)^years."""
    if years_to_retirement <= 0 or mean_return_pct <= 0:
        return fire_number
    r = mean_return_pct / 100.0
    return int(fire_number / ((1 + r) ** years_to_retirement))


def compute_swr_dynamic(
    patrimoine: int,
    annual_expenses: int,
    age: int,
    portfolio_std_pct: float,
) -> float:
    """Dynamic SWR — adjusts the base 4% based on context."""
    swr = 0.03  # base conservative

    if annual_expenses > 0:
        ratio = patrimoine / annual_expenses
        if ratio > 33:
            swr += 0.005  # very comfortable
        elif ratio > 25:
            swr += 0.003

    if age > 75:
        swr += 0.005  # shorter horizon
    elif age > 70:
        swr += 0.003

    if portfolio_std_pct < 10:
        swr += 0.003  # low volatility

    return min(max(swr, SWR_MIN), SWR_MAX)


# ── Monte-Carlo Engine ────────────────────────────────────────

def _weighted_portfolio_stats(
    snap: PatrimoineSnapshot,
    asset_returns: dict[str, dict],
) -> tuple[float, float]:
    """
    Compute portfolio weighted mean return and std dev.
    Returns (mean_pct, std_pct).
    """
    classes = {
        "stocks": snap.stocks,
        "bonds": snap.bonds,
        "real_estate": snap.real_estate,
        "crypto": snap.crypto,
        "savings": snap.savings,
        "cash": snap.cash,
    }

    total = sum(max(v, 0) for v in classes.values())
    if total <= 0:
        # Default balanced when no portfolio
        return 5.0, 12.0

    weights: dict[str, float] = {}
    for k, v in classes.items():
        weights[k] = max(v, 0) / total

    ar = {**DEFAULT_ASSET_RETURNS, **(asset_returns or {})}

    mu = sum(weights[k] * ar.get(k, {"mean": 3.0})["mean"] for k in weights)
    var = sum(weights[k] ** 2 * ar.get(k, {"std": 10.0})["std"] ** 2 for k in weights)
    sigma = math.sqrt(var)

    return mu, sigma


def _sample_return(mean_pct: float, std_pct: float) -> float:
    """Sample a log-normal annual return."""
    mu = mean_pct / 100.0
    sigma = std_pct / 100.0
    if sigma <= 0:
        return mu
    # Log-normal: R = exp(μ - σ²/2 + σZ) - 1
    log_mu = math.log(1 + mu) - 0.5 * sigma ** 2
    z = random.gauss(0, 1)
    return math.exp(log_mu + sigma * z) - 1


def run_monte_carlo(
    patrimoine_initial: int,
    monthly_savings: int,
    extra_monthly_savings: int,
    annual_expenses: int,
    pension_monthly: int,
    current_age: int,
    retirement_age: int,
    life_expectancy: int,
    inflation_rate_pct: float,
    portfolio_mean_pct: float,
    portfolio_std_pct: float,
    debt_end_events: list[tuple[int, int]],  # (year, freed_monthly_centimes)
    num_simulations: int = 1000,
) -> SimulationResult:
    """
    Run Monte-Carlo retirement simulation.

    Args:
        patrimoine_initial: current net worth in centimes
        monthly_savings: base monthly savings in centimes
        extra_monthly_savings: additional savings to test (centimes)
        annual_expenses: target annual spending in centimes
        pension_monthly: estimated monthly pension in centimes
        current_age: current age
        retirement_age: target retirement age
        life_expectancy: assumed death age
        inflation_rate_pct: annual inflation (percent)
        portfolio_mean_pct: portfolio weighted mean return (percent)
        portfolio_std_pct: portfolio weighted std dev (percent)
        debt_end_events: [(year, freed_amount_monthly)] when debts end
        num_simulations: number of paths
    """
    fire_number = compute_fire_number(annual_expenses)
    current_year = date.today().year
    inflation = inflation_rate_pct / 100.0

    # Retirement-phase portfolio (more conservative)
    ret_mean = portfolio_mean_pct * 0.6  # shift toward bonds/savings
    ret_std = portfolio_std_pct * 0.5

    # Pre-compute debt events by year
    debt_events: dict[int, int] = {}
    for yr, freed in debt_end_events:
        debt_events[yr] = debt_events.get(yr, 0) + freed

    ages = list(range(current_age, life_expectancy + 1))
    n_years = len(ages)

    # Initialize result containers
    all_paths: list[list[int]] = []
    fire_ages: list[int | None] = []
    ruin_ages: list[int | None] = []
    final_patrimoines: list[int] = []
    retirement_patrimoines: list[int] = []

    total_savings = monthly_savings + extra_monthly_savings

    for _sim in range(num_simulations):
        path: list[int] = []
        p = patrimoine_initial
        savings = total_savings
        fire_age: int | None = None
        ruin_age: int | None = None
        patrimoine_at_ret = 0

        for i, age in enumerate(ages):
            year = current_year + (age - current_age)

            # Debt end events: freed monthly payment → add to savings
            if year in debt_events and age < retirement_age:
                savings += debt_events[year]

            is_accumulation = age < retirement_age

            if is_accumulation:
                # ── Accumulation phase ────────────
                ret = _sample_return(portfolio_mean_pct, portfolio_std_pct)
                p = int(p * (1 + ret))
                # Savings grow with inflation to maintain real value
                inflation_factor = (1 + inflation) ** (age - current_age)
                annual_savings = int(savings * 12 * inflation_factor)
                p += annual_savings

                if age == retirement_age - 1:
                    patrimoine_at_ret = p
            else:
                # ── Decumulation phase ────────────
                ret = _sample_return(ret_mean, ret_std)
                p = int(p * (1 + ret))

                # Withdrawal = target lifestyle - pension (adjusted for inflation)
                inflation_factor = (1 + inflation) ** (age - current_age)
                annual_withdrawal = int(
                    (annual_expenses * (1 + inflation) ** (age - current_age))
                    - (pension_monthly * 12 * inflation_factor)
                )
                annual_withdrawal = max(annual_withdrawal, 0)
                p -= annual_withdrawal

                if age == retirement_age:
                    patrimoine_at_ret = max(p, 0)

            # Check FIRE condition
            if fire_age is None and p > 0:
                annual_exp_inflated = int(annual_expenses * (1 + inflation) ** (age - current_age))
                if annual_exp_inflated > 0 and p >= annual_exp_inflated * 25:
                    fire_age = age

            # Check ruin
            if p <= 0 and ruin_age is None:
                ruin_age = age
                p = 0

            path.append(max(p, 0))

        all_paths.append(path)
        fire_ages.append(fire_age)
        ruin_ages.append(ruin_age)
        final_patrimoines.append(path[-1] if path else 0)
        retirement_patrimoines.append(patrimoine_at_ret)

    # Build series by age with percentiles
    serie: list[YearProjectionData] = []
    for i, age in enumerate(ages):
        values = [all_paths[s][i] for s in range(num_simulations)]
        is_acc = age < retirement_age

        pension_income = 0
        withdrawal = 0
        if not is_acc:
            inflation_factor = (1 + inflation) ** (age - current_age)
            pension_income = int(pension_monthly * 12 * inflation_factor)
            withdrawal = max(
                int(annual_expenses * inflation_factor) - pension_income,
                0,
            )

        serie.append(YearProjectionData(
            age=age,
            year=current_year + (age - current_age),
            values=values,
            is_accumulation=is_acc,
            pension_income=pension_income,
            withdrawal=withdrawal,
        ))

    return SimulationResult(
        serie_by_age=serie,
        fire_ages=fire_ages,
        ruin_ages=ruin_ages,
        final_patrimoines=final_patrimoines,
        patrimoine_at_retirement=retirement_patrimoines,
    )


def _percentile(values: list[int], pct: float) -> int:
    """Compute percentile from sorted list of ints."""
    if not values:
        return 0
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * (pct / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_v) - 1)
    d = k - f
    return int(sorted_v[f] + d * (sorted_v[c] - sorted_v[f]))


# ── Public API ────────────────────────────────────────────────

async def get_or_create_profile(
    db: AsyncSession,
    user_id: UUID,
) -> RetirementProfile:
    """Get or create a default retirement profile for the user."""
    result = await db.execute(
        select(RetirementProfile).where(RetirementProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = RetirementProfile(
            user_id=user_id,
            birth_year=1990,
            target_retirement_age=64,
            current_monthly_income=0,
            current_monthly_expenses=0,
            monthly_savings=0,
            pension_quarters_acquired=0,
            target_lifestyle_pct=80.0,
            inflation_rate_pct=2.0,
            life_expectancy=90,
            include_real_estate=True,
            asset_returns=DEFAULT_ASSET_RETURNS,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def update_profile(
    db: AsyncSession,
    user_id: UUID,
    data: dict[str, Any],
) -> RetirementProfile:
    """Update retirement profile fields."""
    profile = await get_or_create_profile(db, user_id)
    for key, value in data.items():
        if value is not None and hasattr(profile, key):
            setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile


async def simulate(
    db: AsyncSession,
    user_id: UUID,
    extra_monthly_savings: int = 0,
    num_simulations: int = 1000,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run a full Monte-Carlo retirement simulation.
    Returns structured dict matching SimulationResponse schema.
    """
    profile = await get_or_create_profile(db, user_id)
    snap = await collect_patrimoine(db, user_id, profile.include_real_estate)

    current_year = date.today().year
    current_age = current_year - profile.birth_year

    retirement_age = overrides.get("retirement_age", profile.target_retirement_age) if overrides else profile.target_retirement_age
    monthly_savings = overrides.get("monthly_savings", profile.monthly_savings) if overrides else profile.monthly_savings
    inflation_rate = overrides.get("inflation_rate", profile.inflation_rate_pct) if overrides else profile.inflation_rate_pct

    # Pension estimate
    pension_monthly = profile.pension_estimate_monthly
    if overrides and "pension_estimate" in overrides and overrides["pension_estimate"] is not None:
        pension_monthly = overrides["pension_estimate"]
    if pension_monthly is None or pension_monthly <= 0:
        pension_monthly = estimate_pension_cnav(
            profile.current_monthly_income,
            profile.pension_quarters_acquired,
        )

    # Annual expenses (target lifestyle at retirement)
    annual_expenses = int(
        profile.current_monthly_expenses
        * 12
        * (profile.target_lifestyle_pct / 100.0)
    )
    if annual_expenses <= 0:
        annual_expenses = int(profile.current_monthly_income * 12 * 0.8)

    # Asset returns
    ar = overrides.get("asset_returns_override") if overrides else None
    asset_returns_dict = {}
    if ar:
        asset_returns_dict = {k: {"mean": v.mean, "std": v.std} if hasattr(v, "mean") else v for k, v in ar.items()}
    else:
        asset_returns_dict = profile.asset_returns or DEFAULT_ASSET_RETURNS

    # Portfolio stats
    mu, sigma = _weighted_portfolio_stats(snap, asset_returns_dict)

    # Debt end events
    debt_events: list[tuple[int, int]] = []
    result = await db.execute(
        select(Debt.end_date, Debt.monthly_payment)
        .where(Debt.user_id == user_id)
        .where(Debt.remaining_amount > 0)
    )
    for row in result.all():
        end_date, payment = row[0], int(row[1] or 0)
        if end_date and payment > 0:
            debt_events.append((end_date.year, payment))

    # Run Monte-Carlo
    mc = run_monte_carlo(
        patrimoine_initial=max(snap.total, 0),
        monthly_savings=monthly_savings,
        extra_monthly_savings=extra_monthly_savings,
        annual_expenses=annual_expenses,
        pension_monthly=pension_monthly,
        current_age=current_age,
        retirement_age=retirement_age,
        life_expectancy=profile.life_expectancy,
        inflation_rate_pct=inflation_rate,
        portfolio_mean_pct=mu,
        portfolio_std_pct=sigma,
        debt_end_events=debt_events,
        num_simulations=num_simulations,
    )

    # ── Build response ────────────────────────────────────
    valid_fire_ages = [a for a in mc.fire_ages if a is not None]
    valid_ruin_ages = [a for a in mc.ruin_ages if a is not None]

    median_fire_age = int(_percentile(valid_fire_ages, 50)) if valid_fire_ages else None
    fire_age_p10 = int(_percentile(valid_fire_ages, 10)) if valid_fire_ages else None
    fire_age_p90 = int(_percentile(valid_fire_ages, 90)) if valid_fire_ages else None

    ruin_probability = (len(valid_ruin_ages) / num_simulations) * 100
    success_rate = 100.0 - ruin_probability

    patrimoine_at_ret_p50 = _percentile(mc.patrimoine_at_retirement, 50)

    # FIRE metrics
    fire_number = compute_fire_number(annual_expenses)
    fire_progress = (snap.total / fire_number * 100) if fire_number > 0 else 0

    years_to_ret = max(retirement_age - current_age, 0)
    coast_fire = compute_coast_fire(fire_number, mu, years_to_ret)
    lean_fire = compute_fire_number(int(annual_expenses * 0.6))
    fat_fire = compute_fire_number(int(annual_expenses * 1.2))

    swr = compute_swr_dynamic(snap.total, annual_expenses, current_age, sigma)
    monthly_withdrawal = int(snap.total * swr / 12) if snap.total > 0 else 0

    # Build series
    serie_list = []
    for ypd in mc.serie_by_age:
        serie_list.append({
            "age": ypd.age,
            "year": ypd.year,
            "p10": _percentile(ypd.values, 10),
            "p25": _percentile(ypd.values, 25),
            "p50": _percentile(ypd.values, 50),
            "p75": _percentile(ypd.values, 75),
            "p90": _percentile(ypd.values, 90),
            "is_accumulation": ypd.is_accumulation,
            "pension_income": ypd.pension_income,
            "withdrawal": ypd.withdrawal,
        })

    return {
        "median_fire_age": median_fire_age,
        "fire_age_p10": fire_age_p10,
        "fire_age_p90": fire_age_p90,
        "success_rate_pct": round(success_rate, 1),
        "ruin_probability_pct": round(ruin_probability, 1),
        "patrimoine_at_retirement_p50": patrimoine_at_ret_p50,
        "serie_by_age": serie_list,
        "fire_number": fire_number,
        "fire_progress_pct": round(min(fire_progress, 999.9), 1),
        "coast_fire": coast_fire,
        "lean_fire": lean_fire,
        "fat_fire": fat_fire,
        "swr_recommended_pct": round(swr * 100, 2),
        "monthly_withdrawal_recommended": monthly_withdrawal,
        "pension_estimate_used": pension_monthly,
        "num_simulations": num_simulations,
    }


async def optimize(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Run optimization: test multiple levers and return ranked results.
    """
    profile = await get_or_create_profile(db, user_id)
    current_year = date.today().year
    current_age = current_year - profile.birth_year

    # Base simulation
    base = await simulate(db, user_id, extra_monthly_savings=0, num_simulations=500)
    base_fire_age = base["median_fire_age"] or (profile.life_expectancy)

    levers = []

    # Lever 1-3: Extra savings (+100€, +200€, +500€/month in centimes)
    for extra_eur, label in [(100, "+100€/mois"), (200, "+200€/mois"), (500, "+500€/mois")]:
        extra_centimes = extra_eur * 100
        sim = await simulate(db, user_id, extra_monthly_savings=extra_centimes, num_simulations=500)
        new_fire = sim["median_fire_age"] or profile.life_expectancy
        years_gained = base_fire_age - new_fire

        levers.append({
            "lever_name": label,
            "description": f"Épargner {extra_eur}€ de plus par mois",
            "delta_monthly_savings": extra_centimes,
            "new_fire_age": new_fire if new_fire < profile.life_expectancy else None,
            "years_gained": round(years_gained, 1),
            "new_success_rate": sim["success_rate_pct"],
        })

    # Lever 4: Retire 2 years earlier
    sim_early = await simulate(
        db, user_id, extra_monthly_savings=0, num_simulations=500,
        overrides={"retirement_age": max(profile.target_retirement_age - 2, 50)},
    )
    early_fire = sim_early["median_fire_age"] or profile.life_expectancy
    levers.append({
        "lever_name": "Retraite -2 ans",
        "description": f"Partir à {profile.target_retirement_age - 2} au lieu de {profile.target_retirement_age}",
        "delta_monthly_savings": 0,
        "new_fire_age": early_fire if early_fire < profile.life_expectancy else None,
        "years_gained": round(base_fire_age - early_fire, 1),
        "new_success_rate": sim_early["success_rate_pct"],
    })

    # Determine best lever
    best = max(levers, key=lambda l: l["years_gained"])
    summary = f"Le levier le plus efficace est '{best['lever_name']}' : {best['years_gained']} ans gagnés, taux de succès {best['new_success_rate']}%."

    return {
        "levers": levers,
        "best_lever": best["lever_name"],
        "summary": summary,
    }


async def get_fire_dashboard(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Return consolidated FIRE dashboard metrics.
    """
    profile = await get_or_create_profile(db, user_id)
    snap = await collect_patrimoine(db, user_id, profile.include_real_estate)

    current_year = date.today().year
    current_age = current_year - profile.birth_year
    years_to_ret = max(profile.target_retirement_age - current_age, 0)

    annual_expenses = int(
        profile.current_monthly_expenses
        * 12
        * (profile.target_lifestyle_pct / 100.0)
    )
    if annual_expenses <= 0:
        annual_expenses = int(profile.current_monthly_income * 12 * 0.8)

    fire_number = compute_fire_number(annual_expenses)
    fire_progress = (snap.total / fire_number * 100) if fire_number > 0 else 0

    mu, sigma = _weighted_portfolio_stats(snap, profile.asset_returns or DEFAULT_ASSET_RETURNS)

    coast_fire = compute_coast_fire(fire_number, mu, years_to_ret)
    lean_fire = compute_fire_number(int(annual_expenses * 0.6))
    fat_fire = compute_fire_number(int(annual_expenses * 1.2))

    swr = compute_swr_dynamic(snap.total, annual_expenses, current_age, sigma)
    monthly_withdrawal = int(snap.total * swr / 12) if snap.total > 0 else 0

    # Passive income estimate (dividends + rent + staking roughly)
    passive_income = 0
    # Get dividend income and rent from DB
    from app.models.stock_position import StockPosition
    from app.models.stock_portfolio import StockPortfolio
    result = await db.execute(
        select(func.sum(StockPosition.annual_dividend_yield * StockPosition.value / 100))
        .join(StockPortfolio, StockPosition.portfolio_id == StockPortfolio.id)
        .where(StockPortfolio.user_id == user_id)
    )
    div_annual = int(result.scalar() or 0)

    result = await db.execute(
        select(func.sum(RealEstateProperty.monthly_rent))
        .where(RealEstateProperty.user_id == user_id)
    )
    rent_monthly = int(result.scalar() or 0)

    passive_income = div_annual // 12 + rent_monthly

    return {
        "fire_number": fire_number,
        "fire_progress_pct": round(min(fire_progress, 999.9), 1),
        "coast_fire": coast_fire,
        "lean_fire": lean_fire,
        "fat_fire": fat_fire,
        "swr_pct": round(swr * 100, 2),
        "monthly_withdrawal": monthly_withdrawal,
        "patrimoine_total": snap.total,
        "passive_income_monthly": passive_income,
        "current_age": current_age,
        "target_retirement_age": profile.target_retirement_age,
        "years_to_retirement": years_to_ret,
    }
