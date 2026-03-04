"""
OmniFlow — Fiscal Radar Engine.

Implements the 7-domain French fiscal rules engine:
  1. PEA (exonération IR après 5 ans, plafond 150k€)
  2. Crypto-actifs (art. 150 VH bis CGI, flat tax 30%, abattement 305€)
  3. Immobilier locatif (micro-foncier vs réel, déficit foncier)
  4. PER (déduction versements, plafond TMI-dépendant)
  5. Assurance-Vie (abattement 4 600€/9 200€ après 8 ans)
  6. Dividendes & PV mobilières CTO (PFU vs barème)
  7. Barème IR progressif 2026 (tranches + quotient familial)

All monetary values in **centimes** (BigInteger).
"""

from __future__ import annotations

import datetime as dt
import logging
import math
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fiscal_profile import (
    AV_ABATTEMENT_COUPLE_CENTIMES,
    AV_ABATTEMENT_SINGLE_CENTIMES,
    CRYPTO_ABATTEMENT_CENTIMES,
    CSG_CRDS_RATE,
    DEFICIT_FONCIER_CAP_CENTIMES,
    DIVIDEND_ABATEMENT_PCT,
    IR_BRACKETS_2026,
    MICRO_FONCIER_ABATEMENT_PCT,
    MICRO_FONCIER_CEILING_CENTIMES,
    PEA_CEILING_CENTIMES,
    PER_PLAFOND_MAX_CENTIMES,
    PER_PLAFOND_MIN_CENTIMES,
    PER_PLAFOND_PCT,
    PFU_IR_PART,
    PFU_RATE,
    FiscalProfile,
)

logger = logging.getLogger("omniflow.fiscal_radar")


# ═══════════════════════════════════════════════════════════════════
#  Barème IR 2026 — Pure Functions
# ═══════════════════════════════════════════════════════════════════


def compute_ir_from_bareme(revenu_net_centimes: int, parts: float = 1.0) -> int:
    """
    Compute French income tax (IR) using the 2026 progressive bracket system.
    Applies the quotient familial (parts).
    Returns IR amount in centimes.
    """
    if revenu_net_centimes <= 0 or parts <= 0:
        return 0

    revenu_per_part = revenu_net_centimes / parts
    ir_per_part = 0
    prev_limit = 0

    for limit, rate in IR_BRACKETS_2026:
        if limit is None:
            # Top bracket — everything above prev_limit
            ir_per_part += (revenu_per_part - prev_limit) * rate
            break
        if revenu_per_part <= limit:
            ir_per_part += (revenu_per_part - prev_limit) * rate
            break
        ir_per_part += (limit - prev_limit) * rate
        prev_limit = limit

    return max(0, int(ir_per_part * parts))


def compute_tmi(revenu_net_centimes: int, parts: float = 1.0) -> float:
    """Return the TMI (marginal tax rate) for the given net income."""
    if revenu_net_centimes <= 0:
        return 0.0
    revenu_per_part = revenu_net_centimes / parts
    tmi = 0.0
    for limit, rate in IR_BRACKETS_2026:
        if limit is None or revenu_per_part <= limit:
            tmi = rate
            break
    return tmi * 100  # Return as percentage


# ═══════════════════════════════════════════════════════════════════
#  Domain Analyzers — Pure Functions
# ═══════════════════════════════════════════════════════════════════


def analyze_pea(profile: FiscalProfile, today: dt.date | None = None) -> dict[str, Any]:
    """Analyze PEA fiscal situation."""
    today = today or dt.date.today()
    result: dict[str, Any] = {
        "domain": "pea",
        "has_pea": profile.pea_open_date is not None,
        "deposits": profile.pea_total_deposits,
        "ceiling": PEA_CEILING_CENTIMES,
        "fill_pct": 0.0,
        "mature": False,
        "days_remaining": None,
        "maturity_date": None,
    }

    if not profile.pea_open_date:
        return result

    maturity_date = profile.pea_open_date + dt.timedelta(days=5 * 365)
    days_remaining = (maturity_date - today).days
    result["maturity_date"] = maturity_date.isoformat()
    result["days_remaining"] = max(0, days_remaining)
    result["mature"] = days_remaining <= 0
    result["fill_pct"] = round(
        (profile.pea_total_deposits / PEA_CEILING_CENTIMES) * 100, 1
    ) if PEA_CEILING_CENTIMES > 0 else 0.0

    return result


