"""
OmniFlow — Pydantic schemas for retirement simulation module (Phase C1).
Validation, serialization, and response models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── Asset returns sub-model ──────────────────────────────────

class AssetClassReturn(BaseModel):
    mean: float = Field(..., ge=-10, le=30, description="Mean annual return (%)")
    std: float = Field(..., ge=0, le=80, description="Std dev annual return (%)")


# ── Request Schemas ──────────────────────────────────────────


class CreateRetirementProfileRequest(BaseModel):
    birth_year: int = Field(..., ge=1940, le=2010)
    target_retirement_age: int = Field(default=64, ge=50, le=75)
    current_monthly_income: int = Field(default=0, ge=0, description="Monthly income in centimes")
    current_monthly_expenses: int = Field(default=0, ge=0, description="Monthly expenses in centimes")
    monthly_savings: int = Field(default=0, ge=0, description="Monthly savings in centimes")
    pension_estimate_monthly: int | None = Field(default=None, ge=0, description="CNAV pension estimate in centimes")
    pension_quarters_acquired: int = Field(default=0, ge=0, le=200)
    target_lifestyle_pct: float = Field(default=80.0, ge=20, le=150)
    inflation_rate_pct: float = Field(default=2.0, ge=0, le=10)
    life_expectancy: int = Field(default=90, ge=65, le=110)
    include_real_estate: bool = Field(default=True)
    asset_returns: dict[str, AssetClassReturn] | None = Field(default=None, description="Per-class return assumptions (mean + std)")


class UpdateRetirementProfileRequest(BaseModel):
    birth_year: int | None = Field(default=None, ge=1940, le=2010)
    target_retirement_age: int | None = Field(default=None, ge=50, le=75)
    current_monthly_income: int | None = Field(default=None, ge=0)
    current_monthly_expenses: int | None = Field(default=None, ge=0)
    monthly_savings: int | None = Field(default=None, ge=0)
    pension_estimate_monthly: int | None = Field(default=None, ge=0)
    pension_quarters_acquired: int | None = Field(default=None, ge=0, le=200)
    target_lifestyle_pct: float | None = Field(default=None, ge=20, le=150)
    inflation_rate_pct: float | None = Field(default=None, ge=0, le=10)
    life_expectancy: int | None = Field(default=None, ge=65, le=110)
    include_real_estate: bool | None = None
    asset_returns: dict[str, AssetClassReturn] | None = None


class SimulationRequest(BaseModel):
    extra_monthly_savings: int = Field(default=0, ge=0, description="Additional monthly savings to test (centimes)")
    num_simulations: int = Field(default=1000, ge=100, le=5000)


class WhatIfRequest(BaseModel):
    retirement_age: int | None = Field(default=None, ge=50, le=75)
    monthly_savings: int | None = Field(default=None, ge=0)
    pension_estimate: int | None = Field(default=None, ge=0)
    inflation_rate: float | None = Field(default=None, ge=0, le=10)
    asset_returns_override: dict[str, AssetClassReturn] | None = None


# ── Response Schemas ─────────────────────────────────────────


class YearProjection(BaseModel):
    age: int
    year: int
    p10: int  # centimes
    p25: int
    p50: int
    p75: int
    p90: int
    is_accumulation: bool
    pension_income: int  # centimes — 0 during accumulation
    withdrawal: int  # centimes — 0 during accumulation


class OptimizationLever(BaseModel):
    lever_name: str
    description: str
    delta_monthly_savings: int  # centimes (0 if not savings-based)
    new_fire_age: int | None
    years_gained: float
    new_success_rate: float


class RetirementProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    birth_year: int
    target_retirement_age: int
    current_monthly_income: int
    current_monthly_expenses: int
    monthly_savings: int
    pension_estimate_monthly: int | None
    pension_quarters_acquired: int
    target_lifestyle_pct: float
    inflation_rate_pct: float
    life_expectancy: int
    include_real_estate: bool
    asset_returns: dict[str, Any]
    current_age: int
    years_to_retirement: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SimulationResponse(BaseModel):
    median_fire_age: int | None
    fire_age_p10: int | None
    fire_age_p90: int | None
    success_rate_pct: float
    ruin_probability_pct: float
    patrimoine_at_retirement_p50: int
    serie_by_age: list[YearProjection]
    fire_number: int
    fire_progress_pct: float
    coast_fire: int
    lean_fire: int
    fat_fire: int
    swr_recommended_pct: float
    monthly_withdrawal_recommended: int
    pension_estimate_used: int
    num_simulations: int


class OptimizationResponse(BaseModel):
    levers: list[OptimizationLever]
    best_lever: str
    summary: str


class FireDashboardResponse(BaseModel):
    fire_number: int
    fire_progress_pct: float
    coast_fire: int
    lean_fire: int
    fat_fire: int
    swr_pct: float
    monthly_withdrawal: int
    patrimoine_total: int
    passive_income_monthly: int
    current_age: int
    target_retirement_age: int
    years_to_retirement: int
