"""
OmniFlow — Real Estate Analytics Service (Phase B3).
Net-net yield (fiscal), DVF valuation history, cash-flow projection
with loan amortization schedule.
"""

from __future__ import annotations

import logging
import math
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.real_estate import (
    CSG_CRDS_RATE,
    MICRO_FONCIER_ABATEMENT,
    MICRO_FONCIER_CEILING_CENTIMES,
    RealEstateProperty,
)
from app.models.real_estate_valuation import RealEstateValuation
from app.services.realestate_service import get_dvf_estimation

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  B3.1 — NET-NET YIELD ENGINE
# ═══════════════════════════════════════════════════════════════════


def compute_net_net_yield(prop: dict[str, Any]) -> dict[str, Any]:
    """
    Compute 3-tier yield: brut / net / net-net.
    All monetary values in centimes. Returns updated fields.

    Parameters taken from property dict:
      purchase_price, monthly_rent, monthly_charges, monthly_loan_payment,
      taxe_fonciere (annual), assurance_pno (monthly), vacancy_rate_pct,
      notary_fees_pct, provision_travaux (monthly), current_value,
      fiscal_regime ('micro_foncier' | 'reel'), tmi_pct,
      loan_interest_rate, loan_insurance_rate, loan_remaining, loan_duration_months
    """
    purchase = prop.get("purchase_price", 0) or 0
    rent_m = prop.get("monthly_rent", 0) or 0
    charges_m = prop.get("monthly_charges", 0) or 0
    loan_payment_m = prop.get("monthly_loan_payment", 0) or 0
    current_value = prop.get("current_value", 0) or 0

    taxe_fonciere_a = prop.get("taxe_fonciere", 0) or 0        # annual
    assurance_pno_m = prop.get("assurance_pno", 0) or 0         # monthly
    vacancy_pct = prop.get("vacancy_rate_pct", 0.0) or 0.0
    notary_pct = prop.get("notary_fees_pct", 7.5) or 7.5
    travaux_m = prop.get("provision_travaux", 0) or 0           # monthly
    fiscal = prop.get("fiscal_regime", "micro_foncier") or "micro_foncier"
    tmi = prop.get("tmi_pct", 30.0) or 30.0
    loan_rate = prop.get("loan_interest_rate", 0.0) or 0.0
    loan_ins_rate = prop.get("loan_insurance_rate", 0.0) or 0.0
    loan_remaining = prop.get("loan_remaining", 0) or 0
    loan_dur = prop.get("loan_duration_months", 0) or 0

    rent_a = rent_m * 12
    vacancy_m = int(rent_m * vacancy_pct / 100)
    effective_rent_a = (rent_m - vacancy_m) * 12
    notary_fees = int(purchase * notary_pct / 100)
    total_invest = purchase + notary_fees

    # Annual charges (excluding loan & taxes)
    charges_a = (charges_m + assurance_pno_m + travaux_m) * 12 + taxe_fonciere_a

    # ── Gross yield ───────────────────────────────────────
    gross_yield = round((rent_a / purchase) * 100, 2) if purchase > 0 else 0.0

    # ── Net yield (before tax) ────────────────────────────
    net_income_a = effective_rent_a - charges_a
    net_yield = round((net_income_a / total_invest) * 100, 2) if total_invest > 0 else 0.0

    # ── Net cashflow (simple) ─────────────────────────────
    net_cashflow = rent_m - charges_m - loan_payment_m

    # ── Capital gain ──────────────────────────────────────
    capital_gain = current_value - purchase

    # ── Fiscal burden (impôt foncier + prélèvements sociaux) ──
    # Estimate annual loan interest for deduction (régime réel)
    if loan_rate > 0 and loan_remaining > 0 and loan_dur > 0:
        monthly_rate = loan_rate / 100 / 12
        ann_interest_estimate = int(loan_remaining * monthly_rate * 12)
        ann_insurance_estimate = int(loan_remaining * loan_ins_rate / 100)
    else:
        ann_interest_estimate = 0
        ann_insurance_estimate = 0

    impot_foncier = 0
    ps = 0

    if fiscal == "micro_foncier":
        # Micro-foncier: 30% flat deduction, ceiling 15 000 € annual rent
        if rent_a <= MICRO_FONCIER_CEILING_CENTIMES or rent_a == 0:
            taxable = int(rent_a * (1 - MICRO_FONCIER_ABATEMENT))
        else:
            # Over ceiling → fall back to régime réel logic
            taxable = max(0, effective_rent_a - charges_a - ann_interest_estimate - ann_insurance_estimate)
        impot_foncier = int(taxable * tmi / 100)
        ps = int(taxable * CSG_CRDS_RATE / 100)
    else:
        # Régime réel: deduct all actual charges + loan interest + insurance
        taxable = effective_rent_a - charges_a - ann_interest_estimate - ann_insurance_estimate
        if taxable > 0:
            impot_foncier = int(taxable * tmi / 100)
            ps = int(taxable * CSG_CRDS_RATE / 100)
        # If deficit foncier → no tax (deficit carries over, we don't model carry-forward here)

    annual_tax_burden = impot_foncier + ps

    # ── Net-net yield ─────────────────────────────────────
    net_net_income = effective_rent_a - charges_a - annual_tax_burden
    net_net_yield = round((net_net_income / total_invest) * 100, 2) if total_invest > 0 else 0.0

    return {
        "gross_yield_pct": gross_yield,
        "net_yield_pct": net_yield,
        "net_net_yield_pct": net_net_yield,
        "net_monthly_cashflow": net_cashflow,
        "capital_gain": capital_gain,
        "annual_tax_burden": annual_tax_burden,
    }


