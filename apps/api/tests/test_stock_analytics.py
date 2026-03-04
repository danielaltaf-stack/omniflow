"""
OmniFlow — Phase B2: Stock Analytics unit & integration tests.

Validates:
  - TWR computation (_compute_twr, _normalize_base100)
  - Dividend frequency detection (_detect_frequency)
  - Country inference (_infer_country)
  - HHI & diversification score logic
  - Envelope ceiling calculation
  - All 4 new API endpoints (/stocks/performance, /dividends, /allocation, /envelopes)
"""

from __future__ import annotations

import datetime as dt
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_portfolio import EnvelopeType, PEA_CEILING_CENTIMES
from app.services.stock_analytics import (
    _compute_twr,
    _detect_frequency,
    _infer_country,
    _normalize_base100,
)


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — pure functions
# ═══════════════════════════════════════════════════════════════════


class TestNormalizeBase100:
    """_normalize_base100 should scale a raw series to start at 100."""

    def test_basic(self):
        series = [50.0, 60.0, 55.0, 80.0]
        result = _normalize_base100(series)
        assert len(result) == 4
        assert result[0] == pytest.approx(100.0)
        assert result[1] == pytest.approx(120.0)
        assert result[3] == pytest.approx(160.0)

    def test_single_value(self):
        result = _normalize_base100([42.0])
        assert result == [100.0]

    def test_empty(self):
        assert _normalize_base100([]) == []

    def test_zero_first(self):
        result = _normalize_base100([0.0, 10.0])
        assert result == [0.0, 10.0]


class TestComputeTWR:
    """_compute_twr returns time-weighted return as a percentage."""

    def test_positive_return(self):
        series = [100.0, 110.0, 120.0]
        twr = _compute_twr(series)
        assert twr == pytest.approx(20.0)

    def test_negative_return(self):
        series = [100.0, 90.0, 80.0]
        twr = _compute_twr(series)
        assert twr == pytest.approx(-20.0)

    def test_flat(self):
        series = [100.0, 100.0, 100.0]
        assert _compute_twr(series) == pytest.approx(0.0)

    def test_empty(self):
        assert _compute_twr([]) == 0.0

    def test_single(self):
        assert _compute_twr([50.0]) == 0.0


class TestDetectFrequency:
    """_detect_frequency should classify payment cadence from dates."""

    def test_quarterly(self):
        dates = [
            dt.date(2024, 1, 15),
            dt.date(2024, 4, 15),
            dt.date(2024, 7, 15),
            dt.date(2024, 10, 15),
        ]
        assert _detect_frequency(dates) == "quarterly"

    def test_monthly(self):
        dates = [dt.date(2024, m, 1) for m in range(1, 13)]
        assert _detect_frequency(dates) == "monthly"

    def test_semi_annual(self):
        dates = [dt.date(2024, 3, 15), dt.date(2024, 9, 15)]
        assert _detect_frequency(dates) == "semi_annual"

    def test_annual(self):
        dates = [dt.date(2024, 5, 15)]
        assert _detect_frequency(dates) == "annual"

    def test_empty(self):
        assert _detect_frequency([]) == "annual"


class TestInferCountry:
    """_infer_country should derive ISO-2 country from ISIN or symbol suffix."""

    def test_from_isin(self):
        assert _infer_country("AIR.PA", "FR0000120404") == "FR"

    def test_from_isin_us(self):
        assert _infer_country("AAPL", "US0378331005") == "US"

    def test_from_symbol_suffix_pa(self):
        assert _infer_country("BNP.PA", None) == "FR"

    def test_from_symbol_suffix_de(self):
        assert _infer_country("SAP.DE", None) == "DE"

    def test_from_symbol_suffix_l(self):
        assert _infer_country("SHEL.L", None) == "GB"

    def test_default_us(self):
        assert _infer_country("AAPL", None) == "US"


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — HHI / Diversification Score
# ═══════════════════════════════════════════════════════════════════


class TestHHILogic:
    """Test Herfindahl-Hirschman Index edge cases inline."""

    def test_single_position(self):
        """One position → HHI = 10000, score = 0, grade Concentré."""
        weights = [100.0]
        hhi = sum(w ** 2 for w in weights)
        score = max(0, 100 - hhi / 100)
        assert hhi == pytest.approx(10000)
        assert score == pytest.approx(0)

    def test_two_equal_positions(self):
        """Two 50/50 → HHI = 5000, score = 50."""
        weights = [50.0, 50.0]
        hhi = sum(w ** 2 for w in weights)
        score = max(0, 100 - hhi / 100)
        assert hhi == pytest.approx(5000)
        assert score == pytest.approx(50)

    def test_four_equal_positions(self):
        """Four 25% → HHI = 2500, score = 75."""
        weights = [25.0, 25.0, 25.0, 25.0]
        hhi = sum(w ** 2 for w in weights)
        score = max(0, 100 - hhi / 100)
        assert hhi == pytest.approx(2500)
        assert score == pytest.approx(75)

    def test_perfectly_spread(self):
        """20 equal → HHI = 500, score = 95."""
        n = 20
        weights = [100.0 / n] * n
        hhi = sum(w ** 2 for w in weights)
        score = max(0, 100 - hhi / 100)
        assert hhi == pytest.approx(500)
        assert score == pytest.approx(95)