def analyze_crypto(profile: FiscalProfile) -> dict[str, Any]:
    """Analyze crypto fiscal situation (art. 150 VH bis CGI)."""
    pv_nette = max(0, profile.crypto_pv_annuelle - profile.crypto_mv_annuelle)
    abattement = min(CRYPTO_ABATTEMENT_CENTIMES, pv_nette)
    base_imposable = max(0, pv_nette - abattement)
    flat_tax = int(base_imposable * PFU_RATE)

    # PFU vs barème comparison
    tmi_rate = profile.tmi_rate / 100.0
    ir_bareme = int(base_imposable * tmi_rate)
    ps_bareme = int(base_imposable * CSG_CRDS_RATE)
    total_bareme = ir_bareme + ps_bareme
    pfu_recommended = flat_tax <= total_bareme

    return {
        "domain": "crypto",
        "pv_brute": profile.crypto_pv_annuelle,
        "mv_brute": profile.crypto_mv_annuelle,
        "pv_nette": pv_nette,
        "abattement_305": abattement,
        "base_imposable": base_imposable,
        "flat_tax": flat_tax,
        "bareme_total": total_bareme,
        "pfu_recommended": pfu_recommended,
        "economy_if_switch": abs(flat_tax - total_bareme),
    }


def analyze_immobilier(profile: FiscalProfile) -> dict[str, Any]:
    """Analyze real estate fiscal situation (micro-foncier vs réel)."""
    revenus = profile.total_revenus_fonciers
    charges = profile.total_charges_deductibles
    deficit_reportable = profile.deficit_foncier_reportable
    tmi_rate = profile.tmi_rate / 100.0

    # Micro-foncier calculation
    micro_eligible = revenus <= MICRO_FONCIER_CEILING_CENTIMES
    micro_net = int(revenus * (1 - MICRO_FONCIER_ABATEMENT_PCT)) if micro_eligible else revenus
    micro_tax = int(micro_net * (tmi_rate + CSG_CRDS_RATE))

    # Régime réel calculation
    reel_net = max(0, revenus - charges)
    deficit = max(0, charges - revenus)
    deficit_imputable = min(deficit, DEFICIT_FONCIER_CAP_CENTIMES)
    reel_tax = int(reel_net * (tmi_rate + CSG_CRDS_RATE))
    deficit_economy = int(deficit_imputable * tmi_rate)

    # Which regime is better?
    reel_better = (reel_tax - deficit_economy) < micro_tax if micro_eligible else True
    economy = max(0, micro_tax - (reel_tax - deficit_economy)) if micro_eligible else 0

    return {
        "domain": "immobilier",
        "revenus_fonciers": revenus,
        "charges_deductibles": charges,
        "micro_eligible": micro_eligible,
        "micro_net": micro_net,
        "micro_tax": micro_tax,
        "reel_net": reel_net,
        "reel_tax": reel_tax,
        "deficit_foncier": deficit,
        "deficit_imputable": deficit_imputable,
        "deficit_economy": deficit_economy,
        "deficit_reportable": deficit_reportable,
        "reel_better": reel_better,
        "economy_if_switch": economy,
    }


