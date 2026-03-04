"""
OmniFlow — Digital Vault (Phase G) integration + unit tests.

Covers all 7 entities:
  - Tangible Assets (CRUD + depreciation + warranty)
  - NFT Assets (CRUD + gain/loss)
  - Card Wallet (CRUD + recommendation)
  - Loyalty Programs (CRUD + conversion)
  - Subscriptions (CRUD + analytics)
  - Vault Documents (CRUD + encryption)
  - Peer Debts (CRUD + settle + analytics)
  - Shadow Wealth summary
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import httpx
import pytest

from app.models.subscription import BillingCycle
from app.services import digital_vault_engine as engine

# ── Helpers ──────────────────────────────────────────────

_TEST_PASSWORD = "Str0ng!Pass#42"


def _unique_email() -> str:
    return f"vault_test_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a user and return Authorization headers."""
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Vault Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════
#  UNIT TESTS — Pure computation (no DB)
# ═══════════════════════════════════════════════════════════


class TestDepreciation:
    """Test depreciation computation logic."""

    def test_linear_depreciation(self):
        """Linear depreciation over 3 years at 20%/year → residual 10%."""
        purchase = date.today() - timedelta(days=int(3 * 365.25))
        result = engine.compute_depreciation(
            purchase_price=100_000,
            purchase_date=purchase,
            depreciation_type="linear",
            depreciation_rate=20.0,
            residual_pct=10.0,
        )
        # Engine formula: value = price * max(residual%, 1 - rate% * years)
        # ~3 years at 20% → factor ≈ max(0.1, 1.0 - 0.6) = 0.4 → ~40k
        # Small tolerance for fractional-year rounding (timedelta vs 365.25)
        assert result == pytest.approx(40_000, abs=1000)

    def test_linear_capped_at_residual(self):
        """After full depreciation, value = residual."""
        purchase = date.today() - timedelta(days=int(10 * 365.25))
        result = engine.compute_depreciation(
            purchase_price=100_000,
            purchase_date=purchase,
            depreciation_type="linear",
            depreciation_rate=20.0,
            residual_pct=10.0,
        )
        # Capped at residual = 10% of 100k = 10k
        assert result == 10_000

    def test_declining_depreciation(self):
        """Declining balance depreciation."""
        purchase = date.today() - timedelta(days=int(2 * 365.25))
        result = engine.compute_depreciation(
            purchase_price=100_000,
            purchase_date=purchase,
            depreciation_type="declining",
            depreciation_rate=20.0,
            residual_pct=10.0,
        )
        # Year 1: 100k * (1-0.2) = 80k
        # Year 2: 80k * (1-0.2) = ~64k
        # Small tolerance for fractional-year rounding
        assert result == pytest.approx(64_000, abs=1000)

    def test_none_depreciation(self):
        """No depreciation → value unchanged."""
        purchase = date.today() - timedelta(days=int(5 * 365.25))
        result = engine.compute_depreciation(
            purchase_price=100_000,
            purchase_date=purchase,
            depreciation_type="none",
            depreciation_rate=20.0,
            residual_pct=10.0,
        )
        assert result == 100_000

    def test_depreciation_pct_calculation(self):
        """Depreciation percentage = (purchase - current) / purchase * 100."""
        pct = engine.get_depreciation_pct(100_000, 60_000)
        assert abs(pct - 40.0) < 0.01

    def test_depreciation_pct_zero_purchase(self):
        """No division by zero."""
        pct = engine.get_depreciation_pct(0, 0)
        assert pct == 0.0


class TestWarranty:
    """Test warranty status helper."""

    def test_active_warranty(self):
        """Warranty expires in 60 days → active."""
        future = date.today() + timedelta(days=60)
        assert engine.get_warranty_status(future) == "active"

    def test_expiring_soon_warranty(self):
        """Warranty expires in 25 days → expiring_soon."""
        soon = date.today() + timedelta(days=25)
        assert engine.get_warranty_status(soon) == "expiring_soon"

    def test_expired_warranty(self):
        """Warranty expired → expired."""
        past = date.today() - timedelta(days=5)
        assert engine.get_warranty_status(past) == "expired"

    def test_no_warranty(self):
        """No warranty date → none."""
        assert engine.get_warranty_status(None) == "none"


