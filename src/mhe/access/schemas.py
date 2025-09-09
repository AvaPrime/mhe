
from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class ArtifactOut(BaseModel):
    id: str
    message_id: str
    kind: Literal["code","doc","list","diagram","other"]
    language: Optional[str] = None
    mime_type: Optional[str] = None
    content: str
    sha256: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    extracted_at: datetime

    model_config = {"from_attributes": True}

class MessageRef(BaseModel):
    id: str
    role: str
    assistant: Optional[str] = None
    thread_id: Optional[str] = None

class ArtifactRef(BaseModel):
    id: str
    kind: str
    language: Optional[str] = None

class MemoryCardOut(BaseModel):
    id: str
    thread_id: Optional[str] = None
    summary: str
    rationale: Optional[str] = None
    created_from: dict  # keep raw JSON for now (messages/artifacts arrays)
    tags: Optional[List[str]] = Field(default=None)
    created_at: datetime

    model_config = {"from_attributes": True}