# ═══════════════════════════════════════════════════════════════════
#  B3.2 — DVF VALUATION HISTORY
# ═══════════════════════════════════════════════════════════════════


async def get_valuation_history(
    db: AsyncSession,
    property_id: UUID,
    user_id: UUID,
) -> list[dict[str, Any]]:
    """Get DVF valuation history for a property."""
    # Verify ownership
    prop = await _get_owned_property(db, property_id, user_id)
    if not prop:
        return []

    result = await db.execute(
        select(RealEstateValuation)
        .where(RealEstateValuation.property_id == property_id)
        .order_by(RealEstateValuation.recorded_at.asc())
    )
    valuations = list(result.scalars().all())

    return [
        {
            "id": str(v.id),
            "source": v.source,
            "price_m2_centimes": v.price_m2_centimes,
            "estimation_centimes": v.estimation_centimes,
            "nb_transactions": v.nb_transactions,
            "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in valuations
    ]


async def refresh_dvf_valuation(
    db: AsyncSession,
    property_id: UUID,
    user_id: UUID,
) -> dict[str, Any] | None:
    """
    Force-refresh DVF estimation for a property.
    Creates a new valuation snapshot, compares to previous one.
    """
    prop = await _get_owned_property(db, property_id, user_id)
    if not prop:
        return None

    if not prop.postal_code or not prop.surface_m2:
        return {"error": "Code postal et surface requis pour l'estimation DVF."}

    ptype = prop.property_type.value if hasattr(prop.property_type, "value") else str(prop.property_type)
    dvf_result = await get_dvf_estimation(prop.postal_code, ptype, prop.surface_m2)
    if not dvf_result:
        return {"error": "Aucune donnée DVF disponible pour ce bien."}

    price_m2 = dvf_result["price_m2_centimes"]
    estimation = dvf_result.get("estimation_centimes")
    nb_tx = dvf_result.get("nb_transactions", 0)
    source = "dvf_cquest"  # primary source

    # Create valuation snapshot
    valuation = RealEstateValuation(
        property_id=property_id,
        source=source,
        price_m2_centimes=price_m2,
        estimation_centimes=estimation,
        nb_transactions=nb_tx,
        recorded_at=date.today(),
    )
    db.add(valuation)

    # Update property dvf_estimation
    prop.dvf_estimation = estimation
    await db.commit()
    await db.refresh(valuation)

    # Compare with previous
    result_data = await db.execute(
        select(RealEstateValuation)
        .where(
            RealEstateValuation.property_id == property_id,
            RealEstateValuation.id != valuation.id,
        )
        .order_by(RealEstateValuation.recorded_at.desc())
        .limit(1)
    )
    prev = result_data.scalar_one_or_none()

    significant_change = False
    delta_pct = 0.0
    if prev and prev.price_m2_centimes and price_m2:
        delta_pct = round(((price_m2 - prev.price_m2_centimes) / prev.price_m2_centimes) * 100, 2)
        significant_change = abs(delta_pct) >= 5.0

    return {
        "id": str(valuation.id),
        "source": source,
        "price_m2_centimes": price_m2,
        "estimation_centimes": estimation,
        "nb_transactions": nb_tx,
        "recorded_at": valuation.recorded_at.isoformat(),
        "significant_change": significant_change,
        "delta_pct": delta_pct,
    }


# ═══════════════════════════════════════════════════════════════════
#  B3.3 — CASH-FLOW PROJECTION & AMORTIZATION
# ═══════════════════════════════════════════════════════════════════


def compute_amortization_schedule(
    principal: int,          # centimes
    annual_rate: float,      # %
    duration_months: int,
    insurance_rate: float,   # annual % on initial capital
) -> list[dict[str, Any]]:
    """
    French-style constant-payment (annuité constante) amortization schedule.
    All outputs in centimes.
    """
    if duration_months <= 0 or principal <= 0 or annual_rate <= 0:
        return []

    monthly_rate = annual_rate / 100 / 12
    monthly_insurance = int((principal * insurance_rate / 100) / 12)

    # Monthly payment (hors assurance)
    if monthly_rate > 0:
        mensualite = principal * monthly_rate / (1 - math.pow(1 + monthly_rate, -duration_months))
    else:
        mensualite = principal / duration_months

    mensualite = int(round(mensualite))
    remaining = principal
    schedule: list[dict[str, Any]] = []

    for m in range(1, duration_months + 1):
        interest = int(round(remaining * monthly_rate))
        principal_payment = mensualite - interest
        if principal_payment > remaining:
            principal_payment = remaining
        remaining = max(0, remaining - principal_payment)

        schedule.append({
            "month": m,
            "loan_principal": principal_payment,
            "loan_interest": interest,
            "loan_insurance": monthly_insurance,
            "total_payment": mensualite + monthly_insurance,
            "remaining_capital": remaining,
        })

        if remaining <= 0:
            break

    return schedule


async def get_cashflow_projection(
    db: AsyncSession,
    property_id: UUID,
    user_id: UUID,
    months: int | None = None,
) -> dict[str, Any] | None:
    """
    Build a complete cash-flow projection for a property over the loan duration.
    Returns summary KPIs + monthly breakdown.
    """
    prop = await _get_owned_property(db, property_id, user_id)
    if not prop:
        return None

    duration = months or prop.loan_duration_months or 240
    if duration <= 0:
        duration = 240

    rent_m = prop.monthly_rent or 0
    charges_m = prop.monthly_charges or 0
    assurance_pno_m = prop.assurance_pno or 0
    taxe_fonciere_m = int((prop.taxe_fonciere or 0) / 12)
    travaux_m = prop.provision_travaux or 0
    vacancy_m = int(rent_m * (prop.vacancy_rate_pct or 0) / 100)

    effective_rent_m = rent_m - vacancy_m
    total_charges_m = charges_m + assurance_pno_m + taxe_fonciere_m + travaux_m

    # Compute annual tax (simplified: divided by 12 for monthly)
    yields = compute_net_net_yield(_prop_to_dict(prop))
    annual_tax = yields.get("annual_tax_burden", 0)
    tax_monthly = int(annual_tax / 12)

    # Amortization schedule
    loan_capital = prop.loan_remaining or 0
    schedule = compute_amortization_schedule(
        principal=loan_capital,
        annual_rate=prop.loan_interest_rate or 0,
        duration_months=min(duration, prop.loan_duration_months or duration),
        insurance_rate=prop.loan_insurance_rate or 0,
    )

    # Build monthly projection
    monthly: list[dict[str, Any]] = []
    cumulative = 0
    total_interest = 0
    total_insurance = 0
    total_tax = 0
    total_rent = 0
    payback_month = 0

    start_date = prop.loan_start_date or date.today()

    for m in range(1, duration + 1):
        row_date = _add_months(start_date, m)

        if m <= len(schedule):
            amo = schedule[m - 1]
            loan_principal_m = amo["loan_principal"]
            loan_interest_m = amo["loan_interest"]
            loan_insurance_m = amo["loan_insurance"]
            remaining_cap = amo["remaining_capital"]
        else:
            loan_principal_m = 0
            loan_interest_m = 0
            loan_insurance_m = 0
            remaining_cap = 0

        credit_total = loan_principal_m + loan_interest_m + loan_insurance_m
        cashflow = effective_rent_m - total_charges_m - credit_total - tax_monthly
        cumulative += cashflow

        total_interest += loan_interest_m
        total_insurance += loan_insurance_m
        total_tax += tax_monthly
        total_rent += effective_rent_m

        if payback_month == 0 and cumulative > 0:
            payback_month = m

        monthly.append({
            "month": m,
            "date": row_date.isoformat(),
            "rent": effective_rent_m,
            "charges": total_charges_m,
            "loan_principal": loan_principal_m,
            "loan_interest": loan_interest_m,
            "loan_insurance": loan_insurance_m,
            "tax_monthly": tax_monthly,
            "cashflow": cashflow,
            "cumulative_cashflow": cumulative,
            "remaining_capital": remaining_cap,
        })

    # ROI at end
    purchase = prop.purchase_price or 0
    notary_fees = int(purchase * (prop.notary_fees_pct or 7.5) / 100)
    apport = purchase + notary_fees - (prop.loan_remaining or 0)
    if apport <= 0:
        apport = purchase + notary_fees  # fallback: assume full cash

    capital_gain = (prop.current_value or 0) - purchase
    net_rents = total_rent - (total_charges * 12 if False else 0)  # already net in cumulative
    roi_at_end = round(((capital_gain + cumulative) / apport) * 100, 2) if apport > 0 else 0.0

    return {
        "property_id": str(property_id),
        "duration_months": duration,
        "avg_monthly_cashflow": int(cumulative / duration) if duration > 0 else 0,
        "total_interest_paid": total_interest,
        "total_insurance_paid": total_insurance,
        "total_tax_paid": total_tax,
        "total_rent_collected": total_rent,
        "roi_at_end_pct": roi_at_end,
        "payback_months": payback_month,
        "monthly": monthly,
    }


# ═══════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════


async def _get_owned_property(
    db: AsyncSession,
    property_id: UUID,
    user_id: UUID,
) -> RealEstateProperty | None:
    """Fetch a property only if owned by user."""
    result = await db.execute(
        select(RealEstateProperty).where(
            RealEstateProperty.id == property_id,
            RealEstateProperty.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _prop_to_dict(prop: RealEstateProperty) -> dict[str, Any]:
    """Convert ORM property to dict for compute functions."""
    return {
        "purchase_price": prop.purchase_price,
        "monthly_rent": prop.monthly_rent,
        "monthly_charges": prop.monthly_charges,
        "monthly_loan_payment": prop.monthly_loan_payment,
        "current_value": prop.current_value,
        "taxe_fonciere": prop.taxe_fonciere,
        "assurance_pno": prop.assurance_pno,
        "vacancy_rate_pct": prop.vacancy_rate_pct,
        "notary_fees_pct": prop.notary_fees_pct,
        "provision_travaux": prop.provision_travaux,
        "fiscal_regime": prop.fiscal_regime,
        "tmi_pct": prop.tmi_pct,
        "loan_interest_rate": prop.loan_interest_rate,
        "loan_insurance_rate": prop.loan_insurance_rate,
        "loan_remaining": prop.loan_remaining,
        "loan_duration_months": prop.loan_duration_months,
    }


def _add_months(d: date, months: int) -> date:
    """Add N months to a date (day clamped to valid range)."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    import calendar
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)
