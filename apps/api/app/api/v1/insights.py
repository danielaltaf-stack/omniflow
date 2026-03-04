"""
OmniFlow — Insights / OmniScore API endpoint.
GET /insights/score — Financial health score (0-100) with 6 criteria.
Optimized: N+1 queries eliminated (22 → 7), CacheManager for 24h Redis cache.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.account import Account
from app.models.balance_snapshot import BalanceSnapshot
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.crypto_wallet import CryptoWallet
from app.models.stock_portfolio import StockPortfolio
from app.models.real_estate import RealEstateProperty
from app.models.debt import Debt

logger = logging.getLogger("omniflow.insights")
settings = get_settings()

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/score")
async def get_omniscore(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Calculate the OmniScore — financial health score (0-100).

    6 criteria:
    1. Emergency savings (25 pts) — savings vs 3 months of expenses
    2. Debt ratio (20 pts) — debts / monthly income
    3. Diversification (20 pts) — number of asset classes
    4. Savings regularity (15 pts) — months with positive savings / 12
    5. Net worth growth (10 pts) — 6-month growth trajectory
    6. Banking fees (10 pts) — annual fees vs estimated median

    Optimized: 22 queries → 7 queries + Redis 24h cache.
    """
    cache_key = f"omniscore:{user.id}"

    async def _compute_omniscore() -> dict[str, Any]:
        return await _calculate_omniscore(db, user.id)

    return await cache_manager.cached_result(
        key=cache_key,
        ttl=settings.CACHE_TTL_OMNISCORE,
        compute_fn=_compute_omniscore,
    )


