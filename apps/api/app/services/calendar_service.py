"""
OmniFlow — Financial Calendar Service.

Aggregates financial events from ALL data sources:
  - Bank transactions (recurring income/expenses)
  - Subscriptions (renewals, trial endings, cancellation deadlines)
  - Debts (loan payments with amortization breakdown)
  - Stock dividends (ex-dates, pay-dates)
  - Real estate (rent expected, loan payments)
  - Tangible assets (warranty expiry reminders)
  - Vault documents (document expiry)
  - Fiscal deadlines (tax dates)
  - Custom user events
  - Salary / payday detection

Produces:
  - Aggregated daily event list
  - 30-day cashflow lifeline projection
  - Green-day gamification streak
  - Payday countdown with daily budget
  - Rental income tracker

All monetary values in centimes.  Zero external ML deps.
"""

from __future__ import annotations

import calendar as cal_mod
import logging
import math
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.calendar_event import CalendarEvent
from app.models.debt import Debt, DebtPayment
from app.models.real_estate import RealEstateProperty
from app.models.stock_dividend import StockDividend
from app.models.stock_portfolio import StockPortfolio
from app.models.stock_position import StockPosition
from app.models.subscription import Subscription
from app.models.tangible_asset import TangibleAsset
from app.models.transaction import Transaction
from app.models.vault_document import VaultDocument

logger = logging.getLogger("omniflow.calendar")


# ── CRUD for custom CalendarEvent ──────────────────────────


