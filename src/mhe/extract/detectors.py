
from __future__ import annotations
from typing import List
import re
from mhe.memory.models import Artifact, Message
from mhe.common.ids import stable_sha256

FENCE_RE = re.compile(
    r"""
    (?P<fence>```|~~~)            # opening fence
    [ \t]*
    (?P<lang>[A-Za-z0-9_+\-\.#]*)? # optional language
    [ \t]*\r?\n                   # newline
    (?P<body>.*?)
    \r?\n?
    (?P=fence)                    # matching closing fence
    """,
    re.DOTALL | re.VERBOSE,
)

def _iter_fences(text: str):
    for m in FENCE_RE.finditer(text):
        start_idx = m.start()
        # 1-based line number for the start of the code block's body
        line_start = text.count("\n", 0, start_idx) + 1
        body = m.group("body") or ""
        # number of lines in the code body
        body_lines = body.count("\n") + 1 if body else 1
        line_end = line_start + body_lines - 1
        lang = (m.group("lang") or "").strip() or None
        yield lang, body, line_start, line_end

def extract_artifacts_from_markdown(message: Message) -> List[Artifact]:
    """
    Detect fenced code blocks in message.content and return Artifact objects (uncommitted).
    """
    content = message.content or ""
    artifacts: List[Artifact] = []
    for lang, body, line_start, line_end in _iter_fences(content):
        snippet = (body or "").strip("\r\n")
        if not snippet.strip():
            continue
        sha = stable_sha256("code", lang or "", snippet)
        art = Artifact(
            message_id=message.id,  # may be None prior to flush; caller should ensure a flush if needed
            kind="code",
            language=lang,
            mime_type="text/plain" if not lang else f"text/x-{lang.lower()}",
            content=snippet,
            sha256=sha,
            line_start=line_start,
            line_end=line_end,
        )
        artifacts.append(art)
    return artifacts
