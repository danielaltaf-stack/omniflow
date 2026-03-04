"""
OmniFlow — Wealth Autopilot Engine.

4-step daily savings algorithm:
  1. Financial snapshot (checking balances, recurring income/expenses)
  2. Safety cushion gap calculation
  3. Available savings computation (balance - debits - reserve, rounded)
  4. Priority-based allocation (cushion → projects → DCA)

Plus: DCA suggestions, autopilot score (0-100), scenario simulations.
All monetary values in **centimes** (BigInteger).
"""

from __future__ import annotations

import datetime as dt
import logging
import math
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.autopilot_config import AutopilotConfig
from app.models.bank_connection import BankConnection
from app.models.project_budget import ProjectBudget
from app.models.transaction import Transaction

logger = logging.getLogger("omniflow.wealth_autopilot")


# ═══════════════════════════════════════════════════════════════════
#  DB Helpers
# ═══════════════════════════════════════════════════════════════════


async def get_or_create_config(db: AsyncSession, user_id: UUID) -> AutopilotConfig:
    """Return existing config or create a default one."""
    stmt = select(AutopilotConfig).where(AutopilotConfig.user_id == user_id)
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    if config is None:
        config = AutopilotConfig(user_id=user_id)
        db.add(config)
        await db.flush()
        logger.info("Created default autopilot config for user %s", user_id)
    return config


async def update_config(
    db: AsyncSession, user_id: UUID, data: dict[str, Any]
) -> AutopilotConfig:
    """Update user's autopilot config with provided fields."""
    config = await get_or_create_config(db, user_id)
    for key, value in data.items():
        if hasattr(config, key):
            if key == "allocations" and isinstance(value, list):
                # Validate and normalize allocations
                setattr(config, key, [
                    a.model_dump() if hasattr(a, "model_dump") else a
                    for a in value
                ])
            else:
                setattr(config, key, value)
    await db.flush()
    return config


# ═══════════════════════════════════════════════════════════════════
#  Step 1 — Financial Snapshot
# ═══════════════════════════════════════════════════════════════════


async def _get_checking_balance(db: AsyncSession, user_id: UUID) -> int:
    """Sum of all checking accounts balances (centimes)."""
    stmt = (
        select(func.coalesce(func.sum(Account.balance), 0))
        .select_from(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(
            BankConnection.user_id == user_id,
            Account.type == AccountType.CHECKING.value,
        )
    )
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def _get_savings_balance(db: AsyncSession, user_id: UUID) -> int:
    """Sum of savings accounts balances (centimes)."""
    savings_types = [AccountType.SAVINGS.value]
    stmt = (
        select(func.coalesce(func.sum(Account.balance), 0))
        .select_from(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(
            BankConnection.user_id == user_id,
            Account.type.in_(savings_types),
        )
    )
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def _get_monthly_expenses_avg(
    db: AsyncSession, user_id: UUID, lookback_days: int
) -> int:
    """Average monthly expenses over lookback period (centimes, positive)."""
    cutoff = dt.date.today() - dt.timedelta(days=lookback_days)
    # Get user's account IDs
    acct_q = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acct_ids = [row[0] for row in acct_q.fetchall()]
    stmt = (
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.account_id.in_(acct_ids),
            Transaction.date >= cutoff,
            Transaction.amount < 0,  # debits are negative
        )
    )
    result = await db.execute(stmt)
    total_expenses = abs(result.scalar() or 0)
    months = max(1, lookback_days / 30)
    return int(float(total_expenses) / months)


async def _get_upcoming_recurring_debits(
    db: AsyncSession, user_id: UUID, forecast_days: int
) -> int:
    """Estimated recurring debits in the next N days (centimes, positive)."""
    # Use average daily recurring expenses * forecast_days
    cutoff = dt.date.today() - dt.timedelta(days=90)
    acct_q = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acct_ids = [row[0] for row in acct_q.fetchall()]
    stmt = (
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.account_id.in_(acct_ids),
            Transaction.date >= cutoff,
            Transaction.amount < 0,
            Transaction.is_recurring.is_(True),
        )
    )
    result = await db.execute(stmt)
    total_recurring = abs(result.scalar() or 0)
    daily_avg = float(total_recurring) / 90
    return int(daily_avg * forecast_days)


# ═══════════════════════════════════════════════════════════════════
#  Step 2 — Safety Cushion
# ═══════════════════════════════════════════════════════════════════


def compute_safety_gap(
    monthly_expenses: int, cushion_months: float, savings_balance: int
) -> tuple[int, int]:
    """
    Returns (safety_target, safety_gap) in centimes.
    """
    safety_target = int(monthly_expenses * cushion_months)
    gap = max(0, safety_target - savings_balance)
    return safety_target, gap