async def create_event(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> CalendarEvent:
    event = CalendarEvent(user_id=user_id, **data)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_event_by_id(db: AsyncSession, event_id: UUID, user_id: UUID) -> CalendarEvent | None:
    result = await db.execute(
        select(CalendarEvent).where(
            and_(CalendarEvent.id == event_id, CalendarEvent.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def update_event(db: AsyncSession, event_id: UUID, user_id: UUID, data: dict[str, Any]) -> CalendarEvent | None:
    event = await get_event_by_id(db, event_id, user_id)
    if not event:
        return None
    for k, v in data.items():
        setattr(event, k, v)
    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event_id: UUID, user_id: UUID) -> bool:
    event = await get_event_by_id(db, event_id, user_id)
    if not event:
        return False
    await db.delete(event)
    await db.commit()
    return True


async def list_user_events(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.user_id == user_id,
                CalendarEvent.is_active == True,
                CalendarEvent.event_date >= start,
                CalendarEvent.event_date <= end,
            )
        )
    )
    return list(result.scalars().all())


# ── Aggregation: collect events from all sources ───────────


def _ev(
    source: str,
    original_id: str,
    title: str,
    dt: date,
    amount: int | None = None,
    is_income: bool = False,
    category: str = "other",
    color: str | None = None,
    icon: str | None = None,
    linked_type: str | None = None,
    linked_id: str | None = None,
    extra: dict | None = None,
    is_essential: bool = True,
    urgency: str = "normal",
    description: str | None = None,
) -> dict:
    """Helper to build an AggregatedCalendarEvent dict."""
    return {
        "id": f"{source}:{original_id}",
        "source": source,
        "title": title,
        "description": description,
        "date": dt,
        "amount": amount,
        "is_income": is_income,
        "category": category,
        "color": color,
        "icon": icon,
        "linked_entity_type": linked_type,
        "linked_entity_id": linked_id,
        "extra": extra or {},
        "is_essential": is_essential,
        "urgency": urgency,
    }


async def _collect_transactions(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Past transactions + detected recurring ones projected forward."""
    # Get user accounts
    acct_q = (
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acct_result = await db.execute(acct_q)
    account_ids = [r[0] for r in acct_result.all()]
    if not account_ids:
        return []

    # Actual transactions in range
    tx_q = select(Transaction).where(
        and_(
            Transaction.account_id.in_(account_ids),
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    result = await db.execute(tx_q)
    transactions = list(result.scalars().all())

    events = []
    for tx in transactions:
        amt = tx.amount if tx.amount else 0
        is_income = amt > 0
        label = tx.label or "Transaction"
        cat = getattr(tx, "category", "other") or "other"

        # Determine if essential (heuristic: housing, utilities, insurance, health → essential)
        essential_cats = {"housing", "utilities", "insurance", "health", "transport", "tax", "loan"}
        is_ess = cat.lower() in essential_cats or is_income

        events.append(
            _ev(
                source="transaction",
                original_id=str(tx.id),
                title=label[:80],
                dt=tx.date,
                amount=abs(amt),
                is_income=is_income,
                category=cat,
                color="#00D68F" if is_income else "#FF4757",
                icon="ArrowDownLeft" if is_income else "ArrowUpRight",
                linked_type="account",
                linked_id=str(tx.account_id),
                is_essential=is_ess,
            )
        )

    return events


async def _collect_subscriptions(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Subscription billing dates & cancellation deadlines."""
    result = await db.execute(
        select(Subscription).where(
            and_(Subscription.user_id == user_id, Subscription.is_active == True)
        )
    )
    subs = list(result.scalars().all())
    events = []

    for sub in subs:
        # Billing date within range
        if sub.next_billing_date and start <= sub.next_billing_date <= end:
            events.append(
                _ev(
                    source="subscription",
                    original_id=str(sub.id),
                    title=f"{sub.name} — Prélèvement",
                    dt=sub.next_billing_date,
                    amount=sub.amount,
                    is_income=False,
                    category=sub.category or "subscription",
                    color="#FECA57",
                    icon="CreditCard",
                    linked_type="subscription",
                    linked_id=str(sub.id),
                    is_essential=sub.is_essential,
                    extra={"provider": sub.provider, "billing_cycle": sub.billing_cycle},
                )
            )

        # Cancellation deadline (trial end alert)
        if sub.cancellation_deadline and start <= sub.cancellation_deadline <= end:
            urgency = "critical" if (sub.cancellation_deadline - date.today()).days <= 3 else "warning"
            events.append(
                _ev(
                    source="subscription_trial",
                    original_id=f"{sub.id}_cancel",
                    title=f"⚠️ Dernier jour pour résilier {sub.name}",
                    dt=sub.cancellation_deadline,
                    amount=sub.amount,
                    is_income=False,
                    category="subscription_alert",
                    color="#FF4757",
                    icon="AlertTriangle",
                    linked_type="subscription",
                    linked_id=str(sub.id),
                    is_essential=False,
                    urgency=urgency,
                    description=f"Résiliez avant cette date pour ne pas être débité de {sub.amount / 100:.2f} €",
                )
            )

        # Contract end
        if sub.contract_end_date and start <= sub.contract_end_date <= end:
            events.append(
                _ev(
                    source="subscription",
                    original_id=f"{sub.id}_end",
                    title=f"Fin de contrat {sub.name}",
                    dt=sub.contract_end_date,
                    category="subscription",
                    color="#54A0FF",
                    icon="CalendarX",
                    linked_type="subscription",
                    linked_id=str(sub.id),
                )
            )

    return events


async def _collect_debts(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Loan payment dates with principal vs interest breakdown."""
    result = await db.execute(
        select(Debt).where(Debt.user_id == user_id)
    )
    debts = list(result.scalars().all())
    events = []

    for debt in debts:
        # Projected monthly payment dates
        if debt.start_date:
            # Calculate payment day of month from start_date
            pay_day = debt.start_date.day
            current = start.replace(day=min(pay_day, cal_mod.monthrange(start.year, start.month)[1]))
            if current < start:
                # Move to next month
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)
                current = current.replace(day=min(pay_day, cal_mod.monthrange(current.year, current.month)[1]))

            while current <= end:
                if debt.end_date and current > debt.end_date:
                    break

                # Compute remaining months
                if debt.end_date:
                    months_left = (debt.end_date.year - current.year) * 12 + (debt.end_date.month - current.month)
                else:
                    months_left = debt.duration_months

                # Find matching DebtPayment for breakdown
                extra = {
                    "debt_type": debt.debt_type.value if hasattr(debt.debt_type, "value") else str(debt.debt_type),
                    "remaining_months": max(0, months_left),
                    "creditor": debt.creditor or "",
                }

                # Check if we have actual payment data for this date
                for p in (debt.payments or []):
                    if p.payment_date == current:
                        extra["principal"] = p.principal_amount
                        extra["interest"] = p.interest_amount
                        extra["insurance"] = p.insurance_amount
                        extra["remaining_after"] = p.remaining_after
                        break

                events.append(
                    _ev(
                        source="debt",
                        original_id=f"{debt.id}_{current.isoformat()}",
                        title=f"Crédit — {debt.label}",
                        dt=current,
                        amount=debt.monthly_payment,
                        is_income=False,
                        category="loan",
                        color="#A29BFE",
                        icon="Building",
                        linked_type="debt",
                        linked_id=str(debt.id),
                        is_essential=True,
                        extra=extra,
                        description=f"Plus que {max(0, months_left)} mensualités" if months_left else None,
                    )
                )

                # Next month
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)
                current = current.replace(day=min(pay_day, cal_mod.monthrange(current.year, current.month)[1]))

    return events


async def _collect_dividends(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Stock & ETF dividends."""
    portfolio_q = select(StockPortfolio.id).where(StockPortfolio.user_id == user_id)
    port_result = await db.execute(portfolio_q)
    portfolio_ids = [r[0] for r in port_result.all()]
    if not portfolio_ids:
        return []

    pos_q = select(StockPosition).where(StockPosition.portfolio_id.in_(portfolio_ids))
    pos_result = await db.execute(pos_q)
    position_ids = [p.id for p in pos_result.scalars().all()]
    if not position_ids:
        return []

    div_q = select(StockDividend).where(
        and_(
            StockDividend.position_id.in_(position_ids),
        )
    )
    div_result = await db.execute(div_q)
    dividends = list(div_result.scalars().all())
    events = []

    for div in dividends:
        # Ex-date
        if hasattr(div, "ex_date") and div.ex_date and start <= div.ex_date <= end:
            events.append(
                _ev(
                    source="dividend",
                    original_id=f"{div.id}_ex",
                    title=f"📈 Détachement dividende",
                    dt=div.ex_date,
                    amount=div.total_amount if hasattr(div, "total_amount") else None,
                    is_income=True,
                    category="dividend",
                    color="#00D68F",
                    icon="TrendingUp",
                    linked_type="dividend",
                    linked_id=str(div.id),
                    extra={"type": "ex_date"},
                )
            )

        # Pay date
        if hasattr(div, "pay_date") and div.pay_date and start <= div.pay_date <= end:
            events.append(
                _ev(
                    source="dividend",
                    original_id=f"{div.id}_pay",
                    title=f"💰 Versement dividende",
                    dt=div.pay_date,
                    amount=div.total_amount if hasattr(div, "total_amount") else None,
                    is_income=True,
                    category="dividend",
                    color="#00D68F",
                    icon="Banknote",
                    linked_type="dividend",
                    linked_id=str(div.id),
                    extra={"type": "pay_date"},
                )
            )

    return events


async def _collect_realestate(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Rental income expected dates & RE loan payments."""
    result = await db.execute(
        select(RealEstateProperty).where(RealEstateProperty.user_id == user_id)
    )
    properties = list(result.scalars().all())
    events = []

    for prop in properties:
        # Monthly rent expected (assume day 5 of each month)
        rent = getattr(prop, "monthly_rent", 0) or 0
        if rent > 0:
            current = start.replace(day=5) if start.day <= 5 else (
                (start.replace(day=1) + timedelta(days=32)).replace(day=5)
            )
            while current <= end:
                events.append(
                    _ev(
                        source="rent_income",
                        original_id=f"{prop.id}_rent_{current.isoformat()}",
                        title=f"🏠 Loyer attendu — {getattr(prop, 'label', 'Bien')}",
                        dt=current,
                        amount=rent,
                        is_income=True,
                        category="rent",
                        color="#00D68F",
                        icon="Home",
                        linked_type="property",
                        linked_id=str(prop.id),
                        is_essential=True,
                        extra={"property_name": getattr(prop, "label", "Bien immobilier")},
                    )
                )
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)

        # RE loan payments
        loan_payment = getattr(prop, "monthly_loan_payment", 0) or 0
        if loan_payment > 0:
            loan_day = 10  # Assume day 10
            loan_start = getattr(prop, "loan_start_date", None)
            if loan_start:
                loan_day = loan_start.day

            current = start.replace(day=min(loan_day, cal_mod.monthrange(start.year, start.month)[1]))
            if current < start:
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)
                current = current.replace(day=min(loan_day, cal_mod.monthrange(current.year, current.month)[1]))

            while current <= end:
                events.append(
                    _ev(
                        source="realestate_loan",
                        original_id=f"{prop.id}_loan_{current.isoformat()}",
                        title=f"🏠 Crédit immo — {getattr(prop, 'label', 'Bien')}",
                        dt=current,
                        amount=loan_payment,
                        is_income=False,
                        category="loan",
                        color="#A29BFE",
                        icon="Building",
                        linked_type="property",
                        linked_id=str(prop.id),
                        is_essential=True,
                    )
                )
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)
                current = current.replace(day=min(loan_day, cal_mod.monthrange(current.year, current.month)[1]))

    return events


async def _collect_guarantees(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Warranty expiry reminders for tangible assets (1 month before)."""
    # We look for warranty_expires in range [start+, end+30d] so we alert 30d before
    alert_start = start - timedelta(days=30)
    result = await db.execute(
        select(TangibleAsset).where(
            and_(
                TangibleAsset.user_id == user_id,
                TangibleAsset.warranty_expires != None,
                TangibleAsset.warranty_expires >= start,
                TangibleAsset.warranty_expires <= end + timedelta(days=30),
            )
        )
    )
    assets = list(result.scalars().all())
    events = []

    for asset in assets:
        # Place reminder 30 days before expiry
        reminder_date = asset.warranty_expires - timedelta(days=30)
        if reminder_date < start:
            reminder_date = start
        if reminder_date <= end:
            events.append(
                _ev(
                    source="guarantee",
                    original_id=f"{asset.id}_warranty",
                    title=f"⚠️ Fin de garantie — {asset.name}",
                    dt=reminder_date,
                    category="guarantee",
                    color="#FECA57",
                    icon="Shield",
                    linked_type="asset",
                    linked_id=str(asset.id),
                    urgency="warning",
                    description=f"La garantie de {asset.name} expire le {asset.warranty_expires.strftime('%d/%m/%Y')}. Vérifiez l'état du produit.",
                    extra={
                        "expiry_date": asset.warranty_expires.isoformat(),
                        "brand": asset.brand,
                        "model": asset.model,
                    },
                )
            )

    return events


async def _collect_vault_expiries(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Document expiry alerts from the digital vault."""
    result = await db.execute(
        select(VaultDocument).where(
            and_(
                VaultDocument.user_id == user_id,
                VaultDocument.expiry_date != None,
                VaultDocument.expiry_date >= start,
                VaultDocument.expiry_date <= end + timedelta(days=30),
            )
        )
    )
    docs = list(result.scalars().all())
    events = []

    for doc in docs:
        reminder_days = getattr(doc, "reminder_days", 30) or 30
        reminder_date = doc.expiry_date - timedelta(days=reminder_days)
        if reminder_date < start:
            reminder_date = max(start, doc.expiry_date - timedelta(days=7))

        if start <= reminder_date <= end:
            events.append(
                _ev(
                    source="document_expiry",
                    original_id=f"{doc.id}_expiry",
                    title=f"📄 Document expire — {getattr(doc, 'name', 'Document')}",
                    dt=reminder_date,
                    category="admin",
                    color="#54A0FF",
                    icon="FileText",
                    linked_type="document",
                    linked_id=str(doc.id),
                    urgency="warning",
                    extra={"expiry_date": doc.expiry_date.isoformat()},
                )
            )

    return events


async def _collect_custom_events(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """User-created calendar events."""
    events_db = await list_user_events(db, user_id, start, end)
    events = []

    for ev in events_db:
        events.append(
            _ev(
                source="custom",
                original_id=str(ev.id),
                title=ev.title,
                dt=ev.event_date,
                amount=ev.amount,
                is_income=ev.is_income,
                category=ev.event_type,
                color=ev.color,
                icon=ev.icon,
                linked_type=ev.linked_entity_type,
                linked_id=str(ev.linked_entity_id) if ev.linked_entity_id else None,
                is_essential=True,
                description=ev.description,
                extra=ev.extra_data or {},
            )
        )

    return events


# ── French fiscal calendar (static) ───────────────────────


def _get_fiscal_events(year: int, start: date, end: date) -> list[dict]:
    """Standard French fiscal dates for a given year."""
    fiscal_dates = [
        (date(year, 1, 15), "📋 Date limite — CFE (solde)", "tax", "critical"),
        (date(year, 2, 15), "📋 Acompte IR — Prélèvement", "tax", "warning"),
        (date(year, 4, 10), "📋 Déclaration de revenus — Ouverture", "tax", "normal"),
        (date(year, 5, 15), "📋 Acompte IR — Prélèvement", "tax", "warning"),
        (date(year, 5, 25), "📋 Déclaration de revenus — Date limite papier", "tax", "critical"),
        (date(year, 6, 8), "📋 Déclaration en ligne — Zone 1", "tax", "critical"),
        (date(year, 6, 15), "📋 Déclaration en ligne — Zone 2-3", "tax", "critical"),
        (date(year, 8, 15), "📋 Acompte IR — Prélèvement", "tax", "warning"),
        (date(year, 9, 15), "📋 Taxe foncière — Avis", "tax", "warning"),
        (date(year, 10, 15), "📋 Taxe foncière — Date limite", "tax", "critical"),
        (date(year, 10, 31), "📋 Taxe d'habitation (résid. secondaire)", "tax", "critical"),
        (date(year, 11, 15), "📋 Acompte IR — Prélèvement", "tax", "warning"),
        (date(year, 12, 15), "📋 CFE — Acompte prélèvement", "tax", "warning"),
    ]

    events = []
    for dt, title, cat, urgency in fiscal_dates:
        if start <= dt <= end:
            events.append(
                _ev(
                    source="fiscal",
                    original_id=f"fiscal_{dt.isoformat()}",
                    title=title,
                    dt=dt,
                    category=cat,
                    color="#FF6B6B",
                    icon="FileWarning",
                    is_essential=True,
                    urgency=urgency,
                )
            )

    return events


# ── Salary detection & Payday countdown ───────────────────


async def _detect_salary(
    db: AsyncSession, user_id: UUID
) -> tuple[int | None, int | None]:
    """
    Detect salary day-of-month and amount from past transactions.
    Returns (day_of_month, amount_centimes) or (None, None).
    """
    acct_q = (
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    acct_result = await db.execute(acct_q)
    account_ids = [r[0] for r in acct_result.all()]
    if not account_ids:
        return None, None

    # Look for recurring large credits (likely salary) in last 6 months
    six_months_ago = date.today() - timedelta(days=180)
    tx_q = select(Transaction).where(
        and_(
            Transaction.account_id.in_(account_ids),
            Transaction.amount > 80000,  # > 800 €
            Transaction.date >= six_months_ago,
        )
    ).order_by(Transaction.date.desc())

    result = await db.execute(tx_q)
    transactions = list(result.scalars().all())

    if len(transactions) < 2:
        return None, None

    # Group by day-of-month and find the most common one for large recurring credits
    day_amounts: dict[int, list[int]] = defaultdict(list)
    for tx in transactions:
        day_amounts[tx.date.day].append(tx.amount)

    # Find the day with most occurrences (likely salary day)
    best_day = None
    best_count = 0
    best_avg = 0
    for day, amounts in day_amounts.items():
        if len(amounts) >= best_count and len(amounts) >= 2:
            best_day = day
            best_count = len(amounts)
            best_avg = sum(amounts) // len(amounts)

    return best_day, best_avg


def _compute_payday_countdown(
    salary_day: int | None, salary_amount: int | None, current_balance: int, today: date
) -> dict:
    """Compute payday countdown and daily budget."""
    if not salary_day:
        return {
            "next_payday": None,
            "days_remaining": 0,
            "daily_budget": 0,
            "remaining_budget": 0,
            "payday_amount": 0,
        }

    # Next payday
    if today.day < salary_day:
        next_payday = today.replace(day=min(salary_day, cal_mod.monthrange(today.year, today.month)[1]))
    else:
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        next_payday = next_month.replace(day=min(salary_day, cal_mod.monthrange(next_month.year, next_month.month)[1]))

    days_remaining = (next_payday - today).days
    daily_budget = current_balance // max(days_remaining, 1)

    return {
        "next_payday": next_payday.isoformat(),
        "days_remaining": days_remaining,
        "daily_budget": max(0, daily_budget),
        "remaining_budget": max(0, current_balance),
        "payday_amount": salary_amount or 0,
    }


# ── Current liquid balance ─────────────────────────────────


async def _get_current_balance(db: AsyncSession, user_id: UUID) -> int:
    """Sum all bank account balances for the user (centimes)."""
    q = (
        select(func.coalesce(func.sum(Account.balance), 0))
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user_id)
    )
    result = await db.execute(q)
    return int(result.scalar() or 0)


# ── Rent tracker ───────────────────────────────────────────


async def _build_rent_tracker(
    db: AsyncSession, user_id: UUID, start: date, end: date
) -> list[dict]:
    """Build rental income tracker for properties."""
    result = await db.execute(
        select(RealEstateProperty).where(RealEstateProperty.user_id == user_id)
    )
    properties = list(result.scalars().all())
    tracker = []

    for prop in properties:
        rent = getattr(prop, "monthly_rent", 0) or 0
        if rent <= 0:
            continue

        expected_day = 5  # Default rent collection day
        current = start.replace(day=min(expected_day, cal_mod.monthrange(start.year, start.month)[1]))
        if current < start:
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
            current = current.replace(day=min(expected_day, cal_mod.monthrange(current.year, current.month)[1]))

        while current <= end:
            days_overdue = max(0, (date.today() - current).days) if current < date.today() else 0
            status = "received" if days_overdue == 0 and current < date.today() else (
                "overdue" if days_overdue > 3 else "pending"
            )

            tracker.append({
                "property_id": str(prop.id),
                "property_name": getattr(prop, "label", "Bien immobilier"),
                "expected_date": current.isoformat(),
                "expected_amount": rent,
                "received": status == "received",
                "days_overdue": days_overdue,
                "status": status,
            })

            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
            current = current.replace(day=min(expected_day, cal_mod.monthrange(current.year, current.month)[1]))

    return tracker


# ── Green-day gamification ─────────────────────────────────


def _compute_green_streak(day_events: dict[date, list[dict]], month_start: date, today: date) -> dict:
    """Compute green-day streak: days with no non-essential spending."""
    current_streak = 0
    best_streak = 0
    total_green = 0
    streak = 0

    current = month_start
    end = min(today, month_start.replace(day=cal_mod.monthrange(month_start.year, month_start.month)[1]))
    total_days = 0

    while current <= end:
        total_days += 1
        events = day_events.get(current, [])
        has_non_essential = any(
            not e.get("is_income", False) and not e.get("is_essential", True)
            for e in events
        )
        if has_non_essential:
            streak = 0
        else:
            streak += 1
            total_green += 1

        best_streak = max(best_streak, streak)
        current += timedelta(days=1)

    current_streak = streak  # Current streak is the last computed

    return {
        "current_streak": current_streak,
        "best_streak": best_streak,
        "total_green_days": total_green,
        "total_days_elapsed": total_days,
        "pct": round(total_green / max(total_days, 1) * 100, 1),
    }


# ── Cashflow lifeline (30-day projection) ──────────────────


def _build_lifeline(
    balance: int,
    day_events: dict[date, list[dict]],
    start: date,
    days: int = 30,
    alert_threshold: int = 0,
) -> list[dict]:
    """Build the cashflow lifeline curve."""
    points = []
    current_balance = balance

    for i in range(days):
        d = start + timedelta(days=i)
        events = day_events.get(d, [])
        day_income = sum(e.get("amount", 0) for e in events if e.get("is_income"))
        day_expenses = sum(e.get("amount", 0) for e in events if not e.get("is_income") and e.get("amount"))
        current_balance = current_balance + day_income - day_expenses

        points.append({
            "date": d.isoformat(),
            "projected_balance": current_balance,
            "day_income": day_income,
            "day_expenses": day_expenses,
            "alert": current_balance < alert_threshold,
        })

    return points


# ── Main aggregation ───────────────────────────────────────


async def get_calendar_month(
    db: AsyncSession, user_id: UUID, year: int, month: int
) -> dict[str, Any]:
    """
    Build the complete calendar response for a given month.
    Aggregates all event sources + computes lifeline, green streaks, payday, rent tracker.
    """
    today = date.today()
    month_start = date(year, month, 1)
    month_end = date(year, month, cal_mod.monthrange(year, month)[1])

    # Extend range for lifeline (30 days from today or month start)
    lifeline_start = max(today, month_start)
    lifeline_end = lifeline_start + timedelta(days=30)
    fetch_end = max(month_end, lifeline_end)

    # Collect all events in parallel-friendly manner
    all_events: list[dict] = []

    transactions = await _collect_transactions(db, user_id, month_start, fetch_end)
    all_events.extend(transactions)

    subs = await _collect_subscriptions(db, user_id, month_start, fetch_end)
    all_events.extend(subs)

    debts = await _collect_debts(db, user_id, month_start, fetch_end)
    all_events.extend(debts)

    dividends = await _collect_dividends(db, user_id, month_start, fetch_end)
    all_events.extend(dividends)

    realestate = await _collect_realestate(db, user_id, month_start, fetch_end)
    all_events.extend(realestate)

    guarantees = await _collect_guarantees(db, user_id, month_start, fetch_end)
    all_events.extend(guarantees)

    vault = await _collect_vault_expiries(db, user_id, month_start, fetch_end)
    all_events.extend(vault)

    custom = await _collect_custom_events(db, user_id, month_start, fetch_end)
    all_events.extend(custom)

    # Fiscal events
    fiscal = _get_fiscal_events(year, month_start, fetch_end)
    all_events.extend(fiscal)
    if year != lifeline_end.year:
        fiscal2 = _get_fiscal_events(lifeline_end.year, month_start, fetch_end)
        all_events.extend(fiscal2)

    # Group events by date
    day_events: dict[date, list[dict]] = defaultdict(list)
    for ev in all_events:
        d = ev["date"]
        if isinstance(d, str):
            d = date.fromisoformat(d)
        day_events[d].append(ev)

    # Current balance
    balance = await _get_current_balance(db, user_id)

    # Build day summaries
    days = []
    running_balance = balance
    total_income = 0
    total_expenses = 0

    current = month_start
    while current <= month_end:
        events = day_events.get(current, [])
        day_income = sum(e.get("amount", 0) for e in events if e.get("is_income"))
        day_expenses = sum(e.get("amount", 0) for e in events if not e.get("is_income") and e.get("amount"))

        if current <= today:
            running_balance = running_balance + day_income - day_expenses

        is_green = not any(
            not e.get("is_income", False) and not e.get("is_essential", True)
            for e in events
        )

        alert_level = "ok"
        if running_balance < 0:
            alert_level = "danger"
        elif running_balance < 10000:  # < 100 €
            alert_level = "warning"

        total_income += day_income
        total_expenses += day_expenses

        days.append({
            "date": current.isoformat(),
            "total_income": day_income,
            "total_expenses": day_expenses,
            "net": day_income - day_expenses,
            "projected_balance": running_balance,
            "is_green_day": is_green,
            "events": events,
            "alert_level": alert_level,
        })

        current += timedelta(days=1)

    # Lifeline
    lifeline = _build_lifeline(balance, day_events, lifeline_start, 30)

    # Green streak
    green_streak = _compute_green_streak(day_events, month_start, today)

    # Payday
    salary_day, salary_amount = await _detect_salary(db, user_id)
    payday = _compute_payday_countdown(salary_day, salary_amount, balance, today)

    # Rent tracker
    rent_tracker = await _build_rent_tracker(db, user_id, month_start, month_end)

    # Upcoming alerts (next 7 days)
    alert_start = today
    alert_end = today + timedelta(days=7)
    upcoming_alerts = [
        e for e in all_events
        if e.get("urgency") in ("warning", "critical")
        and alert_start <= (e["date"] if isinstance(e["date"], date) else date.fromisoformat(e["date"])) <= alert_end
    ]

    return {
        "month": f"{year:04d}-{month:02d}",
        "days": days,
        "lifeline": lifeline,
        "green_streak": green_streak,
        "payday": payday,
        "rent_tracker": rent_tracker,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income - total_expenses,
        "upcoming_alerts": upcoming_alerts,
    }
