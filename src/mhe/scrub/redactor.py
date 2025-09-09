from __future__ import annotations
import re
from typing import List, Tuple

_REPLACEMENT = "[REDACTED:{kind}]"

PATTERNS = [
    ("OPENAI_KEY", re.compile(r"\bsk-[A-Za-z0-9]{20,}\b")),
    ("GITHUB_PAT", re.compile(r"\bghp_[A-Za-z0-9]{36,}\b")),
    ("AWS_ACCESS_KEY", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("AWS_SECRET_KEY", re.compile(r"\b(?<![A-Za-z0-9+/=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])\b")),
    ("GOOGLE_API_KEY", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("SLACK_TOKEN", re.compile(r"\bxox(?:[abprs]-[A-Za-z0-9-]{10,})+\b")),
    ("STRIPE_KEY", re.compile(r"\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b")),
    ("PRIVATE_KEY_BLOCK", re.compile(r"-----BEGIN [^-]{0,100}PRIVATE KEY-----[\s\S]+?-----END [^-]{0,100}PRIVATE KEY-----", re.MULTILINE)),
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")),
    ("IPV4", re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b")),
    ("IPV6", re.compile(r"\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b")),
    ("CREDIT_CARD", re.compile(r"\b(?:\d[ -]*?){13,19}\b")),
]

def _mask_credit_card(s: str) -> str:
    digits = re.sub(r"\D", "", s)
    if len(digits) < 13 or len(digits) > 19:
        return _REPLACEMENT.format(kind="CREDIT_CARD")
    masked = digits[:4] + "..." + digits[-4:]
    return f"[REDACTED:CREDIT_CARD:{masked}]"

def scrub_text(text: str) -> Tuple[str, List[Tuple[str, str]]]:
    if not text:
        return text, []
    findings: List[Tuple[str, str]] = []
    def _repl(kind):
        def inner(m: re.Match):
            findings.append((kind, m.group(0)[:60]))
            if kind == "CREDIT_CARD":
                return _mask_credit_card(m.group(0))
            return _REPLACEMENT.format(kind=kind)
        return inner

    scrubbed = text
    for kind, pat in PATTERNS:
        scrubbed = pat.sub(_repl(kind), scrubbed)

    return scrubbed, findings