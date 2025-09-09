
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.models import Assistant, Thread, Message
from mhe.extract.detectors import extract_artifacts_from_markdown
from mhe.extract.cards import mint_card_for_message
from mhe.common.ids import stable_sha256

def _parse_ts(val: Any) -> datetime:
    if val is None:
        return datetime.now(tz=timezone.utc)
    # Google Takeout often uses ISO strings like 2025-09-01T12:34:56Z
    try:
        if isinstance(val, str):
            v = val.strip().replace("Z", "+00:00")
            return datetime.fromisoformat(v)
    except Exception:
        pass
    try:
        return datetime.fromtimestamp(float(val), tz=timezone.utc)
    except Exception:
        pass
    return datetime.now(tz=timezone.utc)

def _role_map(author: str | None) -> str:
    r = (author or "").lower()
    if r in {"user","human","you","me"}:
        return "user"
    if r in {"assistant","model","gemini"}:
        return "assistant"
    return "user"

async def _get_or_create_assistant(session: AsyncSession, name: str, version: Optional[str] = None):
    from mhe.memory.models import Assistant
    from sqlalchemy import select
    res = await session.execute(select(Assistant).where(Assistant.name == name, Assistant.version == version))
    obj = res.scalar_one_or_none()
    if obj: return obj
    obj = Assistant(name=name, version=version); session.add(obj); await session.flush(); return obj

async def ingest_gemini_export(session: AsyncSession, data: Dict[str, Any]) -> dict:
    """Ingest Gemini conversation logs from Google Takeout.
    Supported shapes:
    - { "conversations": [ { "id"|"conversation_id", "title"|"name", "createTime"|"start_time", "messages":[ { "author"|"role", "text"|"content", "createTime"|... } ] } ] }
    - Or top-level list.
    """
    conversations = data.get("conversations") if isinstance(data, dict) else None
    if conversations is None and isinstance(data, list):
        conversations = data
    if conversations is None:
        raise ValueError("Unrecognized Gemini export structure: missing 'conversations'.")

    assistant = await _get_or_create_assistant(session, "gemini", None)

    threads = 0
    messages = 0

    for conv in conversations:
        title = conv.get("title") or conv.get("name")
        started_at = _parse_ts(conv.get("createTime") or conv.get("start_time") or conv.get("updateTime"))
        external_id = str(conv.get("id") or conv.get("conversation_id") or stable_sha256("gemini", title or "", started_at.isoformat()))

        thread = Thread(
            external_id=external_id,
            assistant_id=assistant.id,
            title=title,
            started_at=started_at,
            raw_meta={k: conv.get(k) for k in ("id","conversation_id","createTime","updateTime","start_time") if k in conv}
        )
        session.add(thread); await session.flush()
        threads += 1

        msgs = conv.get("messages") or conv.get("modelTurns") or conv.get("turns") or []
        for mobj in msgs:
            role = _role_map(mobj.get("role") or mobj.get("author"))
            # Gemini Takeout sometimes stores parts under 'text' or 'parts' list with {text}
            text = mobj.get("text")
            if not text and isinstance(mobj.get("parts"), list):
                parts = []
                for p in mobj["parts"]:
                    if isinstance(p, dict):
                        parts.append(str(p.get("text") or p.get("content") or ""))
                    else:
                        parts.append(str(p))
                text = "\n\n".join([t for t in parts if t])
            content_text = (text or "").strip()
            if not content_text:
                continue

            ts = _parse_ts(mobj.get("createTime") or mobj.get("timestamp") or conv.get("createTime"))

            m = Message(
                thread_id=thread.id,
                role=role,
                author=mobj.get("author") or role,
                content=content_text,
                content_md=None,
                created_at=ts,
                tokens=None,
                raw_meta={k: mobj.get(k) for k in ("id","metadata") if k in mobj}
            )
            session.add(m); await session.flush()

            artifacts = extract_artifacts_from_markdown(m)
            for a in artifacts:
                a.message_id = m.id
                session.add(a)
            await session.flush()
            if artifacts:
                card = await mint_card_for_message(session, m, artifacts)
                session.add(card)
            messages += 1

    await session.commit()
    return {"threads": threads, "messages": messages}
