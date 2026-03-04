"""
OmniFlow — RGPD / GDPR Service.

Implements:
- Full data export (Article 15 & 20 — right of access & portability)
- Account hard-delete (Article 17 — right to erasure)
- Data anonymization helpers

Zero external dependencies — pure SQLAlchemy + stdlib.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.bank_connection import BankConnection
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.balance_snapshot import BalanceSnapshot
from app.models.crypto_wallet import CryptoWallet
from app.models.crypto_holding import CryptoHolding
from app.models.crypto_transaction import CryptoTransaction
from app.models.stock_portfolio import StockPortfolio
from app.models.stock_position import StockPosition
from app.models.stock_dividend import StockDividend
from app.models.real_estate import RealEstateProperty
from app.models.real_estate_valuation import RealEstateValuation
from app.models.ai_insight import Budget, AIInsight
from app.models.chat import ChatConversation, ChatMessage
from app.models.profile import Profile, ProfileAccountLink
from app.models.project_budget import ProjectBudget, ProjectContribution
from app.models.notification import Notification
from app.models.debt import Debt, DebtPayment
from app.models.alert import UserAlert, AlertHistory
from app.models.watchlist import UserWatchlist
from app.models.retirement_simulation import RetirementProfile
from app.models.heritage_simulation import HeritageSimulation
from app.models.bank_fee_schedule import BankFeeSchedule
from app.models.fee_analysis import FeeAnalysis
from app.models.fiscal_profile import FiscalProfile
from app.models.autopilot_config import AutopilotConfig
from app.models.tangible_asset import TangibleAsset
from app.models.nft_asset import NFTAsset
from app.models.card_wallet import CardWallet
from app.models.loyalty_program import LoyaltyProgram
from app.models.subscription import Subscription
from app.models.vault_document import VaultDocument
from app.models.peer_debt import PeerDebt
from app.models.calendar_event import CalendarEvent
from app.models.nova_memory import NovaMemory
from app.models.push_subscription import PushSubscription

logger = logging.getLogger("omniflow.gdpr")


# ═══════════════════════════════════════════════════════════════════
#  ANONYMIZATION HELPERS
# ═══════════════════════════════════════════════════════════════════

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"\+?\d[\d\s\-().]{6,}")


def anonymize_email(email: str) -> str:
    """Anonymize an email: j***@g***.com"""
    parts = email.split("@")
    if len(parts) != 2:
        return "***@***.***"
    local = parts[0][0] + "***" if parts[0] else "***"
    domain_parts = parts[1].split(".")
    domain = domain_parts[0][0] + "***" if domain_parts[0] else "***"
    tld = domain_parts[-1] if len(domain_parts) > 1 else "***"
    return f"{local}@{domain}.{tld}"


def anonymize_name(name: str) -> str:
    """Anonymize a name: keep first letter of each word."""
    return " ".join(w[0] + "***" if w else "" for w in name.split())


def anonymize_string(value: str) -> str:
    """Replace emails and phones in a free-text string."""
    result = _EMAIL_RE.sub("[email]", value)
    result = _PHONE_RE.sub("[phone]", result)
    return result


def _serialize_row(obj: Any, anonymize: bool = False) -> dict[str, Any]:
    """Convert an ORM object to a dict, optionally anonymizing PII."""
    data = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name, None)
        if isinstance(val, datetime):
            val = val.isoformat()
        elif isinstance(val, UUID):
            val = str(val)
        elif isinstance(val, bytes):
            val = "[encrypted]"
        elif val is None:
            pass
        else:
            val = val

        if anonymize and isinstance(val, str):
            if "email" in col.name:
                val = anonymize_email(val)
            elif "name" in col.name and col.name != "bank_name":
                val = anonymize_name(val)
            elif col.name in ("ip_address",):
                val = "x.x.x.x"
            elif col.name in ("user_agent",):
                val = "[redacted]"
            elif col.name in ("content", "description", "raw_label", "label"):
                val = anonymize_string(val)

        data[col.name] = val
    return data


async def _fetch_all(
    db: AsyncSession, model: Any, user_id: UUID, anonymize: bool = False
) -> list[dict[str, Any]]:
    """Fetch all rows for a user_id and serialize them."""
    # Check if model has user_id directly
    if hasattr(model, "user_id"):
        result = await db.execute(
            select(model).where(model.user_id == user_id)
        )
    else:
        return []
    rows = result.scalars().all()
    return [_serialize_row(r, anonymize=anonymize) for r in rows]


async def _fetch_nested(
    db: AsyncSession,
    parent_model: Any,
    child_model: Any,
    parent_fk: str,
    user_id: UUID,
    anonymize: bool = False,
) -> list[dict[str, Any]]:
    """Fetch child rows through a parent model that has user_id."""
    parent_result = await db.execute(
        select(parent_model.id).where(parent_model.user_id == user_id)
    )
    parent_ids = [r[0] for r in parent_result.fetchall()]
    if not parent_ids:
        return []
    result = await db.execute(
        select(child_model).where(
            getattr(child_model, parent_fk).in_(parent_ids)
        )
    )
    rows = result.scalars().all()
    return [_serialize_row(r, anonymize=anonymize) for r in rows]


# ═══════════════════════════════════════════════════════════════════
#  FULL DATA EXPORT
# ═══════════════════════════════════════════════════════════════════


async def export_user_data(
    db: AsyncSession,
    user: User,
    anonymize: bool = False,
) -> dict[str, Any]:
    """
    Export ALL user data as a structured dict.
    Returns the complete RGPD-compliant data package.
    """
    uid = user.id
    anon = anonymize

    # User profile
    user_data = {
        "id": str(user.id),
        "email": anonymize_email(user.email) if anon else user.email,
        "name": anonymize_name(user.name) if anon else user.name,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }

    # Collect all data sections
    data: dict[str, list[dict[str, Any]]] = {}
    total_records = 0

    # Direct user_id tables
    direct_tables = [
        ("bank_connections", BankConnection),
        ("accounts", Account),
        ("crypto_wallets", CryptoWallet),
        ("budgets", Budget),
        ("ai_insights", AIInsight),
        ("chat_conversations", ChatConversation),
        ("profiles", Profile),
        ("project_budgets", ProjectBudget),
        ("notifications", Notification),
        ("debts", Debt),
        ("user_alerts", UserAlert),
        ("watchlists", UserWatchlist),
        ("tangible_assets", TangibleAsset),
        ("nft_assets", NFTAsset),
        ("card_wallets", CardWallet),
        ("loyalty_programs", LoyaltyProgram),
        ("subscriptions", Subscription),
        ("vault_documents", VaultDocument),
        ("peer_debts", PeerDebt),
        ("calendar_events", CalendarEvent),
        ("nova_memories", NovaMemory),
        ("push_subscriptions", PushSubscription),
        ("alert_history", AlertHistory),
    ]

    for key, model in direct_tables:
        rows = await _fetch_all(db, model, uid, anon)
        data[key] = rows
        total_records += len(rows)

    # Nested tables (child of parent with user_id)
    # Accounts → Transactions / Balance Snapshots
    data["transactions"] = await _fetch_nested(
        db, Account, Transaction, "account_id", uid, anon
    )
    total_records += len(data["transactions"])

    data["balance_snapshots"] = await _fetch_nested(
        db, Account, BalanceSnapshot, "account_id", uid, anon
    )
    total_records += len(data["balance_snapshots"])

    # Crypto wallets → Holdings / Transactions
    data["crypto_holdings"] = await _fetch_nested(
        db, CryptoWallet, CryptoHolding, "wallet_id", uid, anon
    )
    total_records += len(data["crypto_holdings"])

    data["crypto_transactions"] = await _fetch_nested(
        db, CryptoWallet, CryptoTransaction, "wallet_id", uid, anon
    )
    total_records += len(data["crypto_transactions"])

    # Stock portfolios → Positions / Dividends
    data["stock_portfolios"] = await _fetch_all(db, StockPortfolio, uid, anon)
    total_records += len(data["stock_portfolios"])

    data["stock_positions"] = await _fetch_nested(
        db, StockPortfolio, StockPosition, "portfolio_id", uid, anon
    )
    total_records += len(data["stock_positions"])

    data["stock_dividends"] = await _fetch_nested(
        db, StockPortfolio, StockDividend, "portfolio_id", uid, anon
    )
    # Get dividends through positions
    # StockDividend has position_id → StockPosition has portfolio_id → StockPortfolio has user_id
    stock_pos_result = await db.execute(
        select(StockPosition.id).join(StockPortfolio).where(
            StockPortfolio.user_id == uid
        )
    )
    pos_ids = [r[0] for r in stock_pos_result.fetchall()]
    if pos_ids:
        div_result = await db.execute(
            select(StockDividend).where(StockDividend.position_id.in_(pos_ids))
        )
        data["stock_dividends"] = [
            _serialize_row(r, anonymize=anon) for r in div_result.scalars().all()
        ]
    else:
        data["stock_dividends"] = []
    total_records += len(data["stock_dividends"])

    # Real estate
    data["real_estate_properties"] = await _fetch_all(
        db, RealEstateProperty, uid, anon
    )
    total_records += len(data["real_estate_properties"])

    data["real_estate_valuations"] = await _fetch_nested(
        db, RealEstateProperty, RealEstateValuation, "property_id", uid, anon
    )
    total_records += len(data["real_estate_valuations"])

    # Debts → Payments
    data["debt_payments"] = await _fetch_nested(
        db, Debt, DebtPayment, "debt_id", uid, anon
    )
    total_records += len(data["debt_payments"])

    # Projects → Contributions
    data["project_contributions"] = await _fetch_nested(
        db, ProjectBudget, ProjectContribution, "project_id", uid, anon
    )
    total_records += len(data["project_contributions"])

    # Chat conversations → Messages
    data["chat_messages"] = await _fetch_nested(
        db, ChatConversation, ChatMessage, "conversation_id", uid, anon
    )
    total_records += len(data["chat_messages"])

    # Profile → Account links
    data["profile_account_links"] = await _fetch_nested(
        db, Profile, ProfileAccountLink, "profile_id", uid, anon
    )
    total_records += len(data["profile_account_links"])

    # Singleton tables (one per user, fetch directly)
    singleton_tables = [
        ("retirement_profile", RetirementProfile),
        ("heritage_simulation", HeritageSimulation),
        ("fee_analysis", FeeAnalysis),
        ("fiscal_profile", FiscalProfile),
        ("autopilot_config", AutopilotConfig),
    ]
    for key, model in singleton_tables:
        rows = await _fetch_all(db, model, uid, anon)
        data[key] = rows
        total_records += len(rows)

    # Audit log
    data["audit_log"] = await _fetch_all(db, AuditLog, uid, anon)
    total_records += len(data["audit_log"])

    tables_exported = sum(1 for v in data.values() if v)

    return {
        "export_version": "1.0",
        "exported_at": datetime.now(UTC).isoformat(),
        "user": user_data,
        "data": data,
        "metadata": {
            "total_records": total_records,
            "tables_exported": tables_exported,
            "anonymized": anonymize,
            "export_version": "1.0",
        },
    }


# ═══════════════════════════════════════════════════════════════════
#  ACCOUNT HARD DELETE
# ═══════════════════════════════════════════════════════════════════

# Deletion order: leaf tables first, then parents, then user.
# This avoids foreign key violations.
_DELETE_ORDER_NESTED = [
    # Chat messages (child of conversations)
    (ChatMessage, "conversation_id", ChatConversation),
    # Stock dividends (child of positions, child of portfolios)
    (StockDividend, "position_id", StockPosition, "portfolio_id", StockPortfolio),
    # Stock positions (child of portfolios)
    (StockPosition, "portfolio_id", StockPortfolio),
    # Crypto holdings & transactions (child of wallets)
    (CryptoHolding, "wallet_id", CryptoWallet),
    (CryptoTransaction, "wallet_id", CryptoWallet),
    # Real estate valuations (child of properties)
    (RealEstateValuation, "property_id", RealEstateProperty),
    # Debt payments (child of debts)
    (DebtPayment, "debt_id", Debt),
    # Project contributions (child of projects)
    (ProjectContribution, "project_id", ProjectBudget),
    # Profile account links (child of profiles)
    (ProfileAccountLink, "profile_id", Profile),
    # Alert history (child of alerts)
    (AlertHistory, "alert_id", UserAlert),
    # Transactions & balance snapshots (child of accounts)
    (Transaction, "account_id", Account),
    (BalanceSnapshot, "account_id", Account),
]

_DELETE_ORDER_DIRECT = [
    # After nested cleanup, delete direct user_id tables
    PushSubscription,
    NovaMemory,
    CalendarEvent,
    PeerDebt,
    VaultDocument,
    Subscription,
    LoyaltyProgram,
    CardWallet,
    NFTAsset,
    TangibleAsset,
    AutopilotConfig,
    FiscalProfile,
    FeeAnalysis,
    HeritageSimulation,
    RetirementProfile,
    UserWatchlist,
    UserAlert,
    ChatConversation,
    AIInsight,
    Budget,
    Notification,
    ProjectBudget,
    Profile,
    Debt,
    CryptoWallet,
    StockPortfolio,
    RealEstateProperty,
    Account,
    BankConnection,
    AuditLog,
]


async def delete_user_account(
    db: AsyncSession,
    user: User,
) -> dict[str, int]:
    """
    Hard-delete all user data. Returns {deleted_records, tables_affected}.
    
    This is IRREVERSIBLE. The caller is responsible for:
    - Verifying the user's password
    - Verifying the confirmation string
    - Blacklisting all JWT tokens
    """
    uid = user.id
    deleted = 0
    tables_affected = 0

    logger.warning("GDPR DELETION INITIATED for user_id=%s email=%s", uid, user.email)

    # Phase 1: Delete nested (2-level deep) tables
    for entry in _DELETE_ORDER_NESTED:
        if len(entry) == 5:
            # 3-level: grandchild → child → parent
            child_model, child_fk, mid_model, mid_fk, parent_model = entry
            parent_ids = await db.execute(
                select(parent_model.id).where(parent_model.user_id == uid)
            )
            pids = [r[0] for r in parent_ids.fetchall()]
            if pids:
                mid_ids = await db.execute(
                    select(mid_model.id).where(
                        getattr(mid_model, mid_fk).in_(pids)
                    )
                )
                mids = [r[0] for r in mid_ids.fetchall()]
                if mids:
                    result = await db.execute(
                        delete(child_model).where(
                            getattr(child_model, child_fk).in_(mids)
                        )
                    )
                    if result.rowcount:
                        deleted += result.rowcount
                        tables_affected += 1
        elif len(entry) == 3:
            # 2-level: child → parent
            child_model, child_fk, parent_model = entry
            parent_ids = await db.execute(
                select(parent_model.id).where(parent_model.user_id == uid)
            )
            pids = [r[0] for r in parent_ids.fetchall()]
            if pids:
                result = await db.execute(
                    delete(child_model).where(
                        getattr(child_model, child_fk).in_(pids)
                    )
                )
                if result.rowcount:
                    deleted += result.rowcount
                    tables_affected += 1

    # Phase 2: Delete direct user_id tables
    for model in _DELETE_ORDER_DIRECT:
        if hasattr(model, "user_id"):
            result = await db.execute(
                delete(model).where(model.user_id == uid)
            )
            if result.rowcount:
                deleted += result.rowcount
                tables_affected += 1

    # Phase 3: Delete the user record itself
    await db.execute(delete(User).where(User.id == uid))
    deleted += 1
    tables_affected += 1

    await db.commit()

    logger.warning(
        "GDPR DELETION COMPLETED for user_id=%s — %d records from %d tables",
        uid, deleted, tables_affected,
    )

    return {"deleted_records": deleted, "tables_affected": tables_affected}
