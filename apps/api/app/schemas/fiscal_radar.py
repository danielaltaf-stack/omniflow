"""
OmniFlow — Fiscal Radar Pydantic schemas.

15 models: requests, sub-schemas, responses for the Fiscal Radar engine.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
#  Sub-schemas
# ═══════════════════════════════════════════════════════════════════

class FiscalAlertItem(BaseModel):
    alert_type: str = Field(..., description="e.g. pea_maturity_soon, per_year_end_gap")
    priority: Literal["urgent", "high", "info"] = "info"
    title: str = Field(..., description="Short title for the alert")
    message: str = Field(..., description="Detailed user-facing message")
    economy_estimate: int = Field(0, ge=0, description="Estimated saving in centimes")
    deadline: Optional[date] = Field(None, description="Relevant deadline if any")
    domain: str = Field(..., description="pea, crypto, immobilier, per, av, cto, ir")


class FiscalOptimizationItem(BaseModel):
    domain: str
    label: str
    current_value: int = Field(..., description="Current amount in centimes")
    optimized_value: int = Field(..., description="Optimized amount in centimes")
    economy: int = Field(..., description="Saving in centimes")
    recommendation: str


class DomainAnalysis(BaseModel):
    domain: str
    label: str
    score: int = Field(..., ge=0, le=100)
    status: Literal["optimal", "good", "improvable", "critical"]
    details: dict[str, Any] = {}
    recommendations: list[str] = []


class FiscalScoreBreakdown(BaseModel):
    overall_score: int = Field(..., ge=0, le=100)
    domain_scores: list[DomainAnalysis]
    total_economy_estimate: int = Field(..., ge=0, description="Centimes")
    optimization_count: int = 0


class FiscalExportRevenusF(BaseModel):
    brut: int = 0
    regime: str = "micro_foncier"
    charges_deductibles: int = 0
    revenu_net_foncier: int = 0
    deficit_foncier: int = 0
    cases_cerfa: dict[str, int] = {}


class FiscalExportPVMobilieres(BaseModel):
    pv_cto: int = 0
    mv_cto: int = 0
    pv_nette_cto: int = 0
    dividendes_bruts: int = 0
    option_retenue: str = "pfu"
    impot_estime: int = 0
    cases_cerfa: dict[str, int] = {}


class FiscalExportCrypto(BaseModel):
    pv_nette: int = 0
    abattement_305: int = 0
    base_imposable: int = 0
    flat_tax_estime: int = 0
    cases_cerfa: dict[str, int] = {}


class FiscalExportPER(BaseModel):
    versements: int = 0
    plafond_utilise: int = 0
    economie_ir: int = 0
    cases_cerfa: dict[str, int] = {}


class FiscalExportSynthese(BaseModel):
    total_impot_estime: int = 0
    economies_realisees: int = 0
    score_fiscal: int = 0


# ═══════════════════════════════════════════════════════════════════
#  Request schemas
# ═══════════════════════════════════════════════════════════════════

class UpdateFiscalProfileRequest(BaseModel):
    tax_household: Optional[Literal["single", "couple", "family"]] = None
    parts_fiscales: Optional[float] = Field(None, ge=0.5, le=10.0)
    tmi_rate: Optional[float] = Field(None, ge=0.0, le=45.0)
    revenu_fiscal_ref: Optional[int] = Field(None, ge=0)
    pea_open_date: Optional[date] = None
    pea_total_deposits: Optional[int] = Field(None, ge=0)
    per_annual_deposits: Optional[int] = Field(None, ge=0)
    per_plafond: Optional[int] = Field(None, ge=0)
    av_open_date: Optional[date] = None
    av_total_deposits: Optional[int] = Field(None, ge=0)
    total_revenus_fonciers: Optional[int] = Field(None, ge=0)
    total_charges_deductibles: Optional[int] = Field(None, ge=0)
    deficit_foncier_reportable: Optional[int] = Field(None, ge=0)
    crypto_pv_annuelle: Optional[int] = Field(None, ge=0)
    crypto_mv_annuelle: Optional[int] = Field(None, ge=0)
    dividendes_bruts_annuels: Optional[int] = Field(None, ge=0)
    pv_cto_annuelle: Optional[int] = Field(None, ge=0)


class FiscalAnalysisRequest(BaseModel):
    """Optional overrides for analysis. If empty, uses stored profile."""
    year: int = Field(2026, ge=2020, le=2040)


class TMISimulationRequest(BaseModel):
    extra_income: int = Field(..., ge=0, description="Additional income in centimes")
    income_type: Literal["salaire", "foncier", "dividendes", "crypto", "per_deduction"] = "salaire"


# ═══════════════════════════════════════════════════════════════════
#  Response schemas
# ═══════════════════════════════════════════════════════════════════

class FiscalProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    tax_household: str
    parts_fiscales: float
    tmi_rate: float
    revenu_fiscal_ref: int
    pea_open_date: Optional[date] = None
    pea_total_deposits: int = 0
    per_annual_deposits: int = 0
    per_plafond: int = 0
    av_open_date: Optional[date] = None
    av_total_deposits: int = 0
    total_revenus_fonciers: int = 0
    total_charges_deductibles: int = 0
    deficit_foncier_reportable: int = 0
    crypto_pv_annuelle: int = 0
    crypto_mv_annuelle: int = 0
    dividendes_bruts_annuels: int = 0
    pv_cto_annuelle: int = 0
    fiscal_score: int = 0
    total_economy_estimate: int = 0
    analysis_data: dict = {}
    alerts_data: list = []
    export_data: dict = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FiscalAlertListResponse(BaseModel):
    alerts: list[FiscalAlertItem]
    count: int
    total_economy: int = Field(0, description="Sum of all alert economies in centimes")


class FiscalAnalysisResponse(BaseModel):
    fiscal_score: int = Field(..., ge=0, le=100)
    domain_analyses: list[DomainAnalysis]
    alerts: list[FiscalAlertItem]
    optimizations: list[FiscalOptimizationItem]
    total_economy_estimate: int = 0
    analysis_date: str

    class Config:
        from_attributes = True


class FiscalExportResponse(BaseModel):
    year: int
    revenus_fonciers: FiscalExportRevenusF
    plus_values_mobilieres: FiscalExportPVMobilieres
    crypto_actifs: FiscalExportCrypto
    per_deductions: FiscalExportPER
    synthese: FiscalExportSynthese

    class Config:
        from_attributes = True


class TMISimulationResponse(BaseModel):
    current_tmi: float
    current_ir: int = Field(..., description="Current IR in centimes")
    new_tmi: float
    new_ir: int = Field(..., description="New IR after extra income, centimes")
    marginal_tax: int = Field(..., description="Additional tax on extra income, centimes")
    marginal_rate_effective: float = Field(..., description="Effective marginal rate %")
    extra_income: int
    income_type: str


class FiscalScoreResponse(BaseModel):
    breakdown: FiscalScoreBreakdown
