"""
OmniFlow — Settings & RGPD Endpoints.

GET  /settings/export          — Full RGPD data export (Article 15 & 20)
DELETE /settings/account       — Account hard-delete (Article 17)
GET  /settings/audit-log       — User's own audit trail
GET  /settings/privacy-policy  — Structured privacy policy
GET  /settings/consent         — Current consent status
PUT  /settings/consent         — Update consent preferences
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import blacklist_token, verify_password
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.settings import (
    AccountDeletionRequest,
    AccountDeletionResponse,
    AuditLogEntry,
    AuditLogResponse,
    ConsentStatus,
    ConsentUpdateRequest,
    DataExportResponse,
    PrivacyPolicyResponse,
    PrivacyPolicySection,
)
from app.services.audit_service import get_client_ip, get_user_agent, log_action
from app.services.gdpr_service import export_user_data, delete_user_account

logger = logging.getLogger("omniflow.settings")

router = APIRouter(prefix="/settings", tags=["Settings & RGPD"])


# ═══════════════════════════════════════════════════════════════════
#  DATA EXPORT (RGPD Article 15 & 20)
# ═══════════════════════════════════════════════════════════════════


@router.get(
    "/export",
    response_model=DataExportResponse,
    summary="Export complet des données (RGPD)",
    description=(
        "Exporte toutes les données associées au compte de l'utilisateur "
        "en un seul fichier JSON structuré. Conforme aux articles 15 et 20 "
        "du RGPD (droit d'accès et portabilité)."
    ),
    responses={
        200: {"description": "Export JSON complet"},
        401: {"description": "Non authentifié"},
        429: {"description": "Trop de requêtes (1 export / 15 min)"},
    },
)
async def export_data(
    request: Request,
    anonymize: bool = Query(
        False,
        description="Anonymiser les données personnelles (emails, noms, IP)",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all user data as structured JSON."""
    # Audit trail
    await log_action(
        db,
        action="data_export_requested",
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata={"anonymized": anonymize},
    )

    result = await export_user_data(db, user, anonymize=anonymize)
    return result


# ═══════════════════════════════════════════════════════════════════
#  ACCOUNT DELETION (RGPD Article 17)
# ═══════════════════════════════════════════════════════════════════


