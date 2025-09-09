from __future__ import annotations
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel

class ArtifactOut(BaseModel):
    id: str
    message_id: str
    kind: str
    language: Optional[str] = None
    mime_type: Optional[str] = None
    content: str
    sha256: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    extracted_at: datetime

class MemoryCardOut(BaseModel):
    id: str
    thread_id: Optional[str] = None
    summary: str
    rationale: Optional[str] = None
    created_from: Any
    tags: List[str] = []
    created_at: datetime
