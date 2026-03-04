"""
OmniFlow — Heritage / Succession Simulation Engine (Phase C2).

French inheritance tax simulator:
  - Full 2026 tax brackets (art. 777 CGI)
  - Deductions per heir relationship (art. 779 CGI)
  - Spousal exemption (loi TEPA 2007)
  - Life insurance (art. 990 I & 757 B CGI)
  - Dismemberment / usufruct valuation (art. 669 CGI)
  - Donation optimization with 15-year renewal
  - Timeline projection with inflation

All monetary values in centimes (int).  Rates in percent (float).
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.heritage_simulation import HeritageSimulation
from app.services.retirement_engine import collect_patrimoine

logger = logging.getLogger("omniflow.heritage_engine")


# ══════════════════════════════════════════════════════════════
#  FRENCH TAX CONSTANTS (2026)
# ══════════════════════════════════════════════════════════════

# ── Succession tax brackets — ligne directe (art. 777 CGI) ──
BRACKETS_LIGNE_DIRECTE: list[tuple[int, float]] = [
    (807_200, 0.05),        # ≤ 8 072 €
    (1_210_900, 0.10),      # 8 072 — 12 109 €
    (1_593_200, 0.15),      # 12 109 — 15 932 €
    (55_232_400, 0.20),     # 15 932 — 552 324 €
    (90_283_800, 0.30),     # 552 324 — 902 838 €
    (180_567_700, 0.40),    # 902 838 — 1 805 677 €
    (None, 0.45),           # > 1 805 677 €
]

# ── Brackets — frères / sœurs ───────────────────────────────
BRACKETS_FRERE_SOEUR: list[tuple[int | None, float]] = [
    (2_443_000, 0.35),      # ≤ 24 430 €
    (None, 0.45),           # > 24 430 €
]

# ── Flat rates ───────────────────────────────────────────────
RATE_NEVEU_NIECE = 0.55
RATE_TIERS = 0.60

# ── Deductions (abattements) art. 779 CGI ───────────────────
ABATTEMENT: dict[str, int] = {
    "conjoint": 0,          # Exonerated (TEPA 2007) — handled separately
    "enfant": 10_000_000,   # 100 000 €
    "petit_enfant": 3_186_500,  # 31 865 €
    "frere_soeur": 1_593_200,   # 15 932 €
    "neveu_niece": 796_700,     # 7 967 €
    "tiers": 159_400,           # 1 594 €
}

ABATTEMENT_HANDICAP = 15_932_500  # 159 325 € — cumulative

# ── Life insurance thresholds ────────────────────────────────
LI_ABATTEMENT_BEFORE_70 = 15_250_000   # 152 500 € per beneficiary
LI_RATE_TRANCHE_1 = 0.20               # ≤ 700 000 € (70_000_000 cts)
LI_THRESHOLD_TRANCHE_2 = 70_000_000    # 700 000 €
LI_RATE_TRANCHE_2 = 0.3125             # > 700 000 €
LI_ABATTEMENT_AFTER_70_GLOBAL = 3_050_000  # 30 500 € global

# ── Dismemberment table (art. 669 CGI) ──────────────────────
# (max_age_exclusive, usufruct_pct)
DEMEMBREMENT_TABLE: list[tuple[int, float]] = [
    (21, 0.90),
    (31, 0.80),
    (41, 0.70),
    (51, 0.60),
    (61, 0.50),
    (71, 0.40),
    (81, 0.30),
    (91, 0.20),
    (999, 0.10),
]

DONATION_RENEWAL_YEARS = 15


# ══════════════════════════════════════════════════════════════
#  TAX COMPUTATION FUNCTIONS
# ══════════════════════════════════════════════════════════════

def compute_abattement(relationship: str, handicap: bool = False) -> int:
    """Return the applicable tax deduction in centimes."""
    base = ABATTEMENT.get(relationship, ABATTEMENT["tiers"])
    if handicap:
        base += ABATTEMENT_HANDICAP
    return base


def compute_succession_tax_ligne_directe(taxable: int) -> int:
    """Apply progressive brackets for children / grandchildren."""
    if taxable <= 0:
        return 0
    remaining = taxable
    tax = 0
    prev_limit = 0
    for limit, rate in BRACKETS_LIGNE_DIRECTE:
        if limit is None:
            tax += int(remaining * rate)
            remaining = 0
            break
        bracket_size = limit - prev_limit
        if remaining <= bracket_size:
            tax += int(remaining * rate)
            remaining = 0
            break
        tax += int(bracket_size * rate)
        remaining -= bracket_size
        prev_limit = limit
    return tax


def compute_succession_tax_frere_soeur(taxable: int) -> int:
    """Apply brackets for siblings."""
    if taxable <= 0:
        return 0
    remaining = taxable
    tax = 0
    prev_limit = 0
    for limit, rate in BRACKETS_FRERE_SOEUR:
        if limit is None:
            tax += int(remaining * rate)
            remaining = 0
            break
        bracket_size = limit - prev_limit
        if remaining <= bracket_size:
            tax += int(remaining * rate)
            remaining = 0
            break
        tax += int(bracket_size * rate)
        remaining -= bracket_size
        prev_limit = limit
    return tax


def compute_succession_tax(taxable: int, relationship: str) -> int:
    """Compute succession tax for a given taxable amount and relationship."""
    if relationship == "conjoint":
        return 0  # Fully exempt (TEPA 2007)

    if relationship in ("enfant", "petit_enfant"):
        return compute_succession_tax_ligne_directe(taxable)

    if relationship == "frere_soeur":
        return compute_succession_tax_frere_soeur(taxable)

    if relationship == "neveu_niece":
        return int(max(taxable, 0) * RATE_NEVEU_NIECE)

    # tiers and anything else
    return int(max(taxable, 0) * RATE_TIERS)


def compute_life_insurance_tax(
    amount_before_70: int,
    amount_after_70: int,
    n_beneficiaries: int,
) -> dict[str, Any]:
    """
    Compute life insurance specific taxation.
    Returns breakdown dict.
    """
    n_benef = max(n_beneficiaries, 1)

    # ── Before 70 (art. 990 I) ────────────────────────
    per_benef_before = amount_before_70 // n_benef
    taxable_before_per = max(per_benef_before - LI_ABATTEMENT_BEFORE_70, 0)

    tax_before_per = 0
    if taxable_before_per > 0:
        tranche_1 = min(taxable_before_per, LI_THRESHOLD_TRANCHE_2 - LI_ABATTEMENT_BEFORE_70)
        tranche_1 = max(tranche_1, 0)
        tax_before_per = int(tranche_1 * LI_RATE_TRANCHE_1)
        excess = max(taxable_before_per - tranche_1, 0)
        tax_before_per += int(excess * LI_RATE_TRANCHE_2)

    total_tax_before = tax_before_per * n_benef

    # ── After 70 (art. 757 B) ─────────────────────────
    taxable_after = max(amount_after_70 - LI_ABATTEMENT_AFTER_70_GLOBAL, 0)
    # Integrated into common law — assume average ligne directe rate
    tax_after = compute_succession_tax_ligne_directe(taxable_after // n_benef) * n_benef

    return {
        "amount_before_70": amount_before_70,
        "amount_after_70": amount_after_70,
        "abattement_before_70_per_benef": LI_ABATTEMENT_BEFORE_70,
        "abattement_after_70_global": LI_ABATTEMENT_AFTER_70_GLOBAL,
        "tax_before_70": total_tax_before,
        "tax_after_70": tax_after,
        "total_tax": total_tax_before + tax_after,
        "n_beneficiaries": n_benef,
    }


def compute_demembrement(total_value: int, usufructuary_age: int) -> dict[str, Any]:
    """
    Compute usufruct / bare ownership split based on age.
    """
    usufruit_pct = 0.10  # default oldest bracket
    for max_age, pct in DEMEMBREMENT_TABLE:
        if usufructuary_age < max_age:
            usufruit_pct = pct
            break

    usufruit_value = int(total_value * usufruit_pct)
    nue_propriete_value = total_value - usufruit_value

    return {
        "total_value": total_value,
        "usufructuary_age": usufructuary_age,
        "usufruit_pct": round(usufruit_pct * 100, 1),
        "nue_propriete_pct": round((1 - usufruit_pct) * 100, 1),
        "usufruit_value": usufruit_value,
        "nue_propriete_value": nue_propriete_value,
    }


# ══════════════════════════════════════════════════════════════
#  PATRIMOINE COLLECTION (cross-asset)
# ══════════════════════════════════════════════════════════════

async def collect_heritage_patrimoine(
    db: AsyncSession,
    user_id: UUID,
    profile: HeritageSimulation,
) -> int:
    """
    Collect total heritage patrimoine in centimes.
    Reuses retirement_engine.collect_patrimoine for cross-asset aggregation.
    """
    if profile.custom_patrimoine_override is not None and profile.custom_patrimoine_override > 0:
        return profile.custom_patrimoine_override

    snap = await collect_patrimoine(db, user_id, profile.include_real_estate)
    return max(snap.total, 0)


# ══════════════════════════════════════════════════════════════
#  SUCCESSION SIMULATION
# ══════════════════════════════════════════════════════════════

def _split_patrimoine_by_regime(
    patrimoine_brut: int,
    marital_regime: str,
    has_conjoint: bool,
) -> tuple[int, int]:
    """
    Split patrimoine into conjoint share and taxable estate.
    Returns (conjoint_share, taxable_estate).
    """
    if not has_conjoint:
        return 0, patrimoine_brut

    if marital_regime == "communaute":
        # Conjoint gets 50% community property + succession rights on rest
        conjoint_share = patrimoine_brut // 2
        taxable = patrimoine_brut - conjoint_share
        return conjoint_share, taxable

    if marital_regime == "universel":
        # Universal community: conjoint inherits everything, zero tax (TEPA)
        return patrimoine_brut, 0

    if marital_regime == "separation":
        # Separate property: only the deceased's assets go to succession
        # Approximate: assume 50/50 ownership
        taxable = patrimoine_brut // 2
        return patrimoine_brut - taxable, taxable

    if marital_regime == "pacs":
        # PACS partners: similar to married, exempt from tax
        conjoint_share = patrimoine_brut // 2
        taxable = patrimoine_brut - conjoint_share
        return conjoint_share, taxable

    # concubinage: no automatic rights
    return 0, patrimoine_brut


def _compute_heir_shares(
    taxable_estate: int,
    heirs: list[dict[str, Any]],
    has_conjoint: bool,
    marital_regime: str,
) -> list[dict[str, Any]]:
    """
    Compute each heir's gross share based on French law defaults.
    Simplified: equal distribution among children; conjoint gets usufruct or 1/4.
    """
    results = []
    non_conjoint_heirs = [h for h in heirs if h.get("relationship") != "conjoint"]
    conjoint_heirs = [h for h in heirs if h.get("relationship") == "conjoint"]

    n_children = len([h for h in heirs if h.get("relationship") == "enfant"])

    for heir in conjoint_heirs:
        if marital_regime == "concubinage":
            # No automatic rights for concubins
            share = 0
        elif n_children > 0:
            # With children: conjoint gets 1/4 in full ownership (option légale)
            share = taxable_estate // 4
        else:
            # Without children: conjoint gets everything
            share = taxable_estate
        results.append({**heir, "part_brute": share})

    conjoint_total = sum(r["part_brute"] for r in results)
    remaining = taxable_estate - conjoint_total

    if non_conjoint_heirs:
        per_heir = remaining // len(non_conjoint_heirs) if non_conjoint_heirs else 0
        for i, heir in enumerate(non_conjoint_heirs):
            share = per_heir
            # Last heir gets remainder to avoid rounding loss
            if i == len(non_conjoint_heirs) - 1:
                share = remaining - per_heir * (len(non_conjoint_heirs) - 1)
            results.append({**heir, "part_brute": max(share, 0)})

    return results


def _compute_donation_deductions(
    heir_name: str,
    donation_history: list[dict[str, Any]],
) -> int:
    """
    Sum donations to a specific heir within 15 years (rappel fiscal).
    These reduce the available abattement.
    """
    today = date.today()
    total = 0
    for d in donation_history:
        if d.get("heir_name") != heir_name:
            continue
        try:
            don_date = datetime.strptime(d["date"], "%Y-%m-%d").date()
            years_ago = (today - don_date).days / 365.25
            if years_ago < DONATION_RENEWAL_YEARS:
                total += d.get("amount", 0)
        except (ValueError, KeyError):
            continue
    return total


async def simulate_succession(
    db: AsyncSession,
    user_id: UUID,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Main succession simulation.
    Collects patrimoine, splits by regime, computes per-heir tax.
    """
    profile = await get_or_create_profile(db, user_id)

    # Apply overrides
    heirs_data = profile.heirs or []
    marital_regime = profile.marital_regime
    li_before = profile.life_insurance_before_70
    li_after = profile.life_insurance_after_70

    if overrides:
        if overrides.get("heirs_override"):
            heirs_data = [h.model_dump() if hasattr(h, "model_dump") else h
                          for h in overrides["heirs_override"]]
        if overrides.get("marital_regime_override"):
            marital_regime = overrides["marital_regime_override"]
        if overrides.get("life_insurance_before_70_override") is not None:
            li_before = overrides["life_insurance_before_70_override"]
        if overrides.get("life_insurance_after_70_override") is not None:
            li_after = overrides["life_insurance_after_70_override"]

    # Collect patrimoine
    if overrides and overrides.get("patrimoine_override") is not None:
        patrimoine_brut = overrides["patrimoine_override"]
    else:
        patrimoine_brut = await collect_heritage_patrimoine(db, user_id, profile)

    has_conjoint = any(h.get("relationship") == "conjoint" for h in heirs_data)

    # Split by marital regime
    conjoint_share, taxable_estate = _split_patrimoine_by_regime(
        patrimoine_brut, marital_regime, has_conjoint,
    )

    # Compute per-heir shares
    heir_shares = _compute_heir_shares(
        taxable_estate, heirs_data, has_conjoint, marital_regime,
    )

    # Compute per-heir tax
    heirs_detail = []
    total_droits = 0
    total_net = 0

    for hs in heir_shares:
        rel = hs.get("relationship", "tiers")
        handicap = hs.get("handicap", False)
        part_brute = hs.get("part_brute", 0)
        name = hs.get("name", "Inconnu")

        # Abattement (minus prior donations within 15 years)
        abattement_base = compute_abattement(rel, handicap)
        prior_donations = _compute_donation_deductions(name, profile.donation_history or [])
        abattement_remaining = max(abattement_base - prior_donations, 0)

        taxable = max(part_brute - abattement_remaining, 0)
        droits = compute_succession_tax(taxable, rel)
        net_recu = part_brute - droits

        taux_effectif = (droits / part_brute * 100) if part_brute > 0 else 0.0

        heirs_detail.append({
            "name": name,
            "relationship": rel,
            "part_brute": part_brute,
            "abattement": abattement_remaining,
            "taxable": taxable,
            "droits": droits,
            "net_recu": max(net_recu, 0),
            "taux_effectif_pct": round(taux_effectif, 2),
        })

        total_droits += droits
        total_net += max(net_recu, 0)

    # Add conjoint's non-taxed share to net
    total_net += conjoint_share

    # Life insurance
    li_detail = None
    if profile.include_life_insurance and (li_before > 0 or li_after > 0):
        n_benef = max(len(heirs_data), 1)
        li_detail = compute_life_insurance_tax(li_before, li_after, n_benef)
        total_droits += li_detail["total_tax"]

    # Demembrement (compute for info if conjoint present and has age)
    demembrement_detail = None
    conjoint_heir = next((h for h in heirs_data if h.get("relationship") == "conjoint"), None)
    if conjoint_heir and conjoint_heir.get("age"):
        demembrement_detail = compute_demembrement(
            patrimoine_brut, conjoint_heir["age"],
        )

    patrimoine_taxable = taxable_estate
    taux_global = (total_droits / patrimoine_brut * 100) if patrimoine_brut > 0 else 0.0

    return {
        "patrimoine_brut": patrimoine_brut,
        "patrimoine_taxable": patrimoine_taxable,
        "total_droits": total_droits,
        "total_net_transmis": total_net,
        "taux_effectif_global_pct": round(taux_global, 2),
        "heirs_detail": heirs_detail,
        "life_insurance_detail": li_detail,
        "demembrement_detail": demembrement_detail,
    }