def analyze_per(profile: FiscalProfile, today: dt.date | None = None) -> dict[str, Any]:
    """Analyze PER deduction situation."""
    today = today or dt.date.today()
    tmi_rate = profile.tmi_rate / 100.0

    # Compute plafond if not set
    plafond = profile.per_plafond
    if plafond <= 0 and profile.revenu_fiscal_ref > 0:
        computed = int(profile.revenu_fiscal_ref * PER_PLAFOND_PCT)
        plafond = max(PER_PLAFOND_MIN_CENTIMES, min(PER_PLAFOND_MAX_CENTIMES, computed))

    gap = max(0, plafond - profile.per_annual_deposits)
    economy_if_max = int(gap * tmi_rate)
    month = today.month

    return {
        "domain": "per",
        "versements_ytd": profile.per_annual_deposits,
        "plafond": plafond,
        "gap": gap,
        "fill_pct": round(
            (profile.per_annual_deposits / plafond) * 100, 1
        ) if plafond > 0 else 0.0,
        "economy_if_max": economy_if_max,
        "year_end_approaching": month >= 10,
        "tmi_rate_pct": profile.tmi_rate,
    }


def analyze_assurance_vie(profile: FiscalProfile, today: dt.date | None = None) -> dict[str, Any]:
    """Analyze Assurance-Vie fiscal situation."""
    today = today or dt.date.today()
    result: dict[str, Any] = {
        "domain": "av",
        "has_av": profile.av_open_date is not None,
        "deposits": profile.av_total_deposits,
        "mature": False,
        "days_remaining": None,
        "maturity_date": None,
        "abattement": 0,
    }

    if not profile.av_open_date:
        return result

    maturity_date = profile.av_open_date + dt.timedelta(days=8 * 365)
    days_remaining = (maturity_date - today).days
    is_mature = days_remaining <= 0

    abattement = (
        AV_ABATTEMENT_COUPLE_CENTIMES
        if profile.tax_household == "couple"
        else AV_ABATTEMENT_SINGLE_CENTIMES
    )

    result.update({
        "maturity_date": maturity_date.isoformat(),
        "days_remaining": max(0, days_remaining),
        "mature": is_mature,
        "abattement": abattement,
        "tax_household": profile.tax_household,
    })

    return result


def analyze_dividendes_cto(profile: FiscalProfile) -> dict[str, Any]:
    """Analyze dividends & CTO capital gains — PFU vs barème."""
    dividendes = profile.dividendes_bruts_annuels
    pv_cto = profile.pv_cto_annuelle
    tmi_rate = profile.tmi_rate / 100.0

    # PFU calculation
    pfu_dividendes = int(dividendes * PFU_RATE)
    pfu_pv = int(pv_cto * PFU_RATE)
    pfu_total = pfu_dividendes + pfu_pv

    # Barème calculation for dividends (40% abatement)
    div_apres_abattement = int(dividendes * (1 - DIVIDEND_ABATEMENT_PCT))
    bareme_div_ir = int(div_apres_abattement * tmi_rate)
    bareme_div_ps = int(dividendes * CSG_CRDS_RATE)
    bareme_dividendes = bareme_div_ir + bareme_div_ps

    # PV CTO on barème (no abatement on new acquisitions)
    bareme_pv_ir = int(pv_cto * tmi_rate)
    bareme_pv_ps = int(pv_cto * CSG_CRDS_RATE)
    bareme_pv = bareme_pv_ir + bareme_pv_ps

    bareme_total = bareme_dividendes + bareme_pv
    pfu_recommended = pfu_total <= bareme_total

    return {
        "domain": "cto",
        "dividendes_bruts": dividendes,
        "pv_cto": pv_cto,
        "pfu_total": pfu_total,
        "bareme_total": bareme_total,
        "pfu_recommended": pfu_recommended,
        "economy_if_switch": abs(pfu_total - bareme_total),
    }


# ═══════════════════════════════════════════════════════════════════
#  Alert Generator
# ═══════════════════════════════════════════════════════════════════