class TestNFTGainLoss:
    """Test NFT gain/loss computation."""

    def test_positive_gain(self):
        """Floor > purchase → gain."""

        class FakeNFT:
            purchase_price_eur = 50_000
            current_floor_eur = 80_000

        gain, pct = engine.compute_nft_gain_loss(FakeNFT())
        assert gain == 30_000
        assert abs(pct - 60.0) < 0.01

    def test_loss(self):
        """Floor < purchase → loss."""

        class FakeNFT:
            purchase_price_eur = 80_000
            current_floor_eur = 50_000

        gain, pct = engine.compute_nft_gain_loss(FakeNFT())
        assert gain == -30_000
        assert abs(pct - (-37.5)) < 0.01

    def test_missing_data(self):
        """Missing prices → None."""

        class FakeNFT:
            purchase_price_eur = None
            current_floor_eur = None

        gain, pct = engine.compute_nft_gain_loss(FakeNFT())
        assert gain is None
        assert pct is None


class TestSubscriptionCost:
    """Test subscription cost normalization."""

    def test_monthly_to_monthly(self):
        """Monthly 999 → monthly 999."""
        result = engine.compute_monthly_cost(999, "monthly")
        assert result == 999

    def test_annual_to_monthly(self):
        """Annual 11988 → monthly 999."""
        result = engine.compute_monthly_cost(11_988, "annual")
        assert result == 999

    def test_quarterly_to_monthly(self):
        """Quarterly 2997 → monthly 999."""
        result = engine.compute_monthly_cost(2_997, "quarterly")
        assert result == 999

    def test_weekly_to_annual(self):
        """Weekly 200 → annual 200 * 52 = 10400."""
        result = engine.compute_annual_cost(200, "weekly")
        assert result == 200 * 52


class TestDocumentExpiry:
    """Test document expiry status."""

    def test_valid_document(self):
        """Expires in 180 days → valid."""
        future = date.today() + timedelta(days=180)
        status, days = engine.get_document_expiry_status(future, 30)
        assert status == "valid"
        assert days == 180

    def test_expiring_soon_document(self):
        """Expires in 20 days, reminder at 30 → expiring_soon."""
        soon = date.today() + timedelta(days=20)
        status, days = engine.get_document_expiry_status(soon, 30)
        assert status == "expiring_soon"
        assert days == 20

    def test_expired_document(self):
        """Expired yesterday → expired."""
        past = date.today() - timedelta(days=1)
        status, days = engine.get_document_expiry_status(past, 30)
        assert status == "expired"

    def test_no_expiry(self):
        """No expiry date → no_expiry."""
        status, days = engine.get_document_expiry_status(None, 30)
        assert status == "no_expiry"
        assert days is None


class TestCardRecommendation:
    """Test card recommendation engine."""

    def test_recommend_best_travel_card(self):
        """Recommend card with best travel insurance for travel purchase."""

        class FakeCard:
            def __init__(self, name, tier, is_active, cashback_pct, insurance_level, benefits):
                self.id = uuid.uuid4()
                self.card_name = name
                self.card_tier = tier
                self.is_active = is_active
                self.cashback_pct = cashback_pct
                self.insurance_level = insurance_level
                self.benefits = benefits
                self.expiry_year = 2030
                self.expiry_month = 12

        basic = FakeCard("Basic", "standard", True, 0, "none", [])
        gold = FakeCard("Gold", "gold", True, 0.5, "basic", [])
        plat = FakeCard("Platinum", "platinum", True, 1.0, "extended", [])

        result = engine.recommend_card([basic, gold, plat], 50_000, "travel")
        assert result["recommended_card"] is not None
        # Platinum should score highest for travel
        assert result["recommended_card"].card_name == "Platinum"

    def test_recommend_no_active_cards(self):
        """No active cards → no recommendation."""
        result = engine.recommend_card([], 50_000, "travel")
        assert result["recommended_card"] is None


