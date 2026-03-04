"""
OmniFlow — Phase B4 — Crypto Tax Engine.
Computes PMPA (Prix Moyen Pondéré d'Acquisition), realized/unrealized PV,
flat tax estimation, and cerfa 2086 export for French tax declaration.

French fiscal rules:
  - Flat tax (PFU) = 30% on net capital gains from crypto (art. 150 VH bis CGI)
  - Calculation method: PMPA — obligatory since 2019
  - Annual exemption: 305 € (seuil BNC) on total net gains
  - Cerfa 2086 line-by-line export for each disposal

All amounts in EUR centimes (BigInteger) unless stated otherwise.
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crypto_holding import CryptoHolding
from app.models.crypto_transaction import CryptoTransaction
from app.models.crypto_wallet import CryptoWallet

logger = logging.getLogger(__name__)

# ── French tax constants ──────────────────────────────────
FLAT_TAX_RATE = 0.30            # 30% PFU
ABATTEMENT_BNC = 305_00         # 305 € in centimes
ACQUISITION_TX_TYPES = {"buy", "swap", "transfer_in", "staking_reward", "airdrop"}
DISPOSAL_TX_TYPES = {"sell", "swap"}


# ── Helpers ───────────────────────────────────────────────

async def _get_user_wallet_ids(db: AsyncSession, user_id: UUID) -> list[UUID]:
    """Return all wallet IDs for a user."""
    result = await db.execute(
        select(CryptoWallet.id).where(CryptoWallet.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def _get_transactions(
    db: AsyncSession,
    wallet_ids: list[UUID],
    token_symbol: str | None = None,
    year: int | None = None,
    tx_types: set[str] | None = None,
) -> list[CryptoTransaction]:
    """Fetch transactions with optional filters, ordered by executed_at ASC."""
    q = select(CryptoTransaction).where(
        CryptoTransaction.wallet_id.in_(wallet_ids)
    )
    if token_symbol:
        q = q.where(CryptoTransaction.token_symbol == token_symbol.upper())
    if year:
        q = q.where(extract("year", CryptoTransaction.executed_at) == year)
    if tx_types:
        q = q.where(CryptoTransaction.tx_type.in_(tx_types))
    q = q.order_by(CryptoTransaction.executed_at.asc())
    result = await db.execute(q)
    return list(result.scalars().all())


# ── PMPA Computation ──────────────────────────────────────

async def compute_pmpa(
    db: AsyncSession,
    user_id: UUID,
    token_symbol: str,
) -> dict[str, Any]:
    """
    Compute Prix Moyen Pondéré d'Acquisition for a token.
    PMPA = Σ(acquisition_total_eur) / Σ(acquisition_quantity)

    Returns:
        { pmpa_centimes, total_qty, total_invested_centimes }
    """
    wallet_ids = await _get_user_wallet_ids(db, user_id)
    if not wallet_ids:
        return {"pmpa_centimes": 0, "total_qty": 0.0, "total_invested_centimes": 0}

    txs = await _get_transactions(
        db, wallet_ids, token_symbol=token_symbol, tx_types=ACQUISITION_TX_TYPES
    )

    total_qty = Decimal("0")
    total_cost = Decimal("0")  # centimes

    for tx in txs:
        qty = Decimal(str(tx.quantity))
        cost = Decimal(str(tx.total_eur))
        total_qty += qty
        total_cost += cost

    # For sell/swap-out, reduce the pool
    sells = await _get_transactions(
        db, wallet_ids, token_symbol=token_symbol, tx_types={"sell", "transfer_out"}
    )
    # We need chronological PMPA — recompute with running pool
    # Full PMPA computation:
    running_qty = Decimal("0")
    running_cost = Decimal("0")

    all_txs = await _get_transactions(db, wallet_ids, token_symbol=token_symbol)
    for tx in all_txs:
        qty = Decimal(str(tx.quantity))
        if tx.tx_type in ACQUISITION_TX_TYPES:
            running_cost += Decimal(str(tx.total_eur))
            running_qty += qty
        elif tx.tx_type in {"sell", "transfer_out"}:
            if running_qty > 0:
                pmpa_at_sale = running_cost / running_qty
                running_cost -= pmpa_at_sale * qty
                running_qty -= qty
                # Clamp to zero
                if running_qty < 0:
                    running_qty = Decimal("0")
                    running_cost = Decimal("0")

    pmpa = int(running_cost / running_qty) if running_qty > 0 else 0

    return {
        "pmpa_centimes": pmpa,
        "total_qty": float(running_qty),
        "total_invested_centimes": int(running_cost),
    }


# ── Realized PV (Plus-Values réalisées) ──────────────────

async def compute_realized_pv(
    db: AsyncSession,
    user_id: UUID,
    year: int,
) -> dict[str, Any]:
    """
    Compute realized capital gains for a fiscal year.
    For each sell/swap:
      PV = total_eur_cession - (PMPA_at_moment × quantity) - fee_eur

    Returns:
      { total_pv, total_mv, net_pv, abattement_305, taxable_pv, flat_tax_30,
        disposals: [{date, token, qty, prix_cession, pmpa_used, pv_or_mv, fee}] }
    """
    wallet_ids = await _get_user_wallet_ids(db, user_id)
    if not wallet_ids:
        return _empty_pv_result()

    # Get all transactions up to end of year, chronologically
    all_txs = await _get_transactions(db, wallet_ids)

    # Build per-token PMPA pools running through time
    pools: dict[str, dict] = {}  # symbol → {qty: Decimal, cost: Decimal}
    disposals = []

    for tx in all_txs:
        sym = tx.token_symbol
        if sym not in pools:
            pools[sym] = {"qty": Decimal("0"), "cost": Decimal("0")}

        qty = Decimal(str(tx.quantity))
        pool = pools[sym]

        if tx.tx_type in ACQUISITION_TX_TYPES:
            pool["cost"] += Decimal(str(tx.total_eur))
            pool["qty"] += qty
        elif tx.tx_type in {"sell", "transfer_out"}:
            pmpa = int(pool["cost"] / pool["qty"]) if pool["qty"] > 0 else 0
            acquisition_cost = int(Decimal(str(pmpa)) * qty)
            pv = int(tx.total_eur) - acquisition_cost - int(tx.fee_eur)

            # Remove from pool
            if pool["qty"] > 0:
                pool["cost"] -= Decimal(str(pmpa)) * qty
                pool["qty"] -= qty
                if pool["qty"] < 0:
                    pool["qty"] = Decimal("0")
                    pool["cost"] = Decimal("0")

            # Only count disposals from the requested year
            tx_year = tx.executed_at.year if tx.executed_at else 0
            if tx_year == year:
                disposals.append({
                    "date": tx.executed_at.isoformat() if tx.executed_at else None,
                    "token": sym,
                    "qty": float(qty),
                    "prix_cession": int(tx.total_eur),
                    "pmpa_used": pmpa,
                    "acquisition_cost": acquisition_cost,
                    "fee": int(tx.fee_eur),
                    "pv_or_mv": pv,
                })

    total_pv = sum(d["pv_or_mv"] for d in disposals if d["pv_or_mv"] > 0)
    total_mv = sum(d["pv_or_mv"] for d in disposals if d["pv_or_mv"] < 0)
    net_pv = total_pv + total_mv  # mv is negative

    abattement = min(ABATTEMENT_BNC, max(net_pv, 0))
    taxable = max(net_pv - abattement, 0)
    flat_tax = int(taxable * FLAT_TAX_RATE)

    return {
        "year": year,
        "total_pv": total_pv,
        "total_mv": total_mv,
        "net_pv": net_pv,
        "abattement_305": abattement,
        "taxable_pv": taxable,
        "flat_tax_30": flat_tax,
        "disposals_count": len(disposals),
        "disposals": disposals,
    }


# ── Unrealized PV ────────────────────────────────────────

async def compute_unrealized_pv(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Unrealized P&L per token = current_value - (PMPA × current_qty).
    Returns: { total_unrealized, tokens: [{symbol, qty, pmpa, current_price, value, pv}] }
    """
    wallet_ids = await _get_user_wallet_ids(db, user_id)
    if not wallet_ids:
        return {"total_unrealized": 0, "tokens": []}

    # Get current holdings
    result = await db.execute(
        select(CryptoHolding).where(CryptoHolding.wallet_id.in_(wallet_ids))
    )
    holdings = result.scalars().all()

    tokens = []
    total = 0

    for h in holdings:
        qty = Decimal(str(h.quantity))
        if qty <= 0:
            continue
        pmpa_data = await compute_pmpa(db, user_id, h.token_symbol)
        pmpa = pmpa_data["pmpa_centimes"]
        current_value = int(h.value or 0)
        cost_basis = int(Decimal(str(pmpa)) * qty)
        pv = current_value - cost_basis
        total += pv
        tokens.append({
            "symbol": h.token_symbol,
            "qty": float(qty),
            "pmpa_centimes": pmpa,
            "current_price": int(h.current_price or 0),
            "current_value": current_value,
            "cost_basis": cost_basis,
            "unrealized_pv": pv,
        })

    return {"total_unrealized": total, "tokens": tokens}


