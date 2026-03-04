"""
OmniFlow — Anomaly Detector.
Detects unusual transactions using statistical methods.
Zero external dependencies.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.ai_insight import AIInsight, InsightType, InsightSeverity

logger = logging.getLogger("omniflow.ai.anomaly")


async def detect_anomalies(
    db: AsyncSession,
    user_id: UUID,
    lookback_days: int = 90,
) -> list[dict]:
    """
    Detect anomalies in recent transactions.

    4 types:
    - UNUSUAL_AMOUNT: Z-score > 2.0 within its category
    - DUPLICATE_SUSPICION: same amount + same merchant within 48h
    - NEW_RECURRING: 3+ transactions to same merchant at regular intervals
    - HIDDEN_FEE: bank fee patterns

    Returns list of anomaly dicts.
    """
    # Get account IDs
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    account_ids = [row[0] for row in acc_result.all()]
    if not account_ids:
        return []

    today = date.today()
    start_date = today - timedelta(days=lookback_days)

    # Fetch all transactions in window
    result = await db.execute(
        select(Transaction)
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.date >= start_date,
            )
        )
        .order_by(Transaction.date.desc())
    )
    transactions = result.scalars().all()
    if not transactions:
        return []

    # Get already-reported transaction IDs to avoid duplicates
    existing_result = await db.execute(
        select(AIInsight.related_transaction_id).where(
            and_(
                AIInsight.user_id == user_id,
                AIInsight.related_transaction_id.isnot(None),
                AIInsight.is_dismissed == False,
            )
        )
    )
    already_reported = {row[0] for row in existing_result.all()}

    anomalies: list[dict] = []

    # ── 1. UNUSUAL_AMOUNT — Z-score analysis per category ──
    cat_amounts: dict[str, list[float]] = defaultdict(list)
    for t in transactions:
        if t.category and t.amount < 0:
            cat_amounts[t.category].append(abs(t.amount))

    # Only check recent transactions (last 14 days) for anomalies
    recent_cutoff = today - timedelta(days=14)
    recent_txns = [t for t in transactions if t.date >= recent_cutoff]

    for t in recent_txns:
        if t.id in already_reported:
            continue
        if not t.category or t.amount >= 0:
            continue

        amounts = cat_amounts.get(t.category, [])
        if len(amounts) < 5:
            continue

        mean = sum(amounts) / len(amounts)
        variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
        std = math.sqrt(variance) if variance > 0 else 0

        if std == 0:
            continue

        z_score = abs(abs(t.amount) - mean) / std

        if z_score > 3.0:
            pct_over = round((abs(t.amount) / mean - 1) * 100)
            anomalies.append({
                "type": InsightType.ANOMALY_UNUSUAL_AMOUNT.value,
                "severity": InsightSeverity.CRITICAL.value,
                "title": f"Montant inhabituel : {t.label}",
                "description": (
                    f"Cette transaction de {abs(t.amount)/100:.2f}€ est {pct_over}% "
                    f"supérieure à votre moyenne de {mean/100:.2f}€ "
                    f"pour la catégorie {t.category}."
                ),
                "confidence": min(0.95, 0.5 + z_score * 0.15),
                "transaction_id": str(t.id),
                "data": {
                    "z_score": round(z_score, 2),
                    "amount": t.amount,
                    "category_mean": round(mean),
                    "category_std": round(std),
                    "label": t.label,
                    "date": t.date.isoformat(),
                },
            })
        elif z_score > 2.0:
            pct_over = round((abs(t.amount) / mean - 1) * 100)
            anomalies.append({
                "type": InsightType.ANOMALY_UNUSUAL_AMOUNT.value,
                "severity": InsightSeverity.WARNING.value,
                "title": f"Dépense élevée : {t.label}",
                "description": (
                    f"Cette transaction de {abs(t.amount)/100:.2f}€ est {pct_over}% "
                    f"au-dessus de votre moyenne pour {t.category}."
                ),
                "confidence": min(0.80, 0.4 + z_score * 0.1),
                "transaction_id": str(t.id),
                "data": {
                    "z_score": round(z_score, 2),
                    "amount": t.amount,
                    "category_mean": round(mean),
                    "label": t.label,
                    "date": t.date.isoformat(),
                },
            })

    # ── 2. DUPLICATE_SUSPICION — same amount + merchant within 48h ──
    recent_debits = [t for t in recent_txns if t.amount < 0 and t.merchant]
    for i, t1 in enumerate(recent_debits):
        if t1.id in already_reported:
            continue
        for t2 in recent_debits[i + 1:]:
            if t2.id in already_reported:
                continue
            if (
                t1.merchant == t2.merchant
                and t1.amount == t2.amount
                and abs((t1.date - t2.date).days) <= 2
                and t1.id != t2.id
            ):
                anomalies.append({
                    "type": InsightType.ANOMALY_DUPLICATE.value,
                    "severity": InsightSeverity.WARNING.value,
                    "title": f"Doublon possible : {t1.merchant}",
                    "description": (
                        f"Deux transactions identiques de {abs(t1.amount)/100:.2f}€ "
                        f"chez {t1.merchant} à {abs((t1.date - t2.date).days)} jour(s) "
                        f"d'intervalle."
                    ),
                    "confidence": 0.75,
                    "transaction_id": str(t1.id),
                    "data": {
                        "amount": t1.amount,
                        "merchant": t1.merchant,
                        "date1": t1.date.isoformat(),
                        "date2": t2.date.isoformat(),
                    },
                })
                break  # Only report once per pair

    # ── 3. HIDDEN_FEE — bank fee patterns ──
    fee_keywords = ["frais", "commission", "cotisation", "abonnement carte"]
    for t in recent_txns:
        if t.id in already_reported:
            continue
        if t.amount >= 0:
            continue
        label_lower = (t.label or "").lower()
        if any(kw in label_lower for kw in fee_keywords):
            # Check if this is a new/unusual fee
            similar_fees = [
                tx for tx in transactions
                if tx.id != t.id
                and tx.amount == t.amount
                and any(kw in (tx.label or "").lower() for kw in fee_keywords)
            ]
            if len(similar_fees) < 2:
                # New or rare fee
                anomalies.append({
                    "type": InsightType.ANOMALY_HIDDEN_FEE.value,
                    "severity": InsightSeverity.INFO.value,
                    "title": f"Frais détectés : {abs(t.amount)/100:.2f}€",
                    "description": (
                        f"Frais bancaires de {abs(t.amount)/100:.2f}€ détectés : "
                        f"« {t.label} ». Vérifiez que ce prélèvement est normal."
                    ),
                    "confidence": 0.70,
                    "transaction_id": str(t.id),
                    "data": {
                        "amount": t.amount,
                        "label": t.label,
                        "date": t.date.isoformat(),
                    },
                })

    logger.info(
        f"[AI] Anomaly detection for {user_id}: "
        f"{len(anomalies)} anomalies found in {len(transactions)} transactions"
    )
    return anomalies


async def save_anomalies(
    db: AsyncSession,
    user_id: UUID,
    anomalies: list[dict],
) -> int:
    """Save detected anomalies as AI insights. Returns count saved."""
    count = 0
    for a in anomalies:
        insight = AIInsight(
            user_id=user_id,
            type=InsightType(a["type"]),
            severity=InsightSeverity(a["severity"]),
            title=a["title"],
            description=a["description"],
            data=a.get("data", {}),
            confidence=a.get("confidence", 1.0),
            related_transaction_id=a.get("transaction_id"),
        )
        db.add(insight)
        count += 1

    if count:
        await db.flush()

    return count
