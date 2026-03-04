"""
OmniFlow — Bank connections CRUD + sync endpoints.
Handles both Woob (traditional banks) and Trade Republic (custom API).
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.encryption import encrypt, decrypt
from app.models.account import Account
from app.models.bank_connection import BankConnection, ConnectionStatus
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.bank import (
    ConnectionResponse,
    CreateConnectionRequest,
    SyncResponse,
)
from app.woob_engine.banks import get_bank_info, is_custom_module
from app.woob_engine.sync_service import run_sync

router = APIRouter(prefix="/connections", tags=["Connections"])


# ── Schemas for 2FA ──────────────────────────────────────────

class Verify2FARequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=4, description="4-digit 2FA code")


class Verify2FAResponse(BaseModel):
    connection_id: uuid.UUID
    status: str
    accounts_synced: int = 0
    transactions_synced: int = 0
    error: str | None = None
    process_id: str | None = None


def _connection_to_response(conn: BankConnection) -> ConnectionResponse:
    return ConnectionResponse(
        id=conn.id,
        bank_module=conn.bank_module,
        bank_name=conn.bank_name,
        status=conn.status.value if isinstance(conn.status, ConnectionStatus) else conn.status,
        last_sync_at=conn.last_sync_at,
        last_error=conn.last_error,
        created_at=conn.created_at,
        accounts_count=len(conn.accounts) if conn.accounts else 0,
    )


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all bank connections for the current user."""
    result = await db.execute(
        select(BankConnection).where(BankConnection.user_id == user.id)
    )
    connections = result.scalars().all()
    return [_connection_to_response(c) for c in connections]


