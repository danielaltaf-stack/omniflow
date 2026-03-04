"""
OmniFlow — Project Budgets (savings goals) API.
CRUD for projects, contributions, and progress tracking.
"""

import uuid
import datetime as dt
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.project_budget import ProjectBudget, ProjectContribution, ProjectStatus
from app.models.user import User

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Schemas ─────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    icon: str = Field(default="target", max_length=50)
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
    target_amount: int = Field(..., gt=0, description="Target in centimes")
    deadline: dt.date | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    target_amount: int | None = Field(default=None, gt=0)
    deadline: dt.date | None = None
    status: str | None = None


class ContributionCreate(BaseModel):
    amount: int = Field(..., description="Amount in centimes (positive=deposit, negative=withdrawal)")
    contribution_date: dt.date = Field(default_factory=dt.date.today)
    note: str | None = Field(default=None, max_length=500)


# ── Helpers ─────────────────────────────────────────────────

def _compute_monthly_target(target: int, current: int, deadline: dt.date | None) -> int | None:
    """Compute how much per month is needed to reach the goal by deadline."""
    if not deadline:
        return None
    remaining = target - current
    if remaining <= 0:
        return 0
    today = dt.date.today()
    if deadline <= today:
        return remaining  # Already past deadline
    months = (deadline.year - today.year) * 12 + (deadline.month - today.month)
    if months <= 0:
        return remaining
    return ceil(remaining / months)


