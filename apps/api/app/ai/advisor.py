"""
OmniFlow — Nova AI Advisor v2 (Omniscient Financial Advisor).

Streaming SSE chat with multi-provider fallback, persistent memory,
dynamic suggestions, auto-titling, and expanded context window.

Key improvements over v1:
  - 20 messages of conversation history (was 10)
  - max_tokens 4096 (was 2000)
  - Memory-aware: injects persistent memories into context
  - Dynamic suggestions based on user's actual financial data
  - Auto-generates conversation titles from first message
  - Rate limit raised awareness (daily limit shown in responses)
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_redis
from app.ai.context_aggregator import aggregate_user_context, context_to_system_prompt

logger = logging.getLogger("omniflow.ai.advisor")
settings = get_settings()


# ── LLM Parameters ──────────────────────────────────────

CONVERSATION_HISTORY_LIMIT = 20   # messages to include in context
MAX_TOKENS = 4096                 # response length
TEMPERATURE = 0.7
TOP_P = 0.95
TITLE_MAX_TOKENS = 30             # for auto-title generation


# ── Suggested questions (hardcoded fallback) ─────────────

SUGGESTED_QUESTIONS = [
    {"icon": "wallet", "text": "Analyse ma situation financière globale et donne-moi un plan d'action"},
    {"icon": "trending-down", "text": "Quelles dépenses pourrais-je réduire ce mois-ci ?"},
    {"icon": "piggy-bank", "text": "Comment optimiser mon épargne avec mes revenus actuels ?"},
    {"icon": "bar-chart-3", "text": "Analyse mes investissements et propose des améliorations"},
    {"icon": "shield-alert", "text": "Y a-t-il des anomalies ou risques dans mes finances ?"},
    {"icon": "target", "text": "Crée-moi un budget optimisé pour le mois prochain"},
    {"icon": "home", "text": "Analyse la rentabilité de mes investissements immobiliers"},
    {"icon": "bitcoin", "text": "Que penses-tu de mon portefeuille crypto ?"},
]


# ── Provider management ──────────────────────────────────

def _get_ai_providers() -> list[dict[str, str]]:
    """
    Return ordered list of AI providers to try.
    Each dict: {"name": str, "base_url": str|None, "api_key": str, "model": str}
    """
    providers: list[dict[str, str]] = []

    raw = settings.AI_PROVIDERS
    if raw and raw != "[]":
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                for p in parsed:
                    if p.get("api_key"):
                        providers.append({
                            "name": p.get("name", "custom"),
                            "base_url": p.get("base_url", ""),
                            "api_key": p["api_key"],
                            "model": p.get("model", "gpt-4o-mini"),
                        })
        except json.JSONDecodeError:
            logger.warning("AI_PROVIDERS is not valid JSON, ignoring")

    if settings.OPENAI_API_KEY:
        providers.append({
            "name": "openai",
            "base_url": settings.OPENAI_BASE_URL or "",
            "api_key": settings.OPENAI_API_KEY,
            "model": settings.OPENAI_MODEL,
        })

    return providers


def _has_ai_provider() -> bool:
    return len(_get_ai_providers()) > 0


# ── Rate limiter ─────────────────────────────────────────

async def check_rate_limit(user_id: UUID) -> dict[str, Any]:
    redis = await get_redis()
    key = f"nova_ratelimit:{user_id}:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    try:
        current = await redis.get(key)
        count = int(current) if current else 0
        limit = settings.AI_DAILY_LIMIT
        return {
            "allowed": count < limit,
            "remaining": max(0, limit - count),
            "used": count,
            "limit": limit,
        }
    except Exception:
        return {"allowed": True, "remaining": settings.AI_DAILY_LIMIT, "used": 0, "limit": settings.AI_DAILY_LIMIT}


async def increment_rate_limit(user_id: UUID) -> None:
    redis = await get_redis()
    key = f"nova_ratelimit:{user_id}:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    try:
        pipe = redis.pipeline()
        await pipe.incr(key)
        await pipe.expire(key, 86400)
        await pipe.execute()
    except Exception:
        logger.warning("Failed to increment rate limit for user %s", user_id)


# ── Streaming chat ───────────────────────────────────────

async def stream_chat_response(
    db: AsyncSession,
    user_id: UUID,
    user_message: str,
    conversation_history: list[dict[str, str]] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream a Nova AI response via OpenAI-compatible API.
    Yields SSE-formatted chunks: data: {"content": "...", "done": false}
    """
    # Collect omniscient context
    try:
        context = await aggregate_user_context(db, user_id)
        system_prompt = context_to_system_prompt(context)
    except Exception as e:
        logger.error("Failed to aggregate context: %s", e)
        system_prompt = (
            "Tu es Nova, l'assistant financier IA d'OmniFlow. "
            "Les données de l'utilisateur ne sont pas disponibles actuellement. "
            "Réponds avec des conseils financiers généraux en français."
        )
        context = {}

    # Build messages
    messages = [{"role": "system", "content": system_prompt}]

    if conversation_history:
        for msg in conversation_history[-CONVERSATION_HISTORY_LIMIT:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

    messages.append({"role": "user", "content": user_message})

    providers = _get_ai_providers()
    if not providers:
        yield _sse_event({
            "content": _fallback_response(context),
            "done": False,
        })
        yield _sse_event({"content": "", "done": True})
        return

    await increment_rate_limit(user_id)

    last_error = None
    for i, provider in enumerate(providers):
        try:
            from openai import AsyncOpenAI

            client_kwargs: dict[str, Any] = {"api_key": provider["api_key"]}
            if provider.get("base_url"):
                client_kwargs["base_url"] = provider["base_url"]

            client = AsyncOpenAI(**client_kwargs)

            logger.info(
                "Trying AI provider %d/%d: %s (model=%s)",
                i + 1, len(providers), provider["name"], provider["model"],
            )

            stream = await client.chat.completions.create(
                model=provider["model"],
                messages=messages,
                stream=True,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                top_p=TOP_P,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield _sse_event({"content": content, "done": False})

            yield _sse_event({"content": "", "done": True})
            return

        except ImportError:
            logger.error("openai package not installed")
            yield _sse_event({
                "content": "⚠️ Le module OpenAI n'est pas installé. Contactez l'administrateur.",
                "done": False,
            })
            yield _sse_event({"content": "", "done": True})
            return

        except Exception as e:
            last_error = e
            logger.warning(
                "AI provider %s failed: %s — trying next...",
                provider["name"], str(e)[:200],
            )
            continue

    logger.error("All AI providers failed. Last error: %s", last_error)
    yield _sse_event({
        "content": (
            f"⚠️ Tous les fournisseurs IA sont indisponibles.\n\n"
            f"_Dernière erreur : {str(last_error)}_"
        ),
        "done": False,
    })
    yield _sse_event({"content": "", "done": True})


async def get_quick_response(
    db: AsyncSession,
    user_id: UUID,
    user_message: str,
    conversation_history: list[dict[str, str]] | None = None,
) -> str:
    """Non-streaming version — returns full response as string."""
    providers = _get_ai_providers()
    if not providers:
        try:
            context = await aggregate_user_context(db, user_id)
            return _fallback_response(context)
        except Exception:
            return "Je suis Nova, votre assistant financier. Configurez une API IA pour des conseils personnalisés."

    try:
        context = await aggregate_user_context(db, user_id)
        system_prompt = context_to_system_prompt(context)
    except Exception:
        system_prompt = "Tu es Nova, l'assistant financier IA d'OmniFlow."

    messages = [{"role": "system", "content": system_prompt}]
    if conversation_history:
        for msg in conversation_history[-CONVERSATION_HISTORY_LIMIT:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": user_message})

    last_error = None
    for provider in providers:
        try:
            from openai import AsyncOpenAI

            client_kwargs: dict[str, Any] = {"api_key": provider["api_key"]}
            if provider.get("base_url"):
                client_kwargs["base_url"] = provider["base_url"]

            client = AsyncOpenAI(**client_kwargs)
            response = await client.chat.completions.create(
                model=provider["model"],
                messages=messages,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            last_error = e
            logger.warning("AI provider %s failed (non-stream): %s", provider["name"], str(e)[:200])
            continue

    return f"⚠️ Tous les fournisseurs IA sont indisponibles: {last_error}"


# ── Auto-title generation ────────────────────────────────

async def generate_conversation_title(user_message: str) -> str:
    """
    Generate a short conversation title from the first user message.
    Uses AI if available, otherwise truncates the message.
    """
    providers = _get_ai_providers()
    if not providers:
        return _truncate_title(user_message)

    try:
        from openai import AsyncOpenAI

        provider = providers[0]
        client_kwargs: dict[str, Any] = {"api_key": provider["api_key"]}
        if provider.get("base_url"):
            client_kwargs["base_url"] = provider["base_url"]

        client = AsyncOpenAI(**client_kwargs)
        response = await client.chat.completions.create(
            model=provider["model"],
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Génère un titre court (max 6 mots, en français) pour cette conversation financière. "
                        "Réponds UNIQUEMENT avec le titre, sans guillemets ni ponctuation finale."
                    ),
                },
                {"role": "user", "content": user_message[:200]},
            ],
            temperature=0.3,
            max_tokens=TITLE_MAX_TOKENS,
        )
        title = (response.choices[0].message.content or "").strip().strip('"\'')
        return title[:100] if title else _truncate_title(user_message)
    except Exception:
        return _truncate_title(user_message)


def _truncate_title(message: str) -> str:
    """Truncate a message to make a reasonable title."""
    clean = message.strip().replace("\n", " ")
    if len(clean) <= 60:
        return clean
    return clean[:57] + "..."


# ── Dynamic suggestions ──────────────────────────────────

async def get_dynamic_suggestions(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, str]]:
    """
    Generate context-aware suggestions based on the user's actual data.
    Falls back to hardcoded suggestions if context can't be loaded.
    """
    try:
        context = await aggregate_user_context(db, user_id)
    except Exception:
        return SUGGESTED_QUESTIONS

    suggestions: list[dict[str, str]] = []

    # Always include the global analysis
    suggestions.append({
        "icon": "wallet",
        "text": "Analyse ma situation financière globale et donne-moi un plan d'action",
    })

    # Budget alerts
    budgets = context.get("budgets", [])
    overbudget = [b for b in budgets if b.get("progress_pct", 0) >= 80]
    if overbudget:
        cat = overbudget[0]["category"]
        suggestions.append({
            "icon": "alert-triangle",
            "text": f"Mon budget {cat} est presque épuisé, que faire ?",
        })

    # Subscription optimization
    subs = context.get("subscriptions", {})
    if subs.get("total_monthly_eur", 0) > 50:
        suggestions.append({
            "icon": "repeat",
            "text": f"J'ai {subs['total_monthly_eur']:.0f}€/mois d'abonnements, lesquels optimiser ?",
        })

    # Savings rate
    ie = context.get("income_expenses", {})
    savings_rate = ie.get("savings_rate_pct", 0)
    if savings_rate < 10:
        suggestions.append({
            "icon": "piggy-bank",
            "text": "Mon taux d'épargne est faible, comment l'améliorer ?",
        })
    elif savings_rate > 30:
        suggestions.append({
            "icon": "trending-up",
            "text": "J'épargne beaucoup, où investir cet excédent ?",
        })

    # Investments
    stocks = context.get("stocks", {})
    if stocks.get("portfolios_count", 0) > 0:
        suggestions.append({
            "icon": "bar-chart-3",
            "text": "Analyse la diversification et la performance de mon portefeuille bourse",
        })

    crypto = context.get("crypto", {})
    if crypto.get("wallets_count", 0) > 0:
        suggestions.append({
            "icon": "bitcoin",
            "text": "Évalue le risque de mon portefeuille crypto",
        })

    # Real estate
    re = context.get("real_estate", {})
    if re.get("count", 0) > 0:
        suggestions.append({
            "icon": "home",
            "text": "Analyse la rentabilité de mes biens immobiliers",
        })

    # Debts
    debts = context.get("debts", {})
    if debts.get("count", 0) > 0:
        suggestions.append({
            "icon": "credit-card",
            "text": "Quelle stratégie pour rembourser mes dettes plus vite ?",
        })

    # Tax optimization
    fiscal = context.get("fiscal", {})
    if fiscal:
        suggestions.append({
            "icon": "receipt",
            "text": "Comment optimiser ma fiscalité cette année ?",
        })

    # Retirement
    ret = context.get("retirement", {})
    if ret:
        suggestions.append({
            "icon": "sunset",
            "text": f"Suis-je en bonne voie pour ma retraite à {ret.get('target_age', 64)} ans ?",
        })

    # Heritage
    heritage = context.get("heritage", {})
    if heritage:
        suggestions.append({
            "icon": "landmark",
            "text": "Comment optimiser la transmission de mon patrimoine ?",
        })

    # Projects
    projects = context.get("projects", [])
    if projects:
        p = projects[0]
        suggestions.append({
            "icon": "target",
            "text": f"Comment atteindre mon objectif '{p['name']}' plus vite ?",
        })

    # Upcoming events
    events = context.get("upcoming_events", [])
    if events:
        e = events[0]
        suggestions.append({
            "icon": "calendar",
            "text": f"Prépare-moi pour '{e['title']}' prévu le {e['date']}",
        })

    # Fee analysis
    fees = context.get("fees", {})
    if fees.get("potential_savings_eur", 0) > 0:
        suggestions.append({
            "icon": "scissors",
            "text": f"Comment économiser {fees['potential_savings_eur']:.0f}€/an de frais bancaires ?",
        })

    # Anomalies
    alerts = context.get("active_alerts", [])
    if alerts:
        suggestions.append({
            "icon": "shield-alert",
            "text": f"Explique-moi les {len(alerts)} alertes actives sur mes finances",
        })

    # Limit and return (max 8, unique)
    seen_texts: set[str] = set()
    unique: list[dict[str, str]] = []
    for s in suggestions:
        if s["text"] not in seen_texts and len(unique) < 8:
            seen_texts.add(s["text"])
            unique.append(s)

    # Pad with defaults if too few
    if len(unique) < 4:
        for q in SUGGESTED_QUESTIONS:
            if q["text"] not in seen_texts and len(unique) < 8:
                seen_texts.add(q["text"])
                unique.append(q)

    return unique


