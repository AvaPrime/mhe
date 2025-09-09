
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.db import get_session
from mhe.memory.models import MemoryCard
from mhe.access.schemas import MemoryCardOut

router = APIRouter()

@router.get("", response_model=List[MemoryCardOut])
async def list_memory_cards(
    tag: Optional[str] = Query(default=None, description="Filter results to cards containing this tag"),
    limit: int = Query(default=50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> List[MemoryCardOut]:
    stmt = select(MemoryCard).order_by(MemoryCard.created_at.desc()).limit(limit)
    if tag:
        # PostgreSQL ARRAY contains
        stmt = select(MemoryCard).where(MemoryCard.tags.contains([tag])).order_by(MemoryCard.created_at.desc()).limit(limit)
    res = await session.execute(stmt)
    rows = res.scalars().all()
    return [MemoryCardOut.model_validate(r) for r in rows]

@router.get("/{card_id}", response_model=MemoryCardOut)
async def get_memory_card(card_id: str, session: AsyncSession = Depends(get_session)) -> MemoryCardOut:
    stmt = select(MemoryCard).where(MemoryCard.id == card_id)
    res = await session.execute(stmt)
    obj = res.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="MemoryCard not found")
    return MemoryCardOut.model_validate(obj)
