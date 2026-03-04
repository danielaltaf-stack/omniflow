"""
OmniFlow — Alerts REST API.
POST   /api/v1/alerts              — Create alert
GET    /api/v1/alerts              — List my alerts
GET    /api/v1/alerts/{id}         — Get alert detail
PUT    /api/v1/alerts/{id}         — Update alert
DELETE /api/v1/alerts/{id}         — Delete alert
GET    /api/v1/alerts/history      — Trigger history
POST   /api/v1/alerts/suggestions  — AI suggestions
"""

from __future__ import annotations

import logging
import uuid as uuid_mod
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.alert import UserAlert, AlertHistory
from app.schemas.alert import (
    AlertCreateRequest,
    AlertHistoryResponse,
    AlertResponse,
    AlertSuggestion,
    AlertSuggestionsResponse,
    AlertUpdateRequest,
)

logger = logging.getLogger("omniflow.alerts")

router = APIRouter(prefix="/alerts", tags=["Alerts"])

MAX_ALERTS_PER_USER = 50


# ── Helpers ────────────────────────────────────────────────

def _alert_to_response(alert: UserAlert, trigger_count: int = 0) -> AlertResponse:
    return AlertResponse(
        id=str(alert.id),
        name=alert.name,
        asset_type=alert.asset_type,
        symbol=alert.symbol,
        condition=alert.condition,
        threshold=alert.threshold,
        is_active=alert.is_active,
        cooldown_minutes=alert.cooldown_minutes,
        last_triggered_at=alert.last_triggered_at.isoformat() if alert.last_triggered_at else None,
        notify_in_app=alert.notify_in_app,
        notify_push=alert.notify_push,
        notify_email=alert.notify_email,
        trigger_count=trigger_count,
        created_at=alert.created_at.isoformat() if alert.created_at else "",
        updated_at=alert.updated_at.isoformat() if alert.updated_at else "",
    )