@router.delete(
    "/account",
    response_model=AccountDeletionResponse,
    summary="Supprimer définitivement le compte (RGPD)",
    description=(
        "Suppression totale et irréversible du compte et de toutes les données "
        "associées. Conforme à l'article 17 du RGPD (droit à l'effacement). "
        "Nécessite la confirmation 'SUPPRIMER MON COMPTE' et le mot de passe."
    ),
    responses={
        200: {"description": "Compte supprimé"},
        400: {"description": "Confirmation incorrecte"},
        401: {"description": "Non authentifié / mot de passe incorrect"},
    },
)
async def delete_account(
    request: Request,
    body: AccountDeletionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete everything. Irreversible."""
    # Verify confirmation string
    if body.confirmation != "SUPPRIMER MON COMPTE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Confirmation incorrecte. "
                "Envoyez exactement : 'SUPPRIMER MON COMPTE'"
            ),
        )

    # Verify password
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect.",
        )

    # Log the initiation BEFORE deletion (so it's in the audit trail)
    await log_action(
        db,
        action="account_deletion_initiated",
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    # Perform the hard delete
    result = await delete_user_account(db, user)

    logger.warning(
        "Account DELETED: user_id=%s email=%s deleted=%d tables=%d",
        user.id, user.email, result["deleted_records"], result["tables_affected"],
    )

    return AccountDeletionResponse(
        deleted_records=result["deleted_records"],
        tables_affected=result["tables_affected"],
    )


# ═══════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ═══════════════════════════════════════════════════════════════════


@router.get(
    "/audit-log",
    response_model=AuditLogResponse,
    summary="Historique d'audit de l'utilisateur",
    description="Liste paginée des actions tracées pour l'utilisateur courant.",
    responses={
        200: {"description": "Historique d'audit"},
        401: {"description": "Non authentifié"},
    },
)
async def get_audit_log(
    action: str | None = Query(None, description="Filtrer par type d'action"),
    limit: int = Query(50, ge=1, le=200, description="Nombre max de résultats"),
    offset: int = Query(0, ge=0, description="Décalage pour la pagination"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's own audit trail."""
    # Base query
    query = select(AuditLog).where(AuditLog.user_id == user.id)
    count_query = select(func.count()).select_from(AuditLog).where(
        AuditLog.user_id == user.id
    )

    # Filter by action
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)

    # Order + pagination
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    entries = result.scalars().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return AuditLogResponse(
        entries=[
            AuditLogEntry(
                id=e.id,
                action=e.action,
                resource_type=e.resource_type,
                resource_id=e.resource_id,
                ip_address=e.ip_address,
                metadata=e.metadata_,
                created_at=e.created_at,
            )
            for e in entries
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


# ═══════════════════════════════════════════════════════════════════
#  CONSENT TRACKING
# ═══════════════════════════════════════════════════════════════════


@router.get(
    "/consent",
    response_model=ConsentStatus,
    summary="Statut des consentements RGPD",
    responses={
        200: {"description": "Consentements actuels"},
        401: {"description": "Non authentifié"},
    },
)
async def get_consent(
    user: User = Depends(get_current_user),
):
    """Return the user's current consent preferences."""
    return ConsentStatus(
        analytics=getattr(user, "consent_analytics", False),
        push_notifications=getattr(user, "consent_push_notifications", False),
        ai_personalization=getattr(user, "consent_ai_personalization", True),
        data_sharing=getattr(user, "consent_data_sharing", False),
        updated_at=getattr(user, "consent_updated_at", None),
        privacy_policy_version=getattr(user, "privacy_policy_version", "1.0"),
    )


@router.put(
    "/consent",
    response_model=ConsentStatus,
    summary="Mettre à jour les consentements RGPD",
    responses={
        200: {"description": "Consentements mis à jour"},
        401: {"description": "Non authentifié"},
    },
)
async def update_consent(
    request: Request,
    body: ConsentUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the user's consent preferences."""
    changes = {}

    if body.analytics is not None:
        user.consent_analytics = body.analytics
        changes["analytics"] = body.analytics
    if body.push_notifications is not None:
        user.consent_push_notifications = body.push_notifications
        changes["push_notifications"] = body.push_notifications
    if body.ai_personalization is not None:
        user.consent_ai_personalization = body.ai_personalization
        changes["ai_personalization"] = body.ai_personalization
    if body.data_sharing is not None:
        user.consent_data_sharing = body.data_sharing
        changes["data_sharing"] = body.data_sharing

    if changes:
        user.consent_updated_at = datetime.now(UTC)
        await db.commit()

        # Audit trail
        await log_action(
            db,
            action="consent_updated",
            user_id=user.id,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={"changes": changes},
        )
        await db.commit()

    return ConsentStatus(
        analytics=user.consent_analytics,
        push_notifications=user.consent_push_notifications,
        ai_personalization=user.consent_ai_personalization,
        data_sharing=user.consent_data_sharing,
        updated_at=user.consent_updated_at,
        privacy_policy_version=user.privacy_policy_version,
    )


# ═══════════════════════════════════════════════════════════════════
#  PRIVACY POLICY
# ═══════════════════════════════════════════════════════════════════

_PRIVACY_POLICY = PrivacyPolicyResponse(
    version="1.0",
    last_updated="2026-03-04",
    language="fr",
    dpo_contact="dpo@omniflow.app",
    sections=[
        PrivacyPolicySection(
            title="1. Responsable du traitement",
            content=(
                "OmniFlow SAS, société par actions simplifiée, est responsable "
                "du traitement de vos données personnelles. Contact : dpo@omniflow.app."
            ),
        ),
        PrivacyPolicySection(
            title="2. Données collectées",
            content=(
                "Nous collectons les données suivantes : identité (nom, email), "
                "données bancaires (via agrégation Woob — chiffrées AES-256-GCM), "
                "données patrimoniales (crypto, actions, immobilier), "
                "données comportementales (navigation, Web Vitals — si consentement), "
                "conversations IA (stockées chiffrées, supprimables à tout moment)."
            ),
        ),
        PrivacyPolicySection(
            title="3. Finalités du traitement",
            content=(
                "Vos données sont traitées pour : (a) agrégation bancaire et patrimoniale, "
                "(b) analyse financière et budgétaire, (c) conseil IA personnalisé, "
                "(d) alertes et notifications, (e) amélioration du service. "
                "Aucune donnée n'est vendue à des tiers."
            ),
        ),
        PrivacyPolicySection(
            title="4. Base légale",
            content=(
                "Le traitement est fondé sur : (a) l'exécution du contrat (Art. 6.1.b RGPD), "
                "(b) le consentement pour les traitements optionnels (Art. 6.1.a), "
                "(c) l'intérêt légitime pour la sécurité (Art. 6.1.f)."
            ),
        ),
        PrivacyPolicySection(
            title="5. Durée de conservation",
            content=(
                "Données de compte : durée du contrat + 3 ans. "
                "Données bancaires : supprimées à chaque resynchronisation. "
                "Conversations IA : supprimables manuellement, purgées après 2 ans d'inactivité. "
                "Audit trail : 3 ans (obligation légale)."
            ),
        ),
        PrivacyPolicySection(
            title="6. Vos droits",
            content=(
                "Conformément au RGPD, vous disposez des droits suivants : "
                "(a) Droit d'accès (Art. 15) — GET /api/v1/settings/export, "
                "(b) Droit de rectification (Art. 16) — via les paramètres de votre compte, "
                "(c) Droit à l'effacement (Art. 17) — DELETE /api/v1/settings/account, "
                "(d) Droit à la portabilité (Art. 20) — GET /api/v1/settings/export, "
                "(e) Droit d'opposition (Art. 21) — PUT /api/v1/settings/consent. "
                "Exercez vos droits via l'application ou par email à dpo@omniflow.app."
            ),
        ),
        PrivacyPolicySection(
            title="7. Sécurité",
            content=(
                "Chiffrement AES-256-GCM pour les données sensibles, "
                "TLS 1.3 pour les communications, JWT avec rotation et blacklist, "
                "bcrypt (12 rounds) pour les mots de passe, "
                "sel de clé maître unique par utilisateur, "
                "Dockerfile non-root, health probes Kubernetes, "
                "audit trail complet des actions sensibles."
            ),
        ),
        PrivacyPolicySection(
            title="8. Sous-traitants",
            content=(
                "Hébergement : infrastructure auto-hébergée ou cloud souverain. "
                "Agrégation bancaire : Woob (open-source, exécuté localement). "
                "Aucun transfert de données hors UE."
            ),
        ),
        PrivacyPolicySection(
            title="9. Réclamation",
            content=(
                "Vous pouvez introduire une réclamation auprès de la CNIL "
                "(Commission Nationale de l'Informatique et des Libertés) : "
                "www.cnil.fr."
            ),
        ),
    ],
)


@router.get(
    "/privacy-policy",
    response_model=PrivacyPolicyResponse,
    summary="Politique de confidentialité",
    description="Retourne la politique de confidentialité structurée en JSON.",
)
async def get_privacy_policy():
    """Return structured privacy policy (no auth required)."""
    return _PRIVACY_POLICY
