"""
OmniFlow — Fee Negotiator Pydantic schemas.

12 models: requests, sub-schemas, responses.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
#  Sub-schemas
# ═══════════════════════════════════════════════════════════════════

class FeeBreakdownItem(BaseModel):
    fee_type: str = Field(..., description="Internal key: account_maintenance, card_classic, etc.")
    label: str = Field(..., description="Human-readable label")
    annual_total: int = Field(..., ge=0, description="Total centimes over 12 months")
    monthly_avg: int = Field(..., ge=0, description="Average per month in centimes")
    count: int = Field(..., ge=0, description="Number of matching transactions")


class MonthlyFeeDetail(BaseModel):
    month: str = Field(..., description="YYYY-MM")
    total: int = Field(..., ge=0, description="Total centimes that month")
    details: list[FeeBreakdownItem] = []


class BankAlternative(BaseModel):
    bank_slug: str
    bank_name: str
    is_online: bool
    total_there: int = Field(..., ge=0, description="Estimated annual cost there (centimes)")
    saving: int = Field(..., description="Saving vs current (centimes)")
    pct_saving: float = Field(..., description="Saving percentage")


# ═══════════════════════════════════════════════════════════════════
#  Request schemas
# ═══════════════════════════════════════════════════════════════════

class ScanFeesRequest(BaseModel):
    months: int = Field(12, ge=1, le=36, description="Lookback months")


class UpdateNegotiationRequest(BaseModel):
    status: Literal[
        "draft", "sent", "waiting", "resolved_success", "resolved_fail"
    ]
    result_amount: int = Field(0, ge=0, description="Centimes refunded/waived")


# ═══════════════════════════════════════════════════════════════════
#  Response schemas
# ═══════════════════════════════════════════════════════════════════

class FeeScanResponse(BaseModel):
    total_fees_annual: int
    fees_by_type: list[FeeBreakdownItem]
    monthly_breakdown: list[MonthlyFeeDetail]
    overcharge_score: int = Field(..., ge=0, le=100)
    top_alternatives: list[BankAlternative]
    best_alternative_slug: Optional[str] = None
    best_alternative_saving: int = 0

    class Config:
        from_attributes = True


class NegotiationLetterResponse(BaseModel):
    letter_markdown: str
    arguments: list[str]


class FeeAnalysisResponse(BaseModel):
    id: UUID
    user_id: UUID
    total_fees_annual: int
    fees_by_type: dict
    monthly_breakdown: list
    best_alternative_slug: Optional[str] = None
    best_alternative_saving: int = 0
    top_alternatives: list
    overcharge_score: int
    negotiation_status: str
    negotiation_letter: Optional[str] = None
    negotiation_sent_at: Optional[datetime] = None
    negotiation_result_amount: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BankFeeScheduleResponse(BaseModel):
    bank_slug: str
    bank_name: str
    is_online: bool
    fee_account_maintenance: int
    fee_card_classic: int
    fee_card_premium: int
    fee_card_international: int
    fee_overdraft_commission: int
    fee_transfer_sepa: int
    fee_transfer_intl: int
    fee_check: int
    fee_insurance_card: int
    fee_reject: int
    fee_atm_other_bank: int

    class Config:
        from_attributes = True


class FeeScheduleListResponse(BaseModel):
    schedules: list[BankFeeScheduleResponse]
    count: int
