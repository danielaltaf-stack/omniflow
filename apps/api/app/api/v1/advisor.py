"""
OmniFlow — Nova AI Advisor API endpoints (v2 — Omniscient).

POST /advisor/chat                         — SSE streaming chat with Nova
GET  /advisor/conversations                — List conversation history
GET  /advisor/conversations/{id}           — Get a conversation's messages
DELETE /advisor/conversations/{id}         — Delete a conversation
POST /advisor/conversations/{id}/pin       — Pin / unpin a conversation
POST /advisor/simulate                     — Investment simulation
GET  /advisor/suggestions                  — Dynamic context-aware suggestions
GET  /advisor/status                       — Rate limit status & AI availability
GET  /advisor/memories                     — List persistent Nova memories
POST /advisor/memories                     — Manually add a memory
DELETE /advisor/memories/{id}              — Delete a specific memory
DELETE /advisor/memories                   — Clear all memories
GET  /advisor/memories/stats               — Memory usage statistics
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.chat import ChatConversation, ChatMessage, ChatRole

logger = logging.getLogger("omniflow.api.advisor")
settings = get_settings()

router = APIRouter(prefix="/advisor", tags=["advisor"])


# ── Request / Response schemas ───────────────────────────


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str | None = None


class MemoryCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    memory_type: str = Field(default="fact")
    category: str = Field(default="general")
    importance: int = Field(default=5, ge=1, le=10)


class SimulationRequest(BaseModel):
    initial_amount: float = Field(default=1000, ge=0, le=10_000_000)
    monthly_contribution: float = Field(default=200, ge=0, le=100_000)
    years: int = Field(default=10, ge=1, le=50)
    scenario: str = Field(default="moderate")
    custom_return: float | None = Field(default=None, ge=0, le=1)
    custom_volatility: float | None = Field(default=None, ge=0, le=1)
    inflation_rate: float = Field(default=0.02, ge=0, le=0.2)


# ── POST /advisor/chat ───────────────────────────────────


@router.post("/chat")
async def chat_with_nova(
    body: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Chat with Nova AI advisor. Returns an SSE stream.
    Each event: data: {"content": "...", "done": false/true}
    Final event includes conversation_id.
    """
    from app.ai.advisor import (
        check_rate_limit,
        stream_chat_response,
        generate_conversation_title,
    )

    # Check rate limit
    rl = await check_rate_limit(user.id)
    if not rl["allowed"]:
        raise HTTPException(
            status_code=429,
            detail=f"Limite quotidienne atteinte ({rl['limit']} questions/jour). "
            f"Revenez demain ! 🌙",
        )

    # Get or create conversation
    conversation_id = None
    conversation_history = []
    is_new_conversation = False

    if body.conversation_id:
        try:
            conv_uuid = uuid.UUID(body.conversation_id)
            conv_result = await db.execute(
                select(ChatConversation).where(
                    ChatConversation.id == conv_uuid,
                    ChatConversation.user_id == user.id,
                )
            )
            conv = conv_result.scalar_one_or_none()
            if conv:
                conversation_id = conv.id
                msgs_result = await db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.conversation_id == conv.id)
                    .order_by(ChatMessage.created_at)
                )
                msgs = msgs_result.scalars().all()
                conversation_history = [
                    {
                        "role": str(msg.role.value if hasattr(msg.role, "value") else msg.role),
                        "content": msg.content,
                    }
                    for msg in msgs
                ]
        except (ValueError, Exception):
            pass

    if not conversation_id:
        is_new_conversation = True
        try:
            title = await generate_conversation_title(body.message)
        except Exception:
            title = body.message[:100]

        new_conv = ChatConversation(
            user_id=user.id,
            title=title,
        )
        db.add(new_conv)
        await db.flush()
        conversation_id = new_conv.id

    # Save user message
    user_msg = ChatMessage(
        conversation_id=conversation_id,
        role=ChatRole.USER,
        content=body.message,
    )
    db.add(user_msg)
    await db.commit()

    # Stream response
    async def event_generator():
        full_response = []

        async for event in stream_chat_response(
            db, user.id, body.message, conversation_history
        ):
            yield event
            try:
                line = event.strip()
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    if data.get("content"):
                        full_response.append(data["content"])
            except Exception:
                pass

        # Save assistant response
        assistant_content = "".join(full_response)
        if assistant_content:
            assistant_msg = ChatMessage(
                conversation_id=conversation_id,
                role=ChatRole.ASSISTANT,
                content=assistant_content,
            )
            db.add(assistant_msg)

            # Update conversation metadata
            try:
                msg_count_result = await db.execute(
                    select(func.count(ChatMessage.id))
                    .where(ChatMessage.conversation_id == conversation_id)
                )
                msg_count = (msg_count_result.scalar() or 0) + 1
                await db.execute(
                    update(ChatConversation)
                    .where(ChatConversation.id == conversation_id)
                    .values(
                        message_count=msg_count,
                        last_message_at=datetime.now(timezone.utc),
                    )
                )
            except Exception:
                logger.warning("Failed to update conversation metadata")

            try:
                await db.commit()
            except Exception:
                logger.warning("Failed to save assistant message")

        # Extract memories from conversation
        try:
            from app.ai.memory_service import extract_memories_from_conversation
            msgs_for_memory = conversation_history + [
                {"role": "user", "content": body.message},
                {"role": "assistant", "content": assistant_content},
            ]
            await extract_memories_from_conversation(
                db, user.id, msgs_for_memory, conversation_id
            )
        except Exception as e:
            logger.debug("Memory extraction skipped: %s", e)

        # Final metadata event
        yield f"data: {json.dumps({'conversation_id': str(conversation_id), 'done': True, 'content': ''})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── GET /advisor/conversations ───────────────────────────


