"""
OmniFlow — Pydantic schemas for debts module.
Validation, serialization, and response models for the debt API.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── Request Schemas ──────────────────────────────────────────


class CreateDebtRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=256)
    debt_type: str = Field(default="other", description="mortgage, consumer, student, credit_card, loc, lombard, other")
    creditor: str | None = Field(default=None, max_length=256)
    initial_amount: int = Field(..., gt=0, description="Initial loan amount in centimes")
    remaining_amount: int = Field(..., ge=0, description="Remaining capital in centimes")
    interest_rate_pct: float = Field(..., ge=0, le=30, description="Annual nominal rate (0–30%)")
    insurance_rate_pct: float | None = Field(default=0.0, ge=0, le=5)
    monthly_payment: int = Field(..., gt=0, description="Monthly payment in centimes")
    start_date: date | None = None
    end_date: date | None = None
    duration_months: int = Field(..., ge=1, le=480, description="Duration 1–480 months (max 40 years)")
    early_repayment_fee_pct: float = Field(default=3.0, ge=0, le=5)
    payment_type: str = Field(default="constant_annuity", description="constant_annuity, constant_amortization, in_fine, deferred")
    is_deductible: bool = False
    linked_property_id: UUID | None = None

    @model_validator(mode="after")
    def validate_amounts(self):
        if self.remaining_amount > self.initial_amount:
            raise ValueError("remaining_amount ne peut pas dépasser initial_amount")
        return self


class UpdateDebtRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=256)
    debt_type: str | None = None
    creditor: str | None = None
    initial_amount: int | None = Field(default=None, gt=0)
    remaining_amount: int | None = Field(default=None, ge=0)
    interest_rate_pct: float | None = Field(default=None, ge=0, le=30)
    insurance_rate_pct: float | None = Field(default=None, ge=0, le=5)
    monthly_payment: int | None = Field(default=None, gt=0)
    start_date: date | None = None
    end_date: date | None = None
    duration_months: int | None = Field(default=None, ge=1, le=480)
    early_repayment_fee_pct: float | None = Field(default=None, ge=0, le=5)
    payment_type: str | None = None
    is_deductible: bool | None = None
    linked_property_id: UUID | None = None


class RecordPaymentRequest(BaseModel):
    payment_date: date = Field(...)
    total_amount: int = Field(..., gt=0, description="Total payment in centimes")
    principal_amount: int = Field(default=0, ge=0)
    interest_amount: int = Field(default=0, ge=0)
    insurance_amount: int = Field(default=0, ge=0)


# ── Response Schemas ─────────────────────────────────────────


class DebtResponse(BaseModel):
    id: UUID
    label: str
    debt_type: str
    creditor: str | None
    initial_amount: int
    remaining_amount: int
    interest_rate_pct: float
    insurance_rate_pct: float | None
    monthly_payment: int
    start_date: date | None
    end_date: date | None
    duration_months: int
    early_repayment_fee_pct: float
    payment_type: str
    is_deductible: bool
    linked_property_id: UUID | None
    # Computed fields
    progress_pct: float = 0.0
    remaining_months: int = 0
    total_cost: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class AmortizationRowResponse(BaseModel):
    payment_number: int
    date: date | None
    total: int
    principal: int
    interest: int
    insurance: int
    remaining: int


class AmortizationTableResponse(BaseModel):
    rows: list[AmortizationRowResponse]
    total_interest: int
    total_insurance: int
    total_cost: int
    total_paid: int
    end_date: date | None


class EarlyRepaymentScenarioResponse(BaseModel):
    name: str
    new_monthly_payment: int
    new_duration_months: int
    new_end_date: date | None
    interest_saved: int
    penalty_amount: int
    net_savings: int


class EarlyRepaymentResponse(BaseModel):
    current_remaining: int
    repayment_amount: int
    at_month: int
    reduced_duration: EarlyRepaymentScenarioResponse
    reduced_payment: EarlyRepaymentScenarioResponse


class InvestVsRepayResponse(BaseModel):
    amount: int
    return_rate_pct: float
    horizon_months: int
    invest_gross_value: int
    invest_gross_gain: int
    invest_tax: int
    invest_net_gain: int
    repay_interest_saved: int
    repay_penalty: int
    repay_net_gain: int
    verdict: str
    advantage: int


class ConsolidationResponse(BaseModel):
    total_remaining: int
    total_monthly: int
    weighted_avg_rate: float
    debt_ratio_pct: float
    debts_count: int
    last_end_month: int
    avalanche_order: list[str]
    snowball_order: list[str]
    months_saved_with_extra: int


class DebtSummaryResponse(BaseModel):
    total_remaining: int
    total_monthly: int
    total_initial: int
    weighted_avg_rate: float
    debt_ratio_pct: float
    debts_count: int
    next_end_date: date | None
    debts: list[DebtResponse]


class ChartDataPoint(BaseModel):
    month: int
    date: str | None = None
    principal: int
    interest: int
    insurance: int
    remaining: int
