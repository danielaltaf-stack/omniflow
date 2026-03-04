"""
OmniFlow — Debt API integration tests.

Covers CRUD, amortization, early repayment, invest-vs-repay, consolidation,
and debt impact on networth.
"""

from __future__ import annotations

import uuid

import httpx
import pytest

# ── Helpers ──────────────────────────────────────────────────────

_TEST_PASSWORD = "Str0ng!Pass#42"


def _unique_email() -> str:
    return f"debt_test_{uuid.uuid4().hex[:8]}@omniflow.dev"


async def _register_and_get_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a user and return Authorization headers."""
    email = _unique_email()
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Debt Tester",
            "email": email,
            "password": _TEST_PASSWORD,
            "password_confirm": _TEST_PASSWORD,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


_SAMPLE_DEBT = {
    "label": "Prêt immobilier RP",
    "debt_type": "mortgage",
    "creditor": "Crédit Agricole",
    "initial_amount": 20_000_000,  # 200 000€
    "remaining_amount": 15_000_000,  # 150 000€
    "interest_rate_pct": 1.35,
    "insurance_rate_pct": 0.30,
    "monthly_payment": 85_000,  # 850€
    "start_date": "2022-01-01",
    "end_date": "2042-01-01",
    "duration_months": 240,
    "early_repayment_fee_pct": 3.0,
    "payment_type": "constant_annuity",
    "is_deductible": False,
}


# ═══════════════════════════════════════════════════════════════════
#  CRUD
# ═══════════════════════════════════════════════════════════════════


async def test_create_debt(client: httpx.AsyncClient):
    """POST /debts → 201, returns created debt."""
    headers = await _register_and_get_headers(client)
    resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["label"] == "Prêt immobilier RP"
    assert body["debt_type"] == "mortgage"
    assert body["initial_amount"] == 20_000_000
    assert body["remaining_amount"] == 15_000_000
    assert "id" in body
    assert "progress_pct" in body


async def test_list_debts(client: httpx.AsyncClient):
    """GET /debts → 200, returns summary with debts list."""
    headers = await _register_and_get_headers(client)
    # Create one
    await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)

    resp = await client.get("/api/v1/debts", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["debts_count"] >= 1
    assert len(body["debts"]) >= 1
    assert "total_remaining" in body
    assert "total_monthly" in body
    assert "weighted_avg_rate" in body


async def test_get_debt_by_id(client: httpx.AsyncClient):
    """GET /debts/{id} → 200."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/debts/{debt_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == debt_id


async def test_update_debt(client: httpx.AsyncClient):
    """PUT /debts/{id} → 200, fields updated."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/debts/{debt_id}",
        json={"label": "Prêt modifié", "remaining_amount": 14_000_000},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["label"] == "Prêt modifié"
    assert resp.json()["remaining_amount"] == 14_000_000


async def test_delete_debt(client: httpx.AsyncClient):
    """DELETE /debts/{id} → 204, then GET → 404."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/debts/{debt_id}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/debts/{debt_id}", headers=headers)
    assert get_resp.status_code == 404


async def test_create_debt_validation_remaining_gt_initial(client: httpx.AsyncClient):
    """remaining_amount > initial_amount → 422."""
    headers = await _register_and_get_headers(client)
    bad = {**_SAMPLE_DEBT, "remaining_amount": 25_000_000}
    resp = await client.post("/api/v1/debts", json=bad, headers=headers)
    assert resp.status_code == 422


async def test_create_debt_unauthenticated(client: httpx.AsyncClient):
    """POST /debts without token → 401."""
    resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT)
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════
#  AMORTIZATION TABLE
# ═══════════════════════════════════════════════════════════════════


async def test_amortization_table(client: httpx.AsyncClient):
    """GET /debts/{id}/amortization → 200 with rows."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/debts/{debt_id}/amortization", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "rows" in body
    assert len(body["rows"]) > 0
    assert "total_interest" in body
    assert "total_cost" in body
    # Each row has required fields
    row = body["rows"][0]
    assert "payment_number" in row
    assert "principal" in row
    assert "interest" in row
    assert "remaining" in row


# ═══════════════════════════════════════════════════════════════════
#  EARLY REPAYMENT SIMULATION
# ═══════════════════════════════════════════════════════════════════


async def test_early_repayment(client: httpx.AsyncClient):
    """GET /debts/{id}/simulate-early-repayment → 200."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/debts/{debt_id}/simulate-early-repayment",
        params={"amount": 5_000_000, "at_month": 12},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "reduced_duration" in body
    assert "reduced_payment" in body
    assert body["reduced_duration"]["interest_saved"] >= 0


# ═══════════════════════════════════════════════════════════════════
#  INVEST VS REPAY
# ═══════════════════════════════════════════════════════════════════


async def test_invest_vs_repay(client: httpx.AsyncClient):
    """GET /debts/{id}/invest-vs-repay → 200."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/debts/{debt_id}/invest-vs-repay",
        params={"amount": 5_000_000, "return_rate_pct": 7.0, "horizon_months": 120},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["verdict"] in ("invest", "repay")
    assert "invest_net_gain" in body
    assert "repay_net_gain" in body


# ═══════════════════════════════════════════════════════════════════
#  CONSOLIDATION
# ═══════════════════════════════════════════════════════════════════


async def test_consolidation(client: httpx.AsyncClient):
    """GET /debts/consolidation → 200 with strategies."""
    headers = await _register_and_get_headers(client)
    # Need at least 1 debt
    await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    # Create a second debt
    second = {
        **_SAMPLE_DEBT,
        "label": "Crédit conso",
        "debt_type": "consumer",
        "initial_amount": 1_500_000,
        "remaining_amount": 1_000_000,
        "interest_rate_pct": 5.0,
        "monthly_payment": 30_000,
        "duration_months": 48,
    }
    await client.post("/api/v1/debts", json=second, headers=headers)

    resp = await client.get(
        "/api/v1/debts/consolidation",
        params={"extra_budget": 10_000},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["debts_count"] == 2
    assert "avalanche_order" in body
    assert "snowball_order" in body
    assert len(body["avalanche_order"]) == 2


# ═══════════════════════════════════════════════════════════════════
#  RECORD PAYMENT
# ═══════════════════════════════════════════════════════════════════


async def test_record_payment(client: httpx.AsyncClient):
    """PATCH /debts/{id}/payment → 200, remaining updated."""
    headers = await _register_and_get_headers(client)
    create_resp = await client.post("/api/v1/debts", json=_SAMPLE_DEBT, headers=headers)
    debt_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/debts/{debt_id}/payment",
        json={
            "payment_date": "2024-06-01",
            "total_amount": 85_000,
            "principal_amount": 70_000,
            "interest_amount": 12_000,
            "insurance_amount": 3_000,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    # remaining should have decreased by principal amount
    assert body["remaining_amount"] == 15_000_000 - 70_000