# ═══════════════════════════════════════════════════════════════════
#  Step 3 — Available Savings
# ═══════════════════════════════════════════════════════════════════


def compute_available(
    checking_balance: int,
    upcoming_debits: int,
    monthly_expenses: int,
    min_amount: int,
    step: int,
) -> int:
    """
    Compute available savings amount, rounded down to step.
    Keeps 30% of monthly expenses as safety reserve on checking.

    Returns 0 if below min_amount.
    """
    safety_reserve = int(monthly_expenses * 0.30)
    raw = checking_balance - upcoming_debits - safety_reserve
    if raw < min_amount:
        return 0
    # Round down to step
    if step <= 0:
        step = 1000  # default 10€
    rounded = (raw // step) * step
    return max(0, rounded)


# ═══════════════════════════════════════════════════════════════════
#  Step 4 — Priority Allocation
# ═══════════════════════════════════════════════════════════════════


def allocate_savings(
    available: int,
    allocations: list[dict[str, Any]],
    safety_gap: int,
) -> list[dict[str, Any]]:
    """
    Distribute available savings across allocations by priority.
    Returns list of {allocation_label, allocation_type, amount, reason}.
    """
    if available <= 0 or not allocations:
        return []

    sorted_allocs = sorted(allocations, key=lambda a: a.get("priority", 99))
    remaining = available
    breakdown: list[dict[str, Any]] = []

    for alloc in sorted_allocs:
        if remaining <= 0:
            break

        alloc_type = alloc.get("type", "")
        label = alloc.get("label", alloc_type)
        pct = alloc.get("pct", 0) / 100.0
        share = int(available * pct)

        if alloc_type == "safety_cushion":
            amount = min(share, safety_gap, remaining)
            reason = f"Remplissage matelas sécurité ({safety_gap // 100}€ restants)"
        elif alloc_type == "project":
            target = alloc.get("target", 0)
            current = alloc.get("current", 0)
            project_gap = max(0, target - current)
            amount = min(share, project_gap, remaining)
            reason = f"Projet: {label} ({project_gap // 100}€ restants)"
        elif alloc_type.startswith("dca_"):
            target_monthly = alloc.get("target_monthly", 0)
            amount = min(share, target_monthly, remaining)
            reason = f"DCA: {label} ({target_monthly // 100}€/mois)"
        else:
            amount = min(share, remaining)
            reason = f"Allocation: {label}"

        if amount > 0:
            breakdown.append({
                "allocation_label": label,
                "allocation_type": alloc_type,
                "amount": amount,
                "reason": reason,
            })
            remaining -= amount

    return breakdown


# ═══════════════════════════════════════════════════════════════════
#  DCA Suggestions
# ═══════════════════════════════════════════════════════════════════


def generate_dca_suggestions(
    allocations: list[dict[str, Any]],
    available: int,
) -> list[dict[str, Any]]:
    """
    Extract DCA items from allocations and build suggestions.
    """
    dca_items: list[dict[str, Any]] = []
    dca_types = {"dca_etf", "dca_crypto", "dca_scpi", "dca_bond", "dca_custom"}

    for alloc in allocations:
        atype = alloc.get("type", "")
        if atype not in dca_types:
            continue

        target_monthly = alloc.get("target_monthly", 0)
        pct = alloc.get("pct", 0) / 100.0
        suggested = min(int(available * pct), target_monthly) if available > 0 else 0

        label = alloc.get("label", atype)
        asset = alloc.get("asset_class", atype.replace("dca_", ""))

        dca_items.append({
            "type": atype,
            "label": label,
            "target_monthly": target_monthly,
            "actual_this_month": 0,  # would need transaction analysis
            "remaining": target_monthly,
            "suggestion": f"Investir {suggested // 100}€ en {label}" if suggested > 0 else "Pas de budget disponible",
            "performance_12m": None,
        })

    return dca_items


# ═══════════════════════════════════════════════════════════════════
#  Main Compute
# ═══════════════════════════════════════════════════════════════════


async def compute_savings(
    db: AsyncSession, user_id: UUID
) -> dict[str, Any]:
    """
    Full 4-step savings computation. Returns dict suitable for ComputeResponse.
    """
    config = await get_or_create_config(db, user_id)

    # Step 1 — Snapshot
    checking = await _get_checking_balance(db, user_id)
    savings = await _get_savings_balance(db, user_id)
    monthly_exp = await _get_monthly_expenses_avg(db, user_id, config.lookback_days)
    upcoming = await _get_upcoming_recurring_debits(db, user_id, config.forecast_days)

    # Use configured income if no transaction data
    if monthly_exp == 0 and config.monthly_income > 0:
        monthly_exp = int(config.monthly_income * 0.70)  # Estimate 70% expenses

    # Step 2 — Safety cushion
    safety_target, safety_gap = compute_safety_gap(
        monthly_exp, config.safety_cushion_months, savings
    )

    # Step 3 — Available
    available = compute_available(
        checking, upcoming, monthly_exp,
        config.min_savings_amount, config.savings_step,
    )

    # Step 4 — Allocation
    allocs = config.allocations if isinstance(config.allocations, list) else []
    breakdown = allocate_savings(available, allocs, safety_gap)

    # DCA
    dca_items = generate_dca_suggestions(allocs, available)

    # Savings rate
    total_income = config.monthly_income + config.other_income
    savings_rate = (available / total_income * 100) if total_income > 0 else 0.0

    # Build suggestion
    suggestion_id = str(uuid.uuid4())[:8]
    suggestion = {
        "suggestion_id": suggestion_id,
        "total_available": available,
        "suggested_amount": sum(b["amount"] for b in breakdown),
        "breakdown": breakdown,
        "message": _build_message(available, breakdown, config.min_savings_amount),
        "status": "suggested",
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }

    # Persist results
    config.last_available = int(available)
    config.last_suggestion = suggestion
    config.savings_rate_pct = round(float(savings_rate), 1)
    config.analysis_data = {
        "checking_balance": int(checking),
        "savings_balance": int(savings),
        "monthly_expenses_avg": int(monthly_exp),
        "upcoming_debits": int(upcoming),
        "safety_target": int(safety_target),
        "safety_gap": int(safety_gap),
        "computed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }

    # Score
    score, score_breakdown = compute_autopilot_score(config)
    config.autopilot_score = score

    await db.flush()

    return {
        "suggestion": suggestion,
        "dca_items": dca_items,
        "checking_balance": checking,
        "savings_balance": savings,
        "monthly_expenses_avg": monthly_exp,
        "safety_cushion_target": safety_target,
        "safety_cushion_current": savings,
        "safety_gap": safety_gap,
        "upcoming_debits": upcoming,
        "savings_rate_pct": round(savings_rate, 1),
    }


def _build_message(available: int, breakdown: list[dict], min_amount: int) -> str:
    """Build a user-friendly suggestion message."""
    if available < min_amount:
        return "Pas assez d'épargne disponible cette semaine. Continuez à surveiller vos dépenses !"

    total = sum(b["amount"] for b in breakdown)
    if total == 0:
        return f"Vous avez {available // 100}€ disponibles mais aucune allocation configurée."

    parts = [f"{b['allocation_label']}: {b['amount'] // 100}€" for b in breakdown]
    return f"💰 Suggestion: épargner {total // 100}€ — " + ", ".join(parts)


# ═══════════════════════════════════════════════════════════════════
#  Accept / Skip Suggestion
# ═══════════════════════════════════════════════════════════════════


async def accept_suggestion(
    db: AsyncSession, user_id: UUID, suggestion_id: str
) -> dict[str, Any]:
    """Mark a suggestion as accepted and log it to history."""
    config = await get_or_create_config(db, user_id)

    current = config.last_suggestion or {}
    if current.get("suggestion_id") != suggestion_id:
        return {"error": "Suggestion introuvable ou expirée", "accepted": False}

    current["status"] = "accepted"
    config.last_suggestion = current

    # Append to history
    history = list(config.suggestions_history or [])
    history.append(current)
    # Keep last 100
    if len(history) > 100:
        history = history[-100:]
    config.suggestions_history = history

    await db.flush()
    logger.info("User %s accepted suggestion %s", user_id, suggestion_id)
    return {"accepted": True, "suggestion": current}


async def get_suggestion_history(
    db: AsyncSession, user_id: UUID
) -> dict[str, Any]:
    """Return suggestion history with acceptance stats."""
    config = await get_or_create_config(db, user_id)
    history = config.suggestions_history or []

    total_suggested = sum(h.get("suggested_amount", 0) for h in history)
    accepted = [h for h in history if h.get("status") == "accepted"]
    total_accepted = sum(h.get("suggested_amount", 0) for h in accepted)
    rate = (len(accepted) / len(history) * 100) if history else 0.0

    return {
        "history": history,
        "total_suggested": total_suggested,
        "total_accepted": total_accepted,
        "acceptance_rate": round(rate, 1),
    }


# ═══════════════════════════════════════════════════════════════════
#  Score Autopilot (0-100)
# ═══════════════════════════════════════════════════════════════════


def compute_autopilot_score(
    config: AutopilotConfig,
) -> tuple[int, dict[str, int]]:
    """
    Compute autopilot score (0-100) with 5 components:
      30% savings rate
      25% safety cushion fill
      20% suggestion regularity
      15% DCA diversification
      10% active projects
    """
    # 1. Savings rate (30 pts)
    rate = config.savings_rate_pct
    if rate >= 30:
        sr = 30
    elif rate >= 20:
        sr = 25
    elif rate >= 10:
        sr = 20
    elif rate >= 5:
        sr = 10
    else:
        sr = 0

    # 2. Safety cushion (25 pts)
    analysis = config.analysis_data or {}
    safety_target = analysis.get("safety_target", 1)
    safety_current = analysis.get("savings_balance", 0)
    if safety_target > 0:
        fill = safety_current / safety_target
    else:
        fill = 1.0
    if fill >= 1.0:
        sc = 25
    elif fill >= 0.8:
        sc = 20
    elif fill >= 0.5:
        sc = 10
    else:
        sc = 0

    # 3. Regularity (20 pts)
    history = config.suggestions_history or []
    if history:
        accepted = sum(1 for h in history if h.get("status") == "accepted")
        reg_rate = accepted / len(history)
    else:
        reg_rate = 0
    if reg_rate >= 1.0:
        rg = 20
    elif reg_rate >= 0.8:
        rg = 15
    elif reg_rate >= 0.6:
        rg = 10
    elif reg_rate >= 0.3:
        rg = 5
    else:
        rg = 0

    # 4. DCA diversification (15 pts)
    allocs = config.allocations or []
    dca_types = {a.get("type") for a in allocs if a.get("type", "").startswith("dca_")}
    dca_count = len(dca_types)
    if dca_count >= 3:
        dv = 15
    elif dca_count >= 2:
        dv = 10
    elif dca_count >= 1:
        dv = 5
    else:
        dv = 0

    # 5. Active projects (10 pts)
    project_count = sum(1 for a in allocs if a.get("type") == "project")
    if project_count >= 3:
        pj = 10
    elif project_count >= 2:
        pj = 6
    elif project_count >= 1:
        pj = 3
    else:
        pj = 0

    total = min(100, sr + sc + rg + dv + pj)
    breakdown = {
        "savings_rate_score": sr,
        "safety_cushion_score": sc,
        "regularity_score": rg,
        "diversification_score": dv,
        "projects_score": pj,
    }
    return total, breakdown


# ═══════════════════════════════════════════════════════════════════
#  Scenario Simulation
# ═══════════════════════════════════════════════════════════════════


def simulate_scenarios(
    config: AutopilotConfig, available: int
) -> dict[str, dict[str, Any]]:
    """
    3 savings scenarios:
      prudent:   min_savings_amount per week → ~4× per month
      moderate:  current available per week
      ambitious: available × 1.5 per week
    """
    min_weekly = config.min_savings_amount  # e.g. 2000 centimes = 20€
    moderate_weekly = max(available, min_weekly)
    ambitious_weekly = int(moderate_weekly * 1.5)

    monthly_exp = 0
    analysis = config.analysis_data or {}
    safety_target = analysis.get("safety_target", 0)
    safety_current = analysis.get("savings_balance", 0)

    allocs = config.allocations or []

    def _project(weekly_amount: int) -> dict[str, Any]:
        monthly = weekly_amount * 4
        total_6m = monthly * 6
        total_12m = monthly * 12
        total_24m = monthly * 24

        # When is safety cushion full?
        gap = max(0, safety_target - safety_current)
        cushion_months = math.ceil(gap / monthly) if monthly > 0 else None

        # Projects reached
        projects_reached = []
        cumulative = 0
        for alloc in allocs:
            if alloc.get("type") != "project":
                continue
            remaining = max(0, alloc.get("target", 0) - alloc.get("current", 0))
            pct = alloc.get("pct", 0) / 100.0
            monthly_toward = int(monthly * pct)
            if monthly_toward > 0:
                months_needed = math.ceil(remaining / monthly_toward)
            else:
                months_needed = None
            projects_reached.append({
                "name": alloc.get("label", "Projet"),
                "months_remaining": months_needed,
            })

        return {
            "total_savings_6m": total_6m,
            "total_savings_12m": total_12m,
            "total_savings_24m": total_24m,
            "safety_cushion_full_months": cushion_months,
            "projects_reached": projects_reached,
            "patrimoine_projected": safety_current + total_12m,
        }

    return {
        "prudent": _project(min_weekly),
        "moderate": _project(moderate_weekly),
        "ambitious": _project(ambitious_weekly),
    }
