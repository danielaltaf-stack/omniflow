"""
OmniFlow — Debt service.
Business logic for CRUD + analytics on user debts.
"""

from __future__ import annotations

import logging
import math
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.debt import Debt, DebtPayment, DebtType, PaymentType
from app.services.amortization_engine import (
    AmortizationResult,
    compute_amortization,
    compute_consolidation,
    compare_invest_vs_repay,
    generate_chart_data,
    simulate_early_repayment,
)

logger = logging.getLogger("omniflow.debts")


# ─────────────────────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────────────────────


async def create_debt(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> Debt:
    """Create a new debt for a user."""
    debt = Debt(
        user_id=user_id,
        label=data["label"],
        debt_type=data.get("debt_type", "other"),
        creditor=data.get("creditor"),
        initial_amount=data["initial_amount"],
        remaining_amount=data["remaining_amount"],
        interest_rate_pct=data["interest_rate_pct"],
        insurance_rate_pct=data.get("insurance_rate_pct", 0.0) or 0.0,
        monthly_payment=data["monthly_payment"],
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        duration_months=data["duration_months"],
        early_repayment_fee_pct=data.get("early_repayment_fee_pct", 3.0),
        payment_type=data.get("payment_type", "constant_annuity"),
        is_deductible=data.get("is_deductible", False),
        linked_property_id=data.get("linked_property_id"),
    )
    db.add(debt)
    await db.commit()
    await db.refresh(debt)
    logger.info("Debt created: %s for user %s", debt.id, user_id)
    return debt


async def get_user_debts(db: AsyncSession, user_id: UUID) -> list[Debt]:
    """Get all debts for a user, ordered by remaining amount desc."""
    result = await db.execute(
        select(Debt)
        .where(Debt.user_id == user_id)
        .order_by(Debt.remaining_amount.desc())
    )
    return list(result.scalars().all())


async def get_debt_by_id(db: AsyncSession, debt_id: UUID, user_id: UUID) -> Debt | None:
    """Get a single debt by ID, scoped to user."""
    result = await db.execute(
        select(Debt)
        .where(Debt.id == debt_id, Debt.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_debt(db: AsyncSession, debt_id: UUID, user_id: UUID, data: dict[str, Any]) -> Debt | None:
    """Update a debt. Returns None if not found."""
    debt = await get_debt_by_id(db, debt_id, user_id)
    if not debt:
        return None

    for key, value in data.items():
        if value is not None and hasattr(debt, key):
            setattr(debt, key, value)

    await db.commit()
    await db.refresh(debt)
    logger.info("Debt updated: %s", debt_id)
    return debt


async def delete_debt(db: AsyncSession, debt_id: UUID, user_id: UUID) -> bool:
    """Delete a debt. Returns True if deleted."""
    debt = await get_debt_by_id(db, debt_id, user_id)
    if not debt:
        return False

    await db.delete(debt)
    await db.commit()
    logger.info("Debt deleted: %s", debt_id)
    return True


async def record_payment(
    db: AsyncSession, debt_id: UUID, user_id: UUID, data: dict[str, Any]
) -> DebtPayment | None:
    """Record an actual payment for a debt and update remaining_amount."""
    debt = await get_debt_by_id(db, debt_id, user_id)
    if not debt:
        return None

    # Count existing actual payments
    count_result = await db.execute(
        select(func.count(DebtPayment.id))
        .where(DebtPayment.debt_id == debt_id, DebtPayment.is_actual == True)
    )
    payment_count = count_result.scalar() or 0

    principal = data.get("principal_amount", 0)
    remaining_after = max(0, debt.remaining_amount - principal)

    payment = DebtPayment(
        debt_id=debt_id,
        payment_date=data["payment_date"],
        payment_number=payment_count + 1,
        total_amount=data["total_amount"],
        principal_amount=principal,
        interest_amount=data.get("interest_amount", 0),
        insurance_amount=data.get("insurance_amount", 0),
        remaining_after=remaining_after,
        is_actual=True,
    )
    db.add(payment)

    # Update debt remaining
    debt.remaining_amount = remaining_after
    await db.commit()
    await db.refresh(payment)
    logger.info("Payment recorded: %s for debt %s (remaining: %d)", payment.id, debt_id, remaining_after)
    return payment


# ─────────────────────────────────────────────────────────────
# Summary & Analytics
# ─────────────────────────────────────────────────────────────


def _compute_debt_progress(debt: Debt) -> dict[str, Any]:
    """Compute derived fields for a debt."""
    initial = debt.initial_amount or 1
    remaining = debt.remaining_amount or 0
    progress_pct = round((initial - remaining) / initial * 100, 1) if initial > 0 else 0.0

    # Remaining months estimate
    monthly_rate = (debt.interest_rate_pct or 0.0) / 100 / 12
    mp = debt.monthly_payment or 1
    if remaining <= 0:
        remaining_months = 0
    elif monthly_rate > 0 and mp > int(round(remaining * monthly_rate)):
        remaining_months = math.ceil(
            -math.log(1 - (remaining * monthly_rate) / mp) / math.log(1 + monthly_rate)
        )
    else:
        remaining_months = math.ceil(remaining / max(1, mp))

    # Total cost (projected from now)
    amort = compute_amortization(
        principal=remaining,
        annual_rate_pct=debt.interest_rate_pct or 0.0,
        duration_months=max(1, remaining_months),
        payment_type=debt.payment_type.value if hasattr(debt.payment_type, "value") else str(debt.payment_type or "constant_annuity"),
        insurance_rate_pct=debt.insurance_rate_pct or 0.0,
        start_date=debt.start_date,
    )

    return {
        "progress_pct": progress_pct,
        "remaining_months": remaining_months,
        "total_cost": amort.total_cost,
    }


def debt_to_response(debt: Debt) -> dict[str, Any]:
    """Convert a Debt model instance to response dict with computed fields."""
    computed = _compute_debt_progress(debt)
    return {
        "id": debt.id,
        "label": debt.label,
        "debt_type": debt.debt_type.value if hasattr(debt.debt_type, "value") else str(debt.debt_type),
        "creditor": debt.creditor,
        "initial_amount": debt.initial_amount,
        "remaining_amount": debt.remaining_amount,
        "interest_rate_pct": debt.interest_rate_pct,
        "insurance_rate_pct": debt.insurance_rate_pct,
        "monthly_payment": debt.monthly_payment,
        "start_date": debt.start_date,
        "end_date": debt.end_date,
        "duration_months": debt.duration_months,
        "early_repayment_fee_pct": debt.early_repayment_fee_pct,
        "payment_type": debt.payment_type.value if hasattr(debt.payment_type, "value") else str(debt.payment_type),
        "is_deductible": debt.is_deductible,
        "linked_property_id": debt.linked_property_id,
        "progress_pct": computed["progress_pct"],
        "remaining_months": computed["remaining_months"],
        "total_cost": computed["total_cost"],
        "created_at": debt.created_at,
    }


async def get_debt_summary(
    db: AsyncSession, user_id: UUID, monthly_income: int = 0,
) -> dict[str, Any]:
    """
    Get aggregated debt summary for a user.
    """
    debts = await get_user_debts(db, user_id)

    if not debts:
        return {
            "total_remaining": 0,
            "total_monthly": 0,
            "total_initial": 0,
            "weighted_avg_rate": 0.0,
            "debt_ratio_pct": 0.0,
            "debts_count": 0,
            "next_end_date": None,
            "debts": [],
        }

    total_remaining = sum(d.remaining_amount or 0 for d in debts)
    total_monthly = sum(d.monthly_payment or 0 for d in debts)
    total_initial = sum(d.initial_amount or 0 for d in debts)

    # Weighted average rate
    if total_remaining > 0:
        weighted_avg_rate = sum(
            (d.interest_rate_pct or 0.0) * (d.remaining_amount or 0) for d in debts
        ) / total_remaining
    else:
        weighted_avg_rate = 0.0

    # Debt ratio
    debt_ratio_pct = (total_monthly / monthly_income * 100) if monthly_income > 0 else 0.0

    # Nearest end date
    end_dates = [d.end_date for d in debts if d.end_date]
    next_end_date = min(end_dates) if end_dates else None

    debt_responses = [debt_to_response(d) for d in debts]

    return {
        "total_remaining": total_remaining,
        "total_monthly": total_monthly,
        "total_initial": total_initial,
        "weighted_avg_rate": round(weighted_avg_rate, 2),
        "debt_ratio_pct": round(debt_ratio_pct, 1),
        "debts_count": len(debts),
        "next_end_date": next_end_date,
        "debts": debt_responses,
    }


async def get_amortization_table(
    db: AsyncSession, debt_id: UUID, user_id: UUID,
) -> AmortizationResult | None:
    """Get the full amortization table for a specific debt."""
    debt = await get_debt_by_id(db, debt_id, user_id)
    if not debt:
        return None

    return compute_amortization(
        principal=debt.remaining_amount,
        annual_rate_pct=debt.interest_rate_pct or 0.0,
        duration_months=debt.duration_months,
        payment_type=debt.payment_type.value if hasattr(debt.payment_type, "value") else str(debt.payment_type or "constant_annuity"),
        insurance_rate_pct=debt.insurance_rate_pct or 0.0,
        start_date=debt.start_date,
    )


async def get_early_repayment_sim(
    db: AsyncSession, debt_id: UUID, user_id: UUID,
    amount: int, at_month: int = 0,
) -> dict[str, Any] | None:
    """Simulate early repayment for a specific debt."""
    debt = await get_debt_by_id(db, debt_id, user_id)
    if not debt:
        return None

    result = simulate_early_repayment(
        principal=debt.initial_amount,
        remaining_amount=debt.remaining_amount,
        annual_rate_pct=debt.interest_rate_pct or 0.0,
        duration_months=debt.duration_months,
        insurance_rate_pct=debt.insurance_rate_pct or 0.0,
        monthly_payment=debt.monthly_payment,
        early_repayment_fee_pct=debt.early_repayment_fee_pct,
        repayment_amount=amount,
        at_month=at_month,
        start_date=debt.start_date,
        payment_type=debt.payment_type.value if hasattr(debt.payment_type, "value") else str(debt.payment_type or "constant_annuity"),
    )
    return {
        "current_remaining": result.current_remaining,
        "repayment_amount": result.repayment_amount,
        "at_month": result.at_month,
        "reduced_duration": {
            "name": result.reduced_duration.name,
            "new_monthly_payment": result.reduced_duration.new_monthly_payment,
            "new_duration_months": result.reduced_duration.new_duration_months,
            "new_end_date": result.reduced_duration.new_end_date,
            "interest_saved": result.reduced_duration.interest_saved,
            "penalty_amount": result.reduced_duration.penalty_amount,
            "net_savings": result.reduced_duration.net_savings,
        },
        "reduced_payment": {
            "name": result.reduced_payment.name,
            "new_monthly_payment": result.reduced_payment.new_monthly_payment,
            "new_duration_months": result.reduced_payment.new_duration_months,
            "new_end_date": result.reduced_payment.new_end_date,
            "interest_saved": result.reduced_payment.interest_saved,
            "penalty_amount": result.reduced_payment.penalty_amount,
            "net_savings": result.reduced_payment.net_savings,
        },
    }


async def get_invest_vs_repay(
    db: AsyncSession, debt_id: UUID, user_id: UUID,
    amount: int, return_rate: float = 7.0,
) -> dict[str, Any] | None:
    """Compare investing the surplus vs early repayment."""
    debt = await get_debt_by_id(db, debt_id, user_id)
    if not debt:
        return None

    result = compare_invest_vs_repay(
        amount=amount,
        remaining_amount=debt.remaining_amount,
        annual_rate_pct=debt.interest_rate_pct or 0.0,
        duration_months=debt.duration_months,
        monthly_payment=debt.monthly_payment,
        early_repayment_fee_pct=debt.early_repayment_fee_pct,
        return_rate_pct=return_rate,
        insurance_rate_pct=debt.insurance_rate_pct or 0.0,
        payment_type=debt.payment_type.value if hasattr(debt.payment_type, "value") else str(debt.payment_type or "constant_annuity"),
        start_date=debt.start_date,
    )
    return {
        "amount": result.amount,
        "return_rate_pct": result.return_rate_pct,
        "horizon_months": result.horizon_months,
        "invest_gross_value": result.invest_gross_value,
        "invest_gross_gain": result.invest_gross_gain,
        "invest_tax": result.invest_tax,
        "invest_net_gain": result.invest_net_gain,
        "repay_interest_saved": result.repay_interest_saved,
        "repay_penalty": result.repay_penalty,
        "repay_net_gain": result.repay_net_gain,
        "verdict": result.verdict,
        "advantage": result.advantage,
    }


async def get_consolidation(
    db: AsyncSession, user_id: UUID,
    monthly_income: int = 0, extra_monthly: int = 0,
) -> dict[str, Any]:
    """Get debt consolidation analytics (avalanche/snowball)."""
    debts = await get_user_debts(db, user_id)

    debt_dicts = []
    for d in debts:
        computed = _compute_debt_progress(d)
        debt_dicts.append({
            "id": str(d.id),
            "label": d.label,
            "remaining_amount": d.remaining_amount,
            "interest_rate_pct": d.interest_rate_pct or 0.0,
            "monthly_payment": d.monthly_payment,
            "duration_months": d.duration_months,
            "remaining_months": computed["remaining_months"],
        })

    return compute_consolidation(debt_dicts, monthly_income, extra_monthly)


async def get_chart_data(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """Get stacked chart data for all user debts."""
    debts = await get_user_debts(db, user_id)

    schedules: list[tuple[str, AmortizationResult]] = []
    for d in debts:
        amort = compute_amortization(
            principal=d.remaining_amount,
            annual_rate_pct=d.interest_rate_pct or 0.0,
            duration_months=d.duration_months,
            payment_type=d.payment_type.value if hasattr(d.payment_type, "value") else str(d.payment_type or "constant_annuity"),
            insurance_rate_pct=d.insurance_rate_pct or 0.0,
            start_date=d.start_date,
        )
        schedules.append((d.label, amort))

    return generate_chart_data(schedules)


async def get_total_debt_for_networth(db: AsyncSession, user_id: UUID) -> int:
    """Get total remaining debt amount for net worth calculation."""
    result = await db.execute(
        select(func.sum(Debt.remaining_amount))
        .where(Debt.user_id == user_id)
    )
    return int(result.scalar() or 0)


async def get_total_monthly_payments(db: AsyncSession, user_id: UUID) -> int:
    """Get total monthly debt payments for OmniScore."""
    result = await db.execute(
        select(func.sum(Debt.monthly_payment))
        .where(Debt.user_id == user_id)
    )
    return int(result.scalar() or 0)