@router.post("", response_model=SyncResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    body: CreateConnectionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new bank connection and trigger initial sync."""
    # Validate bank module
    bank = get_bank_info(body.bank_module)
    if not bank:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module bancaire '{body.bank_module}' non supporté.",
        )

    # ── Trade Republic: special 2FA flow ─────────────────────
    if body.bank_module == "traderepublic":
        return await _create_traderepublic_connection(body, bank, user, db)

    # ── Standard Woob banks ──────────────────────────────────
    cred_json = json.dumps(body.credentials).encode("utf-8")
    cred_bytes = encrypt(cred_json)

    connection = BankConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        bank_module=body.bank_module,
        bank_name=bank.name if bank else body.bank_module,
        encrypted_credentials=cred_bytes,
        status=ConnectionStatus.SYNCING,
    )
    db.add(connection)
    await db.flush()
    await db.commit()

    result = await run_sync(connection, db)
    total_txns = sum(len(t) for t in result.transactions.values())

    return SyncResponse(
        connection_id=connection.id,
        status="active" if result.success else ("sca_required" if result.sca_required else "error"),
        accounts_synced=len(result.accounts),
        transactions_synced=total_txns,
        error=result.error,
    )


async def _create_traderepublic_connection(
    body: CreateConnectionRequest,
    bank,
    user: User,
    db: AsyncSession,
) -> SyncResponse:
    """
    Start Trade Republic connection:
    1. Call TR login API with phone + PIN
    2. TR sends a 2FA code to the user's phone
    3. Return connection with sca_required status
    4. User must then call POST /connections/{id}/verify-2fa
    """
    from app.services.traderepublic_client import (
        TradeRepublicClient,
        TradeRepublicAuthError,
        TradeRepublicRateLimitError,
        TradeRepublicError,
    )

    phone = body.credentials.get("phone_number", "").strip()
    pin = body.credentials.get("pin", "").strip()

    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Numéro de téléphone requis. Exemple : +33612345678 ou 0612345678",
        )
    if not pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code PIN à 4 chiffres requis.",
        )
    if len(pin) != 4 or not pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code PIN doit contenir exactement 4 chiffres.",
        )

    # Normalize phone number: remove spaces, dashes, dots
    phone = phone.replace(" ", "").replace("-", "").replace(".", "").replace("(", "").replace(")", "")
    if not phone.startswith("+"):
        # Assume French number if no country code
        phone = f"+33{phone.lstrip('0')}"

    # Call TR login API
    client = TradeRepublicClient()
    try:
        process_id = await client.login(phone, pin)
    except TradeRepublicAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )
    except TradeRepublicRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        )
    except TradeRepublicError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )

    # Store credentials + processId (encrypted)
    cred_data = {
        "phone_number": phone,
        "pin": pin,
        "process_id": process_id,
        # session_token will be added after 2FA verification
    }
    cred_bytes = encrypt(json.dumps(cred_data).encode("utf-8"))

    connection = BankConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        bank_module="traderepublic",
        bank_name="Trade Republic",
        encrypted_credentials=cred_bytes,
        status=ConnectionStatus.SCA_REQUIRED,
        last_error="En attente du code 2FA.",
    )
    db.add(connection)
    await db.commit()

    return SyncResponse(
        connection_id=connection.id,
        status="sca_required",
        accounts_synced=0,
        transactions_synced=0,
        error="Ouvrez l'app Trade Republic sur votre téléphone pour voir le code 2FA (notification push, pas SMS).",
    )


@router.post("/{connection_id}/verify-2fa", response_model=SyncResponse)
async def verify_2fa(
    connection_id: uuid.UUID,
    body: Verify2FARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Complete Trade Republic 2FA verification and trigger full sync.
    """
    from app.services.traderepublic_client import (
        TradeRepublicClient,
        TradeRepublicAuthError,
        TradeRepublicError,
    )

    result = await db.execute(
        select(BankConnection).where(
            BankConnection.id == connection_id,
            BankConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connexion introuvable.",
        )

    if connection.bank_module != "traderepublic":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La vérification 2FA n'est disponible que pour Trade Republic.",
        )

    # Decrypt stored credentials
    try:
        cred_json = decrypt(connection.encrypted_credentials)
        credentials = json.loads(cred_json.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible de déchiffrer les identifiants.",
        )

    process_id = credentials.get("process_id")
    if not process_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun processus 2FA en cours. Veuillez recommencer la connexion.",
        )

    # Verify 2FA with Trade Republic
    client = TradeRepublicClient()
    try:
        session = await client.verify_2fa(process_id, body.code)
    except TradeRepublicAuthError as e:
        connection.last_error = str(e)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )
    except TradeRepublicError as e:
        connection.last_error = str(e)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )

    # Store session tokens in encrypted credentials for future syncs
    credentials["session_token"] = session.session_token
    credentials["refresh_token"] = session.refresh_token
    credentials["session_cookies"] = session.cookies
    credentials["session_created_at"] = session.created_at
    credentials.pop("process_id", None)  # Remove consumed processId

    connection.encrypted_credentials = encrypt(
        json.dumps(credentials).encode("utf-8")
    )
    await db.flush()
    await db.commit()

    # Now run the actual data sync
    sync_result = await run_sync(connection, db)
    total_txns = sum(len(t) for t in sync_result.transactions.values())

    return SyncResponse(
        connection_id=connection.id,
        status="active" if sync_result.success else "error",
        accounts_synced=len(sync_result.accounts),
        transactions_synced=total_txns,
        error=sync_result.error,
    )


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a bank connection and all associated data."""
    result = await db.execute(
        select(BankConnection).where(
            BankConnection.id == connection_id,
            BankConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connexion introuvable.",
        )
    await db.delete(connection)
    await db.commit()


@router.post("/{connection_id}/sync", response_model=SyncResponse)
async def sync_connection(
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force re-sync of a bank connection."""
    result = await db.execute(
        select(BankConnection).where(
            BankConnection.id == connection_id,
            BankConnection.user_id == user.id,
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connexion introuvable.",
        )

    sync_result = await run_sync(connection, db)
    total_txns = sum(len(t) for t in sync_result.transactions.values())

    return SyncResponse(
        connection_id=connection.id,
        status="active" if sync_result.success else "error",
        accounts_synced=len(sync_result.accounts),
        transactions_synced=total_txns,
        error=sync_result.error,
    )
