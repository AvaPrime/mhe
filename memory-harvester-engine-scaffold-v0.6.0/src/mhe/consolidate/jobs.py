
from __future__ import annotations
from datetime import datetime
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from mhe.memory.models import MemoryCard, Consolidation

class MockLLMClient:
    async def synthesize(self, text: str) -> str:
        # Minimal synthetic report; swap with real LLM later.
        header = "# Consolidation Report\n\n"
        trailer = "\n\n---\n(Mock synthesis output)"
        body = text.strip()
        if not body:
            return header + "_No cards found in this window._" + trailer
        # Keep it short-ish
        snippet = body[:2000]
        return header + snippet + trailer

llm = MockLLMClient()

async def run_consolidation_job(session: AsyncSession, window_start: datetime, window_end: datetime) -> Consolidation:
    """Aggregate MemoryCards in a window and produce a consolidated markdown report (uncommitted)."""
    res = await session.execute(
        select(MemoryCard)
        .where(MemoryCard.created_at >= window_start)
        .where(MemoryCard.created_at <= window_end)
        .order_by(MemoryCard.created_at.asc())
    )
    cards: List[MemoryCard] = res.scalars().all()

    if not cards:
        report = await llm.synthesize("")
    else:
        joined = "\n\n".join(
            (c.summary or "").strip() + ("\n" + (c.rationale or "")) for c in cards
        )
        report = await llm.synthesize(joined)

    consolidation = Consolidation(
        window_start=window_start,
        window_end=window_end,
        report_md=report,
    )
    # Caller is responsible for session.add/commit; we add here for convenience
    session.add(consolidation)
    return consolidation