def generate_fiscal_alerts(
    profile: FiscalProfile,
    today: dt.date | None = None,
) -> list[dict[str, Any]]:
    """Generate all fiscal alerts for the given profile."""
    today = today or dt.date.today()
    alerts: list[dict[str, Any]] = []

    year_end = dt.date(today.year, 12, 31)

    # ── 1. PEA maturity soon ──
    if profile.pea_open_date:
        pea = analyze_pea(profile, today)
        days = pea["days_remaining"]
        if days is not None and 0 < days <= 365:
            months = days // 30
            alerts.append({
                "alert_type": "pea_maturity_soon",
                "priority": "urgent",
                "title": "PEA bientôt mature",
                "message": (
                    f"Votre PEA atteint 5 ans dans {months} mois ({days} jours). "
                    f"Les plus-values seront exonérées d'IR. Ne vendez pas maintenant."
                ),
                "economy_estimate": 0,  # Depends on actual PV
                "deadline": pea["maturity_date"],
                "domain": "pea",
            })

    # ── 2. PER year-end gap ──
    per = analyze_per(profile, today)
    if per["gap"] > 0 and today.month >= 10:
        gap_euros = per["gap"] // 100
        eco_euros = per["economy_if_max"] // 100
        alerts.append({
            "alert_type": "per_year_end_gap",
            "priority": "urgent",
            "title": "Plafond PER à optimiser",
            "message": (
                f"Versez encore {gap_euros}€ sur votre PER avant le 31/12 — "
                f"économie IR estimée de {eco_euros}€ (TMI {profile.tmi_rate}%)."
            ),
            "economy_estimate": per["economy_if_max"],
            "deadline": year_end.isoformat(),
            "domain": "per",
        })

    # ── 3. AV maturity soon ──
    if profile.av_open_date:
        av = analyze_assurance_vie(profile, today)
        days = av["days_remaining"]
        if days is not None and 0 < days <= 365:
            months = days // 30
            abattement_euros = av["abattement"] // 100
            alerts.append({
                "alert_type": "av_maturity_soon",
                "priority": "urgent",
                "title": "Assurance-Vie bientôt 8 ans",
                "message": (
                    f"Votre Assurance-Vie atteint 8 ans dans {months} mois. "
                    f"Abattement de {abattement_euros}€ sur les rachats."
                ),
                "economy_estimate": int(av["abattement"] * PFU_RATE),
                "deadline": av["maturity_date"],
                "domain": "av",
            })

    # ── 4. Crypto abattement ──
    if profile.crypto_pv_annuelle > 0:
        crypto = analyze_crypto(profile)
        alerts.append({
            "alert_type": "crypto_abattement",
            "priority": "high" if crypto["pv_nette"] > CRYPTO_ABATTEMENT_CENTIMES else "info",
            "title": "Abattement crypto 305€",
            "message": (
                f"PV crypto nette = {crypto['pv_nette'] // 100}€. "
                f"Abattement forfaitaire de 305€ applicable (économie {crypto['abattement_305'] * 30 // 100}€)."
            ),
            "economy_estimate": int(crypto["abattement_305"] * PFU_RATE),
            "deadline": year_end.isoformat(),
            "domain": "crypto",
        })

    # ── 5. PFU vs barème dividends ──
    if profile.dividendes_bruts_annuels > 0:
        cto = analyze_dividendes_cto(profile)
        if not cto["pfu_recommended"]:
            eco = cto["economy_if_switch"]
            alerts.append({
                "alert_type": "pfu_vs_bareme_dividends",
                "priority": "high",
                "title": "Option barème + avantageuse",
                "message": (
                    f"Votre TMI est {profile.tmi_rate}%. L'option barème "
                    f"(abattement 40% dividendes) économise {eco // 100}€ vs PFU."
                ),
                "economy_estimate": eco,
                "deadline": None,
                "domain": "cto",
            })

    # ── 6. Micro vs réel foncier ──
    if profile.total_revenus_fonciers > 0:
        immo = analyze_immobilier(profile)
        if immo["micro_eligible"] and immo["reel_better"] and immo["economy_if_switch"] > 0:
            alerts.append({
                "alert_type": "micro_vs_reel_foncier",
                "priority": "high",
                "title": "Régime réel plus avantageux",
                "message": (
                    f"Régime réel = {immo['economy_if_switch'] // 100}€ d'économie "
                    f"vs micro-foncier (charges {immo['charges_deductibles'] // 100}€ > "
                    f"abattement 30%)."
                ),
                "economy_estimate": immo["economy_if_switch"],
                "deadline": None,
                "domain": "immobilier",
            })

    # ── 7. Déficit foncier reportable ──
    if profile.deficit_foncier_reportable > 0:
        immo = analyze_immobilier(profile)
        alerts.append({
            "alert_type": "deficit_foncier_reportable",
            "priority": "high",
            "title": "Déficit foncier imputable",
            "message": (
                f"Déficit foncier reportable de {profile.deficit_foncier_reportable // 100}€. "
                f"Imputable sur revenu global (plafond 10 700€/an). "
                f"Économie IR potentielle : {immo['deficit_economy'] // 100}€."
            ),
            "economy_estimate": immo["deficit_economy"],
            "deadline": None,
            "domain": "immobilier",
        })

    # ── 8. PEA ceiling warning ──
    if profile.pea_open_date and profile.pea_total_deposits > 0:
        pea = analyze_pea(profile, today)
        if pea["fill_pct"] > 80:
            remaining = (PEA_CEILING_CENTIMES - profile.pea_total_deposits) // 100
            alerts.append({
                "alert_type": "pea_ceiling_warning",
                "priority": "info",
                "title": "PEA bientôt plein",
                "message": (
                    f"PEA rempli à {pea['fill_pct']}%. "
                    f"Marge restante : {remaining}€ (plafond 150 000€)."
                ),
                "economy_estimate": 0,
                "deadline": None,
                "domain": "pea",
            })

    # ── 9. Crypto PFU vs barème ──
    if profile.crypto_pv_annuelle > CRYPTO_ABATTEMENT_CENTIMES:
        crypto = analyze_crypto(profile)
        if not crypto["pfu_recommended"]:
            alerts.append({
                "alert_type": "crypto_pfu_vs_bareme",
                "priority": "info",
                "title": "Option barème crypto avantageuse",
                "message": (
                    f"TMI {profile.tmi_rate}% < 12,8% : option barème "
                    f"potentiellement avantageuse pour crypto (économie {crypto['economy_if_switch'] // 100}€)."
                ),
                "economy_estimate": crypto["economy_if_switch"],
                "deadline": None,
                "domain": "crypto",
            })

    # ── 10. PER tax impact (high TMI) ──
    if profile.tmi_rate >= 30 and per["gap"] > 0 and today.month < 10:
        alerts.append({
            "alert_type": "per_tax_impact",
            "priority": "info",
            "title": "PER avantageux avec TMI élevé",
            "message": (
                f"Chaque 1 000€ versé sur PER économise {int(profile.tmi_rate * 10)}€ d'IR "
                f"(TMI {profile.tmi_rate}%). Plafond restant : {per['gap'] // 100}€."
            ),
            "economy_estimate": per["economy_if_max"],
            "deadline": None,
            "domain": "per",
        })

    # ── 11. AV post 8 years ──
    if profile.av_open_date:
        av = analyze_assurance_vie(profile, today)
        if av["mature"]:
            alerts.append({
                "alert_type": "av_post_8_years",
                "priority": "info",
                "title": "AV mature — rachats optimisés",
                "message": (
                    f"Assurance-Vie > 8 ans : rachats bénéficient de l'abattement "
                    f"de {av['abattement'] // 100}€/an. Optimisez vos retraits."
                ),
                "economy_estimate": int(av["abattement"] * PFU_RATE),
                "deadline": None,
                "domain": "av",
            })

    # ── 12. Low fiscal score ──
    # This one is set after score computation (see compute_fiscal_score)

    # Sort: urgent first, then high, then info; within same priority, by economy desc
    priority_order = {"urgent": 0, "high": 1, "info": 2}
    alerts.sort(key=lambda a: (priority_order.get(a["priority"], 3), -a["economy_estimate"]))

    return alerts