class TestSubscriptionAnalytics:
    """Test subscription analytics engine."""

    def test_analytics_empty(self):
        """No subscriptions → zeros."""
        analytics = engine.compute_subscription_analytics([])
        assert analytics["total_monthly_cost"] == 0
        assert analytics["active_count"] == 0
        assert analytics["optimization_score"] == 100

    def test_analytics_with_subs(self):
        """Analytics with subscription data."""

        class FakeSub:
            def __init__(self, name, amount, cycle, is_active, category, next_billing, cancel_deadline, is_essential=False, auto_renew=True):
                self.id = uuid.uuid4()
                self.name = name
                self.amount = amount
                self.billing_cycle = cycle
                self.is_active = is_active
                self.category = category
                self.next_billing_date = next_billing
                self.cancellation_deadline = cancel_deadline
                self.is_essential = is_essential
                self.auto_renew = auto_renew

        today = date.today()
        subs = [
            FakeSub("Netflix", 1799, "monthly", True, "streaming", today + timedelta(days=5), None),
            FakeSub("Spotify", 999, "monthly", True, "streaming", today + timedelta(days=10), None),
            FakeSub("Old Gym", 3999, "monthly", False, "fitness", None, None),
        ]
        analytics = engine.compute_subscription_analytics(subs)
        assert analytics["active_count"] == 2
        assert analytics["total_monthly_cost"] == 1799 + 999  # only active


class TestPeerDebtAnalytics:
    """Test P2P debt analytics."""

    def test_analytics_empty(self):
        """No debts → zeros."""
        analytics = engine.compute_peer_debt_analytics([])
        assert analytics["total_lent"] == 0
        assert analytics["net_balance"] == 0
        assert analytics["repayment_rate"] == 100.0

    def test_analytics_mixed(self):
        """Mixed lent/borrowed debts."""

        class FakeDebt:
            def __init__(self, direction, amount, settled, name):
                self.direction = direction
                self.amount = amount
                self.is_settled = settled
                self.counterparty_name = name
                self.due_date = date.today() - timedelta(days=5) if not settled else None
                self.settled_date = None

        debts = [
            FakeDebt("lent", 10_000, False, "Alice"),
            FakeDebt("lent", 5_000, True, "Bob"),
            FakeDebt("borrowed", 3_000, False, "Charlie"),
        ]
        analytics = engine.compute_peer_debt_analytics(debts)
        # Only active debts counted for lent/borrowed totals
        assert analytics["total_lent"] == 10_000  # only active Alice
        assert analytics["total_borrowed"] == 3_000
        assert analytics["net_balance"] == 7_000  # 10k - 3k
        assert analytics["active_count"] == 2
        assert analytics["settled_count"] == 1


