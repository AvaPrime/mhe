
from __future__ import annotations
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from mhe.memory.models import Message, Artifact, MemoryCard
from mhe.memory.embeddings import create_embedding_for_text
from mhe.llm.clients import get_generative_client

def _derive_tags(artifacts: List[Artifact]) -> list[str]:
    langs = sorted({(a.language or "text").lower() for a in artifacts})
    base = [f"code:{l}" for l in langs]
    return base + ["mhe/extraction", "artifact"]

async def mint_card_for_message(session: AsyncSession, message: Message, artifacts: List[Artifact]) -> MemoryCard:
    # Build a light prompt
    snippet = (message.content or "")[:2000]
    arts_meta = ", ".join(sorted(filter(None, [a.language for a in artifacts])))
    prompt = f"Summarize the key outcome of the following message and its code artifacts (langs: {arts_meta}). \nMessage:\n{snippet}\n"

    gen = get_generative_client()
    summary = await gen.summarize(prompt)
    tags = _derive_tags(artifacts)
    created_from = {
        "messages": [{"id": message.id, "role": message.role, "assistant": None, "thread_id": message.thread_id}],
        "artifacts": [{"id": a.id, "kind": a.kind, "language": a.language} for a in artifacts],
    }

    card = MemoryCard(
        thread_id=message.thread_id,
        summary=summary,
        rationale=None,
        created_from=created_from,
        tags=tags,
    )
    session.add(card)
    await session.flush()
    await create_embedding_for_text(session, card.summary, target_kind="memory_card", target_id=card.id)
    return card
