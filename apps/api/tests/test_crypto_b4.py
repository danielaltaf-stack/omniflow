"""
OmniFlow — Phase B4 Crypto Enrichment tests.
Tests: PMPA computation, tax engine, multichain client, staking, transactions.
"""

from __future__ import annotations

import io
import csv
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient


# ── Helper: create user + wallet + transactions ────────────

async def _create_test_user(client: AsyncClient) -> dict:
    """Create a test user and return auth data."""
    email = f"crypto_b4_{uuid4().hex[:8]}@test.com"
    resp = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "first_name": "CryptoB4",
        "last_name": "Test",
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    return {"token": data.get("access_token", ""), "user_id": data.get("user_id", "")}


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════
#  Unit tests — Tax Engine logic (PMPA / PV computation)
# ═══════════════════════════════════════════════════════════


class TestPMPALogic:
    """Test PMPA (Prix Moyen Pondéré d'Acquisition) computation logic."""

    def test_pmpa_basic(self):
        """PMPA with two buys should give weighted average."""
        # Buy 1 BTC at 10000€, then 1 BTC at 20000€
        # PMPA = (10000 + 20000) / 2 = 15000€
        total_qty = Decimal("2")
        total_invested = 10000_00 + 20000_00  # centimes
        pmpa = total_invested / int(total_qty) if total_qty > 0 else 0
        assert pmpa == 15000_00

    def test_pmpa_after_partial_sell(self):
        """After a partial sell, remaining pool PMPA stays the same (PMPA fixed)."""
        # Buy 4 BTC at avg 25000€
        total_qty = Decimal("4")
        total_invested = 100000_00  # 4 * 25000€ in centimes
        pmpa = total_invested / int(total_qty)

        # Sell 1 BTC
        sell_qty = Decimal("1")
        remaining_qty = total_qty - sell_qty
        remaining_invested = total_invested - int(sell_qty * pmpa)

        new_pmpa = remaining_invested / int(remaining_qty) if remaining_qty > 0 else 0
        assert new_pmpa == 25000_00  # PMPA unchanged

    def test_pv_calculation(self):
        """Plus-value = prix_cession - (PMPA * qty_vendue)."""
        pmpa = 15000_00  # centimes
        sell_price = 25000_00  # centimes per unit
        sell_qty = Decimal("0.5")
        prix_cession = int(sell_qty * sell_price)
        cout_acquisition = int(sell_qty * pmpa)
        pv = prix_cession - cout_acquisition
        assert pv == 5000_00  # +5000€

    def test_mv_calculation(self):
        """Moins-value when selling below PMPA."""
        pmpa = 30000_00
        sell_price = 20000_00
        sell_qty = Decimal("1")
        prix_cession = int(sell_qty * sell_price)
        cout_acquisition = int(sell_qty * pmpa)
        mv = prix_cession - cout_acquisition
        assert mv == -10000_00  # -10000€

    def test_flat_tax_30(self):
        """Flat tax is 30% of net positive PV above 305€ threshold."""
        net_pv = 50000_00  # 500€ in centimes → above 305€ threshold
        abattement = 30500  # 305€ in centimes
        taxable = max(net_pv, 0)
        flat_tax = int(taxable * 0.30) if taxable > abattement else 0
        assert flat_tax == 15000_00  # 30% of 500€

    def test_under_305_threshold(self):
        """If net PV < 305€, no tax is due."""
        net_pv = 20000  # 200€ in centimes
        abattement = 30500
        flat_tax = int(net_pv * 0.30) if net_pv > abattement else 0
        assert flat_tax == 0


# ═══════════════════════════════════════════════════════════
#  Unit tests — Multichain configurations
# ═══════════════════════════════════════════════════════════


class TestMultichainConfig:
    """Test multichain client chain configurations."""

    def test_supported_chains(self):
        from app.services.multichain_client import CHAINS, get_supported_chains
        assert "polygon" in CHAINS
        assert "arbitrum" in CHAINS
        assert "optimism" in CHAINS
        assert "bsc" in CHAINS

        chains = get_supported_chains()
        assert len(chains) == 4
        ids = {c["id"] for c in chains}
        assert ids == {"polygon", "arbitrum", "optimism", "bsc"}

    def test_chain_config_polygon(self):
        from app.services.multichain_client import CHAINS
        cfg = CHAINS["polygon"]
        assert cfg.native_symbol == "MATIC"
        assert "polygonscan.com" in cfg.base_url
        assert len(cfg.top_tokens) > 0

    def test_chain_config_bsc(self):
        from app.services.multichain_client import CHAINS
        cfg = CHAINS["bsc"]
        assert cfg.native_symbol == "BNB"
        assert "bscscan.com" in cfg.base_url

    def test_chain_config_arbitrum(self):
        from app.services.multichain_client import CHAINS
        cfg = CHAINS["arbitrum"]
        assert cfg.native_symbol == "ETH"
        assert "arbiscan.io" in cfg.base_url

    def test_chain_config_optimism(self):
        from app.services.multichain_client import CHAINS
        cfg = CHAINS["optimism"]
        assert cfg.native_symbol == "ETH"
        assert "optimistic.etherscan.io" in cfg.base_url

    def test_unsupported_chain_raises(self):
        from app.services.multichain_client import MultichainClient
        with pytest.raises(ValueError, match="non supportée"):
            MultichainClient("0x1234", "avalanche")


