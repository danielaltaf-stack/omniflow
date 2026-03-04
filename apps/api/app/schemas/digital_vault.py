"""
OmniFlow — Digital Vault Pydantic schemas.
40+ models for all 7 vault entities + summary + analytics.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
#  TANGIBLE ASSETS
# ═══════════════════════════════════════════════════════════════


class TangibleAssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="other")
    subcategory: str | None = None
    brand: str | None = None
    model: str | None = None
    purchase_price: int = Field(..., ge=0, description="Centimes")
    purchase_date: date
    current_value: int = Field(default=0, ge=0)
    depreciation_type: str = Field(default="linear")
    depreciation_rate: float = Field(default=20.0, ge=0, le=100)
    residual_pct: float = Field(default=10.0, ge=0, le=100)
    warranty_expires: date | None = None
    warranty_provider: str | None = None
    condition: str = Field(default="good")
    serial_number: str | None = None
    notes: str | None = None
    image_url: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)


class TangibleAssetUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    subcategory: str | None = None
    brand: str | None = None
    model: str | None = None
    purchase_price: int | None = None
    purchase_date: date | None = None
    current_value: int | None = None
    depreciation_type: str | None = None
    depreciation_rate: float | None = None
    residual_pct: float | None = None
    warranty_expires: date | None = None
    warranty_provider: str | None = None
    condition: str | None = None
    serial_number: str | None = None
    notes: str | None = None
    image_url: str | None = None
    extra_data: dict[str, Any] | None = None


class TangibleAssetResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    category: str
    subcategory: str | None = None
    brand: str | None = None
    model: str | None = None
    purchase_price: int
    purchase_date: date
    current_value: int
    depreciation_type: str
    depreciation_rate: float
    residual_pct: float
    warranty_expires: date | None = None
    warranty_provider: str | None = None
    condition: str
    serial_number: str | None = None
    notes: str | None = None
    image_url: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)
    depreciation_pct: float = 0.0  # computed: how much value lost
    warranty_status: str = "unknown"  # computed: active/expired/none
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════
#  NFT ASSETS
# ═══════════════════════════════════════════════════════════════


class NFTAssetCreate(BaseModel):
    collection_name: str = Field(..., min_length=1, max_length=255)
    token_id: str = Field(..., min_length=1, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    blockchain: str = Field(default="ethereum")
    contract_address: str | None = None
    purchase_price_eth: float | None = None
    purchase_price_eur: int | None = None
    current_floor_eur: int | None = None
    marketplace: str | None = None
    marketplace_url: str | None = None
    image_url: str | None = None
    animation_url: str | None = None
    rarity_rank: int | None = None
    traits: dict[str, Any] = Field(default_factory=dict)
    extra_data: dict[str, Any] = Field(default_factory=dict)


class NFTAssetUpdate(BaseModel):
    collection_name: str | None = None
    token_id: str | None = None
    name: str | None = None
    blockchain: str | None = None
    contract_address: str | None = None
    purchase_price_eth: float | None = None
    purchase_price_eur: int | None = None
    current_floor_eur: int | None = None
    marketplace: str | None = None
    marketplace_url: str | None = None
    image_url: str | None = None
    animation_url: str | None = None
    rarity_rank: int | None = None
    traits: dict[str, Any] | None = None
    extra_data: dict[str, Any] | None = None


class NFTAssetResponse(BaseModel):
    id: UUID
    user_id: UUID
    collection_name: str
    token_id: str
    name: str
    blockchain: str
    contract_address: str | None = None
    purchase_price_eth: float | None = None
    purchase_price_eur: int | None = None
    current_floor_eur: int | None = None
    marketplace: str | None = None
    marketplace_url: str | None = None
    image_url: str | None = None
    animation_url: str | None = None
    last_price_update: datetime | None = None
    rarity_rank: int | None = None
    traits: dict[str, Any] = Field(default_factory=dict)
    extra_data: dict[str, Any] = Field(default_factory=dict)
    gain_loss_eur: int | None = None  # computed
    gain_loss_pct: float | None = None  # computed
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════
#  CARD WALLET
# ═══════════════════════════════════════════════════════════════


class CardWalletCreate(BaseModel):
    card_name: str = Field(..., min_length=1, max_length=255)
    bank_name: str = Field(..., min_length=1, max_length=100)
    card_type: str = Field(default="visa")
    card_tier: str = Field(default="standard")
    last_four: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    expiry_month: int = Field(..., ge=1, le=12)
    expiry_year: int = Field(..., ge=2024, le=2040)
    is_active: bool = True
    monthly_fee: int = Field(default=0, ge=0)
    annual_fee: int = Field(default=0, ge=0)
    cashback_pct: float = Field(default=0.0, ge=0, le=100)
    insurance_level: str = Field(default="none")
    benefits: list[str] = Field(default_factory=list)
    color: str | None = None
    notes: str | None = None


class CardWalletUpdate(BaseModel):
    card_name: str | None = None
    bank_name: str | None = None
    card_type: str | None = None
    card_tier: str | None = None
    last_four: str | None = None
    expiry_month: int | None = None
    expiry_year: int | None = None
    is_active: bool | None = None
    monthly_fee: int | None = None
    annual_fee: int | None = None
    cashback_pct: float | None = None
    insurance_level: str | None = None
    benefits: list[str] | None = None
    color: str | None = None
    notes: str | None = None


class CardWalletResponse(BaseModel):
    id: UUID
    user_id: UUID
    card_name: str
    bank_name: str
    card_type: str
    card_tier: str
    last_four: str
    expiry_month: int
    expiry_year: int
    is_active: bool
    monthly_fee: int
    annual_fee: int
    cashback_pct: float
    insurance_level: str
    benefits: list[str] = Field(default_factory=list)
    color: str | None = None
    notes: str | None = None
    is_expired: bool = False  # computed
    total_annual_cost: int = 0  # computed
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class CardRecommendationRequest(BaseModel):
    amount: int = Field(..., ge=0, description="Purchase amount in centimes")
    category: str = Field(default="general", description="Purchase category")
    currency: str = Field(default="EUR")


class CardRecommendationResponse(BaseModel):
    recommended_card: CardWalletResponse | None = None
    reason: str
    benefits_used: list[str] = Field(default_factory=list)
    potential_savings: int = 0  # centimes


# ═══════════════════════════════════════════════════════════════
#  LOYALTY PROGRAMS
# ═══════════════════════════════════════════════════════════════


class LoyaltyProgramCreate(BaseModel):
    program_name: str = Field(..., min_length=1, max_length=255)
    provider: str = Field(..., min_length=1, max_length=100)
    program_type: str = Field(default="other")
    points_balance: int = Field(default=0, ge=0)
    points_unit: str = Field(default="points")
    eur_per_point: float = Field(default=0.01, ge=0)
    expiry_date: date | None = None
    account_number: str | None = None
    tier_status: str | None = None
    last_updated: date | None = None
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)


class LoyaltyProgramUpdate(BaseModel):
    program_name: str | None = None
    provider: str | None = None
    program_type: str | None = None
    points_balance: int | None = None
    points_unit: str | None = None
    eur_per_point: float | None = None
    expiry_date: date | None = None
    account_number: str | None = None
    tier_status: str | None = None
    last_updated: date | None = None
    notes: str | None = None
    extra_data: dict[str, Any] | None = None


class LoyaltyProgramResponse(BaseModel):
    id: UUID
    user_id: UUID
    program_name: str
    provider: str
    program_type: str
    points_balance: int
    points_unit: str
    eur_per_point: float
    estimated_value: int  # centimes
    expiry_date: date | None = None
    account_number: str | None = None
    tier_status: str | None = None
    last_updated: date | None = None
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)
    days_until_expiry: int | None = None  # computed
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════
#  SUBSCRIPTIONS
# ═══════════════════════════════════════════════════════════════


class SubscriptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider: str = Field(default="")
    category: str = Field(default="other")
    amount: int = Field(..., ge=0, description="Cost in centimes")
    billing_cycle: str = Field(default="monthly")
    currency: str = Field(default="EUR")
    next_billing_date: date | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    cancellation_deadline: date | None = None
    auto_renew: bool = True
    cancellation_notice_days: int = Field(default=0, ge=0)
    is_active: bool = True
    is_essential: bool = False
    url: str | None = None
    notes: str | None = None
    color: str | None = None
    icon: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)


class SubscriptionUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    category: str | None = None
    amount: int | None = None
    billing_cycle: str | None = None
    currency: str | None = None
    next_billing_date: date | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None
    cancellation_deadline: date | None = None
    auto_renew: bool | None = None
    cancellation_notice_days: int | None = None
    is_active: bool | None = None
    is_essential: bool | None = None
    url: str | None = None
    notes: str | None = None
    color: str | None = None
    icon: str | None = None
    extra_data: dict[str, Any] | None = None


class SubscriptionResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    provider: str
    category: str
    amount: int
    billing_cycle: str
    currency: str
    next_billing_date: date
    contract_start_date: date
    contract_end_date: date | None = None
    cancellation_deadline: date | None = None
    auto_renew: bool
    cancellation_notice_days: int
    is_active: bool
    is_essential: bool
    url: str | None = None
    notes: str | None = None
    color: str | None = None
    icon: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)
    monthly_cost: int = 0  # computed: normalized to monthly centimes
    annual_cost: int = 0   # computed
    days_until_renewal: int | None = None  # computed
    cancellation_urgent: bool = False  # computed: < 7 days
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class SubscriptionAnalyticsResponse(BaseModel):
    total_monthly_cost: int  # centimes
    total_annual_cost: int   # centimes
    active_count: int
    essential_count: int
    non_essential_count: int
    category_breakdown: dict[str, int]  # category → monthly cost
    optimization_score: float  # 0-100: essential/total × 100
    upcoming_renewals: list[SubscriptionResponse]  # next 30 days
    cancellation_suggestions: list[SubscriptionResponse]  # dormant/non-essential
    potential_annual_savings: int  # centimes if all suggestions followed


# ═══════════════════════════════════════════════════════════════
#  VAULT DOCUMENTS
# ═══════════════════════════════════════════════════════════════


class VaultDocumentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="other")
    document_type: str = Field(default="other", max_length=100)
    issuer: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    document_number: str | None = None  # Will be encrypted
    reminder_days: int = Field(default=30, ge=0)
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)


class VaultDocumentUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    document_type: str | None = None
    issuer: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    document_number: str | None = None
    reminder_days: int | None = None
    notes: str | None = None
    extra_data: dict[str, Any] | None = None


class VaultDocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    category: str
    document_type: str
    issuer: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    has_document_number: bool = False  # never expose the actual number in list
    reminder_days: int
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)
    days_until_expiry: int | None = None  # computed
    is_expired: bool = False  # computed
    expiry_status: str = "valid"  # valid/expiring_soon/expired/no_expiry
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════
#  PEER DEBTS
# ═══════════════════════════════════════════════════════════════


class PeerDebtCreate(BaseModel):
    counterparty_name: str = Field(..., min_length=1, max_length=255)
    counterparty_email: str | None = None
    counterparty_phone: str | None = None
    direction: str = Field(..., pattern=r"^(lent|borrowed)$")
    amount: int = Field(..., gt=0, description="Centimes")
    currency: str = Field(default="EUR")
    description: str | None = None
    date_created: date | None = None  # defaults to today
    due_date: date | None = None
    reminder_enabled: bool = True
    reminder_interval_days: int = Field(default=7, ge=1, le=365)
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)


class PeerDebtUpdate(BaseModel):
    counterparty_name: str | None = None
    counterparty_email: str | None = None
    counterparty_phone: str | None = None
    direction: str | None = None
    amount: int | None = None
    currency: str | None = None
    description: str | None = None
    date_created: date | None = None
    due_date: date | None = None
    reminder_enabled: bool | None = None
    reminder_interval_days: int | None = None
    notes: str | None = None
    extra_data: dict[str, Any] | None = None


class PeerDebtSettleRequest(BaseModel):
    settled_amount: int | None = None  # centimes, defaults to full amount
    settled_date: date | None = None   # defaults to today


class PeerDebtResponse(BaseModel):
    id: UUID
    user_id: UUID
    counterparty_name: str
    counterparty_email: str | None = None
    counterparty_phone: str | None = None
    direction: str
    amount: int
    currency: str
    description: str | None = None
    date_created: date
    due_date: date | None = None
    is_settled: bool
    settled_date: date | None = None
    settled_amount: int | None = None
    reminder_enabled: bool
    reminder_interval_days: int
    last_reminder_at: datetime | None = None
    notes: str | None = None
    extra_data: dict[str, Any] = Field(default_factory=dict)
    is_overdue: bool = False  # computed
    days_overdue: int = 0     # computed
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class PeerDebtAnalyticsResponse(BaseModel):
    total_lent: int          # centimes, unsettled
    total_borrowed: int      # centimes, unsettled
    net_balance: int         # lent - borrowed
    active_count: int
    settled_count: int
    overdue_count: int
    counterparty_balances: list[dict[str, Any]]  # [{name, net, count}]
    repayment_rate: float    # % settled on time


# ═══════════════════════════════════════════════════════════════
#  VAULT SUMMARY (Shadow Wealth)
# ═══════════════════════════════════════════════════════════════


class VaultSummaryResponse(BaseModel):
    # Tangible Assets
    tangible_assets_total: int = 0       # centimes
    tangible_assets_count: int = 0
    tangible_depreciation_total: int = 0  # total lost to depreciation

    # NFTs
    nft_total: int = 0                   # centimes (floor price)
    nft_count: int = 0
    nft_gain_loss: int = 0               # centimes vs purchase

    # Loyalty
    loyalty_total: int = 0               # centimes
    loyalty_count: int = 0

    # Subscriptions
    subscription_monthly: int = 0        # centimes
    subscription_annual: int = 0         # centimes
    subscription_count: int = 0

    # Documents
    documents_count: int = 0
    documents_expiring_soon: int = 0     # within 30 days

    # Peer Debts
    peer_debt_lent_total: int = 0        # centimes, unsettled
    peer_debt_borrowed_total: int = 0    # centimes, unsettled
    peer_debt_net: int = 0               # lent - borrowed

    # Cards
    cards_count: int = 0
    cards_total_annual_fees: int = 0     # centimes

    # Shadow Wealth
    shadow_wealth_total: int = 0         # assets + NFTs + loyalty + peer_net
    warranties_expiring_soon: int = 0
    upcoming_cancellations: int = 0      # subscriptions to cancel within 7 days
    upcoming_renewals: int = 0           # subscriptions renewing within 30 days
