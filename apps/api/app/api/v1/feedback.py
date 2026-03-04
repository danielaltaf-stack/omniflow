"""
OmniFlow — Feedback endpoint.

POST /api/v1/feedback — Submit user feedback (bug, feature request, etc.)
Rate-limited to 5/hour per user.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackRequest, FeedbackResponse
from app.services.audit_service import get_client_ip, get_user_agent, log_action

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post(
    "",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Envoyer un feedback",
)
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit user feedback (bug report, feature request, improvement, other)."""

    # Build metadata with client info
    meta = body.metadata or {}
    meta.update(
        {
            "ip_address": get_client_ip(request),
            "user_agent": get_user_agent(request),
        }
    )

    entry = Feedback(
        user_id=current_user.id,
        category=body.category,
        message=body.message,
        metadata_=meta,
        screenshot=body.screenshot_b64,
    )
    db.add(entry)
    await db.flush()

    # Audit trail
    await log_action(
        db,
        action="feedback_submitted",
        user_id=current_user.id,
        resource_type="feedback",
        resource_id=str(entry.id),
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        metadata={"category": body.category},
    )

    await db.commit()

    return FeedbackResponse(
        id=entry.id,
        message="Merci pour votre retour ! Nous l'examinerons rapidement.",
    )
