
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


@router.post("/search")
async def hybrid_search(
    payload: Dict[str, Any] = Body(...),
    session: AsyncSession = Depends(get_session)
):
    """Hybrid search over messages (lexical) and memory cards (semantic).
    Body: { "q": str, "k": int=20, "w_sem": float=0.6, "w_lex": float=0.4 }
    Returns: { "messages": [...], "cards": [...], "contexts": [...] }
    """
    q: str = payload.get("q") or payload.get("query") or ""
    k: int = int(payload.get("k") or 20)
    w_sem: float = float(payload.get("w_sem") or 0.6)
    w_lex: float = float(payload.get("w_lex") or 0.4)
    if not q.strip(): raise HTTPException(400, detail="Missing 'q' (query)")
    if k < 1: k = 1
    if k > 100: k = 100

    # --- Lexical: message.content_tsv ---
    # Use plainto_tsquery to stay safe for arbitrary strings.
    lex_sql = text("""

        SELECT m.id, m.thread_id, m.role, m.created_at,

               ts_rank(m.content_tsv, plainto_tsquery('english', :q)) AS rank,

               m.content

        FROM mhe.message m

        WHERE m.content_tsv @@ plainto_tsquery('english', :q)

        ORDER BY rank DESC

        LIMIT :k

    """).bindparams(q=q, k=k)
    lex_res = await session.execute(lex_sql)
    lex_rows = lex_res.fetchall()

    # Normalize lexical scores to [0,1]
    max_rank = max((r.rank for r in lex_rows), default=1.0) or 1.0
    messages = [

        {

            "type": "message",

            "id": str(r.id),

            "thread_id": str(r.thread_id) if r.thread_id else None,

            "score_lex": float(r.rank) / float(max_rank),

            "content": r.content,

            "role": r.role,

            "created_at": r.created_at.isoformat() if r.created_at else None,

        }

        for r in lex_rows

    ]

    # --- Semantic: memory_card embeddings ---
    from mhe.llm.clients import get_embedding_client

    emb_client = get_embedding_client()

    qvec = emb_client.embed(q)

    sem_sql = text("""

        SELECT e.target_id AS card_id, 1 - (e.vector <#> :qvec) AS score

        FROM mhe.embedding e

        WHERE e.target_kind = 'memory_card'

        ORDER BY e.vector <#> :qvec ASC

        LIMIT :k

    """).bindparams(qvec=qvec, k=k)

    sem_res = await session.execute(sem_sql)

    sem_rows = sem_res.fetchall()


    # Fetch cards

    from sqlalchemy import select

    from mhe.memory.models import MemoryCard

    card_ids = [r.card_id for r in sem_rows]

    cards_by_id = {}

    if card_ids:

        res_cards = await session.execute(select(MemoryCard).where(MemoryCard.id.in_(card_ids)))

        for c in res_cards.scalars().all():

            cards_by_id[c.id] = c


    cards = []

    for r in sem_rows:

        c = cards_by_id.get(r.card_id)

        if not c: continue

        cards.append({

            "type": "memory_card",

            "id": c.id,

            "score_sem": float(r.score),

            "summary": c.summary,

            "created_from": c.created_from,

        })


    # --- Fusion: simple weighted sum; missing component treated as 0 ---
    # We combine top-k from each list, then sort by fused score and take k.

    # To allow cross-type fusion, we keep them separate and then build a unified 'contexts'.

    fused = []

    for m in messages:

        fused.append({

            **m,

            "score": w_lex * m.get("score_lex", 0.0)  # no semantic for message yet

        })

    for c in cards:

        fused.append({

            **c,

            "score": w_sem * c.get("score_sem", 0.0)

        })

    fused.sort(key=lambda x: x.get("score", 0.0), reverse=True)

    contexts = fused[:k]


    return {"messages": messages, "cards": cards, "contexts": contexts}

