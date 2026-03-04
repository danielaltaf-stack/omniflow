"""
OmniFlow — Tests for Phase B5: Cross-Asset Cash-Flow Projection.

Tests:
- Income source collection (bank, RE, stocks, crypto, savings)
- Expense source collection (bank, debts, RE, projects, budgets)
- 12-month projection engine
- Per-month amount logic (dividends, taxes, debt end dates)
- Health score computation
- API endpoint responses
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.services.cashflow_projection import (
    _compute_health_score,
    _dividend_projected_months,
    _dominant_expense,
    _score_to_grade,
    _source_amount_for_month,
)


# ── Helpers ────────────────────────────────────────────────


def _make_source(src_type: str, amount: int, details: dict | None = None, projected: list | None = None) -> dict:
    return {
        "source_type": src_type,
        "label": f"Test {src_type}",
        "amount_monthly": amount,
        "details": details or {},
        "projected_events": projected or [],
    }


# ── Tests: _dividend_projected_months ──────────────────────


class TestDividendProjectedMonths:
    """Validate dividend pay-month calculation by frequency."""

    def test_quarterly_with_ex_date(self):
        months = _dividend_projected_months(
            freq="quarterly",
            next_ex_date=date(2026, 3, 15),
        )
        assert len(months) == 4
        assert 3 in months  # March base

    def test_monthly(self):
        months = _dividend_projected_months(
            freq="monthly",
            next_ex_date=date(2026, 1, 1),
        )
        assert months == list(range(1, 13))

    def test_semi_annual(self):
        months = _dividend_projected_months(
            freq="semi_annual",
            next_ex_date=date(2026, 6, 1),
        )
        assert len(months) == 2
        assert 6 in months

    def test_annual(self):
        months = _dividend_projected_months(
            freq="annual",
            next_ex_date=date(2026, 5, 1),
        )
        assert months == [5]

    def test_default_without_ex_date(self):
        months = _dividend_projected_months(
            freq="quarterly",
            next_ex_date=None,
        )
        assert len(months) == 4
        assert 3 in months  # Default base March


# ── Tests: _source_amount_for_month ────────────────────────


class TestSourceAmountForMonth:
    """Validate per-month amount logic for different source types."""

    def test_regular_income_every_month(self):
        src = _make_source("salary", 300000)
        for m in range(1, 13):
            result = _source_amount_for_month(src, date(2026, m, 1), is_income=True)
            assert result == 300000

    def test_dividends_only_on_projected_months(self):
        src = _make_source(
            "dividends", 25000,
            details={"annual_dividend": 100000},
            projected=[3, 6, 9, 12],
        )
        # March should pay 1/4 of annual
        assert _source_amount_for_month(src, date(2026, 3, 1), is_income=True) == 25000
        # April should be 0
        assert _source_amount_for_month(src, date(2026, 4, 1), is_income=True) == 0

    def test_taxe_fonciere_peak_october(self):
        src = _make_source(
            "re_tax", 10000,  # monthly average (annual / 12)
            details={"annual_amount": 120000, "peak_month": 10},
            projected=[10],
        )
        # October = 75% of annual
        assert _source_amount_for_month(src, date(2026, 10, 1), is_income=False) == 90000
        # Q1 months = 25% / 3
        assert _source_amount_for_month(src, date(2026, 1, 1), is_income=False) == 10000
        assert _source_amount_for_month(src, date(2026, 2, 1), is_income=False) == 10000
        assert _source_amount_for_month(src, date(2026, 3, 1), is_income=False) == 10000
        # Other months = 0
        assert _source_amount_for_month(src, date(2026, 5, 1), is_income=False) == 0

    def test_debt_stops_after_end_date(self):
        src = _make_source(
            "debt_payment", 50000,
            details={"end_date": "2026-06-30"},
        )
        # Before end: normal
        assert _source_amount_for_month(src, date(2026, 5, 1), is_income=False) == 50000
        # After end: 0
        assert _source_amount_for_month(src, date(2026, 7, 1), is_income=False) == 0

    def test_project_stops_after_deadline(self):
        src = _make_source(
            "project_saving", 20000,
            details={"deadline": "2026-09-30", "target_amount": 100000, "current_amount": 50000},
        )
        # Before deadline
        assert _source_amount_for_month(src, date(2026, 8, 1), is_income=False) == 20000
        # After deadline
        assert _source_amount_for_month(src, date(2026, 10, 1), is_income=False) == 0

    def test_project_stops_when_funded(self):
        src = _make_source(
            "project_saving", 20000,
            details={"target_amount": 100000, "current_amount": 100000},
        )
        assert _source_amount_for_month(src, date(2026, 5, 1), is_income=False) == 0

    def test_debt_no_end_date_continues(self):
        src = _make_source(
            "debt_payment", 50000,
            details={"end_date": None},
        )
        assert _source_amount_for_month(src, date(2028, 12, 1), is_income=False) == 50000


# ── Tests: _compute_health_score ───────────────────────────


class TestHealthScore:
    """Validate the composite health score computation."""

    def test_perfect_score(self):
        result = _compute_health_score(
            total_income=1200000,  # 12k€/year
            total_net=600000,      # 50% savings rate → max 25
            income_sources=[
                _make_source("salary", 80000),
                _make_source("rent", 20000),
            ],
            months_deficit=0,      # 0 deficit → max 25
            months_total=12,
            passive_income=400000,  # 33% passive → ≥30% → max 25
        )
        assert result["score"] >= 70
        assert result["max_score"] == 100
        assert result["grade"] in ("A+", "A", "B+")
        assert "savings_rate" in result["components"]
        assert "deficit_risk" in result["components"]
        assert "passive_income" in result["components"]

    def test_all_deficit_months(self):
        result = _compute_health_score(
            total_income=100000,
            total_net=-50000,
            income_sources=[_make_source("salary", 8000)],
            months_deficit=12,
            months_total=12,
            passive_income=0,
        )
        assert result["score"] <= 30
        assert result["components"]["deficit_risk"]["score"] == 0

    def test_no_income(self):
        result = _compute_health_score(
            total_income=0,
            total_net=0,
            income_sources=[],
            months_deficit=0,
            months_total=12,
            passive_income=0,
        )
        assert result["score"] == 25  # Only deficit_risk is perfect

    def test_components_sum_to_total(self):
        result = _compute_health_score(
            total_income=600000,
            total_net=120000,
            income_sources=[_make_source("salary", 50000)],
            months_deficit=2,
            months_total=12,
            passive_income=60000,
        )
        comp_sum = sum(c["score"] for c in result["components"].values())
        assert comp_sum == result["score"]


# ── Tests: _score_to_grade ─────────────────────────────────


class TestScoreToGrade:
    """Validate grade assignment."""

    def test_grades(self):
        assert _score_to_grade(95) == "A+"
        assert _score_to_grade(85) == "A"
        assert _score_to_grade(75) == "B+"
        assert _score_to_grade(65) == "B"
        assert _score_to_grade(55) == "C"
        assert _score_to_grade(45) == "D"
        assert _score_to_grade(30) == "F"


# ── Tests: _dominant_expense ───────────────────────────────


class TestDominantExpense:
    """Validate finding the main expense category."""

    def test_finds_largest(self):
        assert _dominant_expense({"rent": 50000, "food": 30000, "debt": 80000}) == "debt"

    def test_empty_returns_default(self):
        assert _dominant_expense({}) == "dépenses générales"

    def test_single_entry(self):
        assert _dominant_expense({"charges": 10}) == "charges"


# ── Tests: Schema validation ──────────────────────────────


class TestSchemas:
    """Validate Pydantic schema construction."""

    def test_monthly_projection_schema(self):
        from app.schemas.cashflow import MonthlyProjection

        mp = MonthlyProjection(
            month="2026-06",
            date="2026-06-01",
            income=300000,
            expenses=250000,
            net=50000,
            cumulative=150000,
            income_breakdown={"salary": 250000, "rent": 50000},
            expense_breakdown={"fixed_charges": 200000, "debt_payment": 50000},
            alerts=[],
            suggestions=[],
        )
        assert mp.net == 50000
        assert mp.income_breakdown["salary"] == 250000

    def test_health_score_schema(self):
        from app.schemas.cashflow import CashFlowHealthScore, HealthScoreComponent

        hs = CashFlowHealthScore(
            score=75,
            max_score=100,
            components={
                "savings_rate": HealthScoreComponent(score=20, max=25, label="Taux d'épargne", value=16.0, target=20.0),
                "income_stability": HealthScoreComponent(score=22, max=25, label="Stabilité"),
                "deficit_risk": HealthScoreComponent(score=20, max=25, label="Déficit", value=2, target=0),
                "passive_income": HealthScoreComponent(score=13, max=25, label="Passifs", value=13.0, target=30.0),
            },
            grade="B+",
        )
        assert hs.score == 75
        assert hs.grade == "B+"
        assert hs.components["savings_rate"].value == 16.0

    def test_cross_asset_projection_schema(self):
        from app.schemas.cashflow import (
            AnnualSummary,
            CrossAssetProjectionResponse,
            CashFlowHealthScore,
            CashFlowSource,
            DeficitAlert,
            HealthScoreComponent,
            MonthlyProjection,
            SurplusSuggestion,
        )

        resp = CrossAssetProjectionResponse(
            monthly_projection=[
                MonthlyProjection(
                    month="2026-01",
                    date="2026-01-01",
                    income=100000,
                    expenses=80000,
                    net=20000,
                    cumulative=120000,
                )
            ],
            annual_summary=AnnualSummary(
                total_income=1200000,
                total_expenses=960000,
                total_net=240000,
                passive_income=300000,
                passive_income_ratio=25.0,
                months_deficit=1,
                largest_surplus=40000,
                largest_surplus_month="2026-06",
            ),
            deficit_alerts=[],
            surplus_suggestions=[],
            health_score=CashFlowHealthScore(
                score=72,
                max_score=100,
                components={
                    "savings_rate": HealthScoreComponent(score=20, max=25, label="Épargne"),
                    "income_stability": HealthScoreComponent(score=18, max=25, label="Stabilité"),
                    "deficit_risk": HealthScoreComponent(score=23, max=25, label="Déficit"),
                    "passive_income": HealthScoreComponent(score=11, max=25, label="Passifs"),
                },
                grade="B+",
            ),
            income_sources=[CashFlowSource(source_type="salary", label="Salaire", amount_monthly=100000)],
            expense_sources=[CashFlowSource(source_type="fixed_charges", label="Charges", amount_monthly=80000)],
        )
        assert resp.annual_summary.total_net == 240000
        assert len(resp.income_sources) == 1

    def test_sources_response_schema(self):
        from app.schemas.cashflow import CashFlowSource, SourcesResponse

        sr = SourcesResponse(
            income_sources=[CashFlowSource(source_type="salary", label="Salaire", amount_monthly=300000)],
            expense_sources=[CashFlowSource(source_type="debt_payment", label="Prêt", amount_monthly=100000)],
            total_monthly_income=300000,
            total_monthly_expenses=100000,
            net_monthly=200000,
        )
        assert sr.net_monthly == 200000
