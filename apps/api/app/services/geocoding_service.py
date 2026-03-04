"""
OmniFlow — Geocoding Service via Base Adresse Nationale (BAN).
Phase F1.7-⑤: Sovereign French geocoding — free, unlimited, no API key.

API: https://api-adresse.data.gouv.fr
  - GET /search/?q={address}&limit=5  → single geocoding
  - GET /reverse/?lat=&lon=           → reverse geocoding
  - POST /search/csv/                 → batch geocoding (CSV)

Features:
  - geocode_single(address) → list of GeocodeResult
  - reverse_geocode(lat, lng) → GeocodeResult
  - Cache: 90 days (addresses don't move)
"""

from __future__ import annotations

import json
import logging

import httpx

logger = logging.getLogger(__name__)

BAN_BASE_URL = "https://api-adresse.data.gouv.fr"


async def geocode_single(
    query: str,
    limit: int = 5,
    redis_client=None,
) -> list[dict]:
    """
    Geocode a French address via BAN API.
    Returns list of results matching GeocodeResult schema.
    """
    cache_key = f"geocode:{query.strip().lower()[:120]}:{limit}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    url = f"{BAN_BASE_URL}/search/"
    params = {"q": query, "limit": limit}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("BAN geocoding failed for '%s': %s", query, e)
        return []

    results: list[dict] = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates", [0, 0])

        results.append({
            "lat": coords[1],  # GeoJSON is [lng, lat]
            "lng": coords[0],
            "score": props.get("score", 0.0),
            "label": props.get("label", ""),
            "context": props.get("context", ""),
            "postcode": props.get("postcode", ""),
            "city": props.get("city", ""),
            "importance": props.get("importance", 0.0),
        })

    # Cache 90 days
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(results), ex=7_776_000)
        except Exception:
            pass

    return results


async def reverse_geocode(
    lat: float,
    lng: float,
    redis_client=None,
) -> dict | None:
    """
    Reverse geocode coordinates to a French address via BAN API.
    Returns single GeocodeResult or None.
    """
    cache_key = f"reverse_geocode:{lat:.6f}:{lng:.6f}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    url = f"{BAN_BASE_URL}/reverse/"
    params = {"lat": lat, "lon": lng}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("BAN reverse geocoding failed for (%s,%s): %s", lat, lng, e)
        return None

    features = data.get("features", [])
    if not features:
        return None

    feature = features[0]
    props = feature.get("properties", {})
    geom = feature.get("geometry", {})
    coords = geom.get("coordinates", [0, 0])

    result = {
        "lat": coords[1],
        "lng": coords[0],
        "score": props.get("score", 0.0),
        "label": props.get("label", ""),
        "context": props.get("context", ""),
        "postcode": props.get("postcode", ""),
        "city": props.get("city", ""),
        "importance": props.get("importance", 0.0),
    }

    # Cache 90 days
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(result), ex=7_776_000)
        except Exception:
            pass

    return result
