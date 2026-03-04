"""OmniFlow — Pydantic schemas for Heritage / Succession simulator (Phase C2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Sub-schemas ───────────────────────────────────────────────

class HeirSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    relationship: Literal[
        "conjoint", "enfant", "petit_enfant",
        "frere_soeur", "neveu_niece", "tiers",
    ]
    age: int | None = Field(default=None, ge=0, le=120)
    handicap: bool = False


class DonationRecord(BaseModel):
    heir_name: str = Field(..., min_length=1, max_length=100)
    amount: int = Field(..., ge=0)  # centimes
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    type: Literal["donation_simple", "donation_partage", "don_manuel"] = "donation_simple"


# ── Requests ──────────────────────────────────────────────────

class CreateHeritageRequest(BaseModel):
    marital_regime: Literal[
        "communaute", "separation", "pacs", "concubinage", "universel",
    ] = "communaute"
    heirs: list[HeirSchema] = Field(default_factory=list, max_length=20)
    life_insurance_before_70: int = Field(default=0, ge=0)
    life_insurance_after_70: int = Field(default=0, ge=0)
    donation_history: list[DonationRecord] = Field(default_factory=list, max_length=50)
    include_real_estate: bool = True
    include_life_insurance: bool = True
    custom_patrimoine_override: int | None = Field(default=None, ge=0)


class UpdateHeritageRequest(BaseModel):
    marital_regime: Literal[
        "communaute", "separation", "pacs", "concubinage", "universel",
    ] | None = None
    heirs: list[HeirSchema] | None = None
    life_insurance_before_70: int | None = Field(default=None, ge=0)
    life_insurance_after_70: int | None = Field(default=None, ge=0)
    donation_history: list[DonationRecord] | None = None
    include_real_estate: bool | None = None
    include_life_insurance: bool | None = None
    custom_patrimoine_override: int | None = Field(default=None, ge=0)


class SimulateSuccessionRequest(BaseModel):
    """Optional overrides for what-if scenarios."""
    patrimoine_override: int | None = Field(default=None, ge=0)
    heirs_override: list[HeirSchema] | None = None
    marital_regime_override: str | None = None
    life_insurance_before_70_override: int | None = Field(default=None, ge=0)
    life_insurance_after_70_override: int | None = Field(default=None, ge=0)


class TimelineRequest(BaseModel):
    years: int = Field(default=30, ge=5, le=50)
    inflation_rate_pct: float = Field(default=2.0, ge=0.0, le=10.0)


# ── Response sub-schemas ──────────────────────────────────────

class HeirResult(BaseModel):
    name: str
    relationship: str
    part_brute: int          # centimes — gross share
    abattement: int          # centimes
    taxable: int             # centimes after deduction
    droits: int              # centimes — tax owed
    net_recu: int            # centimes — net received
    taux_effectif_pct: float


class DonationScenario(BaseModel):
    label: str
    donation_per_heir: int   # centimes
    economy_vs_no_donation: int  # centimes saved
    new_total_droits: int
    description: str


class TimelinePoint(BaseModel):
    year: int
    patrimoine_projete: int
    droits_si_succession: int
    net_transmis: int
    donation_abattement_available: bool


# ── Responses ─────────────────────────────────────────────────

class HeritageResponse(BaseModel):
    id: UUID
    user_id: UUID
    marital_regime: str
    heirs: list[HeirSchema]
    life_insurance_before_70: int
    life_insurance_after_70: int
    donation_history: list[DonationRecord]
    include_real_estate: bool
    include_life_insurance: bool
    custom_patrimoine_override: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SimulationSuccessionResponse(BaseModel):
    patrimoine_brut: int
    patrimoine_taxable: int
    total_droits: int
    total_net_transmis: int
    taux_effectif_global_pct: float
    heirs_detail: list[HeirResult]
    life_insurance_detail: dict | None = None
    demembrement_detail: dict | None = None


class DonationOptimizationResponse(BaseModel):
    scenarios: list[DonationScenario]
    best_scenario: str
    economy_max: int   # centimes
    summary: str


class TimelineResponse(BaseModel):
    points: list[TimelinePoint]
    donation_renewal_years: list[int]
