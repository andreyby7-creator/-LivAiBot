from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...adapters.db.session import get_db_session

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(db: AsyncSession = Depends(get_db_session)) -> tuple[dict, int]:
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}, 200
    except Exception as e:
        return {"status": "not_ready", "error": str(e)}, 503
