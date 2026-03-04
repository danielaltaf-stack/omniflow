"""
OmniFlow — Sync service: orchestrates Woob worker → DB persistence.
Production only. Decrypts real credentials, syncs via Woob, persists
accounts + transactions, captures balance snapshots.

Also handles Trade Republic (custom API, bypasses Woob).
Feeds TR stock/ETF positions into Stocks tab and crypto into Crypto tab.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt, encrypt
from app.models.account import Account
from app.models.bank_connection import BankConnection, ConnectionStatus
from app.models.crypto_holding import CryptoHolding
from app.models.crypto_wallet import CryptoWallet, CryptoPlatform, CryptoWalletStatus
from app.models.stock_portfolio import StockPortfolio, Broker
from app.models.stock_position import StockPosition
from app.models.transaction import Transaction
from app.services.networth import capture_snapshots_for_account
from app.woob_engine.banks import is_custom_module
from app.woob_engine.normalizer import NormalizedAccount, NormalizedTransaction
from app.woob_engine.worker import WoobWorker, SyncResult

logger = logging.getLogger("omniflow.sync")


async def sync_connection(
    db: AsyncSession,
    connection: BankConnection,
    progress_callback: Any = None,
) -> SyncResult:
    """
    Run a full sync for a bank connection.
    Routes to the appropriate engine (Woob for traditional banks,
    custom client for Trade Republic, etc.).
    """
    # Update status to syncing
    connection.status = ConnectionStatus.SYNCING
    await db.commit()

    # Decrypt credentials
    try:
        cred_json = decrypt(connection.encrypted_credentials)
        credentials = json.loads(cred_json.decode("utf-8"))
    except Exception as e:
        logger.error(f"[sync] Failed to decrypt credentials for connection {connection.id}: {e}")
        connection.status = ConnectionStatus.ERROR
        connection.last_error = "Impossible de déchiffrer les identifiants bancaires."
        await db.commit()
        return SyncResult(
            success=False, accounts=[], transactions={},
            error="Erreur de déchiffrement des identifiants.",
        )

    # ── Route to the correct sync engine ─────────────────────
    if connection.bank_module == "traderepublic":
        result = await _sync_traderepublic(connection, credentials, progress_callback)
    else:
        result = await _sync_woob(connection, credentials, progress_callback)

    # ── Handle failure ───────────────────────────────────────
    if not result.success:
        connection.status = (
            ConnectionStatus.SCA_REQUIRED if result.sca_required else ConnectionStatus.ERROR
        )
        connection.last_error = result.error
        connection.last_sync_at = datetime.now(timezone.utc)
        await db.commit()
        return result

    # ── Persist results to DB ────────────────────────────────
    total_txns = await _persist_sync_result(db, connection, result)

    logger.info(
        f"[sync] Connection {connection.id} synced: "
        f"{len(result.accounts)} accounts, {total_txns} new transactions"
    )

    # ── Post-commit: sync TR positions to Stocks + Crypto tabs ──
    if connection.bank_module == "traderepublic" and result.metadata:
        tr_positions = result.metadata.get("tr_positions", [])
        user_id = connection.user_id
        if tr_positions:
            try:
                await _sync_tr_stocks(db, user_id, tr_positions)
                await db.commit()
            except Exception as e:
                logger.error(f"[TR] Failed to sync stocks tab: {e}")
                await db.rollback()

            try:
                await _sync_tr_crypto(db, user_id, tr_positions)
                await db.commit()
            except Exception as e:
                logger.error(f"[TR] Failed to sync crypto tab: {e}")
                await db.rollback()

    # ── Post-sync: invalidate user caches ────────────────────
    try:
        from app.core.cache import cache_manager
        invalidated = await cache_manager.invalidate_user(connection.user_id)
        if invalidated:
            logger.info(f"[sync] Invalidated {invalidated} cache keys for user {connection.user_id}")
    except Exception as e:
        logger.warning(f"[sync] Cache invalidation failed: {e}")

    return result


async def _sync_woob(
    connection: BankConnection,
    credentials: dict,
    progress_callback: Any = None,
) -> SyncResult:
    """Sync via Woob engine (traditional French banks)."""
    worker = WoobWorker(
        user_id=str(connection.user_id),
        bank_module=connection.bank_module,
        credentials=credentials,
    )
    if progress_callback:
        worker.on_progress(progress_callback)
    return await worker.sync()


async def _sync_traderepublic(
    connection: BankConnection,
    credentials: dict,
    progress_callback: Any = None,
) -> SyncResult:
    """
    Sync via Trade Republic custom API.

    Creates ALL accounts (even if empty), fetches full transaction history,
    and feeds positions into Stocks + Crypto tabs.
    """
    from app.services.traderepublic_client import (
        TradeRepublicClient,
        TradeRepublicSessionExpiredError,
        TradeRepublicError,
        TRSession,
        TRPosition,
        TRAccountStructure,
        map_tr_event_to_transaction_type,
        map_tr_event_to_category,
    )

    client = TradeRepublicClient()

    # Check for cached session
    session_token = credentials.get("session_token", "")
    refresh_token = credentials.get("refresh_token", "")
    session_cookies = credentials.get("session_cookies", {})

    if not session_token and not session_cookies:
        return SyncResult(
            success=False, accounts=[], transactions={},
            sca_required=True,
            error="Authentification Trade Republic requise. Entrez le code 2FA.",
        )

    session = TRSession(
        session_token=session_token,
        refresh_token=refresh_token,
        cookies=session_cookies,
        created_at=credentials.get("session_created_at", 0),
    )

    try:
        accounts: list[NormalizedAccount] = []
        transactions: dict[str, list[NormalizedTransaction]] = {}
        all_positions: list[TRPosition] = []

        # ── 1. Cash balance (Compte espèces) ─────────────────
        cash = await client.fetch_cash(session)
        cash_ext_id = f"tr-cash-{connection.user_id}"
        accounts.append(NormalizedAccount(
            external_id=cash_ext_id,
            type="checking",
            label=f"Trade Republic – Compte espèces{f' ({cash.iban})' if cash.iban else ''}",
            balance=int(round(cash.balance * 100)),
            currency=cash.currency,
        ))

        # ── 2. Investment accounts (Compte-titres, PEA, Non côté, Obligataire, Wallet crypto) ──
        #     Parse account structure from JWT to identify which secAccNo maps where
        account_structure = client.parse_account_structure(session)

        #     Fetch ALL positions with current prices
        positions = await client.fetch_portfolio_classified(session)
        all_positions = positions

        #     Group positions by sec_acc_no
        positions_by_acc: dict[str, list[TRPosition]] = {}
        for p in positions:
            positions_by_acc.setdefault(p.sec_acc_no, []).append(p)

        #     Known secAccNo → account type mapping from JWT
        known_sec_accs = set()
        for acc_no in account_structure.default_sec:
            known_sec_accs.add(acc_no)
        for acc_no in account_structure.pea_sec:
            known_sec_accs.add(acc_no)

        # ── 2a. Compte-titres (Default Securities) ──
        ct_ext_id = f"tr-compte-titres-{connection.user_id}"
        ct_positions = []
        for acc_no in account_structure.default_sec:
            ct_positions.extend(positions_by_acc.get(acc_no, []))
        ct_value = sum(p.current_price * p.quantity for p in ct_positions)
        if ct_positions:
            n_items = len(ct_positions)
            detail = f"{n_items} titre{'s' if n_items > 1 else ''}"
            accounts.append(NormalizedAccount(
                external_id=ct_ext_id,
                type="investment",
                label=f"Trade Republic – Compte-titres ({detail})",
                balance=int(round(ct_value * 100)),
                currency="EUR",
            ))
        else:
            accounts.append(NormalizedAccount(
                external_id=ct_ext_id,
                type="investment",
                label="Trade Republic – Compte-titres (vide)",
                balance=0,
                currency="EUR",
            ))

        # ── 2b. PEA (Plan d'Épargne en Actions) ──
        pea_ext_id = f"tr-pea-{connection.user_id}"
        pea_positions = []
        for acc_no in account_structure.pea_sec:
            pea_positions.extend(positions_by_acc.get(acc_no, []))
        pea_value = sum(p.current_price * p.quantity for p in pea_positions)
        if pea_positions:
            n_items = len(pea_positions)
            detail = f"{n_items} titre{'s' if n_items > 1 else ''}"
            accounts.append(NormalizedAccount(
                external_id=pea_ext_id,
                type="investment",
                label=f"Trade Republic – PEA ({detail})",
                balance=int(round(pea_value * 100)),
                currency="EUR",
            ))
        else:
            accounts.append(NormalizedAccount(
                external_id=pea_ext_id,
                type="investment",
                label="Trade Republic – PEA (vide)",
                balance=0,
                currency="EUR",
            ))

        # ── 2c. Non côté ──
        nc_ext_id = f"tr-non-cote-{connection.user_id}"
        accounts.append(NormalizedAccount(
            external_id=nc_ext_id,
            type="investment",
            label="Trade Republic – Non côté (vide)",
            balance=0,
            currency="EUR",
        ))

        # ── 2d. Obligataire ──
        oblig_ext_id = f"tr-obligataire-{connection.user_id}"
        accounts.append(NormalizedAccount(
            external_id=oblig_ext_id,
            type="investment",
            label="Trade Republic – Obligataire (vide)",
            balance=0,
            currency="EUR",
        ))

        # ── 2e. Wallet crypto ──
        crypto_ext_id = f"tr-crypto-{connection.user_id}"
        # Any positions from unknown accounts or crypto-typed positions
        crypto_positions = [
            p for p in positions
            if p.asset_type == "crypto" or (
                p.sec_acc_no and p.sec_acc_no not in known_sec_accs
                and p.sec_acc_no not in [a for a in account_structure.default_sec]
                and p.sec_acc_no not in [a for a in account_structure.pea_sec]
            )
        ]
        crypto_value = sum(p.current_price * p.quantity for p in crypto_positions)
        if crypto_positions:
            n_items = len(crypto_positions)
            accounts.append(NormalizedAccount(
                external_id=crypto_ext_id,
                type="investment",
                label=f"Trade Republic – Wallet crypto ({n_items} crypto{'s' if n_items > 1 else ''})",
                balance=int(round(crypto_value * 100)),
                currency="EUR",
            ))
        else:
            accounts.append(NormalizedAccount(
                external_id=crypto_ext_id,
                type="investment",
                label="Trade Republic – Wallet crypto (vide)",
                balance=0,
                currency="EUR",
            ))

        # Legacy alias for portfolio ext_id (used in transaction routing below)
        portfolio_ext_id = ct_ext_id

        # ── 3. Savings plans (Plans d'épargne programmés) ─────
        savings_ext_id = f"tr-savings-{connection.user_id}"
        try:
            savings_plans = await client.fetch_savings_plans(session)
            if savings_plans:
                active_plans = [sp for sp in savings_plans if sp.is_active]
                total_monthly = sum(sp.amount for sp in active_plans)
                n_plans = len(active_plans)
                accounts.append(NormalizedAccount(
                    external_id=savings_ext_id,
                    type="savings",
                    label=f"Trade Republic – Plans d'épargne ({n_plans} actif{'s' if n_plans > 1 else ''})",
                    balance=int(round(total_monthly * 100)),
                    currency="EUR",
                ))
            else:
                accounts.append(NormalizedAccount(
                    external_id=savings_ext_id,
                    type="savings",
                    label="Trade Republic – Plans d'épargne (aucun)",
                    balance=0,
                    currency="EUR",
                ))
        except Exception as e:
            logger.warning(f"[TR] Savings plans skipped: {e}")
            accounts.append(NormalizedAccount(
                external_id=savings_ext_id,
                type="savings",
                label="Trade Republic – Plans d'épargne",
                balance=0,
                currency="EUR",
            ))

        # ── 4. Interest (Rémunération espèces) ────────────────
        interest_ext_id = f"tr-interest-{connection.user_id}"
        try:
            interest = await client.fetch_interest(session)
            if interest:
                rate_pct = f"{interest.annual_rate * 100:.1f}%" if interest.annual_rate else ""
                label = "Trade Republic – Intérêts espèces"
                if rate_pct:
                    label += f" ({rate_pct}/an)"
                accounts.append(NormalizedAccount(
                    external_id=interest_ext_id,
                    type="savings",
                    label=label,
                    balance=int(round(interest.accrued_interest * 100)),
                    currency=interest.currency,
                ))
            else:
                accounts.append(NormalizedAccount(
                    external_id=interest_ext_id,
                    type="savings",
                    label="Trade Republic – Intérêts espèces",
                    balance=0,
                    currency="EUR",
                ))
        except Exception as e:
            logger.warning(f"[TR] Interest info skipped: {e}")
            accounts.append(NormalizedAccount(
                external_id=interest_ext_id,
                type="savings",
                label="Trade Republic – Intérêts espèces",
                balance=0,
                currency="EUR",
            ))

        # ── 5. Timeline → transactions (FULL history) ─────────
        timeline = await client.fetch_timeline(session, max_events=1000)
        cash_txns: list[NormalizedTransaction] = []
        ct_txns: list[NormalizedTransaction] = []      # Compte-titres
        pea_txns: list[NormalizedTransaction] = []      # PEA
        crypto_txns: list[NormalizedTransaction] = []   # Wallet crypto
        savings_txns: list[NormalizedTransaction] = []
        interest_txns: list[NormalizedTransaction] = []

        for ev in timeline:
            txn_type = map_tr_event_to_transaction_type(ev.event_type)
            category, subcategory = map_tr_event_to_category(ev.event_type, ev.title)
            amount_centimes = int(round(ev.amount * 100))

            # Skip zero-amount system events (documents, settings, etc.)
            if amount_centimes == 0 and ev.event_type in (
                None, "UNKNOWN", "DOCUMENTS_ACCEPTED", "MOBILE_CHANGED",
                "CRYPTO_TNC_UPDATE_2025", "EX_POST_COST_REPORT_CREATED",
                "TAX_YEAR_END_REPORT_CREATED",
            ):
                continue

            txn = NormalizedTransaction(
                external_id=ev.event_id,
                date=ev.date,
                amount=amount_centimes,
                label=ev.title,
                raw_label=f"[{ev.event_type or 'UNKNOWN'}] {ev.title}",
                type=txn_type,
                category=category,
                subcategory=subcategory,
            )

            et = ev.event_type or ""
            subtitle_lower = (ev.subtitle or "").lower()

            # Route transactions to appropriate accounts
            if et in (
                "TRADE_INVOICE", "SSP_CORPORATE_ACTION_INVOICE_CASH",
                "SSP_SECURITIES_TRANSFER_INCOMING",
            ):
                # Route to Compte-titres by default; crypto trades to crypto wallet
                if "crypto" in subtitle_lower or "bitcoin" in subtitle_lower:
                    crypto_txns.append(txn)
                else:
                    ct_txns.append(txn)
            elif et == "SAVINGS_PLAN_INVOICE":
                savings_txns.append(txn)
                ct_txns.append(txn)  # Also track in compte-titres
            elif et in (
                "INTEREST_PAYOUT", "INTEREST_PAYOUT_CREATED", "DIVIDEND",
            ):
                interest_txns.append(txn)
                cash_txns.append(txn)  # Interest paid into cash
            else:
                # All other transactions (card payments, transfers, etc.)
                cash_txns.append(txn)

        transactions[cash_ext_id] = cash_txns
        transactions[ct_ext_id] = ct_txns
        transactions[pea_ext_id] = pea_txns
        transactions[nc_ext_id] = []
        transactions[oblig_ext_id] = []
        transactions[crypto_ext_id] = crypto_txns
        transactions[savings_ext_id] = savings_txns
        transactions[interest_ext_id] = interest_txns

        logger.info(
            f"[TR] Sync complete: {len(accounts)} accounts, "
            f"{sum(len(t) for t in transactions.values())} transactions, "
            f"{len(all_positions)} positions"
        )

        # NOTE: stock/crypto sync is done AFTER _persist_sync_result
        # to avoid corrupting the DB transaction if it fails.
        # Positions are passed via metadata.
        return SyncResult(
            success=True,
            accounts=accounts,
            transactions=transactions,
            metadata={"tr_positions": all_positions, "user_id": str(connection.user_id)},
        )

    except TradeRepublicSessionExpiredError:
        logger.info(f"[TR] Session expired for connection {connection.id}")
        return SyncResult(
            success=False, accounts=[], transactions={},
            sca_required=True,
            error="Session Trade Republic expirée. Veuillez vous reconnecter avec le code 2FA.",
        )
    except TradeRepublicError as e:
        logger.error(f"[TR] Sync error for connection {connection.id}: {e}")
        return SyncResult(
            success=False, accounts=[], transactions={},
            error=f"Erreur Trade Republic: {e}",
        )
    except Exception as e:
        logger.exception(f"[TR] Unexpected error for connection {connection.id}")
        return SyncResult(
            success=False, accounts=[], transactions={},
            error=f"Erreur inattendue Trade Republic: {e}",
        )


# ── TR → Stocks Tab ─────────────────────────────────────────

async def _sync_tr_stocks(
    db: AsyncSession,
    user_id: uuid.UUID,
    positions: list,
) -> int:
    """
    Create/update a StockPortfolio (broker=trade_republic) with
    stock + ETF + bond positions from Trade Republic.
    Returns count of positions synced.
    """
    # Filter stock/ETF/bond positions
    stock_positions = [p for p in positions if p.asset_type in ("stock", "etf", "bond")]

    # Find or create the Trade Republic stock portfolio
    result = await db.execute(
        select(StockPortfolio).where(
            StockPortfolio.user_id == user_id,
            StockPortfolio.broker == Broker.TRADE_REPUBLIC.value,
        )
    )
    portfolio = result.scalar_one_or_none()

    if not portfolio:
        portfolio = StockPortfolio(
            id=uuid.uuid4(),
            user_id=user_id,
            label="Trade Republic",
            broker=Broker.TRADE_REPUBLIC.value,
        )
        db.add(portfolio)
        await db.flush()
        logger.info(f"[TR] Created StockPortfolio for user {user_id}")

    # Delete existing positions for this portfolio and re-insert
    await db.execute(
        delete(StockPosition).where(StockPosition.portfolio_id == portfolio.id)
    )

    now = datetime.now(timezone.utc)
    count = 0

    for pos in stock_positions:
        qty = Decimal(str(pos.quantity))
        avg_buy_centimes = int(round(pos.buy_price_avg * 100)) if pos.buy_price_avg else 0
        current_centimes = int(round(pos.current_price * 100)) if pos.current_price else 0
        value = int(qty * current_centimes)
        cost = int(qty * avg_buy_centimes) if avg_buy_centimes else 0
        pnl = value - cost if avg_buy_centimes else 0
        pnl_pct = round((pnl / cost) * 100, 2) if cost > 0 else 0.0

        # Determine display name with asset type tag
        type_tag = ""
        if pos.asset_type == "etf":
            type_tag = " [ETF]"
        elif pos.asset_type == "bond":
            type_tag = " [Obligation]"

        stock_pos = StockPosition(
            id=uuid.uuid4(),
            portfolio_id=portfolio.id,
            symbol=pos.isin,
            name=f"{pos.name}{type_tag}",
            quantity=qty,
            avg_buy_price=avg_buy_centimes if avg_buy_centimes else None,
            current_price=current_centimes,
            value=value,
            pnl=pnl,
            pnl_pct=pnl_pct,
            total_dividends=0,
            currency=pos.currency or "EUR",
            sector=pos.asset_type.upper(),  # Use asset_type as pseudo-sector
            last_price_at=now,
        )
        db.add(stock_pos)
        count += 1

    await db.flush()
    logger.info(f"[TR] Synced {count} stock/ETF positions to Stocks tab")
    return count


# ── TR → Crypto Tab ──────────────────────────────────────────

_CRYPTO_ISIN_TO_SYMBOL: dict[str, str] = {
    # Well-known Trade Republic crypto ISINs (XF prefix)
    # The actual ISIN contains the ticker after XF000
}

_CRYPTO_NAME_TO_SYMBOL: dict[str, str] = {
    "bitcoin": "BTC", "ethereum": "ETH", "solana": "SOL",
    "cardano": "ADA", "polkadot": "DOT", "avalanche": "AVAX",
    "ripple": "XRP", "dogecoin": "DOGE", "shiba inu": "SHIB",
    "litecoin": "LTC", "chainlink": "LINK", "uniswap": "UNI",
    "aave": "AAVE", "polygon": "MATIC", "cosmos": "ATOM",
    "near": "NEAR", "algorand": "ALGO", "stellar": "XLM",
    "toncoin": "TON", "tron": "TRX", "sui": "SUI",
    "aptos": "APT", "arbitrum": "ARB", "optimism": "OP",
    "render": "RENDER", "fetch.ai": "FET", "injective": "INJ",
    "celestia": "TIA", "pepe": "PEPE", "bonk": "BONK",
    "bnb": "BNB",
}


def _extract_crypto_symbol(isin: str, name: str) -> str:
    """Extract crypto ticker symbol from TR ISIN or name."""
    # Try ISIN: XF000BTC0001 → BTC
    if isin.startswith("XF") and len(isin) >= 7:
        # Extract 3-5 char ticker between XF000 and trailing digits
        inner = isin[5:].rstrip("0123456789")
        if not inner:
            inner = isin[5:-4] if len(isin) > 9 else isin[5:]
        if inner:
            return inner.upper()

    # Try name matching
    name_lower = name.lower()
    for keyword, symbol in _CRYPTO_NAME_TO_SYMBOL.items():
        if keyword in name_lower:
            return symbol

    # Last resort: use first word of name
    return name.split()[0].upper() if name else "UNKNOWN"


async def _sync_tr_crypto(
    db: AsyncSession,
    user_id: uuid.UUID,
    positions: list,
) -> int:
    """
    Create/update a CryptoWallet (platform=trade_republic) with
    crypto positions from Trade Republic.
    Returns count of holdings synced.
    """
    # Filter crypto positions
    crypto_positions = [p for p in positions if p.asset_type == "crypto"]

    if not crypto_positions:
        # Still ensure the wallet exists (empty)
        result = await db.execute(
            select(CryptoWallet).where(
                CryptoWallet.user_id == user_id,
                CryptoWallet.platform == CryptoPlatform.TRADE_REPUBLIC.value,
            )
        )
        wallet = result.scalar_one_or_none()
        if wallet:
            # Clear old holdings
            await db.execute(
                delete(CryptoHolding).where(CryptoHolding.wallet_id == wallet.id)
            )
            wallet.last_sync_at = datetime.now(timezone.utc)
            wallet.sync_error = None
            await db.flush()
        return 0

    # Find or create the Trade Republic crypto wallet
    result = await db.execute(
        select(CryptoWallet).where(
            CryptoWallet.user_id == user_id,
            CryptoWallet.platform == CryptoPlatform.TRADE_REPUBLIC.value,
        )
    )
    wallet = result.scalar_one_or_none()

    if not wallet:
        wallet = CryptoWallet(
            id=uuid.uuid4(),
            user_id=user_id,
            platform=CryptoPlatform.TRADE_REPUBLIC.value,
            label="Trade Republic Crypto",
            status=CryptoWalletStatus.ACTIVE.value,
        )
        db.add(wallet)
        await db.flush()
        logger.info(f"[TR] Created CryptoWallet for user {user_id}")

    # Delete existing holdings and re-insert
    await db.execute(
        delete(CryptoHolding).where(CryptoHolding.wallet_id == wallet.id)
    )

    now = datetime.now(timezone.utc)
    count = 0

    # Try to get CoinGecko prices for better accuracy
    try:
        from app.services import coingecko
        symbols = [_extract_crypto_symbol(p.isin, p.name) for p in crypto_positions]
        prices = await coingecko.get_prices(symbols)
    except Exception as e:
        logger.warning(f"[TR] CoinGecko price fetch failed: {e}")
        prices = {}

    for pos in crypto_positions:
        symbol = _extract_crypto_symbol(pos.isin, pos.name)
        qty = Decimal(str(pos.quantity))

        # Use CoinGecko price if available, otherwise TR price
        price_info = prices.get(symbol.upper(), {})
        current_centimes = price_info.get("price_centimes") or int(round(pos.current_price * 100))
        avg_buy_centimes = int(round(pos.buy_price_avg * 100)) if pos.buy_price_avg else None

        value = int(qty * current_centimes)
        cost = int(qty * avg_buy_centimes) if avg_buy_centimes else 0
        pnl = value - cost if avg_buy_centimes else 0
        pnl_pct = round((pnl / cost) * 100, 2) if cost > 0 else 0.0

        holding = CryptoHolding(
            id=uuid.uuid4(),
            wallet_id=wallet.id,
            token_symbol=symbol,
            token_name=pos.name,
            quantity=qty,
            avg_buy_price=avg_buy_centimes,
            current_price=current_centimes,
            value=value,
            pnl=pnl,
            pnl_pct=pnl_pct,
            currency=pos.currency or "EUR",
            last_price_at=now,
        )
        db.add(holding)
        count += 1

    wallet.status = CryptoWalletStatus.ACTIVE.value
    wallet.last_sync_at = now
    wallet.sync_error = None
    await db.flush()

    logger.info(f"[TR] Synced {count} crypto holdings to Crypto tab")
    return count


async def _persist_sync_result(
    db: AsyncSession,
    connection: BankConnection,
    result: SyncResult,
) -> int:
    """Upsert accounts + transactions, capture snapshots, update connection."""

    # ── Upsert accounts ─────────────────────────────────────
    existing_accounts = (
        await db.execute(
            select(Account).where(Account.connection_id == connection.id)
        )
    ).scalars().all()

    existing_map = {a.external_id: a for a in existing_accounts}
    account_id_map: dict[str, uuid.UUID] = {}

    for norm_acc in result.accounts:
        if norm_acc.external_id in existing_map:
            acc = existing_map[norm_acc.external_id]
            acc.balance = norm_acc.balance
            acc.label = norm_acc.label
            acc.currency = norm_acc.currency
        else:
            acc = Account(
                id=uuid.uuid4(),
                connection_id=connection.id,
                external_id=norm_acc.external_id,
                type=norm_acc.type,
                label=norm_acc.label,
                balance=norm_acc.balance,
                currency=norm_acc.currency,
            )
            db.add(acc)

        account_id_map[norm_acc.external_id] = acc.id

    await db.flush()

    # ── Upsert transactions (deduplicate by external_id) ────
    total_txns = 0
    for ext_id, txn_list in result.transactions.items():
        account_id = account_id_map.get(ext_id)
        if not account_id:
            continue

        existing_txn_result = await db.execute(
            select(Transaction.external_id).where(Transaction.account_id == account_id)
        )
        existing_ext_ids = {row[0] for row in existing_txn_result.all()}

        for txn in txn_list:
            if txn.external_id in existing_ext_ids:
                continue

            db.add(Transaction(
                id=uuid.uuid4(),
                account_id=account_id,
                external_id=txn.external_id,
                date=txn.date,
                amount=txn.amount,
                label=txn.label,
                raw_label=txn.raw_label,
                type=txn.type,
                category=txn.category,
                subcategory=txn.subcategory,
                merchant=txn.merchant,
                is_recurring=txn.is_recurring,
            ))
            total_txns += 1

    # ── Capture balance snapshots ────────────────────────────
    for norm_acc in result.accounts:
        acc_id = account_id_map.get(norm_acc.external_id)
        if acc_id:
            try:
                await capture_snapshots_for_account(
                    db, acc_id, norm_acc.balance, norm_acc.currency
                )
            except Exception as e:
                logger.warning(f"[sync] Failed to capture snapshot for {acc_id}: {e}")

    # ── Update connection status ─────────────────────────────
    connection.status = ConnectionStatus.ACTIVE
    connection.last_sync_at = datetime.now(timezone.utc)
    connection.last_error = None

    await db.commit()
    return total_txns


async def run_sync(
    connection: BankConnection,
    db: AsyncSession,
    progress_callback: Any = None,
) -> SyncResult:
    """Backward-compatible wrapper for sync_connection."""
    return await sync_connection(db, connection, progress_callback)
