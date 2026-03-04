"""
OmniFlow — Pydantic schemas for crypto wallets, holdings, tax & staking (B4).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Wallet ─────────────────────────────────────────────

class CreateCryptoWalletRequest(BaseModel):
    platform: str = Field(..., description="binance, kraken, etherscan, polygon, arbitrum, optimism, bsc, or manual")
    label: str = Field(..., min_length=1, max_length=256)
    api_key: str | None = Field(None, description="API key (Binance/Kraken)")
    api_secret: str | None = Field(None, description="API secret (Binance/Kraken)")
    address: str | None = Field(None, description="Public address (on-chain wallets)")
    chain: str | None = Field(None, description="Chain: ethereum, polygon, arbitrum, optimism, bsc")


class CryptoWalletResponse(BaseModel):
    id: UUID
    platform: str
    label: str
    chain: str = "ethereum"
    status: str
    last_sync_at: datetime | None
    sync_error: str | None
    holdings_count: int = 0
    total_value: int = 0  # centimes
    created_at: datetime

    class Config:
        from_attributes = True


# ── Holdings ───────────────────────────────────────────

class CryptoHoldingResponse(BaseModel):
    token_symbol: str
    token_name: str
    quantity: float
    current_price: int  # centimes per unit
    value: int  # centimes
    pnl: int  # centimes
    pnl_pct: float
    change_24h: float = 0.0
    allocation_pct: float = 0.0
    wallet_id: UUID
    # B4 staking fields
    is_staked: bool = False
    staking_apy: float = 0.0
    staking_source: str | None = None

    class Config:
        from_attributes = True


class CryptoPortfolioResponse(BaseModel):
    total_value: int  # centimes
    change_24h: float
    holdings: list[CryptoHoldingResponse]
    wallets: list[CryptoWalletResponse]


class CryptoSparklineResponse(BaseModel):
    symbol: str
    prices: list[float]
    days: int


# ── B4: Tax / Transactions ────────────────────────────

class CreateTransactionRequest(BaseModel):
    wallet_id: UUID
    tx_type: str = Field(..., description="buy, sell, swap, transfer_in, transfer_out, staking_reward, airdrop")
    token_symbol: str = Field(..., min_length=1, max_length=16)
    quantity: float = Field(..., gt=0)
    price_eur: int = Field(..., ge=0, description="Price per unit in centimes")
    fee_eur: int = Field(0, ge=0, description="Fee in centimes")
    counterpart: str | None = Field(None, max_length=16, description="For swap: counterpart token symbol")
    tx_hash: str | None = Field(None, max_length=128)
    executed_at: datetime


class TransactionResponse(BaseModel):
    id: UUID
    wallet_id: UUID
    tx_type: str
    token_symbol: str
    quantity: float
    price_eur: int
    total_eur: int
    fee_eur: int
    counterpart: str | None
    tx_hash: str | None
    executed_at: datetime
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total: int


class DisposalLine(BaseModel):
    date: str
    token: str
    quantity: float
    prix_cession: int  # centimes
    prix_acquisition_pmpa: int  # centimes
    plus_ou_moins_value: int  # centimes


class TaxSummaryResponse(BaseModel):
    year: int
    realized_pv: int  # centimes (total plus-values)
    realized_mv: int  # centimes (total moins-values)
    net_pv: int  # centimes
    seuil_305_atteint: bool
    taxable_pv: int  # centimes (after 305€ abattement)
    flat_tax_30: int  # centimes
    disposals_count: int
    disposals: list[DisposalLine]
    unrealized_total: int  # centimes


class PMPAResponse(BaseModel):
    token_symbol: str
    pmpa_centimes: int
    total_quantity: float
    total_invested_centimes: int


# ── B4: Staking ────────────────────────────────────────

class StakingPosition(BaseModel):
    token_symbol: str
    token_name: str
    quantity: float
    value: int  # centimes
    apy: float
    source: str
    projected_annual_reward: int  # centimes


class StakingSummaryResponse(BaseModel):
    total_staked_value: int  # centimes
    projected_annual_rewards: int  # centimes
    positions: list[StakingPosition]


class SupportedChainResponse(BaseModel):
    id: str
    name: str
    native_symbol: str
