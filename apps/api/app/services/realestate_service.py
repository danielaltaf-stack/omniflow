"""
OmniFlow — Real Estate Service.
Manual entry + DVF API (Demandes de Valeurs Foncières) for local estimation.
Rental yield & cash flow calculations.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client
from app.models.real_estate import RealEstateProperty, PropertyType

logger = logging.getLogger(__name__)

DVF_API_BASE = "https://api.cquest.org/dvf"
DVF_CACHE_TTL = 86400  # 24h


# ── DVF API (Demandes de Valeurs Foncières) ──────────────────

async def get_dvf_estimation(
    postal_code: str,
    property_type: str = "apartment",
    surface_m2: float | None = None,
) -> dict[str, Any] | None:
    """
    Get average square meter price from DVF open data for a postal code.
    Uses the CQuest DVF API (free, no auth needed).
    Returns {price_m2: int (centimes), nb_transactions: int, periode: str}.
    """
    cache_key = f"dvf:{postal_code}:{property_type}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Map to DVF type
    dvf_type = "Appartement" if property_type in ("apartment",) else "Maison"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                DVF_API_BASE,
                params={
                    "code_postal": postal_code,
                    "type_local": dvf_type,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("DVF API failed for %s: %s", postal_code, e)
        return None

    results = data.get("resultats", [])
    if not results:
        # Fallback: try alternative DVF endpoint
        return await _dvf_fallback(postal_code, property_type, surface_m2)

    # Calculate average price per m2 from recent transactions
    prices = []
    for r in results:
        surface = r.get("surface_reelle_bati", 0)
        value = r.get("valeur_fonciere", 0)
        if surface > 0 and value > 0:
            prices.append(value / surface)

    if not prices:
        return None

    avg_price_m2 = sum(prices) / len(prices)
    estimation = None
    if surface_m2 and surface_m2 > 0:
        estimation = int(avg_price_m2 * surface_m2 * 100)  # centimes

    result = {
        "price_m2_centimes": int(avg_price_m2 * 100),
        "nb_transactions": len(prices),
        "estimation_centimes": estimation,
    }

    await redis_client.set(cache_key, json.dumps(result), ex=DVF_CACHE_TTL)
    return result


async def _dvf_fallback(
    postal_code: str,
    property_type: str,
    surface_m2: float | None,
) -> dict[str, Any] | None:
    """Fallback DVF estimation using data.gouv.fr geo API."""
    try:
        dvf_type = "Appartement" if property_type in ("apartment",) else "Maison"
        url = "https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params={
                "code_postal": postal_code,
                "nature_mutation": "Vente",
                "type_local": dvf_type,
                "page_size": 50,
            })
            if resp.status_code != 200:
                return None
            data = resp.json()

        results = data.get("results", [])
        prices = []
        for r in results:
            surface = r.get("surface_reelle_bati")
            value = r.get("valeur_fonciere")
            if surface and value and surface > 0 and value > 0:
                prices.append(value / surface)

        if not prices:
            return None

        avg_price_m2 = sum(prices) / len(prices)
        estimation = int(avg_price_m2 * surface_m2 * 100) if surface_m2 else None

        return {
            "price_m2_centimes": int(avg_price_m2 * 100),
            "nb_transactions": len(prices),
            "estimation_centimes": estimation,
        }
    except Exception as e:
        logger.warning("DVF fallback failed: %s", e)
        return None


# ── CRUD Operations ──────────────────────────────────────────

def _compute_yields(prop: dict[str, Any]) -> dict[str, Any]:
    """Compute yield and cash flow metrics (delegates to B3 net-net engine)."""
    from app.services.realestate_analytics import compute_net_net_yield
    return compute_net_net_yield(prop)


async def create_property(
    db: AsyncSession,
    user_id: UUID,
    data: dict[str, Any],
) -> RealEstateProperty:
    """Create a new real estate property with computed yields."""
    yields = _compute_yields(data)

    # Try DVF estimation
    dvf_estimation = None
    if data.get("postal_code") and data.get("surface_m2"):
        dvf_result = await get_dvf_estimation(
            data["postal_code"],
            data.get("property_type", "apartment"),
            data.get("surface_m2"),
        )
        if dvf_result and dvf_result.get("estimation_centimes"):
            dvf_estimation = dvf_result["estimation_centimes"]

    prop = RealEstateProperty(
        user_id=user_id,
        label=data["label"],
        address=data.get("address"),
        city=data.get("city"),
        postal_code=data.get("postal_code"),
        property_type=data.get("property_type", "apartment"),
        surface_m2=data.get("surface_m2"),
        purchase_price=data["purchase_price"],
        purchase_date=data.get("purchase_date"),
        current_value=data["current_value"],
        dvf_estimation=dvf_estimation,
        monthly_rent=data.get("monthly_rent", 0),
        monthly_charges=data.get("monthly_charges", 0),
        monthly_loan_payment=data.get("monthly_loan_payment", 0),
        loan_remaining=data.get("loan_remaining", 0),
        # B3 fiscal & loan fields
        fiscal_regime=data.get("fiscal_regime", "micro_foncier"),
        tmi_pct=data.get("tmi_pct", 30.0),
        taxe_fonciere=data.get("taxe_fonciere", 0),
        assurance_pno=data.get("assurance_pno", 0),
        vacancy_rate_pct=data.get("vacancy_rate_pct", 0.0),
        notary_fees_pct=data.get("notary_fees_pct", 7.5),
        provision_travaux=data.get("provision_travaux", 0),
        loan_interest_rate=data.get("loan_interest_rate", 0.0),
        loan_insurance_rate=data.get("loan_insurance_rate", 0.0),
        loan_duration_months=data.get("loan_duration_months", 0),
        loan_start_date=data.get("loan_start_date"),
        **yields,
    )
    db.add(prop)
    await db.commit()
    await db.refresh(prop)
    return prop


async def update_property(
    db: AsyncSession,
    property_id: UUID,
    user_id: UUID,
    data: dict[str, Any],
) -> RealEstateProperty | None:
    """Update a real estate property."""
    result = await db.execute(
        select(RealEstateProperty).where(
            RealEstateProperty.id == property_id,
            RealEstateProperty.user_id == user_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        return None

    # Update fields
    for field in [
        "label", "address", "city", "postal_code", "property_type", "surface_m2",
        "purchase_price", "purchase_date", "current_value", "monthly_rent",
        "monthly_charges", "monthly_loan_payment", "loan_remaining",
        # B3 fields
        "fiscal_regime", "tmi_pct", "taxe_fonciere", "assurance_pno",
        "vacancy_rate_pct", "notary_fees_pct", "provision_travaux",
        "loan_interest_rate", "loan_insurance_rate", "loan_duration_months",
        "loan_start_date",
    ]:
        if field in data:
            setattr(prop, field, data[field])

    # Recompute yields (B3 net-net aware)
    yields = _compute_yields({
        "purchase_price": prop.purchase_price,
        "current_value": prop.current_value,
        "monthly_rent": prop.monthly_rent,
        "monthly_charges": prop.monthly_charges,
        "monthly_loan_payment": prop.monthly_loan_payment,
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
    })
    for k, v in yields.items():
        setattr(prop, k, v)

    # Refresh DVF estimation if postal code or surface changed
    if ("postal_code" in data or "surface_m2" in data) and prop.postal_code and prop.surface_m2:
        dvf_result = await get_dvf_estimation(
            prop.postal_code,
            prop.property_type.value if hasattr(prop.property_type, "value") else str(prop.property_type),
            prop.surface_m2,
        )
        if dvf_result and dvf_result.get("estimation_centimes"):
            prop.dvf_estimation = dvf_result["estimation_centimes"]

    await db.commit()
    await db.refresh(prop)
    return prop


async def get_user_properties(db: AsyncSession, user_id: UUID) -> list[RealEstateProperty]:
    """Get all real estate properties for a user."""
    result = await db.execute(
        select(RealEstateProperty)
        .where(RealEstateProperty.user_id == user_id)
        .order_by(RealEstateProperty.created_at)
    )
    return list(result.scalars().all())


async def get_realestate_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """Aggregate real estate portfolio summary."""
    properties = await get_user_properties(db, user_id)

    total_value = sum(p.current_value or 0 for p in properties)
    total_purchase = sum(p.purchase_price or 0 for p in properties)
    total_capital_gain = total_value - total_purchase
    total_monthly_rent = sum(p.monthly_rent or 0 for p in properties)
    total_monthly_charges = sum(p.monthly_charges or 0 for p in properties)
    total_monthly_loan = sum(p.monthly_loan_payment or 0 for p in properties)
    total_loan_remaining = sum(p.loan_remaining or 0 for p in properties)
    net_cashflow = total_monthly_rent - total_monthly_charges - total_monthly_loan
    avg_gross_yield = round((total_monthly_rent * 12 / total_purchase) * 100, 2) if total_purchase > 0 else 0.0

    return {
        "total_value": total_value,
        "total_purchase_price": total_purchase,
        "total_capital_gain": total_capital_gain,
        "total_capital_gain_pct": round((total_capital_gain / total_purchase) * 100, 2) if total_purchase > 0 else 0.0,
        "total_monthly_rent": total_monthly_rent,
        "total_monthly_charges": total_monthly_charges,
        "total_monthly_loan": total_monthly_loan,
        "total_loan_remaining": total_loan_remaining,
        "net_monthly_cashflow": net_cashflow,
        "avg_gross_yield_pct": avg_gross_yield,
        "properties_count": len(properties),
        "properties": [
            {
                "id": str(p.id),
                "label": p.label,
                "address": p.address,
                "city": p.city,
                "postal_code": p.postal_code,
                "latitude": getattr(p, "latitude", None),
                "longitude": getattr(p, "longitude", None),
                "property_type": p.property_type.value if hasattr(p.property_type, "value") else str(p.property_type),
                "surface_m2": p.surface_m2,
                "purchase_price": p.purchase_price,
                "current_value": p.current_value,
                "dvf_estimation": p.dvf_estimation,
                "monthly_rent": p.monthly_rent,
                "monthly_charges": p.monthly_charges,
                "monthly_loan_payment": p.monthly_loan_payment,
                "loan_remaining": p.loan_remaining,
                "net_monthly_cashflow": p.net_monthly_cashflow,
                "gross_yield_pct": p.gross_yield_pct,
                "net_yield_pct": p.net_yield_pct,
                "net_net_yield_pct": p.net_net_yield_pct,
                "capital_gain": p.capital_gain,
                "annual_tax_burden": p.annual_tax_burden,
                # B3 detail fields
                "fiscal_regime": p.fiscal_regime,
                "tmi_pct": p.tmi_pct,
                "taxe_fonciere": p.taxe_fonciere,
                "assurance_pno": p.assurance_pno,
                "vacancy_rate_pct": p.vacancy_rate_pct,
                "notary_fees_pct": p.notary_fees_pct,
                "provision_travaux": p.provision_travaux,
                "loan_interest_rate": p.loan_interest_rate,
                "loan_insurance_rate": p.loan_insurance_rate,
                "loan_duration_months": p.loan_duration_months,
                "loan_start_date": p.loan_start_date.isoformat() if p.loan_start_date else None,
                "purchase_date": p.purchase_date.isoformat() if p.purchase_date else None,
                "created_at": p.created_at,
            }
            for p in properties
        ],
    }


async def delete_property(db: AsyncSession, property_id: UUID, user_id: UUID) -> bool:
    """Delete a real estate property."""
    result = await db.execute(
        select(RealEstateProperty).where(
            RealEstateProperty.id == property_id,
            RealEstateProperty.user_id == user_id,
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        return False

    await db.delete(prop)
    await db.commit()
    return True
