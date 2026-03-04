"""
OmniFlow — WebSocket endpoint for real-time sync progress.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.bank_connection import BankConnection
from app.models.user import User
from app.woob_engine.sync_service import run_sync

router = APIRouter()


@router.websocket("/ws/sync/{connection_id}")
async def websocket_sync(
    websocket: WebSocket,
    connection_id: str,
):
    """
    WebSocket for real-time sync progress.
    
    Client sends: {"token": "Bearer xxx"} as first message for auth.
    Server sends: {"event": "progress|sca_required|completed|error", "data": {...}}
    """
    await websocket.accept()

    try:
        # 1. Auth: first message must contain token
        auth_msg = await websocket.receive_text()
        auth_data = json.loads(auth_msg)
        token = auth_data.get("token", "").replace("Bearer ", "")

        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if not user_id:
                await websocket.send_json({"event": "error", "data": {"message": "Token invalide"}})
                await websocket.close()
                return
        except Exception:
            await websocket.send_json({"event": "error", "data": {"message": "Token invalide ou expiré"}})
            await websocket.close()
            return

        # 2. Get DB session and verify connection
        from app.core.database import async_session_factory
        async with async_session_factory() as db:
            conn_uuid = uuid.UUID(connection_id)
            result = await db.execute(
                select(BankConnection).where(
                    BankConnection.id == conn_uuid,
                    BankConnection.user_id == uuid.UUID(user_id),
                )
            )
            connection = result.scalar_one_or_none()

            if not connection:
                await websocket.send_json({"event": "error", "data": {"message": "Connexion introuvable"}})
                await websocket.close()
                return

            # 3. Run sync with progress callback
            async def progress_callback(event: str, data: dict):
                await websocket.send_json({"event": event, "data": data})

            sync_result = await run_sync(connection, db, progress_callback=progress_callback)

            if sync_result.success:
                total_txns = sum(len(t) for t in sync_result.transactions.values())
                await websocket.send_json({
                    "event": "completed",
                    "data": {
                        "accounts_synced": len(sync_result.accounts),
                        "transactions_synced": total_txns,
                    },
                })
            else:
                error_event = "sca_required" if sync_result.sca_required else "error"
                await websocket.send_json({
                    "event": error_event,
                    "data": {"message": sync_result.error},
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"event": "error", "data": {"message": str(e)}})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
