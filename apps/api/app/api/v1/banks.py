"""
OmniFlow — Banks endpoint: list supported banks.
"""

from fastapi import APIRouter

from app.woob_engine.banks import get_all_banks

router = APIRouter(prefix="/banks", tags=["Banks"])


@router.get("", response_model=list[dict])
async def list_banks():
    """List all supported banks with their fields and SCA type."""
    return get_all_banks()
