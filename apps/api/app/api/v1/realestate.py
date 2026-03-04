"""
OmniFlow — Real Estate API endpoints (Phase B3 enriched + F1.4 map + F1.7).
CRUD properties, DVF estimation, portfolio summary,
valuation history, DVF refresh, cash-flow projection,
DVF heatmap proxy, POI proxy (Overpass),
geocoding (BAN), walk score (POI-density).
"""

from __future__ import annotations

import hashlib
import json
import logging
import statistics
from datetime import datetime, timedelta
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.market import GeocodeResponse, WalkScoreResponse
from app.schemas.realestate import (
    CashFlowProjectionResponse,
    CreatePropertyRequest,
    DVFEstimationResponse,
    DVFRefreshResponse,
    PropertyResponse,
    RealEstateSummaryResponse,
    UpdatePropertyRequest,
    ValuationHistoryResponse,
)
from app.services import realestate_analytics, realestate_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/realestate", tags=["realestate"])

# ── Redis helper ──────────────────────────────────────────────

async def _redis_get(key: str):
    try:
        from app.core.redis import redis_client
        if redis_client:
            raw = await redis_client.get(key)
            if raw:
                return json.loads(raw)
    except Exception:
        pass
    return None


async def _redis_set(key: str, data, ttl: int = 3600):
    try:
        from app.core.redis import redis_client
        if redis_client:
            await redis_client.setex(key, ttl, json.dumps(data))
    except Exception:
        pass


@router.get("", response_model=RealEstateSummaryResponse)
async def get_realestate_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated real estate portfolio — all properties, yields, cash flow."""
    return await realestate_service.get_realestate_summary(db, user.id)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PropertyResponse)
async def create_property(
    body: CreatePropertyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new real estate property with automatic yield calculations."""
    prop = await realestate_service.create_property(
        db=db,
        user_id=user.id,
        data=body.model_dump(),
    )
    return _property_to_response(prop)


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: UUID,
    body: UpdatePropertyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a real estate property. Yields are recomputed automatically."""
    data = body.model_dump(exclude_unset=True)
    prop = await realestate_service.update_property(db, property_id, user.id, data)
    if not prop:
        raise HTTPException(status_code=404, detail="Bien immobilier non trouvé.")
    return _property_to_response(prop)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a real estate property."""
    deleted = await realestate_service.delete_property(db, property_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Bien immobilier non trouvé.")


@router.get("/dvf")
async def get_dvf_estimation(
    postal_code: str = Query(..., min_length=5, max_length=5),
    property_type: str = Query(default="apartment"),
    surface_m2: float | None = Query(default=None),
):
    """
    Get DVF (Demandes de Valeurs Foncières) price estimation for a location.
    Uses French government open data.
    """
    result = await realestate_service.get_dvf_estimation(
        postal_code=postal_code,
        property_type=property_type,
        surface_m2=surface_m2,
    )
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Aucune donnée DVF disponible pour le code postal {postal_code}.",
        )
    return result


# ── B3 Endpoints ─────────────────────────────────────────────


