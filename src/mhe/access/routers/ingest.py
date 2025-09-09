from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi import Body
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
import orjson

from mhe.memory.db import get_session
from mhe.capture.parsers.chatgpt import ingest_chatgpt_export
from mhe.capture.parsers.claude import ingest_claude_export
from mhe.capture.parsers.gemini import ingest_gemini_export

router = APIRouter()

@router.post("/export")
async def ingest_export(
    source: str = Body(..., embed=True),
    payload: Optional[dict] = Body(None),
    file: Optional[UploadFile] = File(None),
    session: AsyncSession = Depends(get_session),
):
    supported_sources = ["chatgpt", "claude", "gemini"]
    if source.lower() not in supported_sources:
        raise HTTPException(400, detail=f"Supported sources: {', '.join(supported_sources)}")

    data = None
    if file is not None:
        raw = await file.read()
        try:
            data = orjson.loads(raw)
        except Exception as e:
            raise HTTPException(400, detail=f"Invalid JSON file: {e}")
    elif payload is not None:
        data = payload
    else:
        raise HTTPException(400, detail="Provide either 'payload' JSON or 'file' upload.")

    # Route to appropriate parser based on source
    if source.lower() == "chatgpt":
        stats = await ingest_chatgpt_export(session, data)
    elif source.lower() == "claude":
        # Convert async session to sync for Claude parser
        sync_session = session.sync_session if hasattr(session, 'sync_session') else session
        stats = ingest_claude_export(data, sync_session)
    elif source.lower() == "gemini":
        # Convert async session to sync for Gemini parser
        sync_session = session.sync_session if hasattr(session, 'sync_session') else session
        stats = ingest_gemini_export(data, sync_session)
    
    return {"status": "ok", "source": source, **stats}
