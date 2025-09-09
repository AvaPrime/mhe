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
    src = source.lower()
    if src not in {"chatgpt","claude","gemini"}:
        raise HTTPException(400, detail="Unsupported source. Use one of: chatgpt, claude, gemini.")

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

    if src == "chatgpt":
        stats = await ingest_chatgpt_export(session, data)
    elif src == "claude":
        stats = await ingest_claude_export(session, data)
    else:
        stats = await ingest_gemini_export(session, data)
    return {"status": "ok", **stats}
