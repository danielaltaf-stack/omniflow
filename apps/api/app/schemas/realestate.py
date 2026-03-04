"""
OmniFlow — Pydantic schemas for real estate properties (Phase B3 enriched).
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreatePropertyRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=256)
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    property_type: str = Field(default="apartment", description="apartment, house, parking, commercial, land, other")
    surface_m2: float | None = None
    purchase_price: int = Field(..., description="Purchase price in centimes")
    purchase_date: date | None = None
    current_value: int = Field(..., description="Current estimated value in centimes")
    monthly_rent: int = Field(default=0, description="Monthly rent in centimes")
    monthly_charges: int = Field(default=0, description="Monthly charges in centimes")
    monthly_loan_payment: int = Field(default=0, description="Monthly loan payment in centimes")
    loan_remaining: int = Field(default=0, description="Remaining loan balance in centimes")
    # B3 fiscal & loan fields
    fiscal_regime: str = Field(default="micro_foncier", description="micro_foncier or reel")
    tmi_pct: float = Field(default=30.0, description="Marginal tax rate %")
    taxe_fonciere: int = Field(default=0, description="Annual property tax in centimes")
    assurance_pno: int = Field(default=0, description="Monthly landlord insurance in centimes")
    vacancy_rate_pct: float = Field(default=0.0, description="Vacancy rate as % of rent")
    notary_fees_pct: float = Field(default=7.5, description="Notary fees as % of purchase price")
    provision_travaux: int = Field(default=0, description="Monthly maintenance provision in centimes")
    loan_interest_rate: float = Field(default=0.0, description="Annual loan interest rate %")
    loan_insurance_rate: float = Field(default=0.0, description="Annual loan insurance rate %")
    loan_duration_months: int = Field(default=0, description="Loan duration in months")
    loan_start_date: date | None = None


class UpdatePropertyRequest(BaseModel):
    label: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    property_type: str | None = None
    surface_m2: float | None = None
    purchase_price: int | None = None
    purchase_date: date | None = None
    current_value: int | None = None
    monthly_rent: int | None = None
    monthly_charges: int | None = None
    monthly_loan_payment: int | None = None
    loan_remaining: int | None = None
    # B3 fields
    fiscal_regime: str | None = None
    tmi_pct: float | None = None
    taxe_fonciere: int | None = None
    assurance_pno: int | None = None
    vacancy_rate_pct: float | None = None
    notary_fees_pct: float | None = None
    provision_travaux: int | None = None
    loan_interest_rate: float | None = None
    loan_insurance_rate: float | None = None
    loan_duration_months: int | None = None
    loan_start_date: date | None = None


class PropertyResponse(BaseModel):
    id: UUID
    label: str
    address: str | None
    city: str | None
    postal_code: str | None
    latitude: float | None
    longitude: float | None
    property_type: str
    surface_m2: float | None
    purchase_price: int
    purchase_date: date | None
    current_value: int
    dvf_estimation: int | None
    monthly_rent: int
    monthly_charges: int
    monthly_loan_payment: int
    loan_remaining: int
    net_monthly_cashflow: int
    gross_yield_pct: float
    net_yield_pct: float
    net_net_yield_pct: float
    capital_gain: int
    annual_tax_burden: int
    # B3 detail
    fiscal_regime: str
    tmi_pct: float
    taxe_fonciere: int
    assurance_pno: int
    vacancy_rate_pct: float
    notary_fees_pct: float
    provision_travaux: int
    loan_interest_rate: float
    loan_insurance_rate: float
    loan_duration_months: int
    loan_start_date: date | None
    created_at: datetime

    class Config:
        from_attributes = True


class DVFEstimationResponse(BaseModel):
    price_m2_centimes: int
    nb_transactions: int
    estimation_centimes: int | None


class RealEstateSummaryResponse(BaseModel):
    total_value: int
    total_purchase_price: int
    total_capital_gain: int
    total_capital_gain_pct: float
    total_monthly_rent: int
    total_monthly_charges: int
    total_monthly_loan: int
    total_loan_remaining: int
    net_monthly_cashflow: int
    avg_gross_yield_pct: float
    properties_count: int
    properties: list[PropertyResponse]


# ── B3 Analytics schemas ──────────────────────────────────────

class ValuationHistoryEntry(BaseModel):
    id: str
    source: str
    price_m2_centimes: int
    estimation_centimes: int | None
    nb_transactions: int
    recorded_at: str | None
    created_at: str | None


class ValuationHistoryResponse(BaseModel):
    property_id: str
    valuations: list[ValuationHistoryEntry]


class DVFRefreshResponse(BaseModel):
    id: str
    source: str
    price_m2_centimes: int
    estimation_centimes: int | None
    nb_transactions: int
    recorded_at: str
    significant_change: bool
    delta_pct: float


class CashFlowMonthly(BaseModel):
    month: int
    date: str
    rent: int
    charges: int
    loan_principal: int
    loan_interest: int
    loan_insurance: int
    tax_monthly: int
    cashflow: int
    cumulative_cashflow: int
    remaining_capital: int


class CashFlowProjectionResponse(BaseModel):
    property_id: str
    duration_months: int
    avg_monthly_cashflow: int
    total_interest_paid: int
    total_insurance_paid: int
    total_tax_paid: int
    total_rent_collected: int
    roi_at_end_pct: float
    payback_months: int
    monthly: list[CashFlowMonthly]