# ── CRUD Endpoints ─────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=AlertResponse)
async def create_alert(
    body: AlertCreateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Create a new price alert."""
    # Check limit
    result = await db.execute(
        select(func.count()).select_from(UserAlert).where(UserAlert.user_id == user.id)
    )
    count = result.scalar() or 0
    if count >= MAX_ALERTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Limite de {MAX_ALERTS_PER_USER} alertes atteinte.",
        )

    alert = UserAlert(
        id=uuid_mod.uuid4(),
        user_id=user.id,
        name=body.name,
        asset_type=body.asset_type,
        symbol=body.symbol.upper(),
        condition=body.condition,
        threshold=body.threshold,
        is_active=True,
        cooldown_minutes=body.cooldown_minutes,
        notify_in_app=body.notify_in_app,
        notify_push=body.notify_push,
        notify_email=body.notify_email,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    logger.info("[alert] Created '%s' for user %s (symbol=%s)", alert.name, user.id, alert.symbol)
    return _alert_to_response(alert)


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    asset_type: str | None = Query(default=None, description="Filter by asset type"),
    is_active: bool | None = Query(default=None, description="Filter by active status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertResponse]:
    """List all alerts for the current user."""
    query = select(UserAlert).where(UserAlert.user_id == user.id)

    if asset_type:
        query = query.where(UserAlert.asset_type == asset_type)
    if is_active is not None:
        query = query.where(UserAlert.is_active == is_active)

    query = query.order_by(desc(UserAlert.created_at)).limit(limit).offset(offset)
    result = await db.execute(query)
    alerts = result.scalars().all()

    # Get trigger counts in batch
    alert_ids = [a.id for a in alerts]
    trigger_counts: dict[UUID, int] = {}
    if alert_ids:
        count_result = await db.execute(
            select(AlertHistory.alert_id, func.count())
            .where(AlertHistory.alert_id.in_(alert_ids))
            .group_by(AlertHistory.alert_id)
        )
        for row in count_result:
            trigger_counts[row[0]] = row[1]

    return [_alert_to_response(a, trigger_counts.get(a.id, 0)) for a in alerts]


@router.get("/history", response_model=list[AlertHistoryResponse])
async def alert_history(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertHistoryResponse]:
    """List alert trigger history for the current user."""
    result = await db.execute(
        select(AlertHistory, UserAlert)
        .join(UserAlert, AlertHistory.alert_id == UserAlert.id)
        .where(AlertHistory.user_id == user.id)
        .order_by(desc(AlertHistory.triggered_at))
        .limit(limit)
        .offset(offset)
    )
    rows = result.all()

    return [
        AlertHistoryResponse(
            id=str(h.id),
            alert_id=str(h.alert_id),
            alert_name=a.name,
            symbol=a.symbol,
            asset_type=a.asset_type,
            condition=a.condition,
            threshold=a.threshold,
            triggered_at=h.triggered_at.isoformat() if h.triggered_at else "",
            price_at_trigger=h.price_at_trigger,
            message=h.message,
        )
        for h, a in rows
    ]


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Get a single alert with its trigger count."""
    result = await db.execute(
        select(UserAlert).where(
            UserAlert.id == UUID(alert_id),
            UserAlert.user_id == user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable.")

    # Count triggers
    count_result = await db.execute(
        select(func.count()).select_from(AlertHistory).where(AlertHistory.alert_id == alert.id)
    )
    trigger_count = count_result.scalar() or 0

    return _alert_to_response(alert, trigger_count)


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: str,
    body: AlertUpdateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Update an alert (name, threshold, channels, active status)."""
    result = await db.execute(
        select(UserAlert).where(
            UserAlert.id == UUID(alert_id),
            UserAlert.user_id == user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable.")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(alert, key, value)

    await db.commit()
    await db.refresh(alert)

    logger.info("[alert] Updated '%s' (id=%s)", alert.name, alert_id)
    return _alert_to_response(alert)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an alert and its history."""
    result = await db.execute(
        select(UserAlert).where(
            UserAlert.id == UUID(alert_id),
            UserAlert.user_id == user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable.")

    await db.delete(alert)
    await db.commit()
    logger.info("[alert] Deleted '%s' (id=%s)", alert.name, alert_id)


@router.post("/suggestions", response_model=AlertSuggestionsResponse)
async def suggest_alerts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertSuggestionsResponse:
    """
    AI-powered alert suggestions based on portfolio analysis.
    Analyzes holdings concentration and proposes protective alerts.
    """
    suggestions: list[AlertSuggestion] = []

    try:
        # Analyze crypto holdings
        from app.models.crypto_holding import CryptoHolding
        from app.models.crypto_wallet import CryptoWallet

        wallet_result = await db.execute(
            select(CryptoWallet).where(CryptoWallet.user_id == user.id)
        )
        wallets = wallet_result.scalars().all()
        wallet_ids = [w.id for w in wallets]

        if wallet_ids:
            hold_result = await db.execute(
                select(CryptoHolding).where(CryptoHolding.wallet_id.in_(wallet_ids))
            )
            holdings = hold_result.scalars().all()

            total_crypto_value = sum(h.current_value_eur or 0 for h in holdings)
            for h in holdings:
                val = h.current_value_eur or 0
                if total_crypto_value > 0 and val / total_crypto_value > 0.30:
                    pct = val / total_crypto_value * 100
                    suggestions.append(AlertSuggestion(
                        name=f"Protection {h.symbol} (-10% 24h)",
                        asset_type="crypto",
                        symbol=h.symbol.upper(),
                        condition="pct_change_24h_below",
                        threshold=10.0,
                        reason=f"{h.symbol} représente {pct:.0f}% de votre portefeuille crypto. "
                               f"Une alerte à -10% protège votre exposition concentrée.",
                    ))

                price = h.current_price_eur or 0
                avg = h.avg_buy_price_eur or 0
                if avg > 0 and price > 0 and price / avg >= 1.5:
                    gain_pct = (price / avg - 1) * 100
                    suggestions.append(AlertSuggestion(
                        name=f"Prise de profit {h.symbol}",
                        asset_type="crypto",
                        symbol=h.symbol.upper(),
                        condition="price_below",
                        threshold=round(price * 0.90, 2),
                        reason=f"{h.symbol} affiche +{gain_pct:.0f}% depuis votre achat. "
                               f"Alerte si le prix redescend sous {price * 0.90:,.0f}€ pour verrouiller les gains.",
                    ))

        # Analyze stock positions
        from app.models.stock_position import StockPosition
        from app.models.stock_portfolio import StockPortfolio

        portfolio_result = await db.execute(
            select(StockPortfolio).where(StockPortfolio.user_id == user.id)
        )
        portfolios = portfolio_result.scalars().all()
        portfolio_ids = [p.id for p in portfolios]

        if portfolio_ids:
            pos_result = await db.execute(
                select(StockPosition).where(StockPosition.portfolio_id.in_(portfolio_ids))
            )
            positions = pos_result.scalars().all()

            total_stock_value = sum(p.current_value or 0 for p in positions)
            for p in positions:
                val = p.current_value or 0
                if total_stock_value > 0 and val / total_stock_value > 0.30:
                    pct = val / total_stock_value * 100
                    suggestions.append(AlertSuggestion(
                        name=f"Concentration {p.symbol} (-10%)",
                        asset_type="stock",
                        symbol=p.symbol.upper(),
                        condition="pct_change_24h_below",
                        threshold=10.0,
                        reason=f"{p.symbol} représente {pct:.0f}% de votre portefeuille actions. "
                               f"Alerte si baisse de -10% en 24h.",
                    ))

        # Suggest major index alert if user has stocks
        if portfolio_ids:
            suggestions.append(AlertSuggestion(
                name="CAC 40 sous 7000 points",
                asset_type="index",
                symbol="^FCHI",
                condition="price_below",
                threshold=7000.0,
                reason="Surveillez le CAC 40 : une chute sous 7000 signalerait un marché baissier.",
            ))

    except Exception as e:
        logger.error("[alert] Suggestion generation error: %s", e)

    # Always add at least one generic suggestion if empty
    if not suggestions:
        suggestions.append(AlertSuggestion(
            name="Bitcoin au-dessus de $100,000",
            asset_type="crypto",
            symbol="BTC",
            condition="price_above",
            threshold=100000.0,
            reason="Soyez alerté quand Bitcoin franchit la barre symbolique des $100,000.",
        ))

    return AlertSuggestionsResponse(suggestions=suggestions[:5])
