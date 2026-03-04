"""
OmniFlow — Crypto Service.
Orchestrates wallet sync (Binance/Kraken/Etherscan/Multi-chain) → DB persistence + price updates.
Phase B4: staking enrichment + multi-chain support (Polygon, Arbitrum, Optimism, BSC).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt, encrypt
from app.models.crypto_holding import CryptoHolding
from app.models.crypto_wallet import CryptoWallet, CryptoPlatform, CryptoWalletStatus
from app.services.binance_client import BinanceClient
from app.services.kraken_client import KrakenClient
from app.services.etherscan_client import EtherscanClient
from app.services.multichain_client import MultichainClient, CHAINS
from app.services import coingecko

logger = logging.getLogger(__name__)

# Platforms that map to a specific chain via MultichainClient
_MULTICHAIN_PLATFORMS: set[str] = {"polygon", "arbitrum", "optimism", "bsc"}

# Well-known token names
_TOKEN_NAMES: dict[str, str] = {
    "BTC": "Bitcoin", "ETH": "Ethereum", "BNB": "BNB", "SOL": "Solana",
    "ADA": "Cardano", "DOT": "Polkadot", "AVAX": "Avalanche", "XRP": "Ripple",
    "DOGE": "Dogecoin", "SHIB": "Shiba Inu", "LTC": "Litecoin", "LINK": "Chainlink",
    "UNI": "Uniswap", "AAVE": "Aave", "MKR": "Maker", "COMP": "Compound",
    "MATIC": "Polygon", "ATOM": "Cosmos", "NEAR": "NEAR", "FTM": "Fantom",
    "ALGO": "Algorand", "USDT": "Tether", "USDC": "USD Coin", "DAI": "Dai",
    "ARB": "Arbitrum", "OP": "Optimism", "APT": "Aptos", "SUI": "Sui",
    "RENDER": "Render", "FET": "Fetch.ai", "INJ": "Injective", "TIA": "Celestia",
    "PEPE": "Pepe", "WIF": "dogwifhat", "BONK": "Bonk", "WBTC": "Wrapped Bitcoin",
    "WETH": "Wrapped Ether",
}


def _token_name(symbol: str) -> str:
    return _TOKEN_NAMES.get(symbol.upper(), symbol.upper())


async def create_wallet(
    db: AsyncSession,
    user_id: UUID,
    platform: str,
    label: str,
    api_key: str | None = None,
    api_secret: str | None = None,
    address: str | None = None,
    chain: str | None = None,
) -> CryptoWallet:
    """Create a new crypto wallet and validate connectivity."""
    # Validate connectivity BEFORE persisting
    if platform == "binance" and api_key and api_secret:
        client = BinanceClient(api_key, api_secret)
        await client.get_spot_balances()  # Will raise if credentials invalid
    elif platform == "kraken" and api_key and api_secret:
        client = KrakenClient(api_key, api_secret)
        await client.get_balances()
    elif platform == "etherscan" and address:
        client = EtherscanClient(address)
        await client.get_eth_balance()
    elif platform in _MULTICHAIN_PLATFORMS and address:
        # Multi-chain on-chain wallet (B4)
        mc_chain = chain or platform
        mc = MultichainClient(address, mc_chain)
        await mc.get_native_balance()  # Validate connectivity
    elif platform == "trade_republic":
        # TR wallet is auto-created by sync_service, skip connectivity check
        pass
    else:
        raise ValueError("Paramètres insuffisants pour cette plateforme.")

    # Resolve chain for the wallet
    resolved_chain = "ethereum"
    if chain:
        resolved_chain = chain
    elif platform in _MULTICHAIN_PLATFORMS:
        resolved_chain = platform
    elif platform == "etherscan":
        resolved_chain = "ethereum"

    wallet = CryptoWallet(
        user_id=user_id,
        platform=platform,
        label=label,
        encrypted_api_key=encrypt(api_key.encode()) if api_key else None,
        encrypted_api_secret=encrypt(api_secret.encode()) if api_secret else None,
        address=address,
        chain=resolved_chain,
        status=CryptoWalletStatus.ACTIVE.value,
    )
    db.add(wallet)
    await db.commit()
    await db.refresh(wallet)

    # Trigger initial sync
    await sync_wallet(db, wallet)
    return wallet


async def sync_wallet(db: AsyncSession, wallet: CryptoWallet) -> int:
    """
    Sync a wallet: fetch holdings from exchange/chain, update prices, persist.
    B4: enriches with staking data (APY, is_staked, staking_source).
    Returns count of holdings synced.
    """
    wallet.status = CryptoWalletStatus.SYNCING.value
    await db.commit()

    try:
        holdings_raw = await _fetch_holdings(wallet)
        staking_map = await _fetch_staking_info(wallet)
    except Exception as e:
        wallet.status = CryptoWalletStatus.ERROR.value
        wallet.sync_error = str(e)[:500]
        await db.commit()
        raise

    if not holdings_raw:
        wallet.status = CryptoWalletStatus.ACTIVE.value
        wallet.last_sync_at = datetime.now(timezone.utc)
        wallet.sync_error = None
        await db.commit()
        return 0

    # Fetch current prices
    symbols = [h["asset"] for h in holdings_raw]
    prices = await coingecko.get_prices(symbols)

    # Delete old holdings and insert fresh
    await db.execute(
        delete(CryptoHolding).where(CryptoHolding.wallet_id == wallet.id)
    )

    count = 0
    now = datetime.now(timezone.utc)

    for h in holdings_raw:
        symbol = h["asset"].upper()
        qty = Decimal(str(h["quantity"]))
        price_info = prices.get(symbol, {})
        current_price = price_info.get("price_centimes", 0)
        value = int(qty * current_price)  # centimes

        # B4: staking enrichment
        stk = staking_map.get(symbol, {})
        is_staked = stk.get("is_staked", False)
        staking_apy = stk.get("apy", 0.0)
        staking_source = stk.get("source", None)
        staking_rewards_total = stk.get("rewards_total", 0)

        holding = CryptoHolding(
            wallet_id=wallet.id,
            token_symbol=symbol,
            token_name=h.get("name") or _token_name(symbol),
            quantity=qty,
            avg_buy_price=None,  # Need trade history for this
            current_price=current_price,
            value=value,
            pnl=0,  # Needs avg_buy_price
            pnl_pct=0.0,
            currency="EUR",
            last_price_at=now,
            # B4 fields
            is_staked=is_staked,
            staking_apy=staking_apy,
            staking_source=staking_source,
            staking_rewards_total=staking_rewards_total,
        )
        db.add(holding)
        count += 1

    wallet.status = CryptoWalletStatus.ACTIVE.value
    wallet.last_sync_at = now
    wallet.sync_error = None
    await db.commit()
    return count


async def _fetch_holdings(wallet: CryptoWallet) -> list[dict[str, Any]]:
    """Fetch raw holdings from the appropriate exchange/chain."""
    platform = wallet.platform.value if hasattr(wallet.platform, "value") else str(wallet.platform)

    if platform == "binance":
        key = decrypt(wallet.encrypted_api_key).decode() if wallet.encrypted_api_key else ""
        secret = decrypt(wallet.encrypted_api_secret).decode() if wallet.encrypted_api_secret else ""
        client = BinanceClient(key, secret)
        return await client.get_all_holdings()

    elif platform == "kraken":
        key = decrypt(wallet.encrypted_api_key).decode() if wallet.encrypted_api_key else ""
        secret = decrypt(wallet.encrypted_api_secret).decode() if wallet.encrypted_api_secret else ""
        client = KrakenClient(key, secret)
        return await client.get_balances()

    elif platform == "etherscan":
        address = wallet.address or ""
        client = EtherscanClient(address)
        return await client.get_all_holdings()

    elif platform in _MULTICHAIN_PLATFORMS:
        # B4: Multi-chain on-chain wallets
        address = wallet.address or ""
        chain = getattr(wallet, "chain", None) or platform
        mc = MultichainClient(address, chain)
        return await mc.get_all_holdings()

    elif platform == "trade_republic":
        # TR holdings are managed by sync_service._sync_tr_crypto()
        # No external fetch needed — holdings are already in DB
        return []

    else:
        return []


async def _fetch_staking_info(wallet: CryptoWallet) -> dict[str, dict[str, Any]]:
    """
    B4: Fetch staking/earn info for a wallet.
    Returns {symbol: {is_staked, apy, source, rewards_total}} for staked assets.
    """
    platform = wallet.platform.value if hasattr(wallet.platform, "value") else str(wallet.platform)
    result: dict[str, dict[str, Any]] = {}

    if platform == "binance":
        key = decrypt(wallet.encrypted_api_key).decode() if wallet.encrypted_api_key else ""
        secret = decrypt(wallet.encrypted_api_secret).decode() if wallet.encrypted_api_secret else ""
        client = BinanceClient(key, secret)

        # Flexible earn
        try:
            earn = await client.get_earn_positions()
            for p in earn:
                symbol = p["asset"].upper()
                result[symbol] = {
                    "is_staked": True,
                    "apy": p.get("apy", 0.0),
                    "source": "binance_earn",
                    "rewards_total": 0,
                }
        except Exception as e:
            logger.warning("Binance earn fetch for staking info failed: %s", e)

        # Locked staking
        try:
            staking = await client.get_staking_positions()
            for p in staking:
                symbol = p["asset"].upper()
                if symbol in result:
                    # Merge: keep highest APY
                    if p.get("apy", 0.0) > result[symbol]["apy"]:
                        result[symbol]["apy"] = p["apy"]
                        result[symbol]["source"] = "binance_staking"
                else:
                    result[symbol] = {
                        "is_staked": True,
                        "apy": p.get("apy", 0.0),
                        "source": "binance_staking",
                        "rewards_total": 0,
                    }
        except Exception as e:
            logger.warning("Binance staking fetch for staking info failed: %s", e)

    elif platform == "kraken":
        key = decrypt(wallet.encrypted_api_key).decode() if wallet.encrypted_api_key else ""
        secret = decrypt(wallet.encrypted_api_secret).decode() if wallet.encrypted_api_secret else ""
        client = KrakenClient(key, secret)
        try:
            staking = await client.get_staking_info()
            for p in staking:
                symbol = p.get("asset", "").upper()
                if symbol:
                    result[symbol] = {
                        "is_staked": True,
                        "apy": p.get("apy", 0.0),
                        "source": "kraken_staking",
                        "rewards_total": 0,
                    }
        except Exception as e:
            logger.warning("Kraken staking fetch failed: %s", e)

    # On-chain wallets and TR don't have staking info from APIs
    return result


async def get_user_wallets(db: AsyncSession, user_id: UUID) -> list[CryptoWallet]:
    """Get all crypto wallets for a user."""
    result = await db.execute(
        select(CryptoWallet)
        .where(CryptoWallet.user_id == user_id)
        .order_by(CryptoWallet.created_at)
    )
    return list(result.scalars().all())


async def get_portfolio_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """
    Aggregate crypto portfolio: total value, P&L, holdings list.
    """
    wallets = await get_user_wallets(db, user_id)
    wallet_ids = [w.id for w in wallets]

    if not wallet_ids:
        return {"total_value": 0, "change_24h": 0.0, "holdings": [], "wallets": []}

    result = await db.execute(
        select(CryptoHolding)
        .where(CryptoHolding.wallet_id.in_(wallet_ids))
        .order_by(CryptoHolding.value.desc())
    )
    holdings = result.scalars().all()

    # Refresh prices
    symbols = list({h.token_symbol for h in holdings})
    prices = await coingecko.get_prices(symbols) if symbols else {}

    total_value = 0
    weighted_change = 0.0
    holdings_out = []

    for h in holdings:
        price_info = prices.get(h.token_symbol, {})
        current_price = price_info.get("price_centimes", h.current_price or 0)
        change_24h = price_info.get("change_24h", 0.0)
        value = int(Decimal(str(h.quantity)) * current_price)

        total_value += value
        weighted_change += value * (change_24h / 100)

        holdings_out.append({
            "token_symbol": h.token_symbol,
            "token_name": h.token_name,
            "quantity": float(h.quantity),
            "current_price": current_price,
            "value": value,
            "pnl": h.pnl,
            "pnl_pct": h.pnl_pct,
            "change_24h": change_24h,
            "allocation_pct": 0.0,  # Computed below
            "wallet_id": str(h.wallet_id),
            # B4 staking fields
            "is_staked": getattr(h, "is_staked", False) or False,
            "staking_apy": getattr(h, "staking_apy", 0.0) or 0.0,
            "staking_source": getattr(h, "staking_source", None),
        })

    # Compute allocation percentages
    for h in holdings_out:
        h["allocation_pct"] = round((h["value"] / total_value) * 100, 2) if total_value > 0 else 0.0

    change_24h_pct = (weighted_change / total_value) * 100 if total_value > 0 else 0.0

    # Build wallet summaries with per-wallet holding stats
    wallet_holdings_count: dict[str, int] = {}
    wallet_total_value: dict[str, int] = {}
    for h in holdings_out:
        wid = h["wallet_id"]
        wallet_holdings_count[wid] = wallet_holdings_count.get(wid, 0) + 1
        wallet_total_value[wid] = wallet_total_value.get(wid, 0) + h["value"]

    return {
        "total_value": total_value,
        "change_24h": round(change_24h_pct, 2),
        "holdings": holdings_out,
        "wallets": [
            {
                "id": str(w.id),
                "platform": w.platform.value if hasattr(w.platform, "value") else str(w.platform),
                "label": w.label,
                "chain": getattr(w, "chain", "ethereum") or "ethereum",
                "status": w.status.value if hasattr(w.status, "value") else str(w.status),
                "last_sync_at": w.last_sync_at.isoformat() if w.last_sync_at else None,
                "sync_error": w.sync_error,
                "holdings_count": wallet_holdings_count.get(str(w.id), 0),
                "total_value": wallet_total_value.get(str(w.id), 0),
                "created_at": w.created_at.isoformat(),
            }
            for w in wallets
        ],
    }


async def delete_wallet(db: AsyncSession, wallet_id: UUID, user_id: UUID) -> bool:
    """Delete a wallet and all its holdings."""
    result = await db.execute(
        select(CryptoWallet).where(
            CryptoWallet.id == wallet_id,
            CryptoWallet.user_id == user_id,
        )
    )
    wallet = result.scalar_one_or_none()
    if not wallet:
        return False

    await db.delete(wallet)
    await db.commit()
    return True
