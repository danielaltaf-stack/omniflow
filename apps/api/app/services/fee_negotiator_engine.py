"""
OmniFlow — Fee Negotiator Engine.

Scans 12 months of bank-fee transactions, compares against 20+ French bank
schedules, computes an overcharge percentile score, and generates a
ready-to-send negotiation letter with legal references (Loi Macron, droit au
compte).

All monetary values in **centimes** (BigInteger).
"""

from __future__ import annotations

import datetime as dt
import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.bank_fee_schedule import BankFeeSchedule
from app.models.fee_analysis import FeeAnalysis
from app.models.transaction import Transaction

logger = logging.getLogger("omniflow.fee_negotiator")

# ═══════════════════════════════════════════════════════════════════
#  Constants
# ═══════════════════════════════════════════════════════════════════

# Maps transaction subcategory → BankFeeSchedule column name
FEE_TYPE_MAPPING: dict[str, str] = {
    "Frais bancaires": "fee_account_maintenance",
    "Cotisation carte": "fee_card_classic",
    "Assurance carte": "fee_insurance_card",
    "Agios": "fee_overdraft_commission",
}

# Human-readable labels
FEE_TYPE_LABELS: dict[str, str] = {
    "fee_account_maintenance": "Tenue de compte",
    "fee_card_classic": "Carte bancaire",
    "fee_card_premium": "Carte premium",
    "fee_insurance_card": "Assurance carte",
    "fee_overdraft_commission": "Agios / Commissions",
    "fee_reject": "Frais de rejet",
    "fee_transfer_sepa": "Virements SEPA",
    "fee_transfer_intl": "Virements internationaux",
    "fee_check": "Chéquier",
    "fee_card_international": "Frais carte international",
    "fee_atm_other_bank": "Retrait DAB autre banque",
}

# All schedule fee columns (order matters for comparison)
ALL_FEE_FIELDS: list[str] = [
    "fee_account_maintenance",
    "fee_card_classic",
    "fee_card_premium",
    "fee_card_international",
    "fee_overdraft_commission",
    "fee_transfer_sepa",
    "fee_transfer_intl",
    "fee_check",
    "fee_insurance_card",
    "fee_reject",
    "fee_atm_other_bank",
]


# ═══════════════════════════════════════════════════════════════════
#  Scan — Analyse 12 mois de frais bancaires
# ═══════════════════════════════════════════════════════════════════


async def scan_user_fees(
    db: AsyncSession,
    user_id: UUID,
    months: int = 12,
) -> dict[str, Any]:
    """
    Scan the last *months* of transactions for category='Banque'
    and aggregate by fee type + month.

    Returns dict with keys:
      total_fees_annual, fees_by_type, monthly_breakdown
    """
    cutoff = dt.date.today() - dt.timedelta(days=months * 30)

    # Fetch all user accounts (Account links to User via BankConnection)
    acct_q = (
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acct_res = await db.execute(acct_q)
    account_ids = [row[0] for row in acct_res.fetchall()]

    if not account_ids:
        return _empty_scan()

    # Fetch fee transactions
    q = (
        select(Transaction)
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.category == "Banque",
            Transaction.date >= cutoff,
        )
        .order_by(Transaction.date)
    )
    result = await db.execute(q)
    transactions = result.scalars().all()

    if not transactions:
        return _empty_scan()

    # Aggregate by type
    by_type: dict[str, dict] = {}
    by_month: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    by_month_count: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for tx in transactions:
        fee_field = _map_subcategory_to_fee_field(tx.subcategory, tx.raw_label or tx.label)
        amount = abs(tx.amount)  # fees stored as negative
        month_key = tx.date.strftime("%Y-%m")

        if fee_field not in by_type:
            by_type[fee_field] = {"annual_total": 0, "count": 0}
        by_type[fee_field]["annual_total"] += amount
        by_type[fee_field]["count"] += 1
        by_month[month_key][fee_field] += amount
        by_month_count[month_key][fee_field] += 1

    # Build structured output
    total_annual = sum(v["annual_total"] for v in by_type.values())
    n_months = max(len(by_month), 1)

    fees_by_type_list = []
    for field, data in sorted(by_type.items(), key=lambda x: -x[1]["annual_total"]):
        fees_by_type_list.append({
            "fee_type": field,
            "label": FEE_TYPE_LABELS.get(field, field),
            "annual_total": data["annual_total"],
            "monthly_avg": data["annual_total"] // n_months,
            "count": data["count"],
        })

    monthly_breakdown = []
    for month_key in sorted(by_month.keys()):
        details = []
        month_total = 0
        for field, amount in by_month[month_key].items():
            month_total += amount
            details.append({
                "fee_type": field,
                "label": FEE_TYPE_LABELS.get(field, field),
                "annual_total": amount,
                "monthly_avg": amount,
                "count": by_month_count[month_key].get(field, 0),
            })
        monthly_breakdown.append({
            "month": month_key,
            "total": month_total,
            "details": details,
        })

    return {
        "total_fees_annual": total_annual,
        "fees_by_type": fees_by_type_list,
        "monthly_breakdown": monthly_breakdown,
    }