# ── Helpers ──────────────────────────────────────────────

def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _fallback_response(context: dict[str, Any]) -> str:
    """Generate a helpful fallback when no AI provider is available."""
    parts = [
        "# 🌟 Nova — Votre Assistant Financier\n",
        "**L'API IA n'est pas encore configurée.** Voici un aperçu basé sur vos données :\n",
    ]

    nw = context.get("net_worth", {})
    if nw:
        parts.append(f"## Patrimoine net : {nw.get('total_eur', 0):,.2f}€\n")

    ie = context.get("income_expenses", {})
    if ie:
        parts.append(
            f"**Revenus :** {ie.get('monthly_income_eur', 0):,.2f}€/mois | "
            f"**Dépenses :** {ie.get('monthly_expenses_eur', 0):,.2f}€/mois | "
            f"**Taux d'épargne :** {ie.get('savings_rate_pct', 0)}%\n"
        )

    alerts = context.get("active_alerts", [])
    if alerts:
        parts.append(f"\n### ⚠️ {len(alerts)} alerte(s) active(s)\n")
        for a in alerts[:3]:
            parts.append(f"- {a['title']}\n")

    budgets = context.get("budgets", [])
    overbudget = [b for b in budgets if b.get("progress_pct", 0) >= 90]
    if overbudget:
        parts.append("\n### 📋 Budgets en alerte\n")
        for b in overbudget:
            parts.append(f"- {b['category']} : {b['spent_eur']:,.2f}/{b['limit_eur']:,.2f}€ ({b['progress_pct']}%)\n")

    parts.append(
        "\n---\n"
        "💡 *Pour des conseils personnalisés et détaillés, configurez votre clé API IA "
        "dans les paramètres (AI_PROVIDERS ou OPENAI_API_KEY).*"
    )

    return "\n".join(parts)
