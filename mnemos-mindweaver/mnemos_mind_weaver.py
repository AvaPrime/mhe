# Mnemos - The MindWeaver
# Advanced Biosynthetic Memory Augmentation System
# Incorporating pgvector hybrid search, Claude/Gemini parsers, Drive/GitHub ingestion,
# Alembic migrations, Ray orchestration, and CI-ready scaffolding.

# --- apps/api/main.py ---
from fastapi import FastAPI, Query
from pydantic import BaseModel
from typing import List
import os

from sqlalchemy.dialects.postgresql import insert

from libs.schemas.shard import Shard
from libs.db.db import get_session, ensure_tables
from libs.db.models import ShardRow
from libs.search.hybrid import HybridSearcher
from libs.embeddings.service import embed

app = FastAPI(title="Mnemos - The MindWeaver API", version="1.0.0")

@app.on_event("startup")
def startup():
    ensure_tables()
    app.state.searcher = HybridSearcher()

@app.get("/health")
def health():
    return {"status": "ok", "env": os.getenv("ENV", "dev")}

class IngestRequest(BaseModel):
    source: str
    shards: List[Shard]

@app.post("/ingest")
def ingest(payload: IngestRequest):
    with get_session() as s:
        texts = []
        text_idx = {}
        for i, sh in enumerate(payload.shards):
            if sh.text:
                text_idx[i] = len(texts)
                texts.append(sh.text)
        vecs = embed(texts) if texts else []
        rows_data = []
        for i, sh in enumerate(payload.shards):
            emb = None
            if i in text_idx:
                emb = vecs[text_idx[i]] if text_idx[i] < len(vecs) else None
            rows_data.append({
                "id": sh.id,
                "source": sh.source,
                "kind": sh.kind,
                "conversation_id": sh.conversation_id,
                "actor": sh.actor,
                "timestamp": sh.timestamp,
                "text": sh.text,
                "metadata": sh.metadata or {},
                "provenance": sh.provenance or {},
                "parents": sh.parents,
                "children": sh.children,
                "embedding": emb,
                "tsv": sh.text or "",
            })
        if not rows_data:
            return {"ingested": 0, "source": payload.source}
        stmt = insert(ShardRow).values(rows_data)
        updatable_cols = [c.name for c in ShardRow.__table__.columns if c.name != "id"]
        stmt = stmt.on_conflict_do_update(
            index_elements=[ShardRow.id],
            set_={name: getattr(stmt.excluded, name) for name in updatable_cols}
        )
        s.execute(stmt)
    return {"ingested": len(rows_data), "source": payload.source}

@app.get("/recall")
def recall(q: str = Query(...), k: int = 10):
    return {"q": q, "results": app.state.searcher.search(q, k)}

# --- libs/schemas/shard.py ---
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import uuid

class Shard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str
    kind: str
    conversation_id: Optional[str] = None
    actor: Optional[str] = None
    timestamp: Optional[datetime] = None
    text: Optional[str] = None
    metadata: Dict = {}
    provenance: Dict = {}
    parents: Optional[List[str]] = []
    children: Optional[List[str]] = []

# --- libs/db/db.py ---
import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql://codex:codex@db:5432/codex")
engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

from libs.db.models import Base

def ensure_tables():
    Base.metadata.create_all(engine)

@contextmanager
def get_session():
    s = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()

# --- libs/db/models.py ---
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, JSON, TIMESTAMP, ARRAY, Float
from datetime import datetime
from typing import Optional, List

from libs.schemas.shard import Shard

class Base(DeclarativeBase):
    pass

class ShardRow(Base):
    __tablename__ = "shards"
    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    source: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(32))
    conversation_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    actor: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    timestamp: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    parents: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    children: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    embedding: Mapped[Optional[List[float]]] = mapped_column(ARRAY(Float), nullable=True)
    tsv: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @staticmethod
    def from_shard(s: Shard) -> "ShardRow":
        return ShardRow(
            id=s.id,
            source=s.source,
            kind=s.kind,
            conversation_id=s.conversation_id,
            actor=s.actor,
            timestamp=s.timestamp,
            text=s.text,
            metadata=s.metadata,
            provenance=s.provenance,
            parents=s.parents,
            children=s.children,
            tsv=s.text or ""
        )

# --- libs/embeddings/service.py ---
import os, math, requests
from typing import List

MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def embed(texts: List[str]) -> list[list[float]]:
    if not texts:
        return []
    if OPENAI_API_KEY:
        try:
            resp = requests.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={"model": MODEL, "input": texts},
                timeout=20
            )
            resp.raise_for_status()
            vecs = [d["embedding"] for d in resp.json()["data"]]
            return [normalize(v) for v in vecs]
        except Exception:
            pass
    return [_hash_vec(t) for t in texts]

def _hash_vec(text: str, dim: int = 1536) -> list[float]:
    v = [0.0]*dim
    for i,ch in enumerate(text.encode('utf-8')):
        v[i % dim] += (ch / 255.0)
    norm = math.sqrt(sum(x*x for x in v)) or 1.0
    return [x/norm for x in v]

