from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi import Body
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
import orjson

from mhe.memory.db import get_session
from mhe.capture.parsers.chatgpt import ingest_chatgpt_export

router = APIRouter()

@router.post("/export")
async def ingest_export(
    source: str = Body(..., embed=True),
    payload: Optional[dict] = Body(None),
    file: Optional[UploadFile] = File(None),
    session: AsyncSession = Depends(get_session),
):
    if source.lower() != "chatgpt":
        raise HTTPException(400, detail="Only 'chatgpt' source is implemented in this scaffold.")

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

    stats = await ingest_chatgpt_export(session, data)
    return {"status": "ok", **stats}
