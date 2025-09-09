import hashlib
from typing import Optional

def stable_sha256(*parts: Optional[str]) -> str:
    m = hashlib.sha256()
    for p in parts:
        if p is None:
            p = ""  # normalize
        if not isinstance(p, (bytes, bytearray)):
            p = str(p).encode("utf-8", errors="ignore")
        m.update(p)
        m.update(b"\x1e")  # record separator
    return m.hexdigest()