def _map_subcategory_to_fee_field(subcategory: str | None, label: str = "") -> str:
    """Map a transaction's subcategory (or raw label) to a fee schedule field."""
    if subcategory and subcategory in FEE_TYPE_MAPPING:
        return FEE_TYPE_MAPPING[subcategory]

    lbl = (label or "").lower()
    if "rejet" in lbl or "impayé" in lbl:
        return "fee_reject"
    if "carte" in lbl and ("premier" in lbl or "gold" in lbl or "visa infinite" in lbl):
        return "fee_card_premium"
    if "cotisation" in lbl and "carte" in lbl:
        return "fee_card_classic"
    if "assurance" in lbl and ("carte" in lbl or "moyen" in lbl):
        return "fee_insurance_card"
    if "agio" in lbl or "interet debiteur" in lbl or "commission" in lbl:
        return "fee_overdraft_commission"
    if "international" in lbl or "hors zone" in lbl:
        return "fee_card_international"
    if "virement" in lbl and ("sepa" in lbl or "externe" in lbl):
        return "fee_transfer_sepa"
    if "retrait" in lbl and ("dab" in lbl or "autre" in lbl):
        return "fee_atm_other_bank"
    return "fee_account_maintenance"  # default


def _empty_scan() -> dict[str, Any]:
    return {
        "total_fees_annual": 0,
        "fees_by_type": [],
        "monthly_breakdown": [],
    }


# ═══════════════════════════════════════════════════════════════════
#  Compare — Top alternatives multibanque
# ═══════════════════════════════════════════════════════════════════


async def compare_with_market(
    db: AsyncSession,
    user_fees_by_type: list[dict],
) -> list[dict[str, Any]]:
    """
    Compare user's annual fees with each bank's schedule.
    Returns alternatives sorted by saving desc, max 10.
    """
    # Load all schedules
    result = await db.execute(select(BankFeeSchedule))
    schedules = result.scalars().all()

    if not schedules:
        return []

    # Sum user fees per field
    user_totals: dict[str, int] = {}
    for item in user_fees_by_type:
        user_totals[item["fee_type"]] = item["annual_total"]
    user_grand_total = sum(user_totals.values())

    alternatives = []
    for sched in schedules:
        total_there = 0
        for field in ALL_FEE_FIELDS:
            if field in user_totals and user_totals[field] > 0:
                total_there += getattr(sched, field, 0)
        saving = user_grand_total - total_there
        pct = (saving / user_grand_total * 100) if user_grand_total > 0 else 0.0
        alternatives.append({
            "bank_slug": sched.bank_slug,
            "bank_name": sched.bank_name,
            "is_online": sched.is_online,
            "total_there": total_there,
            "saving": saving,
            "pct_saving": round(pct, 1),
        })

    alternatives.sort(key=lambda x: -x["saving"])
    return alternatives[:10]


