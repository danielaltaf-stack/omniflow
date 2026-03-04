"""
OmniFlow — Insights Generator.
Generates personalized financial tips using parameterized French templates.
Zero LLM dependency — pure template engine with dynamic variables.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.ai_insight import AIInsight, InsightType, InsightSeverity

logger = logging.getLogger("omniflow.ai.insights")


async def generate_insights(
    db: AsyncSession,
    user_id: UUID,
    max_insights: int = 5,
) -> list[dict]:
    """
    Generate personalized financial insights.

    5 types:
    - SPENDING_TREND: significant increase/decrease in a category
    - SAVINGS_OPPORTUNITY: category where reduction is possible
    - ACHIEVEMENT: net worth growth, budget respected
    - WARNING: overdraft risk, budget exceeded
    - TIP: contextual financial advice

    Returns max `max_insights` insights, prioritized by severity × recency.
    """
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    account_ids = [row[0] for row in acc_result.all()]
    if not account_ids:
        return []

    today = date.today()
    insights: list[dict] = []

    # ── 1. SPENDING_TREND — Compare this month vs last month ──
    this_month_start = today.replace(day=1)
    last_month_end = this_month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    # This month spending by category
    this_month_cats = await _spending_by_category(
        db, account_ids, this_month_start, today
    )
    # Last month spending by category
    last_month_cats = await _spending_by_category(
        db, account_ids, last_month_start, last_month_end
    )

    for cat, this_amount in this_month_cats.items():
        last_amount = last_month_cats.get(cat, 0)
        if last_amount < 1000:  # less than 10€ last month, skip
            continue

        # Days elapsed ratio for fair comparison
        days_in_month = (
            (today.replace(month=today.month % 12 + 1, day=1) - timedelta(days=1))
            if today.month < 12
            else date(today.year, 12, 31)
        ).day
        days_elapsed = today.day
        projected = int(this_amount * days_in_month / days_elapsed) if days_elapsed > 0 else this_amount

        if last_amount > 0:
            pct_change = ((projected - last_amount) / last_amount) * 100
        else:
            continue

        if pct_change > 30:
            insights.append({
                "type": InsightType.SPENDING_TREND.value,
                "severity": InsightSeverity.WARNING.value,
                "title": f"📈 {cat} en hausse de {pct_change:.0f}%",
                "description": (
                    f"Vos dépenses {cat} sont en projection à {projected/100:.0f}€ "
                    f"ce mois-ci, contre {last_amount/100:.0f}€ le mois dernier. "
                    f"C'est {pct_change:.0f}% de plus."
                ),
                "data": {
                    "category": cat,
                    "this_month": projected,
                    "last_month": last_amount,
                    "pct_change": round(pct_change, 1),
                },
                "priority": 3,
            })
        elif pct_change < -25:
            insights.append({
                "type": InsightType.ACHIEVEMENT.value,
                "severity": InsightSeverity.INFO.value,
                "title": f"🎉 {cat} en baisse de {abs(pct_change):.0f}%",
                "description": (
                    f"Bravo ! Vos dépenses {cat} sont en baisse : "
                    f"{projected/100:.0f}€ projetés contre {last_amount/100:.0f}€ "
                    f"le mois dernier."
                ),
                "data": {
                    "category": cat,
                    "this_month": projected,
                    "last_month": last_amount,
                    "pct_change": round(pct_change, 1),
                },
                "priority": 1,
            })

    # ── 2. SAVINGS_OPPORTUNITY — Top discretionary spending ──
    discretionary = ["Restaurants", "Shopping", "Loisirs", "Abonnements"]
    for cat in discretionary:
        if cat in this_month_cats and this_month_cats[cat] > 5000:  # > 50€
            monthly_avg = this_month_cats[cat]
            potential_saving = int(monthly_avg * 0.20)  # 20% reduction
            if potential_saving > 500:  # > 5€
                insights.append({
                    "type": InsightType.SAVINGS_OPPORTUNITY.value,
                    "severity": InsightSeverity.INFO.value,
                    "title": f"💡 Économisez sur {cat}",
                    "description": (
                        f"En réduisant vos dépenses {cat} de 20%, "
                        f"vous économiseriez ~{potential_saving/100:.0f}€ par mois, "
                        f"soit ~{(potential_saving * 12)/100:.0f}€ par an."
                    ),
                    "data": {
                        "category": cat,
                        "current_spending": monthly_avg,
                        "potential_saving": potential_saving,
                    },
                    "priority": 2,
                })

    # ── 3. TIP — Contextual advice based on time ──
    # Tax season reminder (January, April)
    if today.month in (1, 4):
        insights.append({
            "type": InsightType.TIP.value,
            "severity": InsightSeverity.INFO.value,
            "title": "📋 Pensez à vos impôts",
            "description": (
                "C'est la saison fiscale ! Vérifiez vos relevés pour "
                "préparer votre déclaration de revenus."
            ),
            "data": {},
            "priority": 1,
        })

    # Savings rate insight
    total_income = sum(
        abs(a) for cat, a in this_month_cats.items() if cat == "Revenus"
    )
    total_expenses = sum(
        a for cat, a in this_month_cats.items() if cat != "Revenus"
    )
    if total_income > 0:
        savings_rate = ((total_income - total_expenses) / total_income) * 100
        if savings_rate > 20:
            insights.append({
                "type": InsightType.ACHIEVEMENT.value,
                "severity": InsightSeverity.INFO.value,
                "title": f"🏆 Taux d'épargne de {savings_rate:.0f}%",
                "description": (
                    f"Excellent ! Votre taux d'épargne ce mois est de {savings_rate:.0f}%. "
                    f"C'est au-dessus de la moyenne française (15%)."
                ),
                "data": {"savings_rate": round(savings_rate, 1)},
                "priority": 1,
            })
        elif savings_rate < 5:
            insights.append({
                "type": InsightType.WARNING.value,
                "severity": InsightSeverity.WARNING.value,
                "title": "⚠️ Taux d'épargne faible",
                "description": (
                    f"Votre taux d'épargne est de {savings_rate:.0f}% ce mois. "
                    f"Essayez de viser au moins 10-15% de vos revenus."
                ),
                "data": {"savings_rate": round(savings_rate, 1)},
                "priority": 4,
            })

    # Sort by priority (highest first) and limit
    insights.sort(key=lambda x: -x.get("priority", 0))
    result = insights[:max_insights]

    logger.info(
        f"[AI] Generated {len(result)} insights for {user_id} "
        f"(from {len(insights)} candidates)"
    )
    return result


async def save_insights(
    db: AsyncSession,
    user_id: UUID,
    insights: list[dict],
) -> int:
    """Save generated insights to DB. Returns count saved."""
    # Clear old non-anomaly insights (regenerate fresh each time)
    from sqlalchemy import delete

    anomaly_types = [
        InsightType.ANOMALY_UNUSUAL_AMOUNT,
        InsightType.ANOMALY_DUPLICATE,
        InsightType.ANOMALY_NEW_RECURRING,
        InsightType.ANOMALY_HIDDEN_FEE,
    ]
    await db.execute(
        delete(AIInsight).where(
            and_(
                AIInsight.user_id == user_id,
                AIInsight.type.notin_([t.value for t in anomaly_types]),
                AIInsight.is_dismissed == False,
            )
        )
    )

    count = 0
    for tip in insights:
        insight = AIInsight(
            user_id=user_id,
            type=InsightType(tip["type"]),
            severity=InsightSeverity(tip["severity"]),
            title=tip["title"],
            description=tip["description"],
            data=tip.get("data", {}),
        )
        db.add(insight)
        count += 1

    if count:
        await db.flush()

    return count


async def _spending_by_category(
    db: AsyncSession,
    account_ids: list,
    start_date: date,
    end_date: date,
) -> dict[str, int]:
    """Get total spending per category in a date range (centimes, absolute)."""
    result = await db.execute(
        select(
            Transaction.category,
            func.sum(func.abs(Transaction.amount)).label("total"),
        )
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.amount < 0,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.category.isnot(None),
            )
        )
        .group_by(Transaction.category)
    )
    return {row.category: int(row.total) for row in result.all()}
