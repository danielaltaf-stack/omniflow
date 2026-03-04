"""
OmniFlow — Crypto API endpoints.
CRUD wallets, sync, portfolio overview, sparklines.
Phase B4: tax engine, transactions, staking, multi-chain.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.crypto import (
    CreateCryptoWalletRequest,
    CreateTransactionRequest,
    CryptoPortfolioResponse,
    CryptoSparklineResponse,
    CryptoWalletResponse,
    PMPAResponse,
    StakingSummaryResponse,
    SupportedChainResponse,
    TaxSummaryResponse,
    TransactionListResponse,
    TransactionResponse,
)
from app.services import crypto_service, coingecko
from app.services import crypto_tax_engine
from app.services.multichain_client import get_supported_chains

router = APIRouter(prefix="/crypto", tags=["crypto"])


# ── Portfolio ──────────────────────────────────────────

@router.get("", response_model=CryptoPortfolioResponse)
async def get_crypto_portfolio(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated crypto portfolio — all wallets, holdings, P&L."""
    summary = await crypto_service.get_portfolio_summary(db, user.id)
    return summary


# ── Wallets ────────────────────────────────────────────

@router.get("/wallets")
async def get_wallets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all crypto wallets."""
    wallets = await crypto_service.get_user_wallets(db, user.id)
    return [
        {
            "id": str(w.id),
            "platform": w.platform.value if hasattr(w.platform, "value") else str(w.platform),
            "label": w.label,
            "chain": getattr(w, "chain", "ethereum") or "ethereum",
            "status": w.status.value if hasattr(w.status, "value") else str(w.status),
            "last_sync_at": w.last_sync_at.isoformat() if w.last_sync_at else None,
            "sync_error": w.sync_error,
            "holdings_count": len(w.holdings) if w.holdings else 0,
            "total_value": sum(h.value or 0 for h in (w.holdings or [])),
            "created_at": w.created_at.isoformat(),
        }
        for w in wallets
    ]


@router.post("/wallets", status_code=status.HTTP_201_CREATED)
async def create_wallet(
    body: CreateCryptoWalletRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new crypto wallet connection.
    - Binance: requires api_key + api_secret (read-only permissions)
    - Kraken: requires api_key + api_secret (read-only)
    - Etherscan: requires public address
    - Polygon/Arbitrum/Optimism/BSC: requires public address (B4)
    """
    try:
        wallet = await crypto_service.create_wallet(
            db=db,
            user_id=user.id,
            platform=body.platform,
            label=body.label,
            api_key=body.api_key,
            api_secret=body.api_secret,
            address=body.address,
            chain=body.chain,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connexion impossible : {e}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erreur lors de la connexion à {body.platform} : {type(e).__name__} — {str(e)[:300]}",
        )

    return {
        "id": str(wallet.id),
        "platform": wallet.platform.value if hasattr(wallet.platform, "value") else str(wallet.platform),
        "label": wallet.label,
        "chain": getattr(wallet, "chain", "ethereum") or "ethereum",
        "status": "active",
        "message": "Wallet créé et synchronisé avec succès.",
    }