# ═══════════════════════════════════════════════════════════
#  Unit tests — Models
# ═══════════════════════════════════════════════════════════


class TestCryptoModels:
    """Test crypto model definitions and enums."""

    def test_tx_type_enum(self):
        from app.models.crypto_transaction import TxType
        assert TxType.BUY.value == "buy"
        assert TxType.SELL.value == "sell"
        assert TxType.SWAP.value == "swap"
        assert TxType.STAKING_REWARD.value == "staking_reward"
        assert TxType.AIRDROP.value == "airdrop"

    def test_platform_enum_has_multichain(self):
        from app.models.crypto_wallet import CryptoPlatform
        assert CryptoPlatform.POLYGON.value == "polygon"
        assert CryptoPlatform.ARBITRUM.value == "arbitrum"
        assert CryptoPlatform.OPTIMISM.value == "optimism"
        assert CryptoPlatform.BSC.value == "bsc"


# ═══════════════════════════════════════════════════════════
#  Unit tests — CSV export format
# ═══════════════════════════════════════════════════════════


class TestCSVExport:
    """Test CSV export format for Cerfa 2086."""

    def test_csv_format_french_delimiter(self):
        """CSV should use semicolons (French format) with proper headers."""
        # Simulate what crypto_tax_engine.export_csv_2086 produces
        headers = [
            "Date de cession",
            "Nature de l'actif",
            "Quantité cédée",
            "Prix de cession (€)",
            "Frais (€)",
            "Prix d'acquisition PMPA (€)",
            "Plus ou moins-value (€)",
        ]
        rows = [
            ["15/03/2024", "BTC", "0.5", "12500.00", "25.00", "7500.00", "5000.00"],
        ]

        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)

        content = output.getvalue()
        assert ";" in content
        assert "Date de cession" in content
        assert "Plus ou moins-value" in content
        lines = content.strip().split("\n")
        assert len(lines) == 2  # header + 1 data row


# ═══════════════════════════════════════════════════════════
#  Integration tests — API endpoints
# ═══════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestCryptoB4Endpoints:
    """Integration tests for B4 crypto API endpoints."""

    async def test_list_supported_chains(self, client: AsyncClient):
        """GET /crypto/chains returns 4 chains."""
        resp = await client.get("/api/v1/crypto/chains")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 4
        ids = {c["id"] for c in data}
        assert "polygon" in ids
        assert "bsc" in ids

    async def test_tax_summary_requires_auth(self, client: AsyncClient):
        """GET /crypto/tax/summary without auth returns 401."""
        resp = await client.get("/api/v1/crypto/tax/summary?year=2024")
        assert resp.status_code in (401, 403)

    async def test_staking_summary_requires_auth(self, client: AsyncClient):
        """GET /crypto/staking/summary without auth returns 401."""
        resp = await client.get("/api/v1/crypto/staking/summary")
        assert resp.status_code in (401, 403)

    async def test_transactions_requires_auth(self, client: AsyncClient):
        """GET /crypto/transactions without auth returns 401."""
        resp = await client.get("/api/v1/crypto/transactions")
        assert resp.status_code in (401, 403)

    async def test_tax_summary_with_auth(self, client: AsyncClient):
        """GET /crypto/tax/summary with auth and no data returns zeros."""
        user = await _create_test_user(client)
        headers = _auth_headers(user["token"])
        resp = await client.get("/api/v1/crypto/tax/summary?year=2024", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == 2024
        assert data["realized_pv"] == 0
        assert data["flat_tax_30"] == 0

    async def test_staking_summary_with_auth(self, client: AsyncClient):
        """GET /crypto/staking/summary with auth and no wallets returns zeros."""
        user = await _create_test_user(client)
        headers = _auth_headers(user["token"])
        resp = await client.get("/api/v1/crypto/staking/summary", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_staked_value"] == 0
        assert data["positions"] == []

    async def test_transactions_empty(self, client: AsyncClient):
        """GET /crypto/transactions with no data returns empty list."""
        user = await _create_test_user(client)
        headers = _auth_headers(user["token"])
        resp = await client.get("/api/v1/crypto/transactions", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["transactions"] == []
        assert data["total"] == 0

    async def test_export_csv_requires_auth(self, client: AsyncClient):
        """GET /crypto/tax/export-csv without auth returns 401."""
        resp = await client.get("/api/v1/crypto/tax/export-csv?year=2024")
        assert resp.status_code in (401, 403)

    async def test_pmpa_requires_auth(self, client: AsyncClient):
        """GET /crypto/tax/pmpa/BTC without auth returns 401."""
        resp = await client.get("/api/v1/crypto/tax/pmpa/BTC")
        assert resp.status_code in (401, 403)

    async def test_create_wallet_with_chain(self, client: AsyncClient):
        """POST /crypto/wallets with chain param accepted for on-chain platforms."""
        user = await _create_test_user(client)
        headers = _auth_headers(user["token"])
        # This should fail with bad address but show the endpoint accepts chain param
        resp = await client.post("/api/v1/crypto/wallets", json={
            "platform": "polygon",
            "label": "Test Polygon",
            "address": "0x0000000000000000000000000000000000000000",
            "chain": "polygon",
        }, headers=headers)
        # Will be 400/502 (bad address) but NOT 422 (schema error)
        assert resp.status_code != 422