def compute_overcharge_score(user_total: int, schedules_totals: list[int]) -> int:
    """
    Compute percentile 0-100: "Vous payez plus cher que X% des profils types."
    0 = cheapest, 100 = most expensive.
    """
    if not schedules_totals or user_total == 0:
        return 0
    cheaper_count = sum(1 for t in schedules_totals if t < user_total)
    return min(100, int(cheaper_count / len(schedules_totals) * 100))


# ═══════════════════════════════════════════════════════════════════
#  Negotiation Letter Generation
# ═══════════════════════════════════════════════════════════════════


async def generate_negotiation_letter(
    db: AsyncSession,
    user_id: UUID,
    user_fees: dict[str, Any],
    alternatives: list[dict],
    user_name: str = "Client OmniFlow",
    bank_name: str = "Ma Banque",
) -> dict[str, Any]:
    """
    Generate a structured Markdown negotiation letter with legal references.
    Returns {"letter_markdown": str, "arguments": list[str]}.
    """
    total = user_fees.get("total_fees_annual", 0)
    total_eur = total / 100
    fees_by_type = user_fees.get("fees_by_type", [])
    today_str = dt.date.today().strftime("%d/%m/%Y")

    # Build fee table
    fee_lines = []
    for item in fees_by_type:
        eur = item["annual_total"] / 100
        fee_lines.append(f"| {item['label']} | {eur:,.2f} € | {item['count']} opération(s) |")
    fee_table = "\n".join(fee_lines) if fee_lines else "| Aucun frais détecté | — | — |"

    # Best alternative
    best = alternatives[0] if alternatives else None
    best_name = best["bank_name"] if best else "—"
    best_saving_eur = best["saving"] / 100 if best else 0
    best_total_eur = best["total_there"] / 100 if best else 0

    # Top 3 comparison
    alt_lines = []
    for alt in alternatives[:3]:
        alt_lines.append(
            f"| {alt['bank_name']} | {alt['total_there']/100:,.2f} € | "
            f"**{alt['saving']/100:,.2f} € d'économie** ({alt['pct_saving']}%) |"
        )
    alt_table = "\n".join(alt_lines) if alt_lines else "| — | — | — |"

    # Arguments juridiques
    arguments = [
        "Loi Macron n°2015-990 du 6 août 2015 — Mobilité bancaire simplifiée (art. L312-1-7 CMF)",
        "Directive européenne sur les services de paiement (DSP2) — Transparence tarifaire obligatoire",
        "Article L312-1 du Code Monétaire et Financier — Droit au compte",
        f"Différentiel tarifaire démontré : {total_eur:,.2f} € vs {best_total_eur:,.2f} € chez {best_name}",
        "Obligation de loyauté contractuelle (art. 1104 Code Civil)",
    ]

    letter = f"""# Demande de révision des frais bancaires

**{user_name}**
Client(e) de {bank_name}

**Date** : {today_str}

---

**Objet** : Demande de suppression ou réduction de frais bancaires — Montant annuel : **{total_eur:,.2f} €**

Madame, Monsieur,

Client(e) fidèle de votre établissement, je me permets de solliciter une révision de mes frais bancaires après une analyse détaillée de mon relevé des 12 derniers mois.

## 1. Constat chiffré

| Type de frais | Montant annuel | Détail |
|---------------|---------------|--------|
{fee_table}
| **TOTAL** | **{total_eur:,.2f} €** | — |

## 2. Comparaison concurrentielle

L'analyse du marché bancaire français montre que des établissements concurrents proposent des conditions significativement plus avantageuses :

| Banque | Coût annuel estimé | Économie |
|--------|-------------------|----------|
{alt_table}

## 3. Fondements juridiques

Ma démarche s'appuie sur les dispositions suivantes :

- **Loi Macron** (n°2015-990, art. L312-1-7 CMF) : la mobilité bancaire est un droit, avec aide au changement de domiciliation en 22 jours ouvrés.
- **DSP2** (Directive Services de Paiement) : transparence tarifaire et comparabilité des offres.
- **Art. L312-1 CMF** : le droit au compte garantit l'accès aux services bancaires de base.
- **Art. 1104 Code Civil** : obligation de bonne foi et de loyauté dans l'exécution du contrat.

## 4. Demande

Au vu de ces éléments, je vous demande :

1. La **suppression intégrale** des frais de tenue de compte
2. Une **réduction significative** des commissions et cotisations
3. À défaut, une **offre commerciale compétitive** alignée sur les tarifs du marché

Je me permets de souligner que chez **{best_name}**, ces mêmes services me coûteraient **{best_total_eur:,.2f} €/an**, soit une économie de **{best_saving_eur:,.2f} €/an**.

En l'absence de réponse satisfaisante sous 30 jours, je me verrai dans l'obligation d'exercer mon droit à la mobilité bancaire conformément à la Loi Macron.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

**{user_name}**

---
*Lettre générée par OmniFlow — Analyse automatisée des frais bancaires*
"""

    return {
        "letter_markdown": letter.strip(),
        "arguments": arguments,
    }