async def _calculate_omniscore(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """
    Core OmniScore computation with optimized SQL queries.
    Extracted for testability and cache separation.
    """
    criteria = []
    total_score = 0

    # ── Query 1: Get user accounts (single JOIN) ────────────────
    acc_result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    accounts = acc_result.scalars().all()
    account_ids = [a.id for a in accounts]

    # Extract balances from already-loaded accounts (no extra queries)
    savings_balance = sum(
        a.balance for a in accounts
        if hasattr(a.type, 'value') and str(a.type.value if hasattr(a.type, 'value') else a.type) in ('savings', 'deposit')
    )
    checking_balance = sum(
        a.balance for a in accounts
        if hasattr(a.type, 'value') and str(a.type.value if hasattr(a.type, 'value') else a.type) == 'checking'
    )
    liquid_balance = savings_balance + checking_balance

    # ── Query 2: Income + Expenses in ONE query (CASE WHEN) ─────
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    one_year_ago = datetime.now(timezone.utc) - timedelta(days=365)

    income_expense_result = await db.execute(
        select(
            func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)).label("total_income"),
            func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label("total_expenses"),
            func.sum(
                case(
                    (Transaction.category == 'frais_bancaires', Transaction.amount),
                    else_=0,
                )
            ).label("annual_fees"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.date >= one_year_ago.date(),
        )
    )
    ie_row = income_expense_result.one()

    # For 6-month averages, we'll use the full year data and approximate
    # (the 6-month income/expense is more precise with a date filter)
    income_expense_6m = await db.execute(
        select(
            func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)).label("income_6m"),
            func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label("expenses_6m"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.date >= six_months_ago.date(),
        )
    )
    ie6m = income_expense_6m.one()

    total_income_6m = ie6m.income_6m or 0
    total_expenses_6m = abs(ie6m.expenses_6m or 0)
    monthly_income = total_income_6m / 6 if total_income_6m > 0 else 0
    monthly_expenses = total_expenses_6m / 6 if total_expenses_6m > 0 else 0
    annual_fees = abs(ie_row.annual_fees or 0)

    # ── 1. Emergency savings (25 pts) ────────────────────
    target_emergency = monthly_expenses * 3
    if target_emergency > 0:
        ratio = min(1.0, liquid_balance / target_emergency)
        emergency_score = round(25 * ratio)
    else:
        emergency_score = 25
    criteria.append({
        "key": "emergency_savings",
        "label": "Épargne de précaution",
        "score": emergency_score,
        "maxScore": 25,
        "description": f"{'✓' if emergency_score >= 20 else '⚠'} {liquid_balance / 100:.0f}€ / {target_emergency / 100:.0f}€ cible (3 mois de charges)",
        "color": "#22c55e" if emergency_score >= 20 else "#f59e0b",
    })
    total_score += emergency_score

    # ── 2. Debt ratio (20 pts) ───────────────────────────
    debt_accounts = [a for a in accounts if str(a.type.value if hasattr(a.type, 'value') else a.type) in ('loan', 'mortgage', 'credit')]
    total_debt = sum(abs(a.balance) for a in debt_accounts)

    # Query 3: RE loans (kept separate — different table)
    re_loan_result = await db.execute(
        select(func.sum(RealEstateProperty.loan_remaining))
        .where(RealEstateProperty.user_id == user_id)
    )
    re_loans = re_loan_result.scalar() or 0
    total_debt += re_loans

    # Query 3b: Debts module (Phase B1) — standalone debts
    debt_module_result = await db.execute(
        select(func.sum(Debt.remaining_amount))
        .where(Debt.user_id == user_id)
    )
    debt_module_total = debt_module_result.scalar() or 0
    total_debt += debt_module_total

    if monthly_income > 0:
        debt_ratio = (total_debt / 100) / (monthly_income / 100 * 12)
        if debt_ratio <= 0.33:
            debt_score = 20
        elif debt_ratio <= 0.5:
            debt_score = round(20 * (1 - (debt_ratio - 0.33) / 0.17))
        else:
            debt_score = max(0, round(20 * (1 - debt_ratio)))
    else:
        debt_score = 20 if total_debt == 0 else 0

    criteria.append({
        "key": "debt_ratio",
        "label": "Taux d'endettement",
        "score": min(20, max(0, debt_score)),
        "maxScore": 20,
        "description": f"Dettes: {total_debt / 100:.0f}€ — Ratio: {(total_debt / max(1, monthly_income * 12) * 100):.0f}%",
        "color": "#6366f1",
    })
    total_score += min(20, max(0, debt_score))

    # ── 3. Diversification (20 pts) — BATCHED via UNION ALL ──────
    asset_classes = 0
    if any(str(a.type.value if hasattr(a.type, 'value') else a.type) in ('checking', 'savings', 'deposit') for a in accounts):
        asset_classes += 1

    # Query 4: Count crypto + stocks + real_estate in ONE query (UNION ALL)
    diversification_query = union_all(
        select(literal("crypto").label("asset_type"), func.count(CryptoWallet.id).label("cnt"))
        .where(CryptoWallet.user_id == user_id),
        select(literal("stocks").label("asset_type"), func.count(StockPortfolio.id).label("cnt"))
        .where(StockPortfolio.user_id == user_id),
        select(literal("real_estate").label("asset_type"), func.count(RealEstateProperty.id).label("cnt"))
        .where(RealEstateProperty.user_id == user_id),
    )
    div_result = await db.execute(diversification_query)
    for row in div_result.all():
        if row.cnt > 0:
            asset_classes += 1

    diversification_score = min(20, asset_classes * 5)
    criteria.append({
        "key": "diversification",
        "label": "Diversification",
        "score": diversification_score,
        "maxScore": 20,
        "description": f"{asset_classes}/4 classes d'actifs",
        "color": "#f59e0b",
    })
    total_score += diversification_score

    # ── 4. Savings regularity (15 pts) — BATCHED: 1 query instead of 12 ──
    twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)
    regularity_result = await db.execute(
        select(func.count())
        .select_from(
            select(
                func.date_trunc("month", Transaction.date).label("month"),
                func.sum(Transaction.amount).label("net"),
            )
            .where(
                Transaction.account_id.in_(account_ids),
                Transaction.date >= twelve_months_ago.date(),
            )
            .group_by(func.date_trunc("month", Transaction.date))
            .having(func.sum(Transaction.amount) > 0)
            .subquery()
        )
    )
    months_with_savings = regularity_result.scalar() or 0

    regularity_score = round(15 * (months_with_savings / 12))
    criteria.append({
        "key": "savings_regularity",
        "label": "Régularité épargne",
        "score": regularity_score,
        "maxScore": 15,
        "description": f"{months_with_savings}/12 mois avec épargne positive",
        "color": "#06b6d4",
    })
    total_score += regularity_score

    # ── 5. Net worth growth (10 pts) ─────────────────────
    if account_ids:
        # Query 6: current + 6 months ago snapshots in ONE query
        six_m_ago = datetime.now(timezone.utc) - timedelta(days=180)
        snapshot_result = await db.execute(
            select(
                func.sum(
                    case(
                        (func.date_trunc("day", BalanceSnapshot.captured_at) == func.date_trunc("day", datetime.now(timezone.utc)), BalanceSnapshot.balance),
                        else_=0,
                    )
                ).label("now_total"),
                func.sum(
                    case(
                        (func.date_trunc("day", BalanceSnapshot.captured_at) == func.date_trunc("day", six_m_ago), BalanceSnapshot.balance),
                        else_=0,
                    )
                ).label("past_total"),
            )
            .where(BalanceSnapshot.account_id.in_(account_ids))
        )
        snap_row = snapshot_result.one()
        now_total = snap_row.now_total or 0
        past_total = snap_row.past_total or 0

        if past_total and past_total > 0:
            growth_pct = ((now_total - past_total) / abs(past_total)) * 100
            if growth_pct >= 10:
                growth_score = 10
            elif growth_pct >= 0:
                growth_score = round(10 * (growth_pct / 10))
            else:
                growth_score = max(0, round(10 + growth_pct))
        else:
            growth_score = 5
    else:
        growth_score = 5

    criteria.append({
        "key": "networth_growth",
        "label": "Croissance patrimoine",
        "score": min(10, max(0, growth_score)),
        "maxScore": 10,
        "description": "Évolution sur 6 mois",
        "color": "#a855f7",
    })
    total_score += min(10, max(0, growth_score))

    # ── 6. Banking fees (10 pts) — already computed in Query 2 ───
    median_fees = 20000  # 200€ estimated median in centimes

    if annual_fees <= median_fees * 0.5:
        fees_score = 10
    elif annual_fees <= median_fees:
        fees_score = round(10 * (1 - (annual_fees / median_fees) * 0.5))
    else:
        fees_score = max(0, round(10 * (1 - annual_fees / (median_fees * 2))))

    criteria.append({
        "key": "banking_fees",
        "label": "Frais bancaires",
        "score": min(10, max(0, fees_score)),
        "maxScore": 10,
        "description": f"{annual_fees / 100:.0f}€/an (médiane estimée: {median_fees / 100:.0f}€)",
        "color": "#ec4899",
    })
    total_score += min(10, max(0, fees_score))

    # ── Recommendations ──────────────────────────────────
    recommendations = []
    if emergency_score < 20:
        recommendations.append("Constituez une épargne de précaution équivalente à 3 mois de charges.")
    if diversification_score < 15:
        recommendations.append("Diversifiez vers d'autres classes d'actifs pour réduire le risque.")
    if regularity_score < 10:
        recommendations.append("Mettez en place un virement automatique mensuel vers votre épargne.")
    if fees_score < 7:
        recommendations.append("Vos frais bancaires sont élevés. Comparez les offres des banques en ligne.")

    return {
        "total": min(100, max(0, total_score)),
        "criteria": criteria,
        "recommendations": recommendations,
    }


