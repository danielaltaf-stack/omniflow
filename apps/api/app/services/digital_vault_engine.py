"""
OmniFlow — Digital Vault Engine.

Pure async functions for all vault computations:
  - Depreciation algorithms (linear, declining, none, market)
  - Card recommendation engine
  - Subscription analytics & optimization
  - Peer debt analytics
  - Shadow wealth aggregation
  - Warranty & document expiry tracking
  - Loyalty points conversion
"""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, UTC
from typing import Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tangible_asset import TangibleAsset, CATEGORY_DEFAULTS
from app.models.nft_asset import NFTAsset
from app.models.card_wallet import CardWallet, TIER_BENEFITS, CardTier
from app.models.loyalty_program import LoyaltyProgram
from app.models.subscription import Subscription, CYCLE_TO_MONTHLY, CYCLE_TO_ANNUAL, BillingCycle
from app.models.vault_document import VaultDocument
from app.models.peer_debt import PeerDebt

logger = logging.getLogger("omniflow.digital_vault")


# ═══════════════════════════════════════════════════════════════
#  DEPRECIATION ENGINE
# ═══════════════════════════════════════════════════════════════


def compute_depreciation(
    purchase_price: int,
    purchase_date: date,
    depreciation_type: str,
    depreciation_rate: float,
    residual_pct: float,
    reference_date: date | None = None,
) -> int:
    """
    Compute current value of a tangible asset based on depreciation.
    All values in centimes.

    Returns the current value (never negative, respects residual floor).
    """
    if reference_date is None:
        reference_date = date.today()

    if purchase_price <= 0:
        return 0

    days_since = (reference_date - purchase_date).days
    years_since = max(0, days_since / 365.25)

    residual_floor = int(purchase_price * residual_pct / 100.0)

    if depreciation_type == "none":
        return purchase_price

    if depreciation_type == "market":
        # Market-based: return current_value as-is (manually set)
        return purchase_price  # caller should use current_value directly

    if depreciation_type == "linear":
        # Linear: value = purchase × max(residual%, 1 - rate% × years)
        factor = max(residual_pct / 100.0, 1.0 - (depreciation_rate / 100.0) * years_since)
        return max(residual_floor, int(purchase_price * factor))

    if depreciation_type == "declining":
        # Declining balance: value = purchase × (1 - rate%)^years
        factor = (1.0 - depreciation_rate / 100.0) ** years_since
        return max(residual_floor, int(purchase_price * factor))

    # Fallback
    return purchase_price


def get_depreciation_pct(purchase_price: int, current_value: int) -> float:
    """Return the percentage of value lost to depreciation."""
    if purchase_price <= 0:
        return 0.0
    return round((1.0 - current_value / purchase_price) * 100.0, 1)


def get_warranty_status(warranty_expires: date | None, reference_date: date | None = None) -> str:
    """Return warranty status: 'active', 'expired', 'expiring_soon', or 'none'."""
    if warranty_expires is None:
        return "none"
    if reference_date is None:
        reference_date = date.today()
    if warranty_expires < reference_date:
        return "expired"
    if (warranty_expires - reference_date).days <= 30:
        return "expiring_soon"
    return "active"


# ═══════════════════════════════════════════════════════════════
#  TANGIBLE ASSET CRUD
# ═══════════════════════════════════════════════════════════════


async def create_tangible_asset(
    db: AsyncSession, user_id: UUID, data: dict[str, Any]
) -> TangibleAsset:
    """Create a tangible asset with auto-computed current value."""
    asset = TangibleAsset(user_id=user_id, **data)

    # Auto-compute current value if not set
    if asset.current_value == 0 and asset.purchase_price > 0:
        asset.current_value = compute_depreciation(
            asset.purchase_price,
            asset.purchase_date,
            asset.depreciation_type,
            asset.depreciation_rate,
            asset.residual_pct,
        )

    db.add(asset)
    await db.flush()
    return asset


async def list_tangible_assets(db: AsyncSession, user_id: UUID) -> list[TangibleAsset]:
    """List all tangible assets for a user."""
    result = await db.execute(
        select(TangibleAsset)
        .where(TangibleAsset.user_id == user_id)
        .order_by(TangibleAsset.current_value.desc())
    )
    return list(result.scalars().all())


