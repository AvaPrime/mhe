
from __future__ import annotations
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from mhe.llm.clients import get_embedding_client
from mhe.memory.models import Embedding

async def create_embedding_for_text(
    session: AsyncSession,
    text: str,
    target_kind: str,
    target_id: str,
    model: Optional[str] = None,
) -> Embedding:
    client = get_embedding_client()
    vec = client.embed(text or "")
    emb = Embedding(
        target_kind=target_kind,
        target_id=target_id,
        model=model or type(client).__name__,
        dim=len(vec),
        vector=vec,
    )
    session.add(emb)
    return emb
