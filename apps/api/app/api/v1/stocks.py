"""
OmniFlow — Stock API endpoints.
Portfolios, positions, CSV import, price refresh.
Phase B2: Performance, Dividends, Allocation, Envelopes.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.stock import (
    AddPositionRequest,
    AllocationAnalysisResponse,
    CreatePortfolioRequest,
    DividendCalendarResponse,
    EnvelopeSummaryResponse,
    PerformanceResponse,
    StockSummaryResponse,
)
from app.services import stock_service, stock_analytics

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("", response_model=StockSummaryResponse)
async def get_stock_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated stock portfolio — all portfolios, positions, P&L."""
    summary = await stock_service.get_portfolio_summary(db, user.id)
    return summary


@router.get("/portfolios")
async def get_portfolios(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all stock portfolios."""
    portfolios = await stock_service.get_user_portfolios(db, user.id)
    return [
        {
            "id": str(p.id),
            "label": p.label,
            "broker": p.broker.value if hasattr(p.broker, "value") else str(p.broker),
            "positions_count": len(p.positions) if p.positions else 0,
            "total_value": sum(pos.value or 0 for pos in (p.positions or [])),
            "created_at": p.created_at.isoformat(),
        }
        for p in portfolios
    ]


@router.post("/portfolios", status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    body: CreatePortfolioRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new stock portfolio with envelope type."""
    portfolio = await stock_service.create_portfolio(
        db=db,
        user_id=user.id,
        label=body.label,
        broker=body.broker,
        envelope_type=body.envelope_type,
        management_fee_pct=body.management_fee_pct,
        total_deposits=body.total_deposits,
    )
    return {
        "id": str(portfolio.id),
        "label": portfolio.label,
        "broker": portfolio.broker.value if hasattr(portfolio.broker, "value") else str(portfolio.broker),
        "envelope_type": portfolio.envelope_type or "cto",
    }


@router.post("/portfolios/{portfolio_id}/positions", status_code=status.HTTP_201_CREATED)
async def add_position(
    portfolio_id: UUID,
    body: AddPositionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a stock position to a portfolio."""
    try:
        position = await stock_service.add_position(
            db=db,
            portfolio_id=portfolio_id,
            user_id=user.id,
            symbol=body.symbol,
            name=body.name,
            quantity=body.quantity,
            avg_buy_price=body.avg_buy_price,
        )
        return {
            "id": str(position.id),
            "symbol": position.symbol,
            "name": position.name,
            "value": position.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portfolios/{portfolio_id}/import")
async def import_csv(
    portfolio_id: UUID,
    broker: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Import positions from a CSV file (Degiro, Trade Republic, Boursorama).
    Replaces existing positions in the portfolio.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Fichier CSV requis.")

    content = await file.read()
    csv_text = content.decode("utf-8-sig")  # Handle BOM

    try:
        count = await stock_service.import_csv(
            db=db,
            portfolio_id=portfolio_id,
            user_id=user.id,
            broker=broker,
            csv_content=csv_text,
        )
        return {"status": "ok", "positions_imported": count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portfolios/{portfolio_id}/refresh")
async def refresh_prices(
    portfolio_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Refresh all position prices in a portfolio from Yahoo Finance."""
    portfolios = await stock_service.get_user_portfolios(db, user.id)
    if not any(p.id == portfolio_id for p in portfolios):
        raise HTTPException(status_code=404, detail="Portfolio non trouvé.")

    count = await stock_service.refresh_portfolio_prices(db, portfolio_id)
    return {"status": "ok", "positions_updated": count}


@router.delete("/portfolios/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(
    portfolio_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a portfolio and all its positions."""
    deleted = await stock_service.delete_portfolio(db, portfolio_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Portfolio non trouvé.")


@router.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """Get a real-time stock quote from Yahoo Finance."""
    quote = await stock_service.get_stock_quote(symbol)
    if not quote:
        raise HTTPException(status_code=404, detail=f"Aucune cotation trouvée pour {symbol}.")
    return quote


# ══════════════════════════════════════════════════════════════
# Phase B2 — Analytics Endpoints
# ══════════════════════════════════════════════════════════════

@router.get("/performance", response_model=PerformanceResponse)
async def get_performance(
    period: str = Query("1Y", description="1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, MAX"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    B2.1 — Performance vs Benchmark.
    Compare portfolio TWR against S&P 500, CAC 40, MSCI World.
    """
    data = await stock_analytics.get_performance_vs_benchmark(db, user.id, period)
    return data


@router.get("/dividends", response_model=DividendCalendarResponse)
async def get_dividends(
    year: int | None = Query(None, description="Year for dividend calendar (default: current)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    B2.2 — Dividend Calendar.
    Monthly breakdown, upcoming dividends, projected annual yield.
    """
    data = await stock_analytics.get_dividend_calendar(db, user.id, year)
    return data


@router.get("/allocation", response_model=AllocationAnalysisResponse)
async def get_allocation(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    B2.3 — Allocation & Diversification Analysis.
    Sector, country, currency breakdown + HHI score + suggestions.
    """
    data = await stock_analytics.get_allocation_analysis(db, user.id)
    return data


@router.get("/envelopes", response_model=EnvelopeSummaryResponse)
async def get_envelopes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    B2.4 — Enveloppes Fiscales.
    PEA / CTO / Assurance-Vie breakdown, ceiling tracking, fiscal tips.
    """
    data = await stock_analytics.get_envelope_summary(db, user.id)
    return data