@router.get("/{property_id}/valuations", response_model=ValuationHistoryResponse)
async def get_valuation_history(
    property_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get DVF valuation history for a property."""
    history = await realestate_analytics.get_valuation_history(db, property_id, user.id)
    return {"property_id": str(property_id), "valuations": history}


@router.post("/{property_id}/refresh-dvf", response_model=DVFRefreshResponse)
async def refresh_dvf(
    property_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force-refresh DVF estimation, create a new valuation snapshot."""
    result = await realestate_analytics.refresh_dvf_valuation(db, property_id, user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Bien immobilier non trouvé.")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/{property_id}/cashflow", response_model=CashFlowProjectionResponse)
async def get_cashflow_projection(
    property_id: UUID,
    months: int | None = Query(default=None, ge=1, le=600, description="Projection duration in months"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed cash-flow projection with amortization schedule."""
    result = await realestate_analytics.get_cashflow_projection(db, property_id, user.id, months)
    if not result:
        raise HTTPException(status_code=404, detail="Bien immobilier non trouvé.")
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# F1.4 — Map-related endpoints
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DVF_CQUEST_URL = "https://api.cquest.org/dvf"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


@router.get("/dvf-heatmap")
async def get_dvf_heatmap(
    postal_code: str = Query(..., min_length=5, max_length=5, description="French postal code"),
    property_type: str = Query(default="Appartement", description="Type local DVF"),
):
    """
    Get DVF aggregated price data for a postal code.
    Returns median price/m², transaction count, average surface.
    Source: api.cquest.org/dvf — French open data, no API key.
    """
    cache_key = f"dvf:heatmap:{postal_code}:{property_type}"
    cached = await _redis_get(cache_key)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                DVF_CQUEST_URL,
                params={
                    "code_postal": postal_code,
                    "type_local": property_type,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"DVF heatmap error for {postal_code}: {e}")
        raise HTTPException(status_code=502, detail="DVF API indisponible")

    features = data.get("features") or []
    if not features:
        return {
            "postal_code": postal_code,
            "median_price_m2": None,
            "nb_transactions": 0,
            "avg_surface": None,
        }

    # Filter recent (last 24 months) and extract price/m²
    cutoff = datetime.now() - timedelta(days=730)
    prices_m2: list[float] = []
    surfaces: list[float] = []

    for feat in features:
        props = feat.get("properties", {})
        try:
            date_str = props.get("date_mutation", "")
            if date_str:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                if dt < cutoff:
                    continue
            surface = float(props.get("surface_reelle_bati") or props.get("surface_terrain") or 0)
            valeur = float(props.get("valeur_fonciere") or 0)
            if surface > 5 and valeur > 1000:
                prices_m2.append(valeur / surface)
                surfaces.append(surface)
        except (ValueError, TypeError):
            continue

    if not prices_m2:
        result = {
            "postal_code": postal_code,
            "median_price_m2": None,
            "nb_transactions": 0,
            "avg_surface": None,
        }
    else:
        result = {
            "postal_code": postal_code,
            "median_price_m2": round(statistics.median(prices_m2)),
            "nb_transactions": len(prices_m2),
            "avg_surface": round(statistics.mean(surfaces), 1),
            "min_price_m2": round(min(prices_m2)),
            "max_price_m2": round(max(prices_m2)),
        }

    await _redis_set(cache_key, result, ttl=604800)  # 7 days
    return result


@router.get("/poi")
async def get_nearby_poi(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(default=1000, ge=100, le=5000, description="Search radius in meters"),
):
    """
    Get nearby Points of Interest via Overpass API (OpenStreetMap).
    Returns categorized POI within radius of (lat, lng).
    Categories: transport, education, health, commerce, parks.
    """
    cache_key = f"poi:{lat:.4f}:{lng:.4f}:{radius}"
    cached = await _redis_get(cache_key)
    if cached:
        return cached

    # Overpass QL query — fetch amenities, railway stations, shops, parks
    overpass_query = f"""
    [out:json][timeout:15];
    (
      node["railway"~"station|tram_stop"](around:{radius},{lat},{lng});
      node["amenity"~"school|university|college|kindergarten"](around:{radius},{lat},{lng});
      node["amenity"~"hospital|clinic|pharmacy"](around:{radius},{lat},{lng});
      node["shop"~"supermarket|convenience|bakery"](around:{radius},{lat},{lng});
      node["amenity"="marketplace"](around:{radius},{lat},{lng});
      node["leisure"~"park|garden"](around:{radius},{lat},{lng});
      way["leisure"~"park|garden"](around:{radius},{lat},{lng});
    );
    out center 100;
    """

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                OVERPASS_URL,
                data={"data": overpass_query},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"Overpass API error: {e}")
        raise HTTPException(status_code=502, detail="Overpass API indisponible")

    # Parse and categorize results
    pois: list[dict] = []
    seen = set()

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name", "")

        # Get coordinates (node has lat/lon, way has center)
        poi_lat = element.get("lat") or (element.get("center", {}).get("lat"))
        poi_lng = element.get("lon") or (element.get("center", {}).get("lon"))
        if not poi_lat or not poi_lng:
            continue

        # Deduplicate by name+position
        dedup_key = f"{name}:{poi_lat:.4f}:{poi_lng:.4f}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Categorize
        category = None
        poi_type = ""

        if tags.get("railway") in ("station", "tram_stop"):
            category = "transport"
            poi_type = tags.get("railway", "station")
        elif tags.get("amenity") in ("school", "university", "college", "kindergarten"):
            category = "education"
            poi_type = tags.get("amenity", "school")
        elif tags.get("amenity") in ("hospital", "clinic", "pharmacy"):
            category = "health"
            poi_type = tags.get("amenity", "health")
        elif tags.get("shop") in ("supermarket", "convenience", "bakery") or tags.get("amenity") == "marketplace":
            category = "commerce"
            poi_type = tags.get("shop") or "marketplace"
        elif tags.get("leisure") in ("park", "garden"):
            category = "parks"
            poi_type = tags.get("leisure", "park")

        if category:
            pois.append({
                "category": category,
                "name": name or f"{poi_type.capitalize()} sans nom",
                "type": poi_type,
                "lat": round(poi_lat, 6),
                "lng": round(poi_lng, 6),
            })

    result = {"pois": pois, "count": len(pois), "radius": radius}
    await _redis_set(cache_key, result, ttl=86400)  # 24h
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# F1.7 — Geocode + Walk Score endpoints
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode_address(
    q: str = Query(..., min_length=3, max_length=200, description="French address to geocode"),
    limit: int = Query(5, ge=1, le=20),
):
    """
    Geocode a French address via the BAN (Base Adresse Nationale) API.
    Free, unlimited, sovereign French geocoding — no API key required.
    Returns ranked results with coordinates, score, city, context.
    """
    from app.services.geocoding_service import geocode_single

    try:
        from app.core.redis import redis_client as _redis
        redis = _redis
    except Exception:
        redis = None

    results = await geocode_single(query=q, limit=limit, redis_client=redis)
    return {"results": results, "query": q}


@router.get("/walkscore", response_model=WalkScoreResponse)
async def get_walkscore(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """
    Compute walk score for a location based on POI density (Overpass API).
    100% open-source algorithm inspired by walkscore.com.
    Categories: transport (30pt), commerce (25pt), education (15pt),
    health (15pt), leisure (15pt). Distance decay: e^(-d/500).
    """
    from app.services.walkscore_service import compute_walkscore

    try:
        from app.core.redis import redis_client as _redis
        redis = _redis
    except Exception:
        redis = None

    return await compute_walkscore(lat=lat, lng=lng, redis_client=redis)


def _property_to_response(prop) -> dict:
    """Convert ORM property to response dict (B3 enriched)."""
    return {
        "id": prop.id,
        "label": prop.label,
        "address": prop.address,
        "city": prop.city,
        "postal_code": prop.postal_code,
        "latitude": getattr(prop, "latitude", None),
        "longitude": getattr(prop, "longitude", None),
        "property_type": prop.property_type.value if hasattr(prop.property_type, "value") else str(prop.property_type),
        "surface_m2": prop.surface_m2,
        "purchase_price": prop.purchase_price,
        "purchase_date": prop.purchase_date,
        "current_value": prop.current_value,
        "dvf_estimation": prop.dvf_estimation,
        "monthly_rent": prop.monthly_rent,
        "monthly_charges": prop.monthly_charges,
        "monthly_loan_payment": prop.monthly_loan_payment,
        "loan_remaining": prop.loan_remaining,
        "net_monthly_cashflow": prop.net_monthly_cashflow,
        "gross_yield_pct": prop.gross_yield_pct,
        "net_yield_pct": prop.net_yield_pct,
        "net_net_yield_pct": getattr(prop, "net_net_yield_pct", 0.0),
        "capital_gain": prop.capital_gain,
        "annual_tax_burden": getattr(prop, "annual_tax_burden", 0),
        "fiscal_regime": getattr(prop, "fiscal_regime", "micro_foncier"),
        "tmi_pct": getattr(prop, "tmi_pct", 30.0),
        "taxe_fonciere": getattr(prop, "taxe_fonciere", 0),
        "assurance_pno": getattr(prop, "assurance_pno", 0),
        "vacancy_rate_pct": getattr(prop, "vacancy_rate_pct", 0.0),
        "notary_fees_pct": getattr(prop, "notary_fees_pct", 7.5),
        "provision_travaux": getattr(prop, "provision_travaux", 0),
        "loan_interest_rate": getattr(prop, "loan_interest_rate", 0.0),
        "loan_insurance_rate": getattr(prop, "loan_insurance_rate", 0.0),
        "loan_duration_months": getattr(prop, "loan_duration_months", 0),
        "loan_start_date": getattr(prop, "loan_start_date", None),
        "created_at": prop.created_at,
    }
