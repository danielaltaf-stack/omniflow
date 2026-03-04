"""
OmniFlow — Nova Memory Service.

Extracts, stores, and retrieves persistent memories from conversations.
Memories allow Nova to build long-term understanding of the user's
financial life, preferences, goals, and personality across sessions.

Memory types:
  - FACT: Hard facts ("owns 2 properties", "has 3 children")
  - PREFERENCE: User preferences ("prefers ETFs", "risk-averse")
  - GOAL: Financial goals ("retire at 55", "buy house in 2 years")
  - INSIGHT: AI-derived observations ("spending up in restaurants")
  - PERSONALITY: Communication style ("likes detailed explanations")
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.nova_memory import NovaMemory

logger = logging.getLogger("omniflow.ai.memory")


# ── Memory extraction prompt ─────────────────────────────

MEMORY_EXTRACTION_PROMPT = """Analyse cette conversation entre l'utilisateur et Nova (assistant financier).
Extrais les informations NOUVELLES et IMPORTANTES à mémoriser sur l'utilisateur.

Catégories possibles :
- fact: Faits concrets (situation familiale, profession, nombre d'enfants, etc.)
- preference: Préférences (aversion au risque, style d'investissement, etc.)
- goal: Objectifs financiers (retraite, achat immobilier, voyage, etc.)
- insight: Observations dérivées (tendances, comportements, etc.)
- personality: Style de communication (aime le détail, préfère la synthèse, etc.)

Catégories thématiques : general, finance, investment, budget, lifestyle, tax, retirement, heritage, real_estate, career, family

Réponds UNIQUEMENT en JSON valide. Si aucune mémoire à extraire, réponds [].
Format :
[
  {"type": "fact", "category": "family", "content": "A 2 enfants de 5 et 8 ans", "importance": 8},
  {"type": "goal", "category": "real_estate", "content": "Veut acheter une résidence secondaire d'ici 3 ans", "importance": 7}
]

Importance de 1 (anecdotique) à 10 (critique pour les conseils financiers).
Maximum 5 mémoires par extraction. Ne répète pas ce qui est déjà connu.

Mémoires existantes (ne pas dupliquer) :
{existing_memories}

Conversation à analyser :
{conversation}"""


async def extract_memories_from_conversation(
    db: AsyncSession,
    user_id: UUID,
    conversation_messages: list[dict[str, str]],
    conversation_id: UUID | None = None,
    ai_providers: list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    """
    Use the LLM to extract memorable facts from a conversation.
    Returns list of extracted memory dicts (already saved to DB).
    """
    if not conversation_messages or not ai_providers:
        return []

    # Get existing memories to avoid duplicates
    existing = await get_user_memories(db, user_id, limit=30)
    existing_text = "\n".join(
        f"- [{m.memory_type}] {m.content}" for m in existing
    ) or "Aucune mémoire existante."

    # Format conversation
    conv_text = "\n".join(
        f"{'Utilisateur' if m.get('role') == 'user' else 'Nova'}: {m.get('content', '')}"
        for m in conversation_messages[-10:]  # Last 10 messages
    )

    prompt = MEMORY_EXTRACTION_PROMPT.format(
        existing_memories=existing_text,
        conversation=conv_text,
    )

    # Try to extract using AI
    extracted = []
    for provider in ai_providers:
        try:
            from openai import AsyncOpenAI

            client_kwargs: dict[str, Any] = {"api_key": provider["api_key"]}
            if provider.get("base_url"):
                client_kwargs["base_url"] = provider["base_url"]

            client = AsyncOpenAI(**client_kwargs)
            response = await client.chat.completions.create(
                model=provider["model"],
                messages=[
                    {"role": "system", "content": "Tu es un extracteur de mémoire. Réponds uniquement en JSON valide."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=1000,
                response_format={"type": "json_object"} if "gpt" in provider["model"] else None,
            )

            content = response.choices[0].message.content or "[]"
            # Try to parse JSON
            content = content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            parsed = json.loads(content)
            if isinstance(parsed, dict):
                parsed = parsed.get("memories", parsed.get("items", []))
            if isinstance(parsed, list):
                extracted = parsed
            break
        except Exception as e:
            logger.warning("Memory extraction failed with %s: %s", provider.get("name"), str(e)[:200])
            continue

    # Save extracted memories to DB
    saved = []
    for mem in extracted[:5]:  # Max 5 per extraction
        if not isinstance(mem, dict) or "content" not in mem:
            continue

        # Check for duplicates (simple substring match)
        is_dup = any(
            mem["content"].lower() in m.content.lower() or
            m.content.lower() in mem["content"].lower()
            for m in existing
        )
        if is_dup:
            continue

        new_mem = NovaMemory(
            user_id=user_id,
            memory_type=mem.get("type", "fact"),
            category=mem.get("category", "general"),
            content=mem["content"],
            importance=min(10, max(1, mem.get("importance", 5))),
            source_conversation_id=conversation_id,
            is_active=True,
        )
        db.add(new_mem)
        saved.append(mem)

    if saved:
        try:
            await db.commit()
            logger.info("Extracted %d memories for user %s", len(saved), user_id)
        except Exception as e:
            logger.warning("Failed to save memories: %s", e)
            await db.rollback()

    return saved


async def get_user_memories(
    db: AsyncSession,
    user_id: UUID,
    limit: int = 30,
    memory_type: str | None = None,
    category: str | None = None,
) -> list[NovaMemory]:
    """Retrieve active memories for a user, ordered by importance."""
    query = (
        select(NovaMemory)
        .where(
            NovaMemory.user_id == user_id,
            NovaMemory.is_active == True,
        )
    )
    if memory_type:
        query = query.where(NovaMemory.memory_type == memory_type)
    if category:
        query = query.where(NovaMemory.category == category)

    query = query.order_by(
        NovaMemory.importance.desc(),
        NovaMemory.updated_at.desc(),
    ).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_memory(
    db: AsyncSession,
    user_id: UUID,
    memory_id: UUID,
) -> bool:
    """Delete (deactivate) a specific memory."""
    result = await db.execute(
        select(NovaMemory).where(
            NovaMemory.id == memory_id,
            NovaMemory.user_id == user_id,
        )
    )
    mem = result.scalar_one_or_none()
    if not mem:
        return False

    mem.is_active = False
    await db.commit()
    return True


async def clear_all_memories(
    db: AsyncSession,
    user_id: UUID,
) -> int:
    """Deactivate all memories for a user. Returns count."""
    result = await db.execute(
        select(NovaMemory).where(
            NovaMemory.user_id == user_id,
            NovaMemory.is_active == True,
        )
    )
    memories = result.scalars().all()
    count = 0
    for m in memories:
        m.is_active = False
        count += 1
    await db.commit()
    return count


async def add_memory(
    db: AsyncSession,
    user_id: UUID,
    content: str,
    memory_type: str = "fact",
    category: str = "general",
    importance: int = 5,
) -> NovaMemory:
    """Manually add a memory."""
    mem = NovaMemory(
        user_id=user_id,
        memory_type=memory_type,
        category=category,
        content=content,
        importance=min(10, max(1, importance)),
        is_active=True,
    )
    db.add(mem)
    await db.commit()
    await db.refresh(mem)
    return mem


def serialize_memory(mem: NovaMemory) -> dict[str, Any]:
    """Convert a NovaMemory model to a JSON-serializable dict."""
    return {
        "id": str(mem.id),
        "memory_type": mem.memory_type,
        "category": mem.category,
        "content": mem.content,
        "importance": mem.importance,
        "source_conversation_id": str(mem.source_conversation_id) if mem.source_conversation_id else None,
        "is_active": mem.is_active,
        "created_at": mem.created_at.isoformat() if mem.created_at else None,
        "updated_at": mem.updated_at.isoformat() if mem.updated_at else None,
    }


async def get_memory_stats(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    """Get memory statistics for a user."""
    # By type
    result = await db.execute(
        select(
            NovaMemory.memory_type,
            func.count().label("count"),
        )
        .where(
            NovaMemory.user_id == user_id,
            NovaMemory.is_active == True,
        )
        .group_by(NovaMemory.memory_type)
    )
    by_type = {row.memory_type: row.count for row in result.all()}

    # By category
    cat_result = await db.execute(
        select(
            NovaMemory.category,
            func.count().label("count"),
        )
        .where(
            NovaMemory.user_id == user_id,
            NovaMemory.is_active == True,
        )
        .group_by(NovaMemory.category)
    )
    by_category = {row.category: row.count for row in cat_result.all()}

    # Total + avg importance
    agg_result = await db.execute(
        select(
            func.count(NovaMemory.id).label("total"),
            func.coalesce(func.avg(NovaMemory.importance), 0).label("avg_imp"),
        )
        .where(
            NovaMemory.user_id == user_id,
            NovaMemory.is_active == True,
        )
    )
    agg_row = agg_result.one()

    return {
        "total": agg_row.total,
        "by_type": by_type,
        "by_category": by_category,
        "avg_importance": round(float(agg_row.avg_imp), 1),
    }
