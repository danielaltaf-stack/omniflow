"""
OmniFlow — Pydantic schemas for stock portfolios, positions, and B2 analytics.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreatePortfolioRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=256)
    broker: str = Field(default="manual", description="degiro, trade_republic, boursorama, manual")
    envelope_type: str = Field(default="cto", description="pea, pea_pme, cto, assurance_vie, per")
    management_fee_pct: float = Field(default=0.0, ge=0, le=10)
    total_deposits: int = Field(default=0, ge=0, description="Total deposits in centimes")


class AddPositionRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=16)
    name: str = Field(default="", max_length=256)
    quantity: float = Field(..., gt=0)
    avg_buy_price: int | None = Field(None, description="Average buy price in centimes")


class ImportCSVRequest(BaseModel):
    broker: str = Field(..., description="degiro, trade_republic, boursorama")


class StockPositionResponse(BaseModel):
    id: UUID
    portfolio_id: UUID
    symbol: str
    name: str
    quantity: float
    avg_buy_price: int | None  # centimes
    current_price: int | None  # centimes
    value: int  # centimes
    pnl: int  # centimes
    pnl_pct: float
    total_dividends: int  # centimes
    sector: str | None
    currency: str
    allocation_pct: float = 0.0
    # Phase B2 fields
    country: str | None = None
    isin: str | None = None
    annual_dividend_yield: float | None = None
    dividend_frequency: str | None = None

    class Config:
        from_attributes = True


class StockPortfolioResponse(BaseModel):
    id: UUID
    label: str
    broker: str
    envelope_type: str | None = "cto"
    positions_count: int = 0
    total_value: int = 0  # centimes
    created_at: datetime

    class Config:
        from_attributes = True


class StockSummaryResponse(BaseModel):
    total_value: int  # centimes
    total_pnl: int
    total_pnl_pct: float
    total_dividends: int
    positions: list[StockPositionResponse]
    portfolios: list[StockPortfolioResponse]


# ── B2.1 Performance vs Benchmark ─────────────────────────

class BenchmarkSeriesPoint(BaseModel):
    date: str
    value: float


class BenchmarkData(BaseModel):
    twr: float
    series: list[BenchmarkSeriesPoint]


class PerformanceResponse(BaseModel):
    portfolio_twr: float
    benchmarks: dict[str, BenchmarkData]
    portfolio_series: list[BenchmarkSeriesPoint]
    alpha: float
    period: str


# ── B2.2 Dividend Calendar ────────────────────────────────

class MonthlyDividend(BaseModel):
    month: int
    amount: int  # centimes


class UpcomingDividend(BaseModel):
    symbol: str
    name: str
    ex_date: str
    pay_date: str | None
    amount_per_share: int  # centimes
    total: int  # centimes


class PositionDividend(BaseModel):
    symbol: str
    name: str
    annual_amount: int  # centimes
    yield_pct: float
    frequency: str
    next_ex_date: str | None


class DividendCalendarResponse(BaseModel):
    year: int
    total_annual_projected: int  # centimes
    portfolio_yield: float
    monthly_breakdown: list[MonthlyDividend]
    upcoming: list[UpcomingDividend]
    by_position: list[PositionDividend]


# ── B2.3 Allocation & Diversification ─────────────────────

class SectorAllocation(BaseModel):
    sector: str
    value: int
    weight_pct: float
    positions_count: int


class CountryAllocation(BaseModel):
    country: str
    value: int
    weight_pct: float
    positions_count: int


class CurrencyAllocation(BaseModel):
    currency: str
    value: int
    weight_pct: float


class TopPosition(BaseModel):
    symbol: str
    name: str
    weight_pct: float


class AllocationAnalysisResponse(BaseModel):
    by_sector: list[SectorAllocation]
    by_country: list[CountryAllocation]
    by_currency: list[CurrencyAllocation]
    hhi_score: int
    diversification_score: int
    diversification_grade: str
    concentration_alerts: list[str]
    suggestions: list[str]
    top_positions: list[TopPosition]


# ── B2.4 Enveloppes Fiscales ──────────────────────────────

class EnvelopeData(BaseModel):
    type: str
    label: str
    total_value: int  # centimes
    total_pnl: int
    total_deposits: int
    positions_count: int
    portfolios: list[str]
    ceiling: int | None
    ceiling_usage_pct: float | None
    management_fee_annual: int | None
    tax_rate: float


class EnvelopeSummaryResponse(BaseModel):
    envelopes: list[EnvelopeData]
    total_value: int
    fiscal_optimization_tips: list[str]