# ═══════════════════════════════════════════════════════════════════
#  Fiscal Score Computation
# ═══════════════════════════════════════════════════════════════════


def compute_fiscal_score(
    profile: FiscalProfile,
    alerts: list[dict[str, Any]],
) -> tuple[int, list[dict[str, Any]]]:
    """
    Compute fiscal optimization score (0-100).
    Higher = better optimized.
    Returns (score, domain_scores list).
    """
    domain_scores = []
    scores = []

    # PEA score
    if profile.pea_open_date:
        pea = analyze_pea(profile)
        pea_score = 80 if pea["mature"] else max(20, min(70, int(pea.get("fill_pct", 0))))
        if pea["mature"]:
            pea_score = 95
        domain_scores.append({
            "domain": "pea",
            "label": "PEA",
            "score": pea_score,
            "status": "optimal" if pea["mature"] else "good" if pea_score >= 60 else "improvable",
        })
        scores.append(pea_score)

    # Crypto score
    if profile.crypto_pv_annuelle > 0 or profile.crypto_mv_annuelle > 0:
        crypto = analyze_crypto(profile)
        crypto_score = 70 if crypto["pfu_recommended"] else 50
        if crypto["pv_nette"] <= CRYPTO_ABATTEMENT_CENTIMES:
            crypto_score = 90  # Under abatement = well optimized
        domain_scores.append({
            "domain": "crypto",
            "label": "Crypto-actifs",
            "score": crypto_score,
            "status": "optimal" if crypto_score >= 80 else "good" if crypto_score >= 60 else "improvable",
        })
        scores.append(crypto_score)

    # Immobilier score
    if profile.total_revenus_fonciers > 0:
        immo = analyze_immobilier(profile)
        if immo["reel_better"] and immo["micro_eligible"]:
            # User could switch but hasn't
            immo_score = 40
        else:
            immo_score = 75
        if profile.deficit_foncier_reportable > 0:
            immo_score = max(immo_score - 10, 20)
        domain_scores.append({
            "domain": "immobilier",
            "label": "Immobilier locatif",
            "score": immo_score,
            "status": "optimal" if immo_score >= 80 else "good" if immo_score >= 60 else "improvable",
        })
        scores.append(immo_score)

    # PER score
    per = analyze_per(profile)
    if per["plafond"] > 0:
        per_score = min(95, max(10, int(per["fill_pct"])))
        domain_scores.append({
            "domain": "per",
            "label": "PER",
            "score": per_score,
            "status": "optimal" if per_score >= 90 else "good" if per_score >= 60 else "improvable" if per_score >= 30 else "critical",
        })
        scores.append(per_score)

    # AV score
    if profile.av_open_date:
        av = analyze_assurance_vie(profile)
        av_score = 90 if av["mature"] else 50
        domain_scores.append({
            "domain": "av",
            "label": "Assurance-Vie",
            "score": av_score,
            "status": "optimal" if av["mature"] else "improvable",
        })
        scores.append(av_score)

    # CTO dividends score
    if profile.dividendes_bruts_annuels > 0 or profile.pv_cto_annuelle > 0:
        cto = analyze_dividendes_cto(profile)
        cto_score = 70 if cto["pfu_recommended"] else 50
        domain_scores.append({
            "domain": "cto",
            "label": "CTO / Dividendes",
            "score": cto_score,
            "status": "good" if cto_score >= 60 else "improvable",
        })
        scores.append(cto_score)

    # Compute overall
    if scores:
        overall = int(sum(scores) / len(scores))
    else:
        overall = 50  # Default if no data

    # Penalize for urgent alerts
    urgent_count = sum(1 for a in alerts if a.get("priority") == "urgent")
    overall = max(0, min(100, overall - urgent_count * 5))

    return overall, domain_scores


