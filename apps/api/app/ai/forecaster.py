"""
OmniFlow — Cash-Flow Forecaster.
Predicts balance for the next 30 days using weighted statistics.
Zero external dependencies — no Prophet, no sklearn.
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

logger = logging.getLogger("omniflow.ai.forecast")


async def forecast_balance(
    db: AsyncSession,
    user_id: UUID,
    days_ahead: int = 30,
    lookback_days: int = 90,
) -> dict:
    """
    Predict future balance using Weighted Moving Average + recurring detection.

    Algorithm:
    1. Aggregate daily net flows over lookback period
    2. Compute weighted trend (exponential decay λ=0.95)
    3. Compute weekly seasonality (average by day-of-week)
    4. Detect recurring transactions (fixed amounts at regular intervals)
    5. Project forward with confidence intervals

    Returns:
    {
        "current_balance": int,
        "forecast": [{date, predicted, lower_68, upper_68, lower_95, upper_95}],
        "recurring_detected": [{label, amount, next_date, interval_days}],
        "overdraft_risk": {at_risk: bool, estimated_date: str | null},
        "trend_daily": float (avg daily change in centimes)
    }
    """
    # Get accounts & current balance
    acc_result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    accounts = acc_result.scalars().all()
    if not accounts:
        return _empty_forecast()

    account_ids = [a.id for a in accounts]
    # Current liquid balance (checking + savings)
    current_balance = sum(
        a.balance for a in accounts
        if str(a.type.value if hasattr(a.type, 'value') else a.type)
        in ("checking", "savings")
    )

    today = date.today()
    start_date = today - timedelta(days=lookback_days)

    # Fetch daily net flows
    result = await db.execute(
        select(
            Transaction.date,
            func.sum(Transaction.amount).label("net"),
        )
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.date >= start_date,
                Transaction.date <= today,
            )
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date)
    )
    daily_flows_raw = {row.date: int(row.net) for row in result.all()}

    # Fill missing days with 0
    daily_flows: dict[date, int] = {}
    d = start_date
    while d <= today:
        daily_flows[d] = daily_flows_raw.get(d, 0)
        d += timedelta(days=1)

    if len(daily_flows) < 7:
        return _empty_forecast(current_balance)

    # ── Step 1: Weighted trend (exponential decay) ──
    dates_sorted = sorted(daily_flows.keys())
    flows = [daily_flows[d] for d in dates_sorted]
    n = len(flows)

    # Weighted mean daily flow (λ=0.95 decay)
    lam = 0.95
    weights = [lam ** (n - 1 - i) for i in range(n)]
    w_sum = sum(weights)
    trend_daily = sum(f * w for f, w in zip(flows, weights)) / w_sum if w_sum > 0 else 0

    # ── Step 2: Weekly seasonality ──
    dow_totals: dict[int, list[int]] = defaultdict(list)
    for d, flow in daily_flows.items():
        dow_totals[d.weekday()].append(flow)
    dow_avg = {dow: sum(vals) / len(vals) for dow, vals in dow_totals.items()}
    global_avg = sum(flows) / len(flows) if flows else 0
    # Seasonal adjustment = dow_avg - global_avg
    seasonal = {dow: avg - global_avg for dow, avg in dow_avg.items()}

    # ── Step 3: Detect recurring transactions ──
    recurrings = await _detect_recurring(db, account_ids, start_date, today)

    # ── Step 4: Residual variance for confidence intervals ──
    residuals = []
    for i, d in enumerate(dates_sorted):
        predicted = trend_daily + seasonal.get(d.weekday(), 0)
        residuals.append(flows[i] - predicted)
    residual_var = (
        sum(r ** 2 for r in residuals) / len(residuals)
        if residuals else 0
    )
    daily_std = math.sqrt(residual_var) if residual_var > 0 else 0

    # ── Step 5: Project forward ──
    forecast_points = []
    running_balance = current_balance
    overdraft_date = None

    for day_offset in range(1, days_ahead + 1):
        future_date = today + timedelta(days=day_offset)
        dow = future_date.weekday()

        # Base prediction: trend + seasonal
        daily_pred = trend_daily + seasonal.get(dow, 0)

        # Add known recurring transactions for this date
        for rec in recurrings:
            if rec["next_date"] == future_date.isoformat():
                daily_pred += rec["amount"]
                # Advance next_date for the next occurrence
                rec["next_date"] = (
                    future_date + timedelta(days=rec["interval_days"])
                ).isoformat()

        running_balance += int(daily_pred)

        # Confidence intervals grow with sqrt(time)
        cumulative_std = daily_std * math.sqrt(day_offset)
        lower_68 = running_balance - int(cumulative_std)
        upper_68 = running_balance + int(cumulative_std)
        lower_95 = running_balance - int(2 * cumulative_std)
        upper_95 = running_balance + int(2 * cumulative_std)

        forecast_points.append({
            "date": future_date.isoformat(),
            "predicted": running_balance,
            "lower_68": lower_68,
            "upper_68": upper_68,
            "lower_95": lower_95,
            "upper_95": upper_95,
        })

        # Overdraft check
        if running_balance < 0 and overdraft_date is None:
            overdraft_date = future_date.isoformat()

    logger.info(
        f"[AI] Forecast for {user_id}: {days_ahead} days, "
        f"trend={trend_daily/100:.2f}€/day, "
        f"{'OVERDRAFT RISK' if overdraft_date else 'OK'}"
    )

    return {
        "current_balance": current_balance,
        "forecast": forecast_points,
        "recurring_detected": [
            {k: v for k, v in r.items() if k != "next_date_obj"}
            for r in recurrings
        ],
        "overdraft_risk": {
            "at_risk": overdraft_date is not None,
            "estimated_date": overdraft_date,
        },
        "trend_daily": round(trend_daily),
    }


async def _detect_recurring(
    db: AsyncSession,
    account_ids: list,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Detect recurring transactions (salary, rent, subscriptions).
    Looks for 3+ transactions with same merchant/label and similar amounts
    at regular intervals.
    """
    result = await db.execute(
        select(Transaction)
        .where(
            and_(
                Transaction.account_id.in_(account_ids),
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.is_recurring == True,
            )
        )
        .order_by(Transaction.date.desc())
    )
    recurring_txns = result.scalars().all()

    # Group by merchant/label + approximate amount
    groups: dict[str, list] = defaultdict(list)
    for t in recurring_txns:
        key = (t.merchant or t.label or "").strip().lower()
        if key:
            groups[key].append(t)

    recurrings = []
    for key, txns in groups.items():
        if len(txns) < 2:
            continue

        # Sort by date (oldest first)
        txns_sorted = sorted(txns, key=lambda t: t.date)
        amounts = [t.amount for t in txns_sorted]
        avg_amount = sum(amounts) / len(amounts)

        # Compute average interval
        intervals = []
        for i in range(1, len(txns_sorted)):
            diff = (txns_sorted[i].date - txns_sorted[i - 1].date).days
            if 5 < diff < 45:  # reasonable range for recurring
                intervals.append(diff)

        if not intervals:
            continue

        avg_interval = sum(intervals) / len(intervals)
        last_date = txns_sorted[-1].date
        next_date = last_date + timedelta(days=int(round(avg_interval)))

        recurrings.append({
            "label": txns_sorted[-1].label,
            "merchant": txns_sorted[-1].merchant or "",
            "amount": int(avg_amount),
            "interval_days": int(round(avg_interval)),
            "next_date": next_date.isoformat(),
            "occurrences": len(txns_sorted),
        })

    return recurrings


def _empty_forecast(current_balance: int = 0) -> dict:
    """Return an empty forecast structure."""
    return {
        "current_balance": current_balance,
        "forecast": [],
        "recurring_detected": [],
        "overdraft_risk": {"at_risk": False, "estimated_date": None},
        "trend_daily": 0,
    }