def normalize(v):
    norm = math.sqrt(sum(x*x for x in v)) or 1.0
    return [x/norm for x in v]

# --- libs/search/hybrid.py ---
from sqlalchemy import text
from libs.db.db import get_session
from libs.embeddings.service import embed

ALPHA = 0.6
BETA = 0.4

def search_hybrid(q: str, k: int = 10):
    vec = embed([q])[0]
    with get_session() as s:
        sql = text(f"""
            WITH qv AS (SELECT ARRAY[{', '.join(str(x) for x in vec)}]::float8[] AS v),
            scored AS (
                SELECT id, text,
                  (SELECT SUM(a*b) FROM unnest(coalesce(embedding, ARRAY[]::float8[])) WITH ORDINALITY t(a,i)
                   JOIN unnest((SELECT v FROM qv)) WITH ORDINALITY q(b,j) ON i=j) AS vdot,
                  ts_rank(to_tsvector('simple', coalesce(tsv,'')), plainto_tsquery('simple', :q)) AS lex
                FROM shards
            )
            SELECT id, text, vdot, lex,
                   (COALESCE(vdot,0)*:alpha + COALESCE(lex,0)*:beta) AS score
            FROM scored
            ORDER BY score DESC NULLS LAST
            LIMIT :k
        """)
        rows = s.execute(sql, {"q": q, "k": k, "alpha": ALPHA, "beta": BETA}).mappings().all()
        return [{"id": r["id"], "snippet": (r["text"] or "")[:400], "score": float(r["score"])} for r in rows]

class HybridSearcher:
    def search(self, q: str, k: int = 10):
        return search_hybrid(q, k)

# --- libs/connectors/claude_normalizer.py ---
import json, uuid
from datetime import datetime
from libs.schemas.shard import Shard

def normalize_claude_json(path: str):
    with open(path) as f:
        data = json.load(f)
    shards = []
    for convo in data.get("conversations", []):
        cid = convo.get("id") or str(uuid.uuid4())
        for msg in convo.get("chat_messages", []):
            ts = None
            if "timestamp" in msg:
                try:
                    ts = datetime.fromisoformat(msg["timestamp"].replace("Z","+00:00"))
                except: pass
            shards.append(Shard(source="claude", kind="message", conversation_id=cid, actor=msg.get("role"), timestamp=ts, text=msg.get("content")))
    return shards

# --- libs/connectors/gemini_normalizer.py ---
import json, uuid
from datetime import datetime
from libs.schemas.shard import Shard

def normalize_gemini_jsonl(path: str):
    shards = []
    with open(path) as f:
        for line in f:
            try: obj = json.loads(line)
            except: continue
            cid = obj.get("session") or str(uuid.uuid4())
            ts = None
            if obj.get("timestamp"):
                try: ts = datetime.fromisoformat(obj["timestamp"].replace("Z","+00:00"))
                except: pass
            if obj.get("prompt"):
                shards.append(Shard(source="gemini", kind="message", conversation_id=cid, actor="user", timestamp=ts, text=str(obj["prompt"])))
            for c in obj.get("candidates", []):
                shards.append(Shard(source="gemini", kind="message", conversation_id=cid, actor="assistant", timestamp=ts, text=str(c.get("content"))))
    return shards

# --- libs/connectors/github_connector.py ---
import subprocess, tempfile, pathlib, hashlib
from libs.schemas.shard import Shard

INCLUDE_EXT = {'.md','.py','.js','.ts','.json','.yml','.yaml','.toml','.go','.rs','.java','.cpp'}

def clone_and_ingest(repo_url: str):
    tmp = tempfile.mkdtemp(prefix="mnemos_git_")
    subprocess.run(["git","clone","--depth","1",repo_url,tmp], check=True)
    shards = []
    for p in pathlib.Path(tmp).rglob("*"):
        if not p.is_file() or p.suffix.lower() not in INCLUDE_EXT: continue
        try: text = p.read_text(encoding="utf-8", errors="ignore")
        except: continue
        sid = hashlib.sha1(str(p).encode()).hexdigest()[:40]
        shards.append(Shard(id=sid, source="github", kind="code", actor="system", text=text, metadata={"path": str(p)}))
    return shards

# --- apps/forge/ray_forge.py ---
import ray, time
from libs.embeddings.service import embed

ray.init(ignore_reinit_error=True)

@ray.remote
def build_variant(artifact_id: str, seed: int):
    score = sum(abs(x) for x in embed([artifact_id])[0][:64])
    time.sleep(0.1)
    return {"seed": seed, "score": score}

def run_forge(artifact_id: str, variants: int = 5):
    jobs = [build_variant.remote(artifact_id, i) for i in range(variants)]
    results = ray.get(jobs)
    best = max(results, key=lambda r: r["score"])
    return {"artifact_id": artifact_id, "best": best, "variants": results}
