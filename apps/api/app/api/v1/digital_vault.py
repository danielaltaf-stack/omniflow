"""
OmniFlow — Digital Vault API Router.

35+ endpoints for the complete Digital Vault:
  - Tangible Assets (7)   — /vault/assets/*
  - NFTs (5)              — /vault/nfts/*
  - Card Wallet (5)       — /vault/cards/*
  - Loyalty Programs (4)  — /vault/loyalty/*
  - Subscriptions (5)     — /vault/subscriptions/*
  - Documents (4)         — /vault/documents/*
  - Peer Debts (6)        — /vault/peer-debts/*
  - Summary (1)           — /vault/summary
"""

from __future__ import annotations

import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.cache import cache_manager
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.digital_vault import (
    # Tangible Assets
    TangibleAssetCreate,
    TangibleAssetUpdate,
    TangibleAssetResponse,
    # NFTs
    NFTAssetCreate,
    NFTAssetUpdate,
    NFTAssetResponse,
    # Cards
    CardWalletCreate,
    CardWalletUpdate,
    CardWalletResponse,
    CardRecommendationRequest,
    CardRecommendationResponse,
    # Loyalty
    LoyaltyProgramCreate,
    LoyaltyProgramUpdate,
    LoyaltyProgramResponse,
    # Subscriptions
    SubscriptionCreate,
    SubscriptionUpdate,
    SubscriptionResponse,
    SubscriptionAnalyticsResponse,
    # Documents
    VaultDocumentCreate,
    VaultDocumentUpdate,
    VaultDocumentResponse,
    # Peer Debts
    PeerDebtCreate,
    PeerDebtUpdate,
    PeerDebtSettleRequest,
    PeerDebtResponse,
    PeerDebtAnalyticsResponse,
    # Summary
    VaultSummaryResponse,
)
from app.services import digital_vault_engine as engine

logger = logging.getLogger("omniflow.digital_vault")
settings = get_settings()

router = APIRouter(prefix="/vault", tags=["vault"])


# ═══════════════════════════════════════════════════════════════
#  TANGIBLE ASSETS
# ═══════════════════════════════════════════════════════════════


def _asset_to_response(asset) -> dict:
    """Enrich a TangibleAsset with computed fields."""
    dep_pct = engine.get_depreciation_pct(asset.purchase_price, asset.current_value)
    w_status = engine.get_warranty_status(asset.warranty_expires)
    resp = TangibleAssetResponse.model_validate(asset)
    resp.depreciation_pct = dep_pct
    resp.warranty_status = w_status
    return resp.model_dump(mode="json")