# ═══════════════════════════════════════════════════════════════════
#  Fiscal Export Builder
# ═══════════════════════════════════════════════════════════════════


def build_fiscal_export(profile: FiscalProfile, year: int = 2026) -> dict[str, Any]:
    """Build CERFA-ready fiscal export JSON for the given year."""
    immo = analyze_immobilier(profile)
    crypto = analyze_crypto(profile)
    cto = analyze_dividendes_cto(profile)
    per = analyze_per(profile)

    # Revenus fonciers
    regime = "reel" if immo["reel_better"] else "micro_foncier"
    rev_net = immo["reel_net"] if regime == "reel" else immo["micro_net"]
    revenus_fonciers = {
        "brut": profile.total_revenus_fonciers,
        "regime": regime,
        "charges_deductibles": profile.total_charges_deductibles,
        "revenu_net_foncier": rev_net,
        "deficit_foncier": immo["deficit_foncier"],
        "cases_cerfa": {
            "4BA": rev_net // 100,
            "4BD": profile.total_charges_deductibles // 100 if regime == "reel" else 0,
        },
    }

    # Plus-values mobilières
    pv_nette_cto = max(0, profile.pv_cto_annuelle)
    option = "pfu" if cto["pfu_recommended"] else "bareme"
    impot_cto = cto["pfu_total"] if option == "pfu" else cto["bareme_total"]
    plus_values_mob = {
        "pv_cto": profile.pv_cto_annuelle,
        "mv_cto": 0,
        "pv_nette_cto": pv_nette_cto,
        "dividendes_bruts": profile.dividendes_bruts_annuels,
        "option_retenue": option,
        "impot_estime": impot_cto,
        "cases_cerfa": {
            "3VG": pv_nette_cto // 100,
            "2DC": profile.dividendes_bruts_annuels // 100,
        },
    }

    # Crypto
    crypto_export = {
        "pv_nette": crypto["pv_nette"],
        "abattement_305": crypto["abattement_305"],
        "base_imposable": crypto["base_imposable"],
        "flat_tax_estime": crypto["flat_tax"],
        "cases_cerfa": {
            "3AN": crypto["base_imposable"] // 100,
        },
    }

    # PER
    eco_per = int(profile.per_annual_deposits * (profile.tmi_rate / 100.0))
    per_export = {
        "versements": profile.per_annual_deposits,
        "plafond_utilise": profile.per_annual_deposits,
        "economie_ir": eco_per,
        "cases_cerfa": {
            "6NS": profile.per_annual_deposits // 100,
        },
    }

    # Synthèse
    total_impot = impot_cto + crypto["flat_tax"] + int(rev_net * (profile.tmi_rate / 100.0 + CSG_CRDS_RATE))
    economies = eco_per + crypto["abattement_305"] * 30 // 100

    return {
        "year": year,
        "revenus_fonciers": revenus_fonciers,
        "plus_values_mobilieres": plus_values_mob,
        "crypto_actifs": crypto_export,
        "per_deductions": per_export,
        "synthese": {
            "total_impot_estime": total_impot,
            "economies_realisees": economies,
            "score_fiscal": 0,  # Filled in by caller
        },
    }


