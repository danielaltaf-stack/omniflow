"""
OmniFlow — Wealth Autopilot Pydantic schemas.

16+ models: requests, sub-schemas, responses for the Wealth Autopilot engine.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
#  Sub-schemas
# ═══════════════════════════════════════════════════════════════════

class AllocationItem(BaseModel):
    priority: int = Field(..., ge=1, le=10)
    type: Literal[
        "safety_cushion", "project",
        "dca_etf", "dca_crypto", "dca_scpi", "dca_bond", "dca_custom",
    ]
    label: str = Field(..., min_length=1, max_length=120)
    target: int = Field(0, ge=0, description="Target amount in centimes (for cushion/project)")
    current: int = Field(0, ge=0, description="Already saved in centimes")
    pct: float = Field(0.0, ge=0, le=100, description="% of available savings")
    account_type: Optional[str] = None
    project_id: Optional[str] = None
    deadline: Optional[str] = None
    asset_class: Optional[str] = None
    target_monthly: int = Field(0, ge=0, description="Monthly DCA target in centimes")


class SuggestionBreakdown(BaseModel):
    allocation_label: str
    allocation_type: str
    amount: int = Field(..., ge=0, description="Amount in centimes")
    reason: str = ""


class SavingsSuggestion(BaseModel):
    suggestion_id: str
    total_available: int = Field(..., ge=0, description="Total available in centimes")
    suggested_amount: int = Field(..., ge=0, description="Rounded suggestion in centimes")
    breakdown: list[SuggestionBreakdown] = []
    message: str = ""
    status: Literal["suggested", "accepted", "executed", "skipped", "expired"] = "suggested"
    created_at: Optional[str] = None


class DCAItem(BaseModel):
    type: str
    label: str
    target_monthly: int = Field(..., ge=0, description="Target monthly DCA in centimes")
    actual_this_month: int = Field(0, ge=0, description="Already invested this month")
    remaining: int = Field(0, ge=0, description="Remaining to invest this month")
    suggestion: str = ""
    performance_12m: Optional[float] = None


class ScenarioProjection(BaseModel):
    total_savings_6m: int = Field(0, ge=0, description="Centimes")
    total_savings_12m: int = Field(0, ge=0, description="Centimes")
    total_savings_24m: int = Field(0, ge=0, description="Centimes")
    safety_cushion_full_months: Optional[int] = None
    projects_reached: list[dict[str, Any]] = []
    patrimoine_projected: int = Field(0, ge=0, description="Centimes")


class AutopilotScoreBreakdown(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    savings_rate_score: int = Field(0, ge=0, le=30)
    safety_cushion_score: int = Field(0, ge=0, le=25)
    regularity_score: int = Field(0, ge=0, le=20)
    diversification_score: int = Field(0, ge=0, le=15)
    projects_score: int = Field(0, ge=0, le=10)


class SuggestionHistoryItem(BaseModel):
    suggestion_id: str
    total_available: int
    suggested_amount: int
    status: str
    created_at: str
    breakdown: list[SuggestionBreakdown] = []


# ═══════════════════════════════════════════════════════════════════
#  Request schemas
# ═══════════════════════════════════════════════════════════════════

class UpdateAutopilotConfigRequest(BaseModel):
    is_enabled: Optional[bool] = None
    safety_cushion_months: Optional[float] = Field(None, ge=0.5, le=12.0)
    min_savings_amount: Optional[int] = Field(None, ge=500, description="Min 5€ centimes")
    savings_step: Optional[int] = Field(None, ge=100, description="Min 1€ centimes")
    lookback_days: Optional[int] = Field(None, ge=7, le=365)
    forecast_days: Optional[int] = Field(None, ge=1, le=30)
    monthly_income: Optional[int] = Field(None, ge=0)
    income_day: Optional[int] = Field(None, ge=1, le=31)
    other_income: Optional[int] = Field(None, ge=0)
    allocations: Optional[list[AllocationItem]] = None


class AcceptSuggestionRequest(BaseModel):
    suggestion_id: str = Field(..., min_length=1)


# ═══════════════════════════════════════════════════════════════════
#  Response schemas
# ═══════════════════════════════════════════════════════════════════

class AutopilotConfigResponse(BaseModel):
    id: UUID
    user_id: UUID
    is_enabled: bool = True
    safety_cushion_months: float = 3.0
    min_savings_amount: int = 2000
    savings_step: int = 1000
    lookback_days: int = 90
    forecast_days: int = 7
    monthly_income: int = 0
    income_day: int = 1
    other_income: int = 0
    allocations: list[dict] = []
    last_available: int = 0
    last_suggestion: dict = {}
    suggestions_history: list[dict] = []
    autopilot_score: int = 0
    savings_rate_pct: float = 0.0
    analysis_data: dict = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ComputeResponse(BaseModel):
    suggestion: SavingsSuggestion
    dca_items: list[DCAItem] = []
    checking_balance: int = Field(0, description="Centimes")
    savings_balance: int = Field(0, description="Centimes")
    monthly_expenses_avg: int = Field(0, description="Centimes")
    safety_cushion_target: int = Field(0, description="Centimes")
    safety_cushion_current: int = Field(0, description="Centimes")
    safety_gap: int = Field(0, description="Centimes")
    upcoming_debits: int = Field(0, description="Centimes")
    savings_rate_pct: float = 0.0


class DCAStatusResponse(BaseModel):
    dca_items: list[DCAItem] = []
    total_monthly_target: int = Field(0, ge=0, description="Centimes")
    total_invested_this_month: int = Field(0, ge=0, description="Centimes")
    total_remaining: int = Field(0, ge=0, description="Centimes")


class SimulateResponse(BaseModel):
    prudent: ScenarioProjection
    moderate: ScenarioProjection
    ambitious: ScenarioProjection


class AutopilotScoreResponse(BaseModel):
    breakdown: AutopilotScoreBreakdown


class SuggestionHistoryResponse(BaseModel):
    history: list[SuggestionHistoryItem] = []
    total_suggested: int = Field(0, ge=0, description="Centimes")
    total_accepted: int = Field(0, ge=0, description="Centimes")
    acceptance_rate: float = Field(0.0, ge=0, le=100)