# ── Cerfa 2086 Export ────────────────────────────────────

async def generate_cerfa_2086(
    db: AsyncSession,
    user_id: UUID,
    year: int,
) -> list[dict[str, Any]]:
    """
    Generate line-by-line data compatible with cerfa 2086.
    Each line: date_cession, nature_actif, prix_cession, frais, prix_acquisition_pmpa, pv_ou_mv
    """
    pv_data = await compute_realized_pv(db, user_id, year)
    lines = []
    for d in pv_data["disposals"]:
        lines.append({
            "date_cession": d["date"],
            "nature_actif": d["token"],
            "prix_cession": d["prix_cession"],
            "frais": d["fee"],
            "prix_acquisition_pmpa": d["acquisition_cost"],
            "plus_ou_moins_value": d["pv_or_mv"],
        })
    return lines


async def export_csv_2086(
    db: AsyncSession,
    user_id: UUID,
    year: int,
) -> bytes:
    """Generate a CSV file (bytes) for cerfa 2086 import."""
    lines = await generate_cerfa_2086(db, user_id, year)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Date de cession",
        "Nature de l'actif",
        "Prix de cession (€)",
        "Frais (€)",
        "Prix d'acquisition PMPA (€)",
        "Plus ou moins-value (€)",
    ])
    for line in lines:
        writer.writerow([
            line["date_cession"],
            line["nature_actif"],
            f"{line['prix_cession'] / 100:.2f}",
            f"{line['frais'] / 100:.2f}",
            f"{line['prix_acquisition_pmpa'] / 100:.2f}",
            f"{line['plus_ou_moins_value'] / 100:.2f}",
        ])

    return output.getvalue().encode("utf-8")


