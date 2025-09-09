from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.models import Assistant, Thread, Message
from mhe.extract.detectors import extract_artifacts_from_markdown
from mhe.extract.cards import mint_card_for_message
from mhe.common.ids import stable_sha256

def _safe_parts(message: dict) -> List[str]:
    # ChatGPT export: message.get('content', {}).get('parts', [str])
    content = message.get('content') or {}
    parts = content.get('parts') or []
    # Sometimes a single string lives directly in 'content'
    if isinstance(content, str):
        parts = [content]
    # Ensure strings
    out = []
    for p in parts:
        if p is None:
            continue
        if isinstance(p, (dict, list)):
            # Best-effort stringify structured blocks
            out.append(str(p))
        else:
            out.append(str(p))
    return out

def _role(author: dict) -> str:
    # roles: user|assistant|system
    role = (author or {}).get('role') or 'user'
    if role not in {'user','assistant','system'}:
        role = 'user'
    return role

def _ts(sec: Optional[float]) -> datetime:
    if not sec:
        return datetime.now(tz=timezone.utc)
    # ChatGPT exports may be seconds since epoch
    return datetime.fromtimestamp(float(sec), tz=timezone.utc)

async def _get_or_create_assistant(session: AsyncSession, name: str, version: Optional[str] = None) -> Assistant:
    res = await session.execute(select(Assistant).where(Assistant.name == name, Assistant.version == version))
    obj = res.scalar_one_or_none()
    if obj:
        return obj
    obj = Assistant(name=name, version=version)
    session.add(obj)
    await session.flush()
    return obj

async def ingest_chatgpt_export(session: AsyncSession, data: Dict[str, Any]) -> dict:
    """Ingest ChatGPT conversations.json export into thread/message tables.

    Accepts either {"conversations": [...]} or a list at the top level.
    """
    conversations = data.get('conversations') if isinstance(data, dict) else None
    if conversations is None and isinstance(data, list):
        conversations = data
    if conversations is None:
        raise ValueError("Unrecognized ChatGPT export structure: missing 'conversations'.")

    assistant = await _get_or_create_assistant(session, name="chatgpt", version=None)

    threads = 0
    messages = 0

    for conv in conversations:
        title = conv.get('title')
        create_time = conv.get('create_time') or conv.get('update_time')
        started_at = _ts(create_time)

        # mapping is a dict of id -> node {message, parent, children}
        mapping = conv.get('mapping') or {}
        # Fallback older format: 'messages'
        if not mapping and 'messages' in conv:
            # Assume a simple list of messages
            mapping = {str(i): {'message': m, 'parent': None, 'children': []} for i, m in enumerate(conv['messages'])}

        external_id = str(conv.get('id') or conv.get('conversation_id') or stable_sha256(title or '', started_at.isoformat()))

        thread = Thread(
            external_id=external_id,
            assistant_id=assistant.id,
            title=title,
            started_at=started_at,
            raw_meta={k: conv.get(k) for k in ('id','conversation_id','create_time','update_time') if k in conv}
        )
        session.add(thread)
        await session.flush()
        threads += 1

        # Extract messages in chronological order based on 'create_time' within node.message
        nodes: List[Tuple[datetime, dict]] = []
        for node in mapping.values():
            msg = node.get('message')
            if not msg:
                continue
            ts = _ts(msg.get('create_time') or conv.get('create_time'))
            nodes.append((ts, msg))
        nodes.sort(key=lambda x: x[0])

        for ts, msg in nodes:
            author = msg.get('author') or {}
            role = _role(author)
            parts = _safe_parts(msg)
            content_text = "\n\n".join(parts).strip()
            if not content_text:
                continue

            m = Message(
                thread_id=thread.id,
                role=role,
                author=(author.get('name') or author.get('role')),
                content=content_text,
                content_md=None,
                created_at=ts,
                tokens=None,
                raw_meta={k: msg.get(k) for k in ('id','recipient','metadata') if k in msg}
            )
            session.add(m)
            await session.flush()
            artifacts = extract_artifacts_from_markdown(m)
            for a in artifacts:
                a.message_id = m.id
                session.add(a)
            # Flush again so artifact IDs are available for provenance
            await session.flush()
            # Mint a MemoryCard for this message (heuristic: only when artifacts exist)
            if artifacts:
                card = await mint_card_for_message(session, m, artifacts)
                session.add(card)
            messages += 1

    await session.commit()
    return {"threads": threads, "messages": messages}
