
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import MemoryItem

# Placeholder hybrid search: trivial LIKE over title/body.
# Replace with BM25 + pgvector ANN search and cross-encoder rerank.
def search_memory(db: Session, q: str, kinds=None, strength=None, limit=20):
    stmt = select(MemoryItem)
    if kinds:
        stmt = stmt.where(MemoryItem.kind.in_(kinds))
    if strength:
        stmt = stmt.where(MemoryItem.strength.in_(strength))
    if q:
        like = f"%{q}%"
        stmt = stmt.where((MemoryItem.title.ilike(like)) | (MemoryItem.body_md.ilike(like)))
    stmt = stmt.order_by(MemoryItem.created_ts.desc()).limit(limit)
    rows = db.execute(stmt).scalars().all()
    # Fake score for now
    return [{"id": r.id, "kind": r.kind.value, "title": r.title, "score": 0.5} for r in rows]
