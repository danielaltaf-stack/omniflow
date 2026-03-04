"""
OmniFlow — Changelog endpoint.

GET /api/v1/changelog — Returns structured changelog (no DB, static).
Public — no auth required.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.feedback import ChangelogResponse

router = APIRouter(prefix="/changelog", tags=["Changelog"])

_CHANGELOG = ChangelogResponse(
    versions=[
        {
            "version": "0.4.0",
            "date": "2026-03-04",
            "entries": [
                {
                    "type": "feature",
                    "title": "RGPD Frontend complet",
                    "description": "Export données, gestion consentements, audit trail visuel, suppression de compte en self-service.",
                },
                {
                    "type": "feature",
                    "title": "Feedback in-app",
                    "description": "Système de feedback intégré avec catégories (bug, feature, amélioration).",
                },
                {
                    "type": "feature",
                    "title": "Changement de mot de passe",
                    "description": "Endpoint sécurisé PUT /auth/password avec audit trail et invalidation des refresh tokens.",
                },
                {
                    "type": "feature",
                    "title": "Onboarding checklist",
                    "description": "Guide interactif pour les nouveaux utilisateurs avec barre de progression.",
                },
            ],
        },
        {
            "version": "0.3.0",
            "date": "2026-03-04",
            "entries": [
                {
                    "type": "security",
                    "title": "RGPD & Audit Trail",
                    "description": "Export RGPD 43 tables, suppression cascade, audit log temps réel, consent tracking 4 axes.",
                },
                {
                    "type": "security",
                    "title": "security.txt RFC 9116",
                    "description": "Endpoint /.well-known/security.txt conforme au standard.",
                },
            ],
        },
        {
            "version": "0.2.0",
            "date": "2026-03-03",
            "entries": [
                {
                    "type": "performance",
                    "title": "Performance Production",
                    "description": "Redis multi-tier caching, connection pooling, GZip, Prometheus metrics, Kubernetes health probes.",
                },
                {
                    "type": "feature",
                    "title": "PWA & Push Notifications",
                    "description": "Service Worker, install prompt, offline mode, Web Push via VAPID.",
                },
            ],
        },
        {
            "version": "0.1.5",
            "date": "2026-03-03",
            "entries": [
                {
                    "type": "feature",
                    "title": "Nova IA Omniscient",
                    "description": "Chatbot IA multi-provider (OpenAI, Anthropic, Mistral) avec mémoire contextuelle.",
                },
                {
                    "type": "feature",
                    "title": "Calendrier Financier",
                    "description": "Calendrier avec événements financiers, payday countdown, green day tracker.",
                },
            ],
        },
        {
            "version": "0.1.0",
            "date": "2026-03-02",
            "entries": [
                {
                    "type": "feature",
                    "title": "Foundation",
                    "description": "Auth JWT, agrégation bancaire Woob, crypto, bourse, immobilier, budget, patrimoine unifié.",
                },
                {
                    "type": "security",
                    "title": "Sécurité grade bancaire",
                    "description": "AES-256-GCM, bcrypt 12 rounds, rate limiting, token rotation, Redis JTI blacklist.",
                },
            ],
        },
    ]
)


@router.get(
    "",
    response_model=ChangelogResponse,
    summary="Changelog de l'application",
)
async def get_changelog():
    """Returns the structured changelog. No auth required."""
    return _CHANGELOG