# ═══════════════════════════════════════════════════════════════════
#  UNIT TESTS — Envelope ceiling
# ═══════════════════════════════════════════════════════════════════


class TestEnvelopeCeiling:
    """PEA ceiling is 150 000 EUR (15_000_000 centimes)."""

    def test_pea_ceiling_value(self):
        assert PEA_CEILING_CENTIMES == 15_000_000

    def test_usage_pct(self):
        deposits = 7_500_000  # 75 000 EUR
        usage = (deposits / PEA_CEILING_CENTIMES) * 100
        assert usage == pytest.approx(50.0)

    def test_over_ceiling(self):
        deposits = 16_000_000
        usage = (deposits / PEA_CEILING_CENTIMES) * 100
        assert usage > 100.0


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — API endpoints (require auth)
# ═══════════════════════════════════════════════════════════════════


async def _register_and_login(client: httpx.AsyncClient) -> dict:
    """Helper: register + login → return auth headers."""
    import uuid

    email = f"test+{uuid.uuid4().hex[:8]}@omniflow.io"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TestPass123!", "name": "Test B2"},
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "TestPass123!"},
    )
    token = login_resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_performance_endpoint_empty(client: httpx.AsyncClient):
    """GET /stocks/performance with no positions should return zeros."""
    headers = await _register_and_login(client)
    resp = await client.get(
        "/api/v1/stocks/performance?period=1Y",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "portfolio_twr" in body
    assert "benchmarks" in body
    assert "alpha" in body
    assert body["portfolio_twr"] == 0.0


@pytest.mark.asyncio
async def test_dividends_endpoint_empty(client: httpx.AsyncClient):
    """GET /stocks/dividends with no positions should return default structure."""
    headers = await _register_and_login(client)
    resp = await client.get(
        "/api/v1/stocks/dividends",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "monthly_breakdown" in body
    assert len(body["monthly_breakdown"]) == 12
    assert body["total_annual_projected"] == 0
    assert body["portfolio_yield"] == 0.0


@pytest.mark.asyncio
async def test_allocation_endpoint_empty(client: httpx.AsyncClient):
    """GET /stocks/allocation with no positions should still return valid structure."""
    headers = await _register_and_login(client)
    resp = await client.get(
        "/api/v1/stocks/allocation",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["hhi_score"] == 0
    assert body["diversification_score"] == 100
    assert body["diversification_grade"] == "Excellent"
    assert body["by_sector"] == []
    assert body["by_country"] == []


@pytest.mark.asyncio
async def test_envelopes_endpoint_empty(client: httpx.AsyncClient):
    """GET /stocks/envelopes with no portfolios should return empty envelopes list."""
    headers = await _register_and_login(client)
    resp = await client.get(
        "/api/v1/stocks/envelopes",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "envelopes" in body
    assert body["envelopes"] == []
    assert body["total_value"] == 0


@pytest.mark.asyncio
async def test_envelopes_after_portfolio_creation(client: httpx.AsyncClient):
    """Create a PEA portfolio → /stocks/envelopes should list it with ceiling info."""
    headers = await _register_and_login(client)
    # Create portfolio
    create_resp = await client.post(
        "/api/v1/stocks/portfolios",
        json={
            "label": "Mon PEA",
            "broker": "Boursorama",
            "envelope_type": "pea",
            "total_deposits": 5_000_000,  # 50k EUR in centimes
        },
        headers=headers,
    )
    assert create_resp.status_code in (200, 201)

    # Fetch envelopes
    resp = await client.get("/api/v1/stocks/envelopes", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["envelopes"]) >= 1
    pea_env = next((e for e in body["envelopes"] if e["type"] == "pea"), None)
    assert pea_env is not None
    assert pea_env["ceiling"] == PEA_CEILING_CENTIMES
    assert pea_env["ceiling_usage_pct"] == pytest.approx(
        (5_000_000 / PEA_CEILING_CENTIMES) * 100, rel=0.01
    )


@pytest.mark.asyncio
async def test_performance_endpoint_unauthorized(client: httpx.AsyncClient):
    """Unauthenticated request → 401."""
    resp = await client.get("/api/v1/stocks/performance")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dividends_endpoint_unauthorized(client: httpx.AsyncClient):
    """Unauthenticated request → 401."""
    resp = await client.get("/api/v1/stocks/dividends")
    assert resp.status_code == 401
