
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from mhe.memory.db import get_session
from mhe.memory.models import Thread, Message, Assistant, Artifact, MemoryCard

router = APIRouter()

@router.get("")
async def list_threads(
    limit: int = Query(default=50, ge=1, le=200),
    cursor: Optional[str] = Query(default=None, description="Return items older than this ISO timestamp"),
    session: AsyncSession = Depends(get_session)
):
    # Latest message time per thread for ordering
    sub = select(
        Message.thread_id,
        func.max(Message.created_at).label("last_at")
    ).group_by(Message.thread_id).subquery()

    stmt = select(
        Thread.id,
        Thread.title,
        Thread.started_at,
        Assistant.name.label("assistant"),
        sub.c.last_at
    ).join(Assistant, Assistant.id == Thread.assistant_id).join(sub, sub.c.thread_id == Thread.id).order_by(sub.c.last_at.desc())

    if cursor:
        from datetime import datetime
        try:
            cur_dt = datetime.fromisoformat(cursor)
            stmt = stmt.where(sub.c.last_at < cur_dt)
        except Exception:
            pass

    stmt = stmt.limit(limit)
    res = await session.execute(stmt)
    rows = res.fetchall()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "title": r.title,
            "assistant": r.assistant,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "last_message_at": r.last_at.isoformat() if r.last_at else None,
        })

    next_cursor = None
    if rows:
        next_cursor = rows[-1].last_at.isoformat() if rows[-1].last_at else None

    return {"items": items, "next_cursor": next_cursor}


@router.get("/{thread_id}/messages")
async def list_thread_messages(
    thread_id: str,
    session: AsyncSession = Depends(get_session)
):
    # Fetch messages chronologically
    stmt = select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc(), Message.id.asc())
    res = await session.execute(stmt)
    msgs: List[Message] = res.scalars().all()
    if not msgs:
        # verify thread exists
        thr = await session.get(Thread, thread_id)
        if not thr:
            raise HTTPException(404, detail="Thread not found")
        # thread exists but no messages
        return {"thread_id": thread_id, "messages": []}

    # Fetch artifacts per message
    msg_ids = [m.id for m in msgs]
    res_a = await session.execute(select(Artifact).where(Artifact.message_id.in_(msg_ids)).order_by(Artifact.extracted_at.asc()))
    artifacts = res_a.scalars().all()
    arts_by_msg = {}
    for a in artifacts:
        arts_by_msg.setdefault(a.message_id, []).append({
            "id": a.id,
            "kind": a.kind,
            "language": a.language,
            "mime_type": a.mime_type,
            "line_start": a.line_start,
            "line_end": a.line_end,
            "content": a.content,
        })

    # Has memory card? Use JSONB containment on created_from
    q_mc = select(MemoryCard.id, MemoryCard.created_from).where(
        text("created_from -> 'messages' @> to_jsonb(array[jsonb_build_object('id', ANY(:ids))])")
    ).params(ids=msg_ids)
    # Fallback simpler gather (iterate) if JSON containment is tricky:
    res_mc = await session.execute(select(MemoryCard))
    cards = res_mc.scalars().all()
    card_msg_ids = set()
    card_map = {}
    for c in cards:
        try:
            for mref in (c.created_from or {}).get("messages", []):
                mid = mref.get("id")
                if mid:
                    card_msg_ids.add(mid)
                    card_map.setdefault(mid, []).append({"id": c.id, "summary": c.summary, "tags": c.tags})
        except Exception:
            continue

    out = []
    for m in msgs:
        out.append({
            "id": m.id,
            "role": m.role,
            "author": m.author,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "content": m.content,
            "artifacts": arts_by_msg.get(m.id, []),
            "cards": card_map.get(m.id, []),
        })

    return {"thread_id": thread_id, "messages": out}
