
from __future__ import annotations
from typing import List, Optional
import math
import random
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.common.config import settings
from mhe.memory.models import Embedding

# --- Mock embedder -----------------------------------------------------------

@dataclass
class MockEmbeddingClient:
    dim: int

    def embed(self, text: str) -> List[float]:
        """
        Deterministic-ish mock: seed from text hash to keep consistency across runs.
        Produces a unit-normalized vector of length dim.
        """
        # Keep behavior stable for same input
        seed = hash(text) & 0xFFFFFFFF
        rng = random.Random(seed)
        vec = [rng.uniform(-1.0, 1.0) for _ in range(self.dim)]
        # L2 normalize
        norm = math.sqrt(sum(x*x for x in vec)) or 1.0
        vec = [x / norm for x in vec]
        return vec

mock_embedder = MockEmbeddingClient(dim=settings.embed_dim)

# --- Persistence helpers -----------------------------------------------------

async def create_embedding_for_text(
    session: AsyncSession,
    text: str,
    target_kind: str,
    target_id: str,
    model: Optional[str] = None,
) -> Embedding:
    """
    Generate (mock) embedding and persist to mhe.embedding for a given target.
    Returns the Embedding ORM object (uncommitted).
    """
    model = model or "mock-embeddings-{}".format(settings.embed_dim)
    vec = mock_embedder.embed(text or "")
    emb = Embedding(
        target_kind=target_kind,
        target_id=target_id,
        model=model,
        dim=len(vec),
        vector=vec,  # pgvector will accept Python list
    )
    session.add(emb)
    return emb

def cosine(u: List[float], v: List[float]) -> float:
    # Inputs are expected unit-normalized; still compute safely
    num = sum(a*b for a, b in zip(u, v))
    # Clamp for numerical safety
    if num > 1: num = 1.0
    if num < -1: num = -1.0
    return num