# ── Tax Summary ──────────────────────────────────────────

async def get_tax_summary(
    db: AsyncSession,
    user_id: UUID,
    year: int,
) -> dict[str, Any]:
    """
    Dashboard summary: realized gains, losses, net, flat tax estimation,
    seuil 305€ status, unrealized PV.
    """
    realized = await compute_realized_pv(db, user_id, year)
    unrealized = await compute_unrealized_pv(db, user_id)

    return {
        "year": year,
        "realized": {
            "total_pv": realized["total_pv"],
            "total_mv": realized["total_mv"],
            "net_pv": realized["net_pv"],
            "abattement_305": realized["abattement_305"],
            "taxable_pv": realized["taxable_pv"],
            "flat_tax_30": realized["flat_tax_30"],
            "disposals_count": realized["disposals_count"],
        },
        "unrealized": {
            "total": unrealized["total_unrealized"],
            "tokens_count": len(unrealized["tokens"]),
        },
        "seuil_305_atteint": realized["net_pv"] > ABATTEMENT_BNC,
    }


# ── Staking Summary ─────────────────────────────────────

async def get_staking_summary(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """
    Aggregate staking positions: total staked value, projected 12m rewards,
    per-token breakdown.
    """
    wallet_ids = await _get_user_wallet_ids(db, user_id)
    if not wallet_ids:
        return {"total_staked_value": 0, "projected_annual_rewards": 0, "positions": []}

    result = await db.execute(
        select(CryptoHolding).where(
            CryptoHolding.wallet_id.in_(wallet_ids),
            CryptoHolding.is_staked == True,  # noqa: E712
        )
    )
    staked = result.scalars().all()

    positions = []
    total_staked = 0
    total_projected = 0

    for h in staked:
        value = int(h.value or 0)
        apy = float(h.staking_apy or 0.0)
        projected = int(value * apy / 100) if apy > 0 else 0
        total_staked += value
        total_projected += projected
        positions.append({
            "token_symbol": h.token_symbol,
            "token_name": h.token_name,
            "quantity": float(h.quantity),
            "value": value,
            "apy": apy,
            "projected_annual_reward": projected,
            "rewards_total": int(h.staking_rewards_total or 0),
            "source": h.staking_source or "unknown",
        })

    return {
        "total_staked_value": total_staked,
        "projected_annual_rewards": total_projected,
        "positions_count": len(positions),
        "positions": positions,
    }


# ── Transaction CRUD ─────────────────────────────────────

async def add_transaction(
    db: AsyncSession,
    user_id: UUID,
    wallet_id: UUID,
    data: dict[str, Any],
) -> CryptoTransaction:
    """Add a manual transaction. Validates wallet ownership."""
    result = await db.execute(
        select(CryptoWallet).where(
            CryptoWallet.id == wallet_id,
            CryptoWallet.user_id == user_id,
        )
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise ValueError("Wallet introuvable.")

    tx = CryptoTransaction(
        wallet_id=wallet_id,
        tx_type=data["tx_type"],
        token_symbol=data["token_symbol"].upper(),
        quantity=Decimal(str(data.get("quantity", 0))),
        price_eur=int(data.get("price_eur", 0)),
        total_eur=int(data.get("total_eur", 0)),
        fee_eur=int(data.get("fee_eur", 0)),
        counterpart=data.get("counterpart"),
        tx_hash=data.get("tx_hash"),
        executed_at=data.get("executed_at", datetime.now(timezone.utc)),
        source=data.get("source", "manual"),
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def list_transactions(
    db: AsyncSession,
    user_id: UUID,
    wallet_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CryptoTransaction]:
    """List transactions for a user, optionally filtered by wallet."""
    wallet_ids = await _get_user_wallet_ids(db, user_id)
    if not wallet_ids:
        return []
    q = select(CryptoTransaction).where(
        CryptoTransaction.wallet_id.in_(wallet_ids)
    )
    if wallet_id:
        q = q.where(CryptoTransaction.wallet_id == wallet_id)
    q = q.order_by(CryptoTransaction.executed_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


# ── Private helpers ──────────────────────────────────────

def _empty_pv_result() -> dict[str, Any]:
    return {
        "year": 0,
        "total_pv": 0,
        "total_mv": 0,
        "net_pv": 0,
        "abattement_305": 0,
        "taxable_pv": 0,
        "flat_tax_30": 0,
        "disposals_count": 0,
        "disposals": [],
    }