# ── Anomalies ─────────────────────────────────────────────


@router.get("/anomalies")
async def get_anomalies(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Detect and return anomalies in recent transactions.
    Combines fresh detection with persisted anomalies.
    """
    from app.ai.anomaly_detector import detect_anomalies, save_anomalies

    # Run fresh detection
    new_anomalies = await detect_anomalies(db, user.id)

    # Save new ones
    if new_anomalies:
        await save_anomalies(db, user.id, new_anomalies)
        await db.commit()

    # Fetch all non-dismissed anomalies
    from app.models.ai_insight import AIInsight, InsightType

    anomaly_types = [
        InsightType.ANOMALY_UNUSUAL_AMOUNT.value,
        InsightType.ANOMALY_DUPLICATE.value,
        InsightType.ANOMALY_NEW_RECURRING.value,
        InsightType.ANOMALY_HIDDEN_FEE.value,
    ]
    result = await db.execute(
        select(AIInsight)
        .where(
            AIInsight.user_id == user.id,
            AIInsight.type.in_(anomaly_types),
            AIInsight.is_dismissed == False,
        )
        .order_by(AIInsight.created_at.desc())
        .limit(20)
    )
    anomalies = result.scalars().all()

    return {
        "anomalies": [
            {
                "id": str(a.id),
                "type": a.type.value if hasattr(a.type, 'value') else a.type,
                "severity": a.severity.value if hasattr(a.severity, 'value') else a.severity,
                "title": a.title,
                "description": a.description,
                "confidence": a.confidence,
                "data": a.data,
                "is_read": a.is_read,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "transaction_id": str(a.related_transaction_id) if a.related_transaction_id else None,
            }
            for a in anomalies
        ],
        "count": len(anomalies),
    }


# ── Forecast ──────────────────────────────────────────────


@router.get("/forecast")
async def get_forecast(
    days: int = 30,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Predict balance for the next N days (default 30).
    Uses weighted moving average + recurring detection + weekly seasonality.
    """
    from app.ai.forecaster import forecast_balance

    if days < 7:
        days = 7
    if days > 90:
        days = 90

    result = await forecast_balance(db, user.id, days_ahead=days)

    return result


# ── Tips ──────────────────────────────────────────────────


@router.get("/tips")
async def get_tips(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get top 5 personalized financial insights/tips.
    Generated from spending patterns, trends, and contextual analysis.
    """
    from app.ai.insights_generator import generate_insights, save_insights

    tips = await generate_insights(db, user.id)

    # Save to DB
    if tips:
        await save_insights(db, user.id, tips)
        await db.commit()

    return {
        "tips": [
            {
                "type": t["type"],
                "severity": t["severity"],
                "title": t["title"],
                "description": t["description"],
                "data": t.get("data", {}),
            }
            for t in tips
        ],
        "count": len(tips),
    }


# ── Dismiss ───────────────────────────────────────────────


@router.patch("/{insight_id}/dismiss")
async def dismiss_insight(
    insight_id: UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Dismiss an insight (user acknowledged/ignored it)."""
    from app.models.ai_insight import AIInsight

    result = await db.execute(
        select(AIInsight).where(
            AIInsight.id == insight_id,
            AIInsight.user_id == user.id,
        )
    )
    insight = result.scalar_one_or_none()

    if not insight:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Insight introuvable.")

    insight.is_dismissed = True
    insight.is_read = True
    await db.commit()

    return {"status": "dismissed"}