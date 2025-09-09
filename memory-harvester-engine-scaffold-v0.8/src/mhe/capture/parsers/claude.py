
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
    # Accept numeric epoch (seconds) or ISO8601 string
    try:
        return datetime.fromtimestamp(float(val), tz=timezone.utc)
    except Exception:
        pass
    try:
        # Try ISO 8601
        if isinstance(val, str):
            # Remove Z if present
            v = val.strip().replace("Z", "+00:00")
            return datetime.fromisoformat(v)
    except Exception:
        pass
    return datetime.now(tz=timezone.utc)

def _role_map(author: str | None) -> str:
    r = (author or "").lower()
    if r in {"user","human"}:
        return "user"
    if r in {"assistant","ai","claude"}:
        return "assistant"
    return "user"

async def _get_or_create_assistant(session: AsyncSession, name: str, version: Optional[str] = None):
    from mhe.memory.models import Assistant
    res = await session.execute(select(Assistant).where(Assistant.name == name, Assistant.version == version))
    obj = res.scalar_one_or_none()
    if obj: return obj
    obj = Assistant(name=name, version=version)
    session.add(obj); await session.flush()
    return obj

async def ingest_claude_export(session: AsyncSession, data: Dict[str, Any]) -> dict:
    """Ingest Claude export JSON.
    Expected shapes supported:
    - { "conversations": [ { "uuid"|"id", "name"|"title", "created_at", "updated_at", "messages": [ { "role"|"author", "text"|"content", "created_at" } ] } ] }
    - Or a top-level list of conversations.
    """
    conversations = data.get("conversations") if isinstance(data, dict) else None
    if conversations is None and isinstance(data, list):
        conversations = data
    if conversations is None:
        raise ValueError("Unrecognized Claude export structure: missing 'conversations'.")

    assistant = await _get_or_create_assistant(session, "claude", None)

    threads = 0
    messages = 0

    for conv in conversations:
        title = conv.get("name") or conv.get("title")
        started_at = _parse_ts(conv.get("created_at") or conv.get("updated_at"))
        external_id = str(conv.get("uuid") or conv.get("id") or stable_sha256("claude", title or "", started_at.isoformat()))

        thread = Thread(
            external_id=external_id,
            assistant_id=assistant.id,
            title=title,
            started_at=started_at,
            raw_meta={k: conv.get(k) for k in ("uuid","id","created_at","updated_at") if k in conv}
        )
        session.add(thread); await session.flush()
        threads += 1

        msgs = conv.get("messages") or []
        # Support alternate shape: items with 'content' arrays (role/content)
        for mobj in msgs:
            role = _role_map(mobj.get("role") or mobj.get("author"))
            # Claude exports sometimes store content as string or list of blocks
            content = mobj.get("text") or mobj.get("content")
            if isinstance(content, list):
                # join text parts
                parts = []
                for block in content:
                    if isinstance(block, dict):
                        t = block.get("text") or block.get("content") or ""
                        parts.append(str(t))
                    else:
                        parts.append(str(block))
                content_text = "\n\n".join(p for p in parts if p).strip()
            else:
                content_text = (content or "").strip()

            if not content_text:
                continue

            ts = _parse_ts(mobj.get("created_at") or mobj.get("timestamp"))

            m = Message(
                thread_id=thread.id,
                role=role,
                author=mobj.get("author") or role,
                content=content_text,
                content_md=None,
                created_at=ts,
                tokens=None,
                raw_meta={k: mobj.get(k) for k in ("id","uuid","metadata") if k in mobj}
            )
            session.add(m); await session.flush()

            # Extraction + card
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