# ═══════════════════════════════════════════════════════════════════
#  TMI Simulation
# ═══════════════════════════════════════════════════════════════════


def simulate_tmi_impact(
    profile: FiscalProfile,
    extra_income_centimes: int,
    income_type: str = "salaire",
) -> dict[str, Any]:
    """Simulate the impact of additional income on TMI and IR."""
    current_ir = compute_ir_from_bareme(profile.revenu_fiscal_ref, profile.parts_fiscales)
    current_tmi = compute_tmi(profile.revenu_fiscal_ref, profile.parts_fiscales)

    new_revenu = profile.revenu_fiscal_ref + extra_income_centimes
    new_ir = compute_ir_from_bareme(new_revenu, profile.parts_fiscales)
    new_tmi = compute_tmi(new_revenu, profile.parts_fiscales)

    marginal_tax = new_ir - current_ir
    marginal_rate = (marginal_tax / extra_income_centimes * 100) if extra_income_centimes > 0 else 0.0

    return {
        "current_tmi": current_tmi,
        "current_ir": current_ir,
        "new_tmi": new_tmi,
        "new_ir": new_ir,
        "marginal_tax": marginal_tax,
        "marginal_rate_effective": round(marginal_rate, 2),
        "extra_income": extra_income_centimes,
        "income_type": income_type,
    }