async def get_tangible_asset(db: AsyncSession, user_id: UUID, asset_id: UUID) -> TangibleAsset | None:
    """Get a single tangible asset."""
    result = await db.execute(
        select(TangibleAsset)
        .where(TangibleAsset.id == asset_id, TangibleAsset.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_tangible_asset(
    db: AsyncSession, user_id: UUID, asset_id: UUID, data: dict[str, Any]
) -> TangibleAsset | None:
    """Update a tangible asset."""
    asset = await get_tangible_asset(db, user_id, asset_id)
    if not asset:
        return None
    for key, value in data.items():
        if hasattr(asset, key):
            setattr(asset, key, value)
    await db.flush()
    return asset


async def delete_tangible_asset(db: AsyncSession, user_id: UUID, asset_id: UUID) -> bool:
    """Delete a tangible asset."""
    asset = await get_tangible_asset(db, user_id, asset_id)
    if not asset:
        return False
    await db.delete(asset)
    await db.flush()
    return True


async def revalue_asset(db: AsyncSession, user_id: UUID, asset_id: UUID) -> TangibleAsset | None:
    """Recalculate current value based on depreciation."""
    asset = await get_tangible_asset(db, user_id, asset_id)
    if not asset:
        return None
    if asset.depreciation_type != "market":
        asset.current_value = compute_depreciation(
            asset.purchase_price,
            asset.purchase_date,
            asset.depreciation_type,
            asset.depreciation_rate,
            asset.residual_pct,
        )
    await db.flush()
    return asset


async def get_expiring_warranties(db: AsyncSession, user_id: UUID, days: int = 30) -> list[TangibleAsset]:
    """Get assets with warranties expiring within N days."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(TangibleAsset)
        .where(
            TangibleAsset.user_id == user_id,
            TangibleAsset.warranty_expires != None,  # noqa: E711
            TangibleAsset.warranty_expires >= today,
            TangibleAsset.warranty_expires <= cutoff,
        )
        .order_by(TangibleAsset.warranty_expires.asc())
    )
    return list(result.scalars().all())


# ═══════════════════════════════════════════════════════════════
#  NFT CRUD
# ═══════════════════════════════════════════════════════════════


async def create_nft_asset(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> NFTAsset:
    nft = NFTAsset(user_id=user_id, **data)
    db.add(nft)
    await db.flush()
    return nft


async def list_nft_assets(db: AsyncSession, user_id: UUID) -> list[NFTAsset]:
    result = await db.execute(
        select(NFTAsset)
        .where(NFTAsset.user_id == user_id)
        .order_by(NFTAsset.created_at.desc())
    )
    return list(result.scalars().all())


async def get_nft_asset(db: AsyncSession, user_id: UUID, nft_id: UUID) -> NFTAsset | None:
    result = await db.execute(
        select(NFTAsset).where(NFTAsset.id == nft_id, NFTAsset.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_nft_asset(
    db: AsyncSession, user_id: UUID, nft_id: UUID, data: dict[str, Any]
) -> NFTAsset | None:
    nft = await get_nft_asset(db, user_id, nft_id)
    if not nft:
        return None
    for key, value in data.items():
        if hasattr(nft, key):
            setattr(nft, key, value)
    await db.flush()
    return nft


async def delete_nft_asset(db: AsyncSession, user_id: UUID, nft_id: UUID) -> bool:
    nft = await get_nft_asset(db, user_id, nft_id)
    if not nft:
        return False
    await db.delete(nft)
    await db.flush()
    return True


def compute_nft_gain_loss(nft: NFTAsset) -> tuple[int | None, float | None]:
    """Return (gain_loss_eur in centimes, gain_loss_pct)."""
    if nft.purchase_price_eur and nft.current_floor_eur:
        gain = nft.current_floor_eur - nft.purchase_price_eur
        pct = (gain / nft.purchase_price_eur) * 100 if nft.purchase_price_eur > 0 else 0.0
        return gain, round(pct, 2)
    return None, None


# ═══════════════════════════════════════════════════════════════
#  CARD WALLET CRUD + RECOMMENDATION
# ═══════════════════════════════════════════════════════════════


async def create_card(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> CardWallet:
    card = CardWallet(user_id=user_id, **data)
    db.add(card)
    await db.flush()
    return card


async def list_cards(db: AsyncSession, user_id: UUID) -> list[CardWallet]:
    result = await db.execute(
        select(CardWallet)
        .where(CardWallet.user_id == user_id)
        .order_by(CardWallet.card_tier.desc())
    )
    return list(result.scalars().all())


async def get_card(db: AsyncSession, user_id: UUID, card_id: UUID) -> CardWallet | None:
    result = await db.execute(
        select(CardWallet).where(CardWallet.id == card_id, CardWallet.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_card(
    db: AsyncSession, user_id: UUID, card_id: UUID, data: dict[str, Any]
) -> CardWallet | None:
    card = await get_card(db, user_id, card_id)
    if not card:
        return None
    for key, value in data.items():
        if hasattr(card, key):
            setattr(card, key, value)
    await db.flush()
    return card


async def delete_card(db: AsyncSession, user_id: UUID, card_id: UUID) -> bool:
    card = await get_card(db, user_id, card_id)
    if not card:
        return False
    await db.delete(card)
    await db.flush()
    return True


def recommend_card(
    cards: list[CardWallet],
    amount: int,
    category: str = "general",
    currency: str = "EUR",
) -> dict[str, Any]:
    """
    Recommend the best card for a purchase based on benefits.

    Categories: travel, electronics, car_rental, online, foreign_currency, general
    """
    if not cards:
        return {"recommended_card": None, "reason": "Aucune carte enregistrée", "benefits_used": [], "potential_savings": 0}

    active_cards = [c for c in cards if c.is_active]
    if not active_cards:
        return {"recommended_card": None, "reason": "Aucune carte active", "benefits_used": [], "potential_savings": 0}

    best_card = None
    best_score = -1
    best_reason = ""
    best_benefits: list[str] = []
    best_savings = 0

    for card in active_cards:
        score = 0
        reasons: list[str] = []
        benefits_used: list[str] = []
        savings = 0

        tier = card.card_tier
        tier_info = TIER_BENEFITS.get(CardTier(tier) if tier in [t.value for t in CardTier] else CardTier.STANDARD, {})

        # Cashback
        if card.cashback_pct > 0:
            cashback_amount = int(amount * card.cashback_pct / 100)
            savings += cashback_amount
            score += card.cashback_pct * 10
            benefits_used.append(f"Cashback {card.cashback_pct}%")

        # Category-specific scoring
        if category == "travel" and tier_info.get("travel_insurance"):
            score += 30
            reasons.append("Assurance voyage incluse")
            benefits_used.append("Assurance voyage")

        if category == "electronics" and amount >= 50000:  # >500€
            if tier_info.get("warranty_extension"):
                score += 40
                reasons.append("Extension de garantie constructeur")
                benefits_used.append("Extension garantie")
            if tier_info.get("purchase_protection"):
                score += 20
                reasons.append("Protection achat (vol/casse)")
                benefits_used.append("Protection achat")

        if category == "car_rental" and tier_info.get("car_rental_insurance"):
            score += 35
            reasons.append("Assurance location voiture incluse")
            benefits_used.append("Assurance location auto")

        if category == "foreign_currency" or currency != "EUR":
            fx_fee = tier_info.get("fx_fee_pct", 2.0)
            fx_savings = int(amount * (2.0 - fx_fee) / 100)
            if fx_savings > 0:
                savings += fx_savings
                score += (2.0 - fx_fee) * 15
                reasons.append(f"Frais de change réduits ({fx_fee}%)")
                benefits_used.append(f"FX fee {fx_fee}%")

        if category == "online" and card.cashback_pct > 0:
            score += 15
            reasons.append("Cashback sur achats en ligne")

        # General: prefer higher tier for larger amounts
        if amount >= 100000:  # >1000€
            tier_order = {"standard": 0, "gold": 1, "platinum": 2, "premium": 3, "infinite": 4, "other": 0}
            score += tier_order.get(tier, 0) * 5

        if score > best_score:
            best_score = score
            best_card = card
            best_reason = " + ".join(reasons) if reasons else "Meilleure carte pour cet achat"
            best_benefits = benefits_used
            best_savings = savings

    return {
        "recommended_card": best_card,
        "reason": best_reason,
        "benefits_used": best_benefits,
        "potential_savings": best_savings,
    }


# ═══════════════════════════════════════════════════════════════
#  LOYALTY PROGRAMS CRUD
# ═══════════════════════════════════════════════════════════════


def convert_loyalty_points(points_balance: int, eur_per_point: float) -> int:
    """Convert points to EUR centimes."""
    return int(points_balance * eur_per_point * 100)


async def create_loyalty_program(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> LoyaltyProgram:
    program = LoyaltyProgram(user_id=user_id, **data)
    program.estimated_value = convert_loyalty_points(program.points_balance, program.eur_per_point)
    db.add(program)
    await db.flush()
    return program


async def list_loyalty_programs(db: AsyncSession, user_id: UUID) -> list[LoyaltyProgram]:
    result = await db.execute(
        select(LoyaltyProgram)
        .where(LoyaltyProgram.user_id == user_id)
        .order_by(LoyaltyProgram.estimated_value.desc())
    )
    return list(result.scalars().all())


async def get_loyalty_program(db: AsyncSession, user_id: UUID, prog_id: UUID) -> LoyaltyProgram | None:
    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.id == prog_id, LoyaltyProgram.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_loyalty_program(
    db: AsyncSession, user_id: UUID, prog_id: UUID, data: dict[str, Any]
) -> LoyaltyProgram | None:
    program = await get_loyalty_program(db, user_id, prog_id)
    if not program:
        return None
    for key, value in data.items():
        if hasattr(program, key):
            setattr(program, key, value)
    # Recalculate estimated value
    program.estimated_value = convert_loyalty_points(program.points_balance, program.eur_per_point)
    await db.flush()
    return program


async def delete_loyalty_program(db: AsyncSession, user_id: UUID, prog_id: UUID) -> bool:
    program = await get_loyalty_program(db, user_id, prog_id)
    if not program:
        return False
    await db.delete(program)
    await db.flush()
    return True


# ═══════════════════════════════════════════════════════════════
#  SUBSCRIPTIONS CRUD + ANALYTICS
# ═══════════════════════════════════════════════════════════════


def compute_monthly_cost(amount: int, billing_cycle: str) -> int:
    """Normalize a subscription amount to monthly centimes."""
    try:
        cycle = BillingCycle(billing_cycle)
    except ValueError:
        cycle = BillingCycle.MONTHLY
    multiplier = CYCLE_TO_MONTHLY.get(cycle, 1.0)
    return int(amount * multiplier)


def compute_annual_cost(amount: int, billing_cycle: str) -> int:
    """Normalize a subscription amount to annual centimes."""
    try:
        cycle = BillingCycle(billing_cycle)
    except ValueError:
        cycle = BillingCycle.MONTHLY
    multiplier = CYCLE_TO_ANNUAL.get(cycle, 12.0)
    return int(amount * multiplier)


async def create_subscription(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> Subscription:
    # Default dates if not provided
    if not data.get("contract_start_date"):
        data["contract_start_date"] = date.today()
    if not data.get("next_billing_date"):
        data["next_billing_date"] = date.today() + timedelta(days=30)
    sub = Subscription(user_id=user_id, **data)
    db.add(sub)
    await db.flush()
    return sub


async def list_subscriptions(db: AsyncSession, user_id: UUID, active_only: bool = False) -> list[Subscription]:
    stmt = select(Subscription).where(Subscription.user_id == user_id)
    if active_only:
        stmt = stmt.where(Subscription.is_active == True)  # noqa: E712
    result = await db.execute(stmt.order_by(Subscription.next_billing_date.asc()))
    return list(result.scalars().all())


async def get_subscription(db: AsyncSession, user_id: UUID, sub_id: UUID) -> Subscription | None:
    result = await db.execute(
        select(Subscription).where(Subscription.id == sub_id, Subscription.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_subscription(
    db: AsyncSession, user_id: UUID, sub_id: UUID, data: dict[str, Any]
) -> Subscription | None:
    sub = await get_subscription(db, user_id, sub_id)
    if not sub:
        return None
    for key, value in data.items():
        if hasattr(sub, key):
            setattr(sub, key, value)
    await db.flush()
    return sub


async def delete_subscription(db: AsyncSession, user_id: UUID, sub_id: UUID) -> bool:
    sub = await get_subscription(db, user_id, sub_id)
    if not sub:
        return False
    await db.delete(sub)
    await db.flush()
    return True


def compute_subscription_analytics(subs: list[Subscription]) -> dict[str, Any]:
    """Compute subscription analytics and optimization suggestions."""
    active_subs = [s for s in subs if s.is_active]
    today = date.today()

    total_monthly = 0
    total_annual = 0
    essential_count = 0
    non_essential_count = 0
    category_breakdown: dict[str, int] = {}

    upcoming_renewals = []
    cancellation_suggestions = []

    for sub in active_subs:
        monthly = compute_monthly_cost(sub.amount, sub.billing_cycle)
        annual = compute_annual_cost(sub.amount, sub.billing_cycle)
        total_monthly += monthly
        total_annual += annual

        cat = sub.category or "other"
        category_breakdown[cat] = category_breakdown.get(cat, 0) + monthly

        if sub.is_essential:
            essential_count += 1
        else:
            non_essential_count += 1

        # Upcoming renewals (next 30 days)
        if sub.next_billing_date and (sub.next_billing_date - today).days <= 30:
            upcoming_renewals.append(sub)

        # Cancellation suggestions: non-essential
        if not sub.is_essential and sub.auto_renew:
            cancellation_suggestions.append(sub)

    # Optimization score: 100 if all essential, lower if many non-essential
    total = essential_count + non_essential_count
    optimization_score = (essential_count / total * 100) if total > 0 else 100.0

    potential_savings = sum(
        compute_annual_cost(s.amount, s.billing_cycle)
        for s in cancellation_suggestions
    )

    return {
        "total_monthly_cost": total_monthly,
        "total_annual_cost": total_annual,
        "active_count": len(active_subs),
        "essential_count": essential_count,
        "non_essential_count": non_essential_count,
        "category_breakdown": category_breakdown,
        "optimization_score": round(optimization_score, 1),
        "upcoming_renewals": upcoming_renewals,
        "cancellation_suggestions": cancellation_suggestions,
        "potential_annual_savings": potential_savings,
    }


# ═══════════════════════════════════════════════════════════════
#  VAULT DOCUMENTS CRUD
# ═══════════════════════════════════════════════════════════════


async def create_vault_document(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> VaultDocument:
    """Create a vault document. Encrypt document_number if provided."""
    doc_number = data.pop("document_number", None)
    doc = VaultDocument(user_id=user_id, **data)

    if doc_number:
        try:
            from app.core.encryption import encrypt
            encrypted = encrypt(doc_number.encode("utf-8"), aad=str(user_id).encode())
            doc.document_number = encrypted.hex()
        except Exception:
            logger.warning("Encryption not available, storing document_number as-is")
            doc.document_number = doc_number

    db.add(doc)
    await db.flush()
    return doc


async def list_vault_documents(db: AsyncSession, user_id: UUID) -> list[VaultDocument]:
    result = await db.execute(
        select(VaultDocument)
        .where(VaultDocument.user_id == user_id)
        .order_by(VaultDocument.expiry_date.asc().nullslast())
    )
    return list(result.scalars().all())


async def get_vault_document(db: AsyncSession, user_id: UUID, doc_id: UUID) -> VaultDocument | None:
    result = await db.execute(
        select(VaultDocument).where(VaultDocument.id == doc_id, VaultDocument.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_vault_document(
    db: AsyncSession, user_id: UUID, doc_id: UUID, data: dict[str, Any]
) -> VaultDocument | None:
    doc = await get_vault_document(db, user_id, doc_id)
    if not doc:
        return None

    doc_number = data.pop("document_number", None)
    for key, value in data.items():
        if hasattr(doc, key):
            setattr(doc, key, value)

    if doc_number is not None:
        try:
            from app.core.encryption import encrypt
            encrypted = encrypt(doc_number.encode("utf-8"), aad=str(user_id).encode())
            doc.document_number = encrypted.hex()
        except Exception:
            doc.document_number = doc_number

    await db.flush()
    return doc


async def delete_vault_document(db: AsyncSession, user_id: UUID, doc_id: UUID) -> bool:
    doc = await get_vault_document(db, user_id, doc_id)
    if not doc:
        return False
    await db.delete(doc)
    await db.flush()
    return True


def get_document_expiry_status(
    expiry_date: date | None,
    reminder_days: int = 30,
    reference_date: date | None = None,
) -> tuple[str, int | None]:
    """Return (status, days_until_expiry)."""
    if expiry_date is None:
        return "no_expiry", None
    if reference_date is None:
        reference_date = date.today()
    days_left = (expiry_date - reference_date).days
    if days_left < 0:
        return "expired", days_left
    if days_left <= reminder_days:
        return "expiring_soon", days_left
    return "valid", days_left


# ═══════════════════════════════════════════════════════════════
#  PEER DEBTS CRUD + ANALYTICS
# ═══════════════════════════════════════════════════════════════


async def create_peer_debt(db: AsyncSession, user_id: UUID, data: dict[str, Any]) -> PeerDebt:
    if not data.get("date_created"):
        data["date_created"] = date.today()
    debt = PeerDebt(user_id=user_id, **data)
    db.add(debt)
    await db.flush()
    return debt


async def list_peer_debts(db: AsyncSession, user_id: UUID, include_settled: bool = True) -> list[PeerDebt]:
    stmt = select(PeerDebt).where(PeerDebt.user_id == user_id)
    if not include_settled:
        stmt = stmt.where(PeerDebt.is_settled == False)  # noqa: E712
    result = await db.execute(stmt.order_by(PeerDebt.date_created.desc()))
    return list(result.scalars().all())


async def get_peer_debt(db: AsyncSession, user_id: UUID, debt_id: UUID) -> PeerDebt | None:
    result = await db.execute(
        select(PeerDebt).where(PeerDebt.id == debt_id, PeerDebt.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_peer_debt(
    db: AsyncSession, user_id: UUID, debt_id: UUID, data: dict[str, Any]
) -> PeerDebt | None:
    debt = await get_peer_debt(db, user_id, debt_id)
    if not debt:
        return None
    for key, value in data.items():
        if hasattr(debt, key):
            setattr(debt, key, value)
    await db.flush()
    return debt


async def delete_peer_debt(db: AsyncSession, user_id: UUID, debt_id: UUID) -> bool:
    debt = await get_peer_debt(db, user_id, debt_id)
    if not debt:
        return False
    await db.delete(debt)
    await db.flush()
    return True


async def settle_peer_debt(
    db: AsyncSession, user_id: UUID, debt_id: UUID,
    settled_amount: int | None = None, settled_date: date | None = None,
) -> PeerDebt | None:
    """Mark a peer debt as settled."""
    debt = await get_peer_debt(db, user_id, debt_id)
    if not debt:
        return None
    debt.is_settled = True
    debt.settled_amount = settled_amount or debt.amount
    debt.settled_date = settled_date or date.today()
    await db.flush()
    return debt


def compute_peer_debt_analytics(debts: list[PeerDebt]) -> dict[str, Any]:
    """Compute P2P debt analytics."""
    today = date.today()
    active_debts = [d for d in debts if not d.is_settled]
    settled_debts = [d for d in debts if d.is_settled]

    total_lent = sum(d.amount for d in active_debts if d.direction == "lent")
    total_borrowed = sum(d.amount for d in active_debts if d.direction == "borrowed")
    net_balance = total_lent - total_borrowed

    overdue = [d for d in active_debts if d.due_date and d.due_date < today]

    # Counterparty balances
    counterparty_map: dict[str, dict[str, Any]] = {}
    for d in active_debts:
        name = d.counterparty_name
        if name not in counterparty_map:
            counterparty_map[name] = {"name": name, "lent": 0, "borrowed": 0, "count": 0}
        counterparty_map[name]["count"] += 1
        if d.direction == "lent":
            counterparty_map[name]["lent"] += d.amount
        else:
            counterparty_map[name]["borrowed"] += d.amount

    counterparty_balances = [
        {
            "name": v["name"],
            "net": v["lent"] - v["borrowed"],
            "lent": v["lent"],
            "borrowed": v["borrowed"],
            "count": v["count"],
        }
        for v in sorted(counterparty_map.values(), key=lambda x: abs(x["lent"] - x["borrowed"]), reverse=True)
    ]

    # Repayment rate: settled on time / total settled
    on_time_count = sum(
        1 for d in settled_debts
        if d.due_date and d.settled_date and d.settled_date <= d.due_date
    )
    repayment_rate = (on_time_count / len(settled_debts) * 100) if settled_debts else 100.0

    return {
        "total_lent": total_lent,
        "total_borrowed": total_borrowed,
        "net_balance": net_balance,
        "active_count": len(active_debts),
        "settled_count": len(settled_debts),
        "overdue_count": len(overdue),
        "counterparty_balances": counterparty_balances,
        "repayment_rate": round(repayment_rate, 1),
    }


# ═══════════════════════════════════════════════════════════════
#  SHADOW WEALTH AGGREGATOR
# ═══════════════════════════════════════════════════════════════


async def compute_vault_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """Compute the full shadow wealth summary for a user."""
    today = date.today()
    soon = today + timedelta(days=30)
    week = today + timedelta(days=7)

    # Tangible assets
    assets = await list_tangible_assets(db, user_id)
    # Recompute current values
    for a in assets:
        if a.depreciation_type != "market":
            a.current_value = compute_depreciation(
                a.purchase_price, a.purchase_date,
                a.depreciation_type, a.depreciation_rate, a.residual_pct,
            )
    tangible_total = sum(a.current_value for a in assets)
    tangible_depreciation = sum(max(0, a.purchase_price - a.current_value) for a in assets)
    warranties_expiring = sum(
        1 for a in assets
        if a.warranty_expires and today <= a.warranty_expires <= soon
    )

    # NFTs
    nfts = await list_nft_assets(db, user_id)
    nft_total = sum(n.current_floor_eur or 0 for n in nfts)
    nft_purchase = sum(n.purchase_price_eur or 0 for n in nfts)
    nft_gain_loss = nft_total - nft_purchase

    # Loyalty
    loyalty_list = await list_loyalty_programs(db, user_id)
    loyalty_total = sum(p.estimated_value for p in loyalty_list)

    # Subscriptions
    subs = await list_subscriptions(db, user_id, active_only=True)
    sub_monthly = sum(compute_monthly_cost(s.amount, s.billing_cycle) for s in subs)
    sub_annual = sum(compute_annual_cost(s.amount, s.billing_cycle) for s in subs)
    upcoming_cancellations = sum(
        1 for s in subs
        if s.cancellation_deadline and today <= s.cancellation_deadline <= week
    )
    upcoming_renewals = sum(
        1 for s in subs
        if s.next_billing_date and today <= s.next_billing_date <= soon
    )

    # Documents
    documents = await list_vault_documents(db, user_id)
    docs_expiring = sum(
        1 for d in documents
        if d.expiry_date and today <= d.expiry_date <= soon
    )

    # Peer debts
    peer_debts = await list_peer_debts(db, user_id, include_settled=False)
    lent_total = sum(d.amount for d in peer_debts if d.direction == "lent")
    borrowed_total = sum(d.amount for d in peer_debts if d.direction == "borrowed")
    peer_net = lent_total - borrowed_total

    # Cards
    cards = await list_cards(db, user_id)
    active_cards = [c for c in cards if c.is_active]
    cards_annual_fees = sum(
        c.annual_fee + (c.monthly_fee * 12) for c in active_cards
    )

    # Shadow Wealth = assets + NFTs + loyalty + peer_debts_net
    shadow_wealth = tangible_total + nft_total + loyalty_total + peer_net

    return {
        "tangible_assets_total": tangible_total,
        "tangible_assets_count": len(assets),
        "tangible_depreciation_total": tangible_depreciation,
        "nft_total": nft_total,
        "nft_count": len(nfts),
        "nft_gain_loss": nft_gain_loss,
        "loyalty_total": loyalty_total,
        "loyalty_count": len(loyalty_list),
        "subscription_monthly": sub_monthly,
        "subscription_annual": sub_annual,
        "subscription_count": len(subs),
        "documents_count": len(documents),
        "documents_expiring_soon": docs_expiring,
        "peer_debt_lent_total": lent_total,
        "peer_debt_borrowed_total": borrowed_total,
        "peer_debt_net": peer_net,
        "cards_count": len(active_cards),
        "cards_total_annual_fees": cards_annual_fees,
        "shadow_wealth_total": shadow_wealth,
        "warranties_expiring_soon": warranties_expiring,
        "upcoming_cancellations": upcoming_cancellations,
        "upcoming_renewals": upcoming_renewals,
    }
