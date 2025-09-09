from __future__ import annotations
from typing import Protocol, List, Tuple, Optional
import math, random

from mhe.common.config import settings

# ---- Interfaces --------------------------------------------------------------
class EmbeddingClient(Protocol):
    def embed(self, text: str) -> List[float]: ...

class GenerativeClient(Protocol):
    async def summarize(self, prompt: str) -> str: ...

# ---- Mock implementations ----------------------------------------------------
class MockEmbeddingClient:
    def __init__(self, dim: int): self.dim = dim
    def embed(self, text: str) -> List[float]:
        seed = hash(text) & 0xFFFFFFFF
        rng = random.Random(seed)
        vec = [rng.uniform(-1.0, 1.0) for _ in range(self.dim)]
        norm = math.sqrt(sum(x*x for x in vec)) or 1.0
        return [x / norm for x in vec]

class MockGenerativeClient:
    async def summarize(self, prompt: str) -> str:
        # Tiny heuristic: echo first 200 chars
        snippet = (prompt or "")[:200].replace("\n", " ")
        return f"(mock) Summary: {snippet}..."

# ---- OpenAI stubs (wire real calls when keys present) ------------------------
try:
    import os
    import json
    import http.client
except Exception:
    pass

class OpenAIEmbeddingClient:
    def __init__(self, model: str, dim: int):
        self.model = model
        self.dim = dim
        self.api_key = settings.openai_api_key

    def embed(self, text: str) -> List[float]:
        # Placeholder: if no key, fallback to mock for now
        if not self.api_key:
            return MockEmbeddingClient(self.dim).embed(text)
        # A real implementation would hit OpenAI embeddings API here.
        return MockEmbeddingClient(self.dim).embed(text)

class OpenAIGenerativeClient:
    def __init__(self, model: str):
        self.model = model
        self.api_key = settings.openai_api_key

    async def summarize(self, prompt: str) -> str:
        if not self.api_key:
            return await MockGenerativeClient().summarize(prompt)
        # A real implementation would call OpenAI chat/completions here.
        return await MockGenerativeClient().summarize(prompt)

# ---- Factories ---------------------------------------------------------------
def get_embedding_client() -> EmbeddingClient:
    provider = (settings.embedding_provider or "mock").lower()
    if provider == "openai":
        return OpenAIEmbeddingClient(settings.embed_model, settings.embed_dim)
    return MockEmbeddingClient(settings.embed_dim)

def get_generative_client() -> GenerativeClient:
    provider = (settings.llm_provider or "mock").lower()
    if provider == "openai":
        return OpenAIGenerativeClient(settings.llm_model)
    return MockGenerativeClient()