# ═══════════════════════════════════════════════════════════════════
#  Orchestrator — Main entry points (DB-aware)
# ═══════════════════════════════════════════════════════════════════


async def get_or_create_profile(db: AsyncSession, user_id: UUID) -> FiscalProfile:
    """Get existing fiscal profile or create a default one."""
    stmt = select(FiscalProfile).where(FiscalProfile.user_id == user_id)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = FiscalProfile(user_id=user_id)
        db.add(profile)
        await db.flush()
        logger.info("Created default fiscal profile for user %s", user_id)

    return profile


async def update_profile(
    db: AsyncSession,
    user_id: UUID,
    data: dict[str, Any],
) -> FiscalProfile:
    """Update the fiscal profile with the given data."""
    profile = await get_or_create_profile(db, user_id)

    for key, value in data.items():
        if value is not None and hasattr(profile, key):
            setattr(profile, key, value)

    await db.flush()
    logger.info("Updated fiscal profile for user %s", user_id)
    return profile


async def run_full_analysis(
    db: AsyncSession,
    user_id: UUID,
    year: int = 2026,
) -> dict[str, Any]:
    """Run the full fiscal analysis: alerts + score + export."""
    profile = await get_or_create_profile(db, user_id)

    # Generate alerts
    alerts = generate_fiscal_alerts(profile)

    # Compute score
    score, domain_scores = compute_fiscal_score(profile, alerts)

    # Add low-score alert if needed
    if score < 50:
        optimization_count = sum(1 for a in alerts if a["economy_estimate"] > 0)
        total_eco = sum(a["economy_estimate"] for a in alerts)
        alerts.append({
            "alert_type": "fiscal_score_low",
            "priority": "info",
            "title": f"Score fiscal {score}/100",
            "message": (
                f"Score fiscal {score}/100 — {optimization_count} optimisations identifiées "
                f"pour une économie potentielle de {total_eco // 100}€."
            ),
            "economy_estimate": total_eco,
            "deadline": None,
            "domain": "ir",
        })

    # Build export
    export = build_fiscal_export(profile, year)
    export["synthese"]["score_fiscal"] = score

    # Total economy
    total_economy = sum(a["economy_estimate"] for a in alerts)

    # Persist results
    profile.fiscal_score = score
    profile.total_economy_estimate = total_economy
    profile.analysis_data = {
        "domain_scores": domain_scores,
        "date": dt.date.today().isoformat(),
    }
    profile.alerts_data = alerts
    profile.export_data = export
    await db.flush()

    # Build optimizations list
    optimizations = []
    for a in alerts:
        if a["economy_estimate"] > 0:
            optimizations.append({
                "domain": a["domain"],
                "label": a["title"],
                "current_value": 0,
                "optimized_value": a["economy_estimate"],
                "economy": a["economy_estimate"],
                "recommendation": a["message"],
            })

    return {
        "fiscal_score": score,
        "domain_analyses": domain_scores,
        "alerts": alerts,
        "optimizations": optimizations,
        "total_economy_estimate": total_economy,
        "analysis_date": dt.date.today().isoformat(),
    }