@router.get("/conversations")
async def list_conversations(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
) -> dict[str, Any]:
    """List user's conversation history, pinned first, then most recent."""
    result = await db.execute(
        select(ChatConversation)
        .where(ChatConversation.user_id == user.id)
        .order_by(
            ChatConversation.is_pinned.desc().nullslast(),
            ChatConversation.updated_at.desc(),
        )
        .limit(limit)
    )
    conversations = result.scalars().all()

    items = []
    for conv in conversations:
        # Use stored message_count if available, else compute
        msg_count = getattr(conv, "message_count", None)
        if not msg_count:
            count_result = await db.execute(
                select(func.count(ChatMessage.id))
                .where(ChatMessage.conversation_id == conv.id)
            )
            msg_count = count_result.scalar() or 0

        items.append({
            "id": str(conv.id),
            "title": conv.title,
            "message_count": msg_count,
            "is_pinned": getattr(conv, "is_pinned", False) or False,
            "summary": getattr(conv, "summary", None),
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        })

    return {"conversations": items, "count": len(items)}


# ── GET /advisor/conversations/{id} ──────────────────────


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get all messages in a conversation."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de conversation invalide.")

    conv_result = await db.execute(
        select(ChatConversation).where(
            ChatConversation.id == conv_uuid,
            ChatConversation.user_id == user.id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")

    msgs_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
    )
    messages = msgs_result.scalars().all()

    return {
        "id": str(conv.id),
        "title": conv.title,
        "messages": [
            {
                "id": str(m.id),
                "role": str(m.role.value if hasattr(m.role, "value") else m.role),
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }


# ── DELETE /advisor/conversations/{id} ───────────────────


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete a conversation and all its messages."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de conversation invalide.")

    conv_result = await db.execute(
        select(ChatConversation).where(
            ChatConversation.id == conv_uuid,
            ChatConversation.user_id == user.id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")

    await db.delete(conv)
    await db.commit()

    return {"status": "deleted"}


# ── POST /advisor/simulate ───────────────────────────────


@router.post("/simulate")
async def simulate_investment(
    body: SimulationRequest,
    user=Depends(get_current_user),
) -> dict[str, Any]:
    """
    Run an investment simulation with Monte-Carlo analysis.
    Returns deterministic projections, Monte-Carlo bands, and scenario comparison.
    """
    from app.ai.simulator import simulate_investment as run_simulation

    result = run_simulation(
        initial_amount=body.initial_amount,
        monthly_contribution=body.monthly_contribution,
        years=body.years,
        scenario=body.scenario,
        custom_return=body.custom_return,
        custom_volatility=body.custom_volatility,
        inflation_rate=body.inflation_rate,
    )

    return result


# ── POST /advisor/conversations/{id}/pin ─────────────────


@router.post("/conversations/{conversation_id}/pin")
async def toggle_pin_conversation(
    conversation_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Toggle pin status on a conversation."""
    try:
        conv_uuid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de conversation invalide.")

    conv_result = await db.execute(
        select(ChatConversation).where(
            ChatConversation.id == conv_uuid,
            ChatConversation.user_id == user.id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")

    current_pinned = getattr(conv, "is_pinned", False) or False
    new_pinned = not current_pinned
    try:
        await db.execute(
            update(ChatConversation)
            .where(ChatConversation.id == conv_uuid)
            .values(is_pinned=new_pinned)
        )
        await db.commit()
    except Exception:
        # Column may not exist yet (pre-migration)
        pass

    return {"id": str(conv.id), "is_pinned": new_pinned}


# ── GET /advisor/suggestions ─────────────────────────────


@router.get("/suggestions")
async def get_suggestions(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get dynamic context-aware suggestions for Nova."""
    from app.ai.advisor import get_dynamic_suggestions

    suggestions = await get_dynamic_suggestions(db, user.id)
    return {"suggestions": suggestions}


# ── GET /advisor/status ──────────────────────────────────


@router.get("/status")
async def get_advisor_status(
    user=Depends(get_current_user),
) -> dict[str, Any]:
    """Check AI advisor availability and rate limit status."""
    from app.ai.advisor import check_rate_limit, _get_ai_providers

    rl = await check_rate_limit(user.id)
    providers = _get_ai_providers()

    return {
        "available": len(providers) > 0,
        "model": providers[0]["model"] if providers else "fallback",
        "provider": providers[0]["name"] if providers else "none",
        "providers_count": len(providers),
        "rate_limit": rl,
        "name": "Nova",
        "version": "2.0",
        "capabilities": [
            "omniscient_context",
            "persistent_memory",
            "dynamic_suggestions",
            "auto_titling",
            "streaming_sse",
            "monte_carlo_simulation",
        ],
    }


# ── Memory CRUD endpoints ────────────────────────────────


@router.get("/memories")
async def list_memories(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    category: str | None = Query(default=None),
) -> dict[str, Any]:
    """List persistent Nova memories for the user."""
    from app.ai.memory_service import get_user_memories, serialize_memory

    memories = await get_user_memories(db, user.id, limit=limit, category=category)
    return {
        "memories": [serialize_memory(m) for m in memories],
        "count": len(memories),
    }


@router.post("/memories")
async def add_memory(
    body: MemoryCreateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Manually add a memory for Nova."""
    from app.ai.memory_service import add_memory as _add_memory, serialize_memory

    memory = await _add_memory(
        db,
        user.id,
        content=body.content,
        memory_type=body.memory_type,
        category=body.category,
        importance=body.importance,
    )
    return {"memory": serialize_memory(memory), "status": "created"}


@router.delete("/memories/{memory_id}")
async def remove_memory(
    memory_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete a specific memory."""
    from app.ai.memory_service import delete_memory

    success = await delete_memory(db, user.id, memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mémoire introuvable.")
    return {"status": "deleted"}


@router.delete("/memories")
async def clear_memories(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Clear all Nova memories for the user."""
    from app.ai.memory_service import clear_all_memories

    count = await clear_all_memories(db, user.id)
    return {"status": "cleared", "deleted_count": count}


@router.get("/memories/stats")
async def memory_stats(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get memory usage statistics."""
    from app.ai.memory_service import get_memory_stats

    stats = await get_memory_stats(db, user.id)
    return stats
