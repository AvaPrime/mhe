from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.models import MemoryCard
from mhe.memory.db import get_session
from mhe.access.schemas import MemoryCardOut

router = APIRouter()

@router.get("/{card_id}", response_model=MemoryCardOut)
async def get_memory_card(card_id: str, session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(MemoryCard).where(MemoryCard.id == card_id))
    card = res.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="MemoryCard not found")
    return card

@router.get("/", response_model=List[MemoryCardOut])
async def list_memory_cards(
    tag: Optional[str] = Query(None, description="Filter by tag"),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(MemoryCard)
    if tag:
        # ARRAY(String) supports .any() in SQLAlchemy for membership tests
        stmt = stmt.where(MemoryCard.tags.any(tag))
    res = await session.execute(stmt.order_by(MemoryCard.created_at.desc()))
    return list(res.scalars())
