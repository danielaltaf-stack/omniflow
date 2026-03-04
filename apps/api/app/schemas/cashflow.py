"""
OmniFlow — Pydantic schemas for cash flow, currency, and cross-asset projection (B5).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Existing schemas (bank-only cashflow) ─────────────────


class CashFlowPeriod(BaseModel):
    date: str | None
    income: int  # centimes
    expenses: int  # centimes
    net: int
    savings_rate: float
    tx_count: int


class CashFlowSummary(BaseModel):
    total_income: int
    total_expenses: int
    total_net: int
    avg_income: int
    avg_expenses: int
    avg_net: int
    avg_savings_rate: float
    periods_count: int


class CashFlowTrends(BaseModel):
    income_ma: list[int]
    expense_ma: list[int]
    income_trend: str
    expense_trend: str
    income_change_pct: float
    expense_change_pct: float


class TopCategoryExpense(BaseModel):
    category: str
    count: int
    total: int  # centimes
    percentage: float


class CashFlowResponse(BaseModel):
    periods: list[CashFlowPeriod]
    summary: CashFlowSummary
    trends: CashFlowTrends
    top_categories: list[TopCategoryExpense]


class ExchangeRatesResponse(BaseModel):
    base: str = "EUR"
    rates: dict[str, float]


class CurrencyConvertRequest(BaseModel):
    amount_centimes: int = Field(..., description="Amount in centimes to convert")
    from_currency: str = Field(..., min_length=3, max_length=3)
    to_currency: str = Field(..., min_length=3, max_length=3)


class CurrencyConvertResponse(BaseModel):
    original: int
    converted: int
    from_currency: str
    to_currency: str
    rate: float


# ── Phase B5: Cross-Asset Projection schemas ─────────────


class CashFlowSource(BaseModel):
    """A single income or expense source detected from any asset class."""
    source_type: str  # salary, rent, dividends, staking, interest, debt_payment, etc.
    label: str
    amount_monthly: int  # centimes
    details: dict = Field(default_factory=dict)


class MonthlyProjection(BaseModel):
    """Single month in the 12-month projection calendar."""
    month: str  # "YYYY-MM"
    date: str  # ISO date of month start
    income: int  # centimes
    expenses: int  # centimes
    net: int  # centimes
    cumulative: int  # centimes — running treasury balance
    income_breakdown: dict[str, int] = Field(default_factory=dict)  # source_type → centimes
    expense_breakdown: dict[str, int] = Field(default_factory=dict)
    alerts: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class AnnualSummary(BaseModel):
    """Aggregate stats over the projection horizon."""
    total_income: int
    total_expenses: int
    total_net: int
    passive_income: int  # rent + dividends + staking + interest
    passive_income_ratio: float  # % of total income
    months_deficit: int  # number of months net < 0
    largest_surplus: int
    largest_surplus_month: str | None


class DeficitAlert(BaseModel):
    """Alert for a month where cumulative balance goes negative."""
    month: str
    shortfall: int  # centimes (positive = amount needed)
    main_cause: str
    recommendation: str


class SurplusSuggestion(BaseModel):
    """Suggestion for a month with high surplus."""
    month: str
    surplus: int  # centimes
    suggestion_type: str  # invest, save, etc.
    message: str


class HealthScoreComponent(BaseModel):
    """One component of the composite health score."""
    score: int
    max: int = 25
    label: str
    value: float | None = None
    target: float | None = None


class CashFlowHealthScore(BaseModel):
    """Composite cash-flow health score (0-100)."""
    score: int
    max_score: int = 100
    components: dict[str, HealthScoreComponent]
    grade: str  # A+, A, B+, B, C, D, F


class CrossAssetProjectionResponse(BaseModel):
    """Full cross-asset cash-flow projection response."""
    monthly_projection: list[MonthlyProjection]
    annual_summary: AnnualSummary
    deficit_alerts: list[DeficitAlert]
    surplus_suggestions: list[SurplusSuggestion]
    health_score: CashFlowHealthScore
    income_sources: list[CashFlowSource]
    expense_sources: list[CashFlowSource]


class SourcesResponse(BaseModel):
    """Standalone income/expense sources listing."""
    income_sources: list[CashFlowSource]
    expense_sources: list[CashFlowSource]
    total_monthly_income: int
    total_monthly_expenses: int
    net_monthly: int
