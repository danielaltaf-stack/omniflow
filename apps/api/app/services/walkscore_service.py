"""
OmniFlow — Walk Score Calculator Service.
Phase F1.7-④: POI-density-based walkability scoring via Overpass API.

Algorithm (inspired by walkscore.com, 100% open-source):
  1. Fetch POI within 1.5km via Overpass (reuses existing query pattern)
  2. Weight by category (total 100 points):
     - Transport (gares, métro, tram, bus): 30 pts max
     - Commerce (supermarché, boulangerie, pharmacie): 25 pts max
     - Éducation (écoles, universités): 15 pts max
     - Santé (hôpital, clinique, pharmacie): 15 pts max
     - Loisirs (parcs, jardins, sport): 15 pts max
  3. Distance decay: score = base × e^(-distance/500)
  4. Final score capped at 100, classified into human-readable label

Labels:
  90-100 : Walker's Paradise
  70-89  : Very Walkable
  50-69  : Somewhat Walkable
  25-49  : Car-Dependent
  0-24   : Almost All Errands Require a Car
"""

from __future__ import annotations

import json
import logging
import math

import httpx

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Maximum points per category
CATEGORY_WEIGHTS = {
    "transport": 30,
    "commerce": 25,
    "education": 15,
    "health": 15,
    "leisure": 15,
}

# Distance decay constant (meters). POI at this distance contributes ~37% of base score.
DECAY_CONSTANT = 500.0

# Search radius
SEARCH_RADIUS = 1500


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute haversine distance in meters between two points."""
    R = 6_371_000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _categorize_element(tags: dict) -> str | None:
    """Categorize an OSM element into our scoring categories."""
    if tags.get("railway") in ("station", "tram_stop"):
        return "transport"
    if tags.get("public_transport") == "station":
        return "transport"
    if tags.get("highway") == "bus_stop":
        return "transport"
    if tags.get("amenity") in ("bus_station",):
        return "transport"

    if tags.get("amenity") in ("school", "university", "college", "kindergarten", "library"):
        return "education"

    if tags.get("amenity") in ("hospital", "clinic", "pharmacy", "doctors", "dentist"):
        return "health"

    if tags.get("shop") in (
        "supermarket", "convenience", "bakery", "butcher", "greengrocer",
        "deli", "pastry", "general",
    ):
        return "commerce"
    if tags.get("amenity") in ("marketplace", "post_office", "bank"):
        return "commerce"

    if tags.get("leisure") in ("park", "garden", "playground", "sports_centre", "fitness_centre"):
        return "leisure"
    if tags.get("amenity") in ("theatre", "cinema", "restaurant", "cafe"):
        return "leisure"

    return None


def _compute_category_score(
    distances: list[float],
    max_points: int,
) -> int:
    """
    Compute score for one category given distances of all POI in that category.
    Uses exponential decay: each POI contributes base × e^(-dist/DECAY_CONSTANT).
    The base value per POI decreases with count to avoid oversaturation.
    """
    if not distances:
        return 0

    # Sort by proximity
    distances.sort()

    total = 0.0
    for i, dist in enumerate(distances):
        # Diminishing returns: first POI worth more than 10th
        base = max_points / (1 + i * 0.5)
        decay = math.exp(-dist / DECAY_CONSTANT)
        total += base * decay

    return min(max_points, int(round(total)))


def _label_from_score(score: int) -> str:
    """Convert numeric score to human-readable label."""
    if score >= 90:
        return "Walker's Paradise"
    if score >= 70:
        return "Very Walkable"
    if score >= 50:
        return "Somewhat Walkable"
    if score >= 25:
        return "Car-Dependent"
    return "Almost All Errands Require a Car"


async def compute_walkscore(
    lat: float,
    lng: float,
    redis_client=None,
) -> dict:
    """
    Main entry point: compute walk score for a location.
    Returns dict matching WalkScoreResponse schema.
    """
    cache_key = f"walkscore:{lat:.5f}:{lng:.5f}"
    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    # Extended Overpass query covering all scoring categories
    overpass_query = f"""
    [out:json][timeout:20];
    (
      node["railway"~"station|tram_stop"](around:{SEARCH_RADIUS},{lat},{lng});
      node["public_transport"="station"](around:{SEARCH_RADIUS},{lat},{lng});
      node["highway"="bus_stop"](around:{SEARCH_RADIUS},{lat},{lng});
      node["amenity"~"school|university|college|kindergarten|library"](around:{SEARCH_RADIUS},{lat},{lng});
      node["amenity"~"hospital|clinic|pharmacy|doctors|dentist"](around:{SEARCH_RADIUS},{lat},{lng});
      node["shop"~"supermarket|convenience|bakery|butcher|greengrocer|general"](around:{SEARCH_RADIUS},{lat},{lng});
      node["amenity"~"marketplace|post_office|bank"](around:{SEARCH_RADIUS},{lat},{lng});
      node["leisure"~"park|garden|playground|sports_centre"](around:{SEARCH_RADIUS},{lat},{lng});
      node["amenity"~"restaurant|cafe|cinema|theatre"](around:{SEARCH_RADIUS},{lat},{lng});
      way["leisure"~"park|garden"](around:{SEARCH_RADIUS},{lat},{lng});
    );
    out center 300;
    """

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                OVERPASS_URL,
                data={"data": overpass_query},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning("Overpass API error for walkscore (%s,%s): %s", lat, lng, e)
        return {
            "score": 0,
            "label": "Unknown",
            "breakdown": {cat: 0 for cat in CATEGORY_WEIGHTS},
            "poi_count": 0,
            "radius_m": SEARCH_RADIUS,
        }

    # Group POI by category with distances
    category_distances: dict[str, list[float]] = {cat: [] for cat in CATEGORY_WEIGHTS}
    seen = set()
    total_poi = 0

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        poi_lat = element.get("lat") or (element.get("center", {}).get("lat"))
        poi_lng = element.get("lon") or (element.get("center", {}).get("lon"))
        if not poi_lat or not poi_lng:
            continue

        # Deduplicate by approximate position
        dedup = f"{poi_lat:.4f}:{poi_lng:.4f}"
        if dedup in seen:
            continue
        seen.add(dedup)

        category = _categorize_element(tags)
        if not category:
            continue

        dist = _haversine(lat, lng, poi_lat, poi_lng)
        category_distances[category].append(dist)
        total_poi += 1

    # Compute per-category scores
    breakdown: dict[str, int] = {}
    total_score = 0
    for cat, max_pts in CATEGORY_WEIGHTS.items():
        cat_score = _compute_category_score(category_distances[cat], max_pts)
        breakdown[cat] = cat_score
        total_score += cat_score

    final_score = min(100, total_score)
    label = _label_from_score(final_score)

    result = {
        "score": final_score,
        "label": label,
        "breakdown": breakdown,
        "poi_count": total_poi,
        "radius_m": SEARCH_RADIUS,
    }

    # Cache 30 days
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(result), ex=2_592_000)
        except Exception:
            pass

    return result
