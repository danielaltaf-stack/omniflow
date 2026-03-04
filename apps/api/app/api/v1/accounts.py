"""
OmniFlow — Accounts, Transactions & Categories endpoints.
"""

from __future__ import annotations

import math
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.bank import AccountResponse, PaginatedTransactions, TransactionResponse
from app.woob_engine.categorizer import CATEGORY_COLORS, CATEGORY_ICONS

router = APIRouter(tags=["Accounts"])


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all accounts across all bank connections for the current user."""
    result = await db.execute(
        select(Account, BankConnection.bank_name, BankConnection.bank_module)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user.id)
        .order_by(BankConnection.bank_name, Account.label)
    )
    rows = result.all()

    return [
        AccountResponse(
            id=acc.id,
            connection_id=acc.connection_id,
            external_id=acc.external_id,
            type=acc.type.value if hasattr(acc.type, "value") else acc.type,
            label=acc.label,
            balance=acc.balance,
            currency=acc.currency,
            bank_name=bank_name,
            bank_module=bank_module,
            created_at=acc.created_at,
        )
        for acc, bank_name, bank_module in rows
    ]


@router.get("/accounts/{account_id}/transactions", response_model=PaginatedTransactions)
async def list_transactions(
    account_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List transactions for an account (paginated)."""
    # Verify account belongs to user
    acc_result = await db.execute(
        select(Account)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(Account.id == account_id, BankConnection.user_id == user.id)
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compte introuvable.",
        )

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.account_id == account_id
        )
    )
    total = count_result.scalar() or 0

    # Fetch page
    offset = (page - 1) * per_page
    txn_result = await db.execute(
        select(Transaction)
        .where(Transaction.account_id == account_id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    transactions = txn_result.scalars().all()

    return PaginatedTransactions(
        items=[
            TransactionResponse(
                id=t.id,
                account_id=t.account_id,
                external_id=t.external_id,
                date=t.date,
                amount=t.amount,
                label=t.label,
                raw_label=t.raw_label,
                type=t.type.value if hasattr(t.type, "value") else t.type,
                category=t.category,
                subcategory=t.subcategory,
                merchant=t.merchant,
                is_recurring=t.is_recurring,
                created_at=t.created_at,
            )
            for t in transactions
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/transactions/search", response_model=PaginatedTransactions)
async def search_transactions(
    q: str = Query(default="", description="Search text in label/merchant"),
    category: str | None = Query(default=None),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    amount_min: int | None = Query(default=None, description="Min amount in centimes"),
    amount_max: int | None = Query(default=None, description="Max amount in centimes"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search transactions across all accounts with filters."""
    # Get user's account IDs
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user.id)
    )
    account_ids = [row[0] for row in acc_result.all()]

    if not account_ids:
        return PaginatedTransactions(items=[], total=0, page=1, per_page=per_page, pages=1)

    # Build query
    base = select(Transaction).where(Transaction.account_id.in_(account_ids))

    if q:
        search = f"%{q}%"
        base = base.where(
            or_(
                Transaction.label.ilike(search),
                Transaction.merchant.ilike(search),
                Transaction.raw_label.ilike(search),
            )
        )

    if category:
        base = base.where(Transaction.category == category)

    if date_from:
        base = base.where(Transaction.date >= date_from)

    if date_to:
        base = base.where(Transaction.date <= date_to)

    if amount_min is not None:
        base = base.where(Transaction.amount >= amount_min)

    if amount_max is not None:
        base = base.where(Transaction.amount <= amount_max)

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch page
    offset = (page - 1) * per_page
    txn_result = await db.execute(
        base.order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    transactions = txn_result.scalars().all()

    return PaginatedTransactions(
        items=[
            TransactionResponse(
                id=t.id,
                account_id=t.account_id,
                external_id=t.external_id,
                date=t.date,
                amount=t.amount,
                label=t.label,
                raw_label=t.raw_label,
                type=t.type.value if hasattr(t.type, "value") else t.type,
                category=t.category,
                subcategory=t.subcategory,
                merchant=t.merchant,
                is_recurring=t.is_recurring,
                created_at=t.created_at,
            )
            for t in transactions
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/categories")
async def list_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all categories with transaction count and total amount."""
    acc_result = await db.execute(
        select(Account.id)
        .join(BankConnection, Account.connection_id == BankConnection.id)
        .where(BankConnection.user_id == user.id)
    )
    account_ids = [row[0] for row in acc_result.all()]

    if not account_ids:
        return []

    result = await db.execute(
        select(
            Transaction.category,
            func.count().label("count"),
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.category.isnot(None),
        )
        .group_by(Transaction.category)
        .order_by(func.count().desc())
    )
    rows = result.all()

    return [
        {
            "category": row.category,
            "count": row.count,
            "total": int(row.total) if row.total else 0,
            "color": CATEGORY_COLORS.get(row.category, "#9E9E9E"),
            "icon": CATEGORY_ICONS.get(row.category, "help-circle"),
        }
        for row in rows
    ]