# ═══════════════════════════════════════════════════════════════════
#  CRUD — Profile persistence
# ═══════════════════════════════════════════════════════════════════


async def get_or_create_analysis(
    db: AsyncSession,
    user_id: UUID,
) -> FeeAnalysis:
    """Return existing FeeAnalysis or create a default one."""
    q = select(FeeAnalysis).where(FeeAnalysis.user_id == user_id)
    result = await db.execute(q)
    analysis = result.scalar_one_or_none()

    if analysis is None:
        analysis = FeeAnalysis(user_id=user_id)
        db.add(analysis)
        await db.flush()
        await db.refresh(analysis)
        logger.info("Created default FeeAnalysis for user %s", user_id)

    return analysis


async def persist_scan_results(
    db: AsyncSession,
    user_id: UUID,
    scan: dict[str, Any],
    alternatives: list[dict],
    overcharge: int,
) -> FeeAnalysis:
    """Save scan results into fee_analyses."""
    analysis = await get_or_create_analysis(db, user_id)

    analysis.total_fees_annual = scan["total_fees_annual"]
    analysis.fees_by_type = {
        item["fee_type"]: item["annual_total"]
        for item in scan.get("fees_by_type", [])
    }
    analysis.monthly_breakdown = scan.get("monthly_breakdown", [])
    analysis.overcharge_score = overcharge

    if alternatives:
        analysis.best_alternative_slug = alternatives[0]["bank_slug"]
        analysis.best_alternative_saving = alternatives[0]["saving"]
        analysis.top_alternatives = alternatives[:5]

    await db.flush()
    await db.refresh(analysis)
    return analysis


async def update_negotiation_status(
    db: AsyncSession,
    user_id: UUID,
    status: str,
    result_amount: int = 0,
) -> FeeAnalysis:
    """Update negotiation pipeline status."""
    analysis = await get_or_create_analysis(db, user_id)
    analysis.negotiation_status = status

    if status == "sent" and analysis.negotiation_sent_at is None:
        analysis.negotiation_sent_at = dt.datetime.now(dt.timezone.utc)

    if status in ("resolved_success", "resolved_fail"):
        analysis.negotiation_result_amount = result_amount

    await db.flush()
    await db.refresh(analysis)
    return analysis


async def save_negotiation_letter(
    db: AsyncSession,
    user_id: UUID,
    letter: str,
) -> FeeAnalysis:
    """Persist generated letter markdown."""
    analysis = await get_or_create_analysis(db, user_id)
    analysis.negotiation_letter = letter
    if analysis.negotiation_status == "none":
        analysis.negotiation_status = "draft"
    await db.flush()
    await db.refresh(analysis)
    return analysis


async def get_fee_schedules(
    db: AsyncSession,
    bank_slug: str | None = None,
) -> list[BankFeeSchedule]:
    """Return all bank schedules or a single one."""
    q = select(BankFeeSchedule)
    if bank_slug:
        q = q.where(BankFeeSchedule.bank_slug == bank_slug)
    q = q.order_by(BankFeeSchedule.bank_name)
    result = await db.execute(q)
    return list(result.scalars().all())