# ══════════════════════════════════════════════════════════════
#  DONATION OPTIMIZATION
# ══════════════════════════════════════════════════════════════

async def simulate_donation_optimization(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Test multiple donation scenarios and compare tax impact.
    """
    # Baseline: no additional donation
    baseline = await simulate_succession(db, user_id)
    baseline_droits = baseline["total_droits"]

    profile = await get_or_create_profile(db, user_id)
    children = [h for h in (profile.heirs or []) if h.get("relationship") == "enfant"]
    n_children = max(len(children), 1)

    scenarios = []
    test_amounts = [
        (1_000_000, "10 000 €/enfant"),
        (5_000_000, "50 000 €/enfant"),
        (10_000_000, "100 000 €/enfant"),
        (15_000_000, "150 000 €/enfant"),
        (20_000_000, "200 000 €/enfant"),
    ]

    for donation_per_child, label in test_amounts:
        total_donated = donation_per_child * n_children

        # Collect current patrimoine
        patrimoine = await collect_heritage_patrimoine(db, user_id, profile)
        if total_donated >= patrimoine:
            continue  # Can't donate more than owned

        reduced_patrimoine = patrimoine - total_donated

        # Simulate with reduced patrimoine
        sim = await simulate_succession(
            db, user_id,
            overrides={"patrimoine_override": reduced_patrimoine},
        )
        new_droits = sim["total_droits"]
        economy = baseline_droits - new_droits

        scenarios.append({
            "label": f"Donation {label}",
            "donation_per_heir": donation_per_child,
            "economy_vs_no_donation": max(economy, 0),
            "new_total_droits": new_droits,
            "description": (
                f"Donner {label} à chaque enfant ({n_children} enfant(s)) → "
                f"patrimoine réduit à {reduced_patrimoine // 100:,.0f}€, "
                f"économie de {max(economy, 0) // 100:,.0f}€ de droits"
            ),
        })

    # Sort by economy descending
    scenarios.sort(key=lambda s: s["economy_vs_no_donation"], reverse=True)

    best = scenarios[0] if scenarios else None
    best_name = best["label"] if best else "Aucun"
    economy_max = best["economy_vs_no_donation"] if best else 0

    summary = (
        f"Le scénario le plus avantageux est '{best_name}' avec une économie "
        f"de {economy_max // 100:,.0f}€ de droits de succession."
    ) if best else "Ajoutez des héritiers enfants pour voir les scénarios de donation."

    return {
        "scenarios": scenarios,
        "best_scenario": best_name,
        "economy_max": economy_max,
        "summary": summary,
    }


# ══════════════════════════════════════════════════════════════
#  TIMELINE PROJECTION
# ══════════════════════════════════════════════════════════════

async def compute_timeline_projection(
    db: AsyncSession,
    user_id: UUID,
    years: int = 30,
    inflation_rate_pct: float = 2.0,
) -> dict[str, Any]:
    """
    Project patrimoine over N years with inflation.
    At each year, compute succession tax if death occurred then.
    Mark years where donation abattements renew.
    """
    profile = await get_or_create_profile(db, user_id)
    patrimoine_base = await collect_heritage_patrimoine(db, user_id, profile)

    inflation = inflation_rate_pct / 100.0
    current_year = date.today().year

    points = []
    renewal_years = []

    for y in range(years + 1):
        year = current_year + y
        patrimoine_projete = int(patrimoine_base * (1 + inflation) ** y)

        # Simulate succession at this point
        sim = await simulate_succession(
            db, user_id,
            overrides={"patrimoine_override": patrimoine_projete},
        )
        droits = sim["total_droits"]
        net = sim["total_net_transmis"]

        # Check if donation abattement renews this year
        abattement_available = (y % DONATION_RENEWAL_YEARS == 0) and y > 0
        if abattement_available:
            renewal_years.append(year)

        points.append({
            "year": year,
            "patrimoine_projete": patrimoine_projete,
            "droits_si_succession": droits,
            "net_transmis": net,
            "donation_abattement_available": abattement_available,
        })

    return {
        "points": points,
        "donation_renewal_years": renewal_years,
    }


# ══════════════════════════════════════════════════════════════
#  CRUD (profile management)
# ══════════════════════════════════════════════════════════════

async def get_or_create_profile(
    db: AsyncSession,
    user_id: UUID,
) -> HeritageSimulation:
    """Get or create a default heritage profile for the user."""
    result = await db.execute(
        select(HeritageSimulation).where(HeritageSimulation.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = HeritageSimulation(
            user_id=user_id,
            marital_regime="communaute",
            heirs=[],
            life_insurance_before_70=0,
            life_insurance_after_70=0,
            donation_history=[],
            include_real_estate=True,
            include_life_insurance=True,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def update_profile(
    db: AsyncSession,
    user_id: UUID,
    data: dict[str, Any],
) -> HeritageSimulation:
    """Update heritage profile fields."""
    profile = await get_or_create_profile(db, user_id)
    for key, value in data.items():
        if value is not None and hasattr(profile, key):
            setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile
