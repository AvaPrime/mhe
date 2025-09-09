
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from mhe.memory.db import get_session
from mhe.consolidate.jobs import run_consolidation_job

router = APIRouter()

@router.post("/run")
async def run_consolidation(session: AsyncSession = Depends(get_session)):
    now = datetime.now(tz=timezone.utc)
    window_start = now - timedelta(days=7)
    window_end = now
    consolidation = await run_consolidation_job(session, window_start, window_end)
    await session.commit()
    return {"id": consolidation.id, "window_start": window_start, "window_end": window_end}