@router.post("/wallets/{wallet_id}/sync")
async def sync_wallet(
    wallet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a sync for a specific wallet."""
    wallets = await crypto_service.get_user_wallets(db, user.id)
    wallet = next((w for w in wallets if w.id == wallet_id), None)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet non trouvé.")

    try:
        count = await crypto_service.sync_wallet(db, wallet)
        return {"status": "ok", "holdings_synced": count}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Erreur lors de la sync : {type(e).__name__} — {str(e)[:300]}",
        )


@router.delete("/wallets/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wallet(
    wallet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a crypto wallet and all its holdings."""
    deleted = await crypto_service.delete_wallet(db, wallet_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Wallet non trouvé.")


# ── Sparkline / Prices / Search ────────────────────────

@router.get("/sparkline/{symbol}")
async def get_sparkline(
    symbol: str,
    days: int = 7,
):
    """Get sparkline price data for a token (7d default)."""
    prices = await coingecko.get_sparkline(symbol, days=days)
    return {"symbol": symbol.upper(), "prices": prices, "days": days}


@router.get("/prices")
async def get_prices(symbols: str):
    """
    Get current prices for tokens.
    Query: ?symbols=BTC,ETH,SOL
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="Fournissez au moins un symbole.")
    prices = await coingecko.get_prices(symbol_list)
    return prices


@router.get("/search")
async def search_tokens(q: str):
    """Search tokens by name or symbol."""
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Requête trop courte (min 2 caractères).")
    results = await coingecko.search_token(q)
    return results


# ── B4: Transactions ──────────────────────────────────

@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: CreateTransactionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a manual crypto transaction (buy/sell/swap/staking_reward…)."""
    try:
        tx = await crypto_tax_engine.add_transaction(
            db=db,
            user_id=user.id,
            wallet_id=body.wallet_id,
            data={
                "tx_type": body.tx_type,
                "token_symbol": body.token_symbol.upper(),
                "quantity": body.quantity,
                "price_eur": body.price_eur,
                "fee_eur": body.fee_eur,
                "counterpart": body.counterpart,
                "tx_hash": body.tx_hash,
                "executed_at": body.executed_at,
            },
        )
        return TransactionResponse(
            id=tx.id,
            wallet_id=tx.wallet_id,
            tx_type=tx.tx_type,
            token_symbol=tx.token_symbol,
            quantity=float(tx.quantity),
            price_eur=tx.price_eur,
            total_eur=tx.total_eur,
            fee_eur=tx.fee_eur,
            counterpart=tx.counterpart,
            tx_hash=tx.tx_hash,
            executed_at=tx.executed_at,
            source=tx.source,
            created_at=tx.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    wallet_id: UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List crypto transactions (optionally filtered by wallet)."""
    result = await crypto_tax_engine.list_transactions(
        db=db,
        user_id=user.id,
        wallet_id=wallet_id,
        limit=limit,
        offset=offset,
    )
    txs = []
    for tx in result["transactions"]:
        txs.append(TransactionResponse(
            id=tx.id,
            wallet_id=tx.wallet_id,
            tx_type=tx.tx_type,
            token_symbol=tx.token_symbol,
            quantity=float(tx.quantity),
            price_eur=tx.price_eur,
            total_eur=tx.total_eur,
            fee_eur=tx.fee_eur,
            counterpart=tx.counterpart,
            tx_hash=tx.tx_hash,
            executed_at=tx.executed_at,
            source=tx.source,
            created_at=tx.created_at,
        ))
    return TransactionListResponse(transactions=txs, total=result["total"])


# ── B4: Tax Engine ─────────────────────────────────────

@router.get("/tax/summary", response_model=TaxSummaryResponse)
async def get_tax_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int = Query(..., ge=2015, le=2099, description="Année fiscale"),
):
    """Get tax summary: realized P&L, unrealized, Cerfa 2086 preview."""
    result = await crypto_tax_engine.get_tax_summary(db, user.id, year)
    realized = result["realized"]
    unrealized = result["unrealized"]

    disposals = []
    for d in realized.get("disposals", []):
        disposals.append({
            "date": d["date"],
            "token": d["token"],
            "quantity": d["quantity"],
            "prix_cession": d["prix_cession"],
            "prix_acquisition_pmpa": d["prix_acquisition_pmpa"],
            "plus_ou_moins_value": d["plus_ou_moins_value"],
        })

    return TaxSummaryResponse(
        year=realized.get("year", year),
        realized_pv=realized.get("total_pv", 0),
        realized_mv=realized.get("total_mv", 0),
        net_pv=realized.get("net_pv", 0),
        seuil_305_atteint=realized.get("abattement_305", True),
        taxable_pv=realized.get("taxable_pv", 0),
        flat_tax_30=realized.get("flat_tax_30", 0),
        disposals_count=realized.get("disposals_count", 0),
        disposals=disposals,
        unrealized_total=unrealized.get("total_unrealized", 0),
    )


@router.get("/tax/export-csv")
async def export_cerfa_csv(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    year: int = Query(..., ge=2015, le=2099),
):
    """Export Cerfa 2086 data as CSV (French ';' delimiter)."""
    csv_bytes = await crypto_tax_engine.export_csv_2086(db, user.id, year)

    def _iter():
        yield csv_bytes

    return StreamingResponse(
        _iter(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="cerfa_2086_{year}.csv"',
        },
    )


@router.get("/tax/pmpa/{symbol}", response_model=PMPAResponse)
async def get_pmpa(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get PMPA (Prix Moyen Pondéré d'Acquisition) for a token."""
    result = await crypto_tax_engine.compute_pmpa(db, user.id, symbol.upper())
    return PMPAResponse(
        token_symbol=symbol.upper(),
        pmpa_centimes=result["pmpa_centimes"],
        total_quantity=result["total_qty"],
        total_invested_centimes=result["total_invested_centimes"],
    )


# ── B4: Staking ────────────────────────────────────────

@router.get("/staking/summary", response_model=StakingSummaryResponse)
async def get_staking_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get staking positions summary: total staked value, APY, projected rewards."""
    result = await crypto_tax_engine.get_staking_summary(db, user.id)
    return StakingSummaryResponse(
        total_staked_value=result["total_staked_value"],
        projected_annual_rewards=result["projected_annual_rewards"],
        positions=result["positions"],
    )


# ── B4: Multi-chain ───────────────────────────────────

@router.get("/chains", response_model=list[SupportedChainResponse])
async def list_supported_chains():
    """List supported blockchain networks."""
    chains = get_supported_chains()
    return [
        SupportedChainResponse(
            id=c["id"],
            name=c["name"],
            native_symbol=c["native_symbol"],
        )
        for c in chains
    ]