# ═══════════════════════════════════════════════════════════
#  INTEGRATION TESTS — Full API round-trips
# ═══════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_tangible_asset_crud(client: httpx.AsyncClient):
    """Full CRUD cycle for tangible assets."""
    headers = await _register_and_get_headers(client)

    # Create
    resp = await client.post("/api/v1/vault/assets", json={
        "name": "MacBook Pro M3",
        "category": "tech",
        "brand": "Apple",
        "model_name": "MacBook Pro 16",
        "purchase_price": 349_900,
        "purchase_date": "2024-01-15",
        "condition": "mint",
        "warranty_expires": (date.today() + timedelta(days=180)).isoformat(),
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "MacBook Pro M3"
    assert body["category"] == "tech"
    assert body["purchase_price"] == 349_900
    asset_id = body["id"]

    # List
    resp = await client.get("/api/v1/vault/assets", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Get
    resp = await client.get(f"/api/v1/vault/assets/{asset_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == asset_id

    # Update
    resp = await client.put(f"/api/v1/vault/assets/{asset_id}", json={
        "condition": "excellent",
        "notes": "Légère rayure",
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["condition"] == "excellent"

    # Revalue
    resp = await client.post(f"/api/v1/vault/assets/{asset_id}/revalue", headers=headers)
    assert resp.status_code == 200

    # Delete
    resp = await client.delete(f"/api/v1/vault/assets/{asset_id}", headers=headers)
    assert resp.status_code == 204

    # Verify deleted
    resp = await client.get(f"/api/v1/vault/assets/{asset_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_nft_crud(client: httpx.AsyncClient):
    """Create, list, delete NFTs."""
    headers = await _register_and_get_headers(client)

    resp = await client.post("/api/v1/vault/nfts", json={
        "collection_name": "Bored Ape Yacht Club",
        "token_id": "3749",
        "name": "BAYC #3749",
        "blockchain": "ethereum",
        "purchase_price_eur": 1_200_000,
        "current_floor_eur": 800_000,
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["collection_name"] == "Bored Ape Yacht Club"
    assert body["gain_loss_eur"] == -400_000
    nft_id = body["id"]

    resp = await client.get("/api/v1/vault/nfts", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.delete(f"/api/v1/vault/nfts/{nft_id}", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_card_wallet_crud(client: httpx.AsyncClient):
    """Create, list, recommend cards."""
    headers = await _register_and_get_headers(client)

    resp = await client.post("/api/v1/vault/cards", json={
        "card_name": "Visa Gold BNP",
        "bank_name": "BNP Paribas",
        "card_type": "visa",
        "card_tier": "gold",
        "last_four": "4567",
        "expiry_month": 12,
        "expiry_year": 2027,
        "monthly_fee": 500,
        "annual_fee": 0,
        "cashback_pct": 0.5,
        "insurance_level": "basic",
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["last_four"] == "4567"
    assert body["card_tier"] == "gold"

    # Recommend
    resp = await client.post("/api/v1/vault/cards/recommend", json={
        "amount": 50_000,
        "category": "travel",
    }, headers=headers)
    assert resp.status_code == 200
    rec = resp.json()
    assert "reason" in rec


@pytest.mark.asyncio
async def test_loyalty_program_crud(client: httpx.AsyncClient):
    """Create, list, update loyalty programs."""
    headers = await _register_and_get_headers(client)

    resp = await client.post("/api/v1/vault/loyalty", json={
        "program_name": "Flying Blue",
        "provider": "Air France",
        "program_type": "airline",
        "points_balance": 45_000,
        "points_unit": "miles",
        "eur_per_point": 0.01,
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["points_balance"] == 45_000
    assert body["estimated_value"] == 45_000  # 45000 * 0.01€ = 450€ = 45000 centimes
    prog_id = body["id"]

    # Update points
    resp = await client.put(f"/api/v1/vault/loyalty/{prog_id}", json={
        "points_balance": 50_000,
    }, headers=headers)
    assert resp.status_code == 200

    resp = await client.get("/api/v1/vault/loyalty", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_subscription_crud_and_analytics(client: httpx.AsyncClient):
    """Create subscriptions and get analytics."""
    headers = await _register_and_get_headers(client)

    # Netflix
    resp = await client.post("/api/v1/vault/subscriptions", json={
        "name": "Netflix Premium",
        "provider": "Netflix",
        "category": "streaming",
        "amount": 1799,
        "billing_cycle": "monthly",
        "next_billing_date": (date.today() + timedelta(days=5)).isoformat(),
        "auto_renew": True,
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["monthly_cost"] == 1799

    # Spotify Annual
    resp = await client.post("/api/v1/vault/subscriptions", json={
        "name": "Spotify Family",
        "provider": "Spotify",
        "category": "streaming",
        "amount": 16_788,
        "billing_cycle": "annual",
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["annual_cost"] == 16_788

    # Analytics
    resp = await client.get("/api/v1/vault/subscriptions/analytics", headers=headers)
    assert resp.status_code == 200
    analytics = resp.json()
    assert analytics["count_active"] == 2
    assert "optimization_score" in analytics


@pytest.mark.asyncio
async def test_vault_document_crud(client: httpx.AsyncClient):
    """Create document with encrypted number, verify it."""
    headers = await _register_and_get_headers(client)

    resp = await client.post("/api/v1/vault/documents", json={
        "name": "Passeport",
        "category": "identity",
        "document_type": "passport",
        "issuer": "Préfecture",
        "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
        "document_number": "12AB34567",
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Passeport"
    assert body["has_document_number"] is True
    assert body["expiry_status"] == "valid"
    doc_id = body["id"]

    resp = await client.get("/api/v1/vault/documents", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.delete(f"/api/v1/vault/documents/{doc_id}", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_peer_debt_crud_and_settle(client: httpx.AsyncClient):
    """Create, settle, and analyze P2P debts."""
    headers = await _register_and_get_headers(client)

    # Lend
    resp = await client.post("/api/v1/vault/peer-debts", json={
        "counterparty_name": "Jean Dupont",
        "direction": "lent",
        "amount": 15_000,
        "description": "Remboursement restaurant",
        "due_date": (date.today() + timedelta(days=14)).isoformat(),
    }, headers=headers)
    assert resp.status_code == 201
    debt_id = resp.json()["id"]
    assert resp.json()["is_settled"] is False

    # Borrow
    resp = await client.post("/api/v1/vault/peer-debts", json={
        "counterparty_name": "Marie Martin",
        "direction": "borrowed",
        "amount": 5_000,
    }, headers=headers)
    assert resp.status_code == 201

    # Settle first debt
    resp = await client.post(f"/api/v1/vault/peer-debts/{debt_id}/settle", json={}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_settled"] is True

    # Analytics
    resp = await client.get("/api/v1/vault/peer-debts/analytics", headers=headers)
    assert resp.status_code == 200
    analytics = resp.json()
    assert analytics["total_lent"] == 15_000
    assert analytics["total_borrowed"] == 5_000
    assert analytics["total_settled"] == 1


@pytest.mark.asyncio
async def test_vault_summary(client: httpx.AsyncClient):
    """Shadow wealth summary aggregates all entities."""
    headers = await _register_and_get_headers(client)

    # Create one of each
    await client.post("/api/v1/vault/assets", json={
        "name": "Rolex", "category": "jewelry", "purchase_price": 800_000,
        "purchase_date": "2023-06-01",
    }, headers=headers)
    await client.post("/api/v1/vault/nfts", json={
        "name": "CryptoPunk", "collection_name": "CryptoPunks",
        "token_id": "42", "current_floor_eur": 300_000,
    }, headers=headers)
    await client.post("/api/v1/vault/loyalty", json={
        "program_name": "Amex MR", "provider": "Amex",
        "points_balance": 100_000, "eur_per_point": 0.008,
    }, headers=headers)
    await client.post("/api/v1/vault/subscriptions", json={
        "name": "Netflix", "provider": "Netflix",
        "amount": 1799, "billing_cycle": "monthly",
    }, headers=headers)
    await client.post("/api/v1/vault/peer-debts", json={
        "counterparty_name": "Alice", "direction": "lent", "amount": 20_000,
    }, headers=headers)

    resp = await client.get("/api/v1/vault/summary", headers=headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["tangible_assets_count"] == 1
    assert summary["tangible_assets_value"] > 0
    assert summary["nft_count"] == 1
    assert summary["loyalty_programs_count"] == 1
    assert summary["subscriptions_active_count"] == 1
    assert summary["peer_debt_lent"] == 20_000
    assert summary["shadow_wealth_total"] > 0


@pytest.mark.asyncio
async def test_asset_not_found(client: httpx.AsyncClient):
    """404 for non-existent asset."""
    headers = await _register_and_get_headers(client)
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/vault/assets/{fake_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_warranties_endpoint(client: httpx.AsyncClient):
    """GET /vault/assets/warranties returns upcoming warranty expirations."""
    headers = await _register_and_get_headers(client)

    # Asset with warranty expiring soon
    await client.post("/api/v1/vault/assets", json={
        "name": "TV Samsung",
        "category": "tech",
        "purchase_price": 150_000,
        "purchase_date": "2023-01-01",
        "warranty_expires": (date.today() + timedelta(days=15)).isoformat(),
    }, headers=headers)

    # Asset with warranty far away
    await client.post("/api/v1/vault/assets", json={
        "name": "Lave-linge",
        "category": "furniture",
        "purchase_price": 70_000,
        "purchase_date": "2024-01-01",
        "warranty_expires": (date.today() + timedelta(days=300)).isoformat(),
    }, headers=headers)

    resp = await client.get("/api/v1/vault/assets/warranties?days=30", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["name"] == "TV Samsung"
