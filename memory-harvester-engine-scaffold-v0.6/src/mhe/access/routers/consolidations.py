
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from mhe.memory.db import get_session
from mhe.memory.models import Consolidation
from mhe.consolidate.jobs import run_consolidation_job

router = APIRouter()

@router.post("/run")
async def run(window_days: Optional[int] = Body(default=7), session: AsyncSession = Depends(get_session)):
    # Compute window [now - window_days, now)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=int(window_days or 7))
    cons = await run_consolidation_job(session, window_start=start, window_end=now)
    session.add(cons)
    await session.flush()
    cid = cons.id
    await session.commit()
    return {"id": cid}