@router.post("/assets", response_model=TangibleAssetResponse, status_code=201)
async def create_asset(
    body: TangibleAssetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a tangible asset."""
    asset = await engine.create_tangible_asset(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _asset_to_response(asset)


@router.get("/assets", response_model=list[TangibleAssetResponse])
async def list_assets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tangible assets."""
    assets = await engine.list_tangible_assets(db, user.id)
    return [_asset_to_response(a) for a in assets]


@router.get("/assets/warranties", response_model=list[TangibleAssetResponse])
async def list_expiring_warranties(
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get assets with warranties expiring soon."""
    assets = await engine.get_expiring_warranties(db, user.id, days)
    return [_asset_to_response(a) for a in assets]


@router.get("/assets/{asset_id}", response_model=TangibleAssetResponse)
async def get_asset(
    asset_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single tangible asset."""
    asset = await engine.get_tangible_asset(db, user.id, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _asset_to_response(asset)


@router.put("/assets/{asset_id}", response_model=TangibleAssetResponse)
async def update_asset(
    asset_id: UUID,
    body: TangibleAssetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a tangible asset."""
    data = body.model_dump(exclude_unset=True)
    asset = await engine.update_tangible_asset(db, user.id, asset_id, data)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _asset_to_response(asset)


@router.delete("/assets/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a tangible asset."""
    deleted = await engine.delete_tangible_asset(db, user.id, asset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


@router.post("/assets/{asset_id}/revalue", response_model=TangibleAssetResponse)
async def revalue_asset(
    asset_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recalculate asset value based on depreciation."""
    asset = await engine.revalue_asset(db, user.id, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _asset_to_response(asset)


# ═══════════════════════════════════════════════════════════════
#  NFT ASSETS
# ═══════════════════════════════════════════════════════════════


def _nft_to_response(nft) -> dict:
    """Enrich NFT with gain/loss."""
    gain, pct = engine.compute_nft_gain_loss(nft)
    resp = NFTAssetResponse.model_validate(nft)
    resp.gain_loss_eur = gain
    resp.gain_loss_pct = pct
    return resp.model_dump(mode="json")


@router.post("/nfts", response_model=NFTAssetResponse, status_code=201)
async def create_nft(
    body: NFTAssetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    nft = await engine.create_nft_asset(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _nft_to_response(nft)


@router.get("/nfts", response_model=list[NFTAssetResponse])
async def list_nfts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    nfts = await engine.list_nft_assets(db, user.id)
    return [_nft_to_response(n) for n in nfts]


@router.get("/nfts/{nft_id}", response_model=NFTAssetResponse)
async def get_nft(
    nft_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    nft = await engine.get_nft_asset(db, user.id, nft_id)
    if not nft:
        raise HTTPException(status_code=404, detail="NFT not found")
    return _nft_to_response(nft)


@router.put("/nfts/{nft_id}", response_model=NFTAssetResponse)
async def update_nft(
    nft_id: UUID,
    body: NFTAssetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    nft = await engine.update_nft_asset(db, user.id, nft_id, data)
    if not nft:
        raise HTTPException(status_code=404, detail="NFT not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _nft_to_response(nft)


@router.delete("/nfts/{nft_id}", status_code=204)
async def delete_nft(
    nft_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await engine.delete_nft_asset(db, user.id, nft_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="NFT not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


# ═══════════════════════════════════════════════════════════════
#  CARD WALLET
# ═══════════════════════════════════════════════════════════════


def _card_to_response(card) -> dict:
    """Enrich card with computed fields."""
    today = date.today()
    is_expired = (card.expiry_year < today.year) or (
        card.expiry_year == today.year and card.expiry_month < today.month
    )
    total_annual = card.annual_fee + (card.monthly_fee * 12)
    resp = CardWalletResponse.model_validate(card)
    resp.is_expired = is_expired
    resp.total_annual_cost = total_annual
    return resp.model_dump(mode="json")


@router.post("/cards", response_model=CardWalletResponse, status_code=201)
async def create_card(
    body: CardWalletCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await engine.create_card(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _card_to_response(card)


@router.get("/cards", response_model=list[CardWalletResponse])
async def list_cards(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cards = await engine.list_cards(db, user.id)
    return [_card_to_response(c) for c in cards]


@router.put("/cards/{card_id}", response_model=CardWalletResponse)
async def update_card(
    card_id: UUID,
    body: CardWalletUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    card = await engine.update_card(db, user.id, card_id, data)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _card_to_response(card)


@router.delete("/cards/{card_id}", status_code=204)
async def delete_card(
    card_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await engine.delete_card(db, user.id, card_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Card not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


@router.post("/cards/recommend", response_model=CardRecommendationResponse)
async def recommend_card(
    body: CardRecommendationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a card recommendation for a purchase."""
    cards = await engine.list_cards(db, user.id)
    result = engine.recommend_card(cards, body.amount, body.category, body.currency)
    # Convert the recommended card to response format
    rec_card = result["recommended_card"]
    return {
        "recommended_card": _card_to_response(rec_card) if rec_card else None,
        "reason": result["reason"],
        "benefits_used": result["benefits_used"],
        "potential_savings": result["potential_savings"],
    }


# ═══════════════════════════════════════════════════════════════
#  LOYALTY PROGRAMS
# ═══════════════════════════════════════════════════════════════


def _loyalty_to_response(program) -> dict:
    """Enrich loyalty program with computed fields."""
    today = date.today()
    days_until = None
    if program.expiry_date:
        days_until = (program.expiry_date - today).days
    resp = LoyaltyProgramResponse.model_validate(program)
    resp.days_until_expiry = days_until
    return resp.model_dump(mode="json")


@router.post("/loyalty", response_model=LoyaltyProgramResponse, status_code=201)
async def create_loyalty(
    body: LoyaltyProgramCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    program = await engine.create_loyalty_program(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _loyalty_to_response(program)


@router.get("/loyalty", response_model=list[LoyaltyProgramResponse])
async def list_loyalty(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    programs = await engine.list_loyalty_programs(db, user.id)
    return [_loyalty_to_response(p) for p in programs]


@router.put("/loyalty/{prog_id}", response_model=LoyaltyProgramResponse)
async def update_loyalty(
    prog_id: UUID,
    body: LoyaltyProgramUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    program = await engine.update_loyalty_program(db, user.id, prog_id, data)
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty program not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _loyalty_to_response(program)


@router.delete("/loyalty/{prog_id}", status_code=204)
async def delete_loyalty(
    prog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await engine.delete_loyalty_program(db, user.id, prog_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Loyalty program not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


# ═══════════════════════════════════════════════════════════════
#  SUBSCRIPTIONS
# ═══════════════════════════════════════════════════════════════


def _sub_to_response(sub) -> dict:
    """Enrich subscription with computed fields."""
    today = date.today()
    monthly = engine.compute_monthly_cost(sub.amount, sub.billing_cycle)
    annual = engine.compute_annual_cost(sub.amount, sub.billing_cycle)
    days_until = None
    if sub.next_billing_date:
        days_until = (sub.next_billing_date - today).days
    cancel_urgent = False
    if sub.cancellation_deadline:
        cancel_urgent = (sub.cancellation_deadline - today).days <= 7
    resp = SubscriptionResponse.model_validate(sub)
    resp.monthly_cost = monthly
    resp.annual_cost = annual
    resp.days_until_renewal = days_until
    resp.cancellation_urgent = cancel_urgent
    return resp.model_dump(mode="json")


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    body: SubscriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = await engine.create_subscription(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _sub_to_response(sub)


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    active_only: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subs = await engine.list_subscriptions(db, user.id, active_only=active_only)
    return [_sub_to_response(s) for s in subs]


@router.put("/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def update_subscription(
    sub_id: UUID,
    body: SubscriptionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    sub = await engine.update_subscription(db, user.id, sub_id, data)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _sub_to_response(sub)


@router.delete("/subscriptions/{sub_id}", status_code=204)
async def delete_subscription(
    sub_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await engine.delete_subscription(db, user.id, sub_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


@router.get("/subscriptions/analytics", response_model=SubscriptionAnalyticsResponse)
async def get_subscription_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get subscription analytics and optimization suggestions."""
    subs = await engine.list_subscriptions(db, user.id)
    analytics = engine.compute_subscription_analytics(subs)
    # Convert subscription objects to response dicts
    analytics["upcoming_renewals"] = [_sub_to_response(s) for s in analytics["upcoming_renewals"]]
    analytics["cancellation_suggestions"] = [_sub_to_response(s) for s in analytics["cancellation_suggestions"]]
    return analytics


# ═══════════════════════════════════════════════════════════════
#  VAULT DOCUMENTS
# ═══════════════════════════════════════════════════════════════


def _doc_to_response(doc) -> dict:
    """Enrich document with computed fields."""
    status, days = engine.get_document_expiry_status(doc.expiry_date, doc.reminder_days)
    resp = VaultDocumentResponse.model_validate(doc)
    resp.has_document_number = doc.document_number is not None
    resp.days_until_expiry = days
    resp.is_expired = status == "expired"
    resp.expiry_status = status
    return resp.model_dump(mode="json")


@router.post("/documents", response_model=VaultDocumentResponse, status_code=201)
async def create_document(
    body: VaultDocumentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await engine.create_vault_document(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _doc_to_response(doc)


@router.get("/documents", response_model=list[VaultDocumentResponse])
async def list_documents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    docs = await engine.list_vault_documents(db, user.id)
    return [_doc_to_response(d) for d in docs]


@router.put("/documents/{doc_id}", response_model=VaultDocumentResponse)
async def update_document(
    doc_id: UUID,
    body: VaultDocumentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    doc = await engine.update_vault_document(db, user.id, doc_id, data)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _doc_to_response(doc)


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await engine.delete_vault_document(db, user.id, doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


# ═══════════════════════════════════════════════════════════════
#  PEER DEBTS
# ═══════════════════════════════════════════════════════════════


def _debt_to_response(debt) -> dict:
    """Enrich peer debt with computed fields."""
    today = date.today()
    is_overdue = (
        not debt.is_settled
        and debt.due_date is not None
        and debt.due_date < today
    )
    days_overdue = max(0, (today - debt.due_date).days) if is_overdue else 0
    resp = PeerDebtResponse.model_validate(debt)
    resp.is_overdue = is_overdue
    resp.days_overdue = days_overdue
    return resp.model_dump(mode="json")


@router.post("/peer-debts", response_model=PeerDebtResponse, status_code=201)
async def create_peer_debt(
    body: PeerDebtCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debt = await engine.create_peer_debt(db, user.id, body.model_dump())
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _debt_to_response(debt)


@router.get("/peer-debts", response_model=list[PeerDebtResponse])
async def list_peer_debts(
    include_settled: bool = True,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debts = await engine.list_peer_debts(db, user.id, include_settled=include_settled)
    return [_debt_to_response(d) for d in debts]


@router.put("/peer-debts/{debt_id}", response_model=PeerDebtResponse)
async def update_peer_debt(
    debt_id: UUID,
    body: PeerDebtUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    debt = await engine.update_peer_debt(db, user.id, debt_id, data)
    if not debt:
        raise HTTPException(status_code=404, detail="Peer debt not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _debt_to_response(debt)


@router.delete("/peer-debts/{debt_id}", status_code=204)
async def delete_peer_debt(
    debt_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await engine.delete_peer_debt(db, user.id, debt_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Peer debt not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")


@router.post("/peer-debts/{debt_id}/settle", response_model=PeerDebtResponse)
async def settle_peer_debt(
    debt_id: UUID,
    body: PeerDebtSettleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a peer debt as settled."""
    debt = await engine.settle_peer_debt(
        db, user.id, debt_id,
        settled_amount=body.settled_amount,
        settled_date=body.settled_date,
    )
    if not debt:
        raise HTTPException(status_code=404, detail="Peer debt not found")
    await db.commit()
    await cache_manager.invalidate(f"vault:summary:{user.id}")
    return _debt_to_response(debt)


@router.get("/peer-debts/analytics", response_model=PeerDebtAnalyticsResponse)
async def get_peer_debt_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get P2P debt analytics."""
    debts = await engine.list_peer_debts(db, user.id, include_settled=True)
    return engine.compute_peer_debt_analytics(debts)


# ═══════════════════════════════════════════════════════════════
#  VAULT SUMMARY (Shadow Wealth)
# ═══════════════════════════════════════════════════════════════


@router.get("/summary", response_model=VaultSummaryResponse)
async def get_vault_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full shadow wealth summary."""
    cache_key = f"vault:summary:{user.id}"

    async def _compute():
        return await engine.compute_vault_summary(db, user.id)

    return await cache_manager.cached_result(
        cache_key, settings.CACHE_TTL_DIGITAL_VAULT, _compute
    )
