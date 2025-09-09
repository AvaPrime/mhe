
from __future__ import annotations
from typing import List, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from mhe.memory.models import Message, Artifact, MemoryCard
from mhe.memory.embeddings import create_embedding_for_text

# --- Mock LLM client (swap-in real provider later) ---------------------------
class MockLLMClient:
    async def summarize(self, content: str, artifacts: List[Artifact]) -> Tuple[str, list[str]]:
        """
        Return (summary, tags). Heuristic+mock for scaffold.
        """
        # Heuristic language-derived tags
        langs = sorted({(a.language or "text").lower() for a in artifacts})
        base_tags = [f"code:{l}" for l in langs]
        # Minimalistic summary rule
        if len(artifacts) == 1:
            a = artifacts[0]
            lang = a.language or "text"
            summary = f"Contains {lang} code block; captures key snippet from the discussion."
        else:
            summary = f"Aggregates {len(artifacts)} code blocks across the message; anchors implementation context."
        # Add a generic topic tag
        tags = base_tags + ["mhe/extraction", "artifact"]
        return summary, tags

llm = MockLLMClient()

# --- Memory Card Minting -----------------------------------------------------
async def mint_card_for_message(session: AsyncSession, message: Message, artifacts: List[Artifact]) -> MemoryCard:
    """
    Create an uncommitted MemoryCard for a message with artifacts.
    Requires artifact IDs to be present (ensure caller flushed).

    Returns: MemoryCard (not yet committed)
    """
    # Build a compact prompt substrate (used by real LLM later)
    # For mock: we only use content + artifact languages
    summary, tags = await llm.summarize(message.content or "", artifacts)

    created_from = {
        "messages": [
            {"id": message.id, "role": message.role, "assistant": None, "thread_id": message.thread_id}
        ],
        "artifacts": [
            {"id": a.id, "kind": a.kind, "language": a.language} for a in artifacts
        ],
    }
    card = MemoryCard(
        thread_id=message.thread_id,
        summary=summary,
        rationale=None,
        created_from=created_from,
        tags=tags,
    )
    # Persist card and generate embedding on summary
    session.add(card)
    await session.flush()
    await create_embedding_for_text(session, card.summary, target_kind="memory_card", target_id=card.id)
    return card