def _project_to_response(project: ProjectBudget) -> dict:
    progress_pct = round(
        (project.current_amount / project.target_amount) * 100, 1
    ) if project.target_amount > 0 else 0

    monthly_target = _compute_monthly_target(
        project.target_amount, project.current_amount, project.deadline
    )

    return {
        "id": str(project.id),
        "name": project.name,
        "description": project.description,
        "icon": project.icon,
        "color": project.color,
        "target_amount": project.target_amount,
        "current_amount": project.current_amount,
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "status": project.status,
        "monthly_target": monthly_target,
        "progress_pct": progress_pct,
        "is_archived": project.is_archived,
        "contributions_count": len(project.contributions) if project.contributions else 0,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


# ── Routes ──────────────────────────────────────────────────

@router.get("")
async def list_projects(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all project budgets for the current user."""
    query = select(ProjectBudget).where(ProjectBudget.user_id == user.id)

    if not include_archived:
        query = query.where(ProjectBudget.is_archived == False)

    query = query.options(selectinload(ProjectBudget.contributions))
    query = query.order_by(ProjectBudget.created_at.desc())

    result = await db.execute(query)
    projects = result.scalars().all()
    return [_project_to_response(p) for p in projects]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project budget / savings goal."""
    monthly = _compute_monthly_target(body.target_amount, 0, body.deadline)

    project = ProjectBudget(
        id=uuid.uuid4(),
        user_id=user.id,
        name=body.name,
        description=body.description,
        icon=body.icon,
        color=body.color,
        target_amount=body.target_amount,
        current_amount=0,
        deadline=body.deadline,
        status=ProjectStatus.ACTIVE.value,
        monthly_target=monthly,
        is_archived=False,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _project_to_response(project)


@router.get("/{project_id}")
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single project with all contributions."""
    result = await db.execute(
        select(ProjectBudget)
        .where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
        .options(selectinload(ProjectBudget.contributions))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    resp = _project_to_response(project)
    # Include full contribution details
    resp["contributions"] = [
        {
            "id": str(c.id),
            "amount": c.amount,
            "date": c.date.isoformat(),
            "note": c.note,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in (project.contributions or [])
    ]
    return resp


@router.put("/{project_id}")
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a project's details."""
    result = await db.execute(
        select(ProjectBudget).where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    if body.icon is not None:
        project.icon = body.icon
    if body.color is not None:
        project.color = body.color
    if body.target_amount is not None:
        project.target_amount = body.target_amount
    if body.deadline is not None:
        project.deadline = body.deadline
    if body.status is not None:
        valid = [s.value for s in ProjectStatus]
        if body.status not in valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Statut invalide. Choisissez : {', '.join(valid)}",
            )
        project.status = body.status

    # Recompute monthly target
    project.monthly_target = _compute_monthly_target(
        project.target_amount, project.current_amount, project.deadline
    )

    await db.commit()
    await db.refresh(project)
    return _project_to_response(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a project and all its contributions."""
    result = await db.execute(
        select(ProjectBudget).where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/archive", status_code=status.HTTP_200_OK)
async def archive_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive (soft-delete) a project."""
    result = await db.execute(
        select(ProjectBudget).where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    project.is_archived = True
    await db.commit()
    return {"message": "Projet archivé."}


# ── Contributions ───────────────────────────────────────────

@router.post("/{project_id}/contributions", status_code=status.HTTP_201_CREATED)
async def add_contribution(
    project_id: uuid.UUID,
    body: ContributionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a contribution (deposit or withdrawal) to a project."""
    result = await db.execute(
        select(ProjectBudget).where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    if project.status != ProjectStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible d'ajouter une contribution à un projet non actif.",
        )

    contribution = ProjectContribution(
        id=uuid.uuid4(),
        project_id=project_id,
        amount=body.amount,
        date=body.contribution_date,
        note=body.note,
    )
    db.add(contribution)

    # Update current_amount
    project.current_amount += body.amount
    if project.current_amount < 0:
        project.current_amount = 0

    # Auto-complete if target reached
    if project.current_amount >= project.target_amount:
        project.status = ProjectStatus.COMPLETED.value

    # Recompute monthly target
    project.monthly_target = _compute_monthly_target(
        project.target_amount, project.current_amount, project.deadline
    )

    await db.commit()

    return {
        "id": str(contribution.id),
        "project_id": str(project_id),
        "amount": body.amount,
        "date": body.contribution_date.isoformat(),
        "note": body.note,
        "new_current_amount": project.current_amount,
        "new_progress_pct": round(
            (project.current_amount / project.target_amount) * 100, 1
        ) if project.target_amount > 0 else 0,
    }


@router.delete(
    "/{project_id}/contributions/{contribution_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_contribution(
    project_id: uuid.UUID,
    contribution_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a contribution from a project."""
    # Verify project belongs to user
    result = await db.execute(
        select(ProjectBudget).where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    result = await db.execute(
        select(ProjectContribution).where(
            and_(
                ProjectContribution.id == contribution_id,
                ProjectContribution.project_id == project_id,
            )
        )
    )
    contribution = result.scalar_one_or_none()
    if not contribution:
        raise HTTPException(status_code=404, detail="Contribution introuvable.")

    # Reverse the contribution amount
    project.current_amount -= contribution.amount
    if project.current_amount < 0:
        project.current_amount = 0

    # Recompute monthly target
    project.monthly_target = _compute_monthly_target(
        project.target_amount, project.current_amount, project.deadline
    )

    # Revert completed status if under target
    if project.status == ProjectStatus.COMPLETED.value and project.current_amount < project.target_amount:
        project.status = ProjectStatus.ACTIVE.value

    await db.delete(contribution)
    await db.commit()


@router.get("/{project_id}/progress")
async def get_progress(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detailed progress report for a project."""
    result = await db.execute(
        select(ProjectBudget)
        .where(
            and_(ProjectBudget.id == project_id, ProjectBudget.user_id == user.id)
        )
        .options(selectinload(ProjectBudget.contributions))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    remaining = max(0, project.target_amount - project.current_amount)
    progress_pct = round(
        (project.current_amount / project.target_amount) * 100, 1
    ) if project.target_amount > 0 else 0

    monthly_target = _compute_monthly_target(
        project.target_amount, project.current_amount, project.deadline
    )

    # Days remaining to deadline
    days_remaining = None
    if project.deadline:
        delta = project.deadline - dt.date.today()
        days_remaining = max(0, delta.days)

    # Compute monthly contributions overview
    monthly_contributions: dict[str, int] = {}
    for c in (project.contributions or []):
        key = c.date.strftime("%Y-%m")
        monthly_contributions[key] = monthly_contributions.get(key, 0) + c.amount

    # Estimate completion date based on average monthly contribution
    estimated_completion = None
    if monthly_contributions and remaining > 0:
        avg_monthly = sum(monthly_contributions.values()) / len(monthly_contributions)
        if avg_monthly > 0:
            months_needed = ceil(remaining / avg_monthly)
            today = dt.date.today()
            est_year = today.year + (today.month + months_needed - 1) // 12
            est_month = (today.month + months_needed - 1) % 12 + 1
            estimated_completion = f"{est_year}-{est_month:02d}"

    return {
        "project_id": str(project.id),
        "name": project.name,
        "target_amount": project.target_amount,
        "current_amount": project.current_amount,
        "remaining": remaining,
        "progress_pct": progress_pct,
        "monthly_target": monthly_target,
        "days_remaining": days_remaining,
        "estimated_completion": estimated_completion,
        "monthly_contributions": monthly_contributions,
        "total_contributions": len(project.contributions) if project.contributions else 0,
    }
