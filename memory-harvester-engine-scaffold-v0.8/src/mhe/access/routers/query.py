
from __future__ import annotations
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from mhe.memory.db import get_session
from mhe.llm.clients import get_embedding_client

router = APIRouter()

@router.post("/query")
async def rag_query(payload: Dict[str, Any] = Body(...), session: AsyncSession = Depends(get_session)):
    query: str = payload.get("query") or ""
    k: int = int(payload.get("k") or 8)
    if not query.strip():
        raise HTTPException(400, detail="Missing 'query'")
    if k < 1 or k > 50:
        k = 8

    qvec = get_embedding_client().embed(query)

    # pgvector cosine distance operator: <#>
    # We select memory_card embeddings ordered by ascending distance
    stmt = text("""

        SELECT e.target_id AS card_id, 1 - (e.vector <#> :qvec) AS score

        FROM mhe.embedding e

        WHERE e.target_kind = 'memory_card'

        ORDER BY e.vector <#> :qvec ASC

        LIMIT :k

    """).bindparams(qvec=qvec, k=k)

    res = await session.execute(stmt)
    rows = res.fetchall()

    if not rows:
        return {"contexts": []}

    ids = [r.card_id for r in rows]
    # Fetch cards
    from sqlalchemy import select
    from mhe.memory.models import MemoryCard
    card_rows = await session.execute(select(MemoryCard).where(MemoryCard.id.in_(ids)))
    cards = {c.id: c for c in card_rows.scalars().all()}

    contexts = []
    for r in rows:
        c = cards.get(r.card_id)
        if not c: continue
        contexts.append({"score": float(r.score), "summary": c.summary, "created_from": c.created_from, "id": c.id})
    return {"contexts": contexts}
