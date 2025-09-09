
from __future__ import annotations
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.db import get_session
from mhe.memory.models import Embedding, MemoryCard
from mhe.memory.embeddings import mock_embedder, cosine

router = APIRouter()

@router.post("/rag/query")
async def rag_query(
    payload: Dict[str, Any] = Body(...),
    session: AsyncSession = Depends(get_session)
):
    query: str = payload.get("query") or ""
    k: int = int(payload.get("k") or 8)
    if not query.strip():
        raise HTTPException(400, detail="Missing 'query'")
    if k < 1 or k > 50:
        k = 8

    qvec = mock_embedder.embed(query)

    # Fetch candidate embeddings for memory cards (scaffold: naive full scan; optimize later)
    stmt = select(Embedding).where(Embedding.target_kind == "memory_card")
    res = await session.execute(stmt)
    embs: List[Embedding] = res.scalars().all()

    # Rank by cosine similarity
    scored = []
    for e in embs:
        vec = list(e.vector) if isinstance(e.vector, (list, tuple)) else e.vector  # pgvector returns list-like
        score = cosine(qvec, vec)
        scored.append((score, e.target_id))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:k]

    if not top:
        return {"contexts": []}

    target_ids = [tid for _, tid in top]
    stmt_cards = select(MemoryCard).where(MemoryCard.id.in_(target_ids))
    res2 = await session.execute(stmt_cards)
    cards = {c.id: c for c in res2.scalars().all()}

    contexts = []
    for score, tid in top:
        c = cards.get(tid)
        if not c:
            continue
        contexts.append({
            "score": score,
            "summary": c.summary,
            "created_from": c.created_from,
            "id": c.id,
        })
    return {"contexts": contexts}
