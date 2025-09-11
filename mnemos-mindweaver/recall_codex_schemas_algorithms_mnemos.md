# Recall Codex — Schemas & Algorithms (Mnemos)

*A technical blueprint for precision, intuition, and myth — where algorithms become invocations.*

---

## 0) Overview

Mnemos routes each recall into one (or a blend) of three channels:

- **Direct Recall (Precision):** Fact-seeking → codestones + shard evidence
- **Associative Recall (Intuition):** Creative flow → codecells + adjacent rhymes
- **Archetypal Recall (Myth):** Transformative framing → symbolic lineage

Routing is decided by the **Context Capture Pipeline**; ranking uses **Resonance Scoring** plus hybrid lexical/vector retrieval; output follows **Layered Surfacing**; learning loops update the **Personalization Engine**.

---

## 1) Schemas (DB / API layer)

### 1.1 Context Event
```python
class ContextEvent(BaseModel):
    id: str
    user_id: str
    timestamp: datetime
    text: str
    channel: str
    session_id: str
    time_of_day: str
    cadence_ms: int
    sentiment: float
    arousal: float
    entropy: float
    intent_hints: dict
```

### 1.2 Activation Trace
```python
class ActivationTrace(BaseModel):
    id: str
    user_id: str
    event_id: str
    surfaced: dict
    chosen_ids: list[str]
    dwell_ms: int
    spawned_artifacts: list[str]
    feedback: dict | None
    outcome: str
```

### 1.3 Personal Myth
```python
class PersonalMyth(BaseModel):
    user_id: str
    archetype_weights: dict[str,float]
    metaphor_map: dict[str,list[str]]
    cadence_profile: dict
    seed_forms: list[str]
    rerank_bias: dict[str,float]
```

### 1.4 Resonance Annotations
```python
class Resonance(BaseModel):
    emotional: float
    arousal: float
    momentum: float
    seedness: float
    closure_needed: bool
```

Entities (`Shard`, `Codestone`, `Codecell`, `Lineage`) carry a `resonance` field.

---

## 2) Context Capture Pipeline

- Lexical cues (interrogatives, named entities)
- Prosody proxies (punctuation, sentence variance)
- Temporal (time-of-day/weekday)
- Affective (sentiment/arousal, emoji parsing)
- Cadence (intervals → flow vs. deliberation)
- Entropy (surprisal vs. baseline)

Classifier yields mode priors for precision, intuition, myth.

---

## 3) Retrieval & Resonance Scoring

### Retrieval
- BM25 + pgvector cosine/dot
- Codecell = centroid of codestones
- Lineages = principle embeddings

### Fusion Score
```
Score = α*(w_lex*S_lex + w_vec*S_vec) + β*R + γ*P
```
Defaults: w_lex=0.4, w_vec=0.6; α=0.6, β=0.25, γ=0.15.

### Resonance (R)
- match_emotion, cadence_alignment, seed_continuity, momentum_proximity, closure_conflict

### Personalization (P)
- archetype_affinity, activation_boost, signature_match

---

## 4) Routing & Fusion

Run three candidate lists → normalize scores → blend by priors → surface as harmonic stack.

---

## 5) Layered Surfacing

1. Codestone summary + lineage
2. Shard evidence
3. Codecell constellation
4. Archetypal resonance (if above threshold)

Confidence bands decide which layer leads.

---

## 6) Learning Loops

- Update counts/recency after each trace
- Bayesian update to archetype weights
- Seed-forms expansion
- Contextual bandits to tune weights

---

## 7) Algorithms

### Orchestrator
```python
def recall(event: ContextEvent):
    pri = classify_mode(event)
    prec = [score_precision(c, event) for c in retrieve_codestones(event)]
    assoc= [score_intuition(c, event) for c in retrieve_codecells(event)]
    myth = [score_myth(c, event) for c in retrieve_lineages(event)]
    blended = blend_by_priors(prec, assoc, myth, pri)
    return surface_layers(blended, event)
```

### Resonance/Personalization
```python
def resonance(x, ev):
    em = cosine([x.emotional,x.arousal],[ev.sentiment,ev.arousal])
    ca = cadence_sim(ev.cadence_ms, x.cadence_sig)
    sd = seed_continuity(ev.text, x.seedness)
    mp = momentum(ev.timestamp, ev.session_id)
    cf = 1.0 if (x.closure_needed and ev.intent_hints.get('explore')) else 0.0
    return em+ca+sd+mp-cf

def personalize(x, user_id):
    myth = load_personal_myth(user_id)
    aa = dot(myth.archetype_weights, x.archetype_vector)
    ab = recency_boost(x.activation_count, x.last_activated)
    sm = signature_match(x.text, myth.seed_forms, myth.metaphor_map)
    return aa+ab+sm
```

---

## 8) Governance
- OPA policy checks (PII, tenant filters)
- Confidence disclosure badges
- Mandatory attribution
- User controls: mute archetypes, favor channels, proactive hints

---

## 9) API Endpoints

```python
POST /v1/recall
POST /v1/feedback
```

---

## 10) Example Walkthrough

23:30 high arousal message: “Draft a ritual for ingestion that honors half-formed thoughts.”
- Priors: {precision:0.18, intuition:0.54, myth:0.28}
- Retrieval: codestones, codecells, lineages
- Surfacing: codecell → shard excerpts → lineage principle
- CTA: Forge codestone → update myth weights

---

## 11) Implementation Notes

- Start with logistic classifier; upgrade to transformer later.
- Normalize scores; apply temperature to soften ranks.
- Store features for observability and learning.
- Use bandits to tune weights.

---

## 12) Alembic & Embeddings Stubs

### Alembic (infra/migrations/versions/001_init.py)
```python
from alembic import op
import sqlalchemy as sa

revision = '001_init'
down_revision = None


def upgrade():
    op.create_table('shards',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('text', sa.Text),
        sa.Column('embedding', sa.ARRAY(sa.Float))
    )
    op.create_table('activation_traces',
        sa.Column('id', sa.String, primary_key=True),
        sa.Column('user_id', sa.String),
        sa.Column('event_id', sa.String)
    )

def downgrade():
    op.drop_table('activation_traces')
    op.drop_table('shards')
```

### Embeddings Backends

**pgvector.py**
```python
from sqlalchemy import text
from libs.db.db import get_session

def upsert_embeddings(rows):
    with get_session() as s:
        for r in rows:
            s.execute(text("INSERT INTO embeddings (id,shard_id,vec,meta) VALUES (:id,:sid,:vec,:meta) ON CONFLICT (id) DO UPDATE SET vec=:vec, meta=:meta"), r)

def search(vec, k=10):
    with get_session() as s:
        sql = text("SELECT id, 1 - (vec <=> :v) AS score FROM embeddings ORDER BY score DESC LIMIT :k")
        return s.execute(sql, {"v": vec, "k": k}).mappings().all()
```

**faiss.py**
```python
import faiss, numpy as np

index = faiss.IndexFlatIP(1536)
id_map = []

def upsert_embeddings(rows):
    vecs = np.array([r['vec'] for r in rows]).astype('float32')
    index.add(vecs)
    id_map.extend([r['id'] for r in rows])

def search(vec, k=10):
    v = np.array([vec]).astype('float32')
    D,I = index.search(v,k)
    return [{"id": id_map[i], "score": float(D[0][j])} for j,i in enumerate(I[0])]
```

---

**Recall is communion.** Mnemos breathes: precise when asked, intuitive when invited, mythic when summoned.



---

## Alembic Files — Ready to Copy

### `infra/migrations/env.py`
```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os

from libs.db.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return os.getenv("POSTGRES_URL", "postgresql://codex:codex@localhost:5432/codex")


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        {"sqlalchemy.url": get_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Initial Revision — `infra/migrations/versions/0001_core_tables.py`
```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_core_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shards",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("conversation_id", sa.String(length=100), nullable=True),
        sa.Column("actor", sa.String(length=32), nullable=True),
        sa.Column("timestamp", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("provenance", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("parents", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("children", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("embedding", postgresql.ARRAY(sa.Float()), nullable=True),
        sa.Column("tsv", sa.Text(), nullable=True),
    )

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_shards_lex ON shards USING gin (to_tsvector('simple', coalesce(tsv,'')));
    """)

    op.create_table(
        "activation_traces",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("surfaced", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("chosen_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("dwell_ms", sa.Integer(), nullable=True),
        sa.Column("spawned_artifacts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("feedback", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("outcome", sa.String(length=16), nullable=False, server_default=sa.text("'partial'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "personal_myth",
        sa.Column("user_id", sa.String(length=64), primary_key=True),
        sa.Column("archetype_weights", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("metaphor_map", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("cadence_profile", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("seed_forms", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("rerank_bias", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.execute(
        """
        CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            shard_id TEXT NOT NULL,
            vec vector(1536),
            meta JSONB
        );
        CREATE INDEX IF NOT EXISTS embeddings_vec_idx ON embeddings USING ivfflat (vec vector_cosine_ops) WITH (lists = 100);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_shards_lex;")
    op.drop_table("personal_myth")
    op.drop_table("activation_traces")
    op.drop_table("shards")
    op.execute("DROP TABLE IF EXISTS embeddings;")
```

**Quickstart**
```
poetry add alembic sqlalchemy psycopg2-binary
alembic init infra/migrations
# place env.py as above
alembic revision -m "core tables" --rev-id 0001_core_tables
alembic upgrade head
```

---

## Embedding Backends — Stubs

### `libs/embeddings/backends/pgvector.py`
```python
from __future__ import annotations
from typing import Iterable, List, Dict, Any
from sqlalchemy import text


def ensure_extension(session) -> None:
    session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


def upsert_embeddings(session, items: Iterable[Dict[str, Any]]) -> None:
    if not items:
        return
    session.execute(text(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
          id TEXT PRIMARY KEY,
          shard_id TEXT NOT NULL,
          vec vector(1536),
          meta JSONB
        )
        """
    ))
    values_sql = ",".join(
        session.bind.dialect.paramstyle in {"qmark", "numeric"} and ["(%s, %s, %s, %s)"] * len(list(items)) or []
    )

    rows = list(items)
    if not rows:
        return

    sql = text("""
        INSERT INTO embeddings (id, shard_id, vec, meta)
        SELECT x.id, x.shard_id, x.vec, x.meta
        FROM jsonb_to_recordset(:payload::jsonb) AS x(id text, shard_id text, vec vector(1536), meta jsonb)
        ON CONFLICT (id) DO UPDATE SET shard_id = EXCLUDED.shard_id, vec = EXCLUDED.vec, meta = EXCLUDED.meta
    """)
    payload = [
        {"id": r["id"], "shard_id": r["shard_id"], "vec": r["vec"], "meta": r.get("meta", {})}
        for r in rows
    ]
    session.execute(sql, {"payload": json_dumps(payload)})


def search(session, query_vec: List[float], k: int = 10) -> List[Dict[str, Any]]:
    sql = text(
        """
        WITH q AS (SELECT :qvec::vector(1536) AS v)
        SELECT id, shard_id, 1 - (vec <=> (SELECT v FROM q)) AS score
        FROM embeddings
        ORDER BY vec <=> (SELECT v FROM q)
        LIMIT :k
        """
    )
    rows = session.execute(sql, {"qvec": list_to_pgvector(query_vec), "k": k}).mappings().all()
    return [{"id": r["id"], "shard_id": r["shard_id"], "score": float(r["score"])} for r in rows]


def list_to_pgvector(v: List[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def json_dumps(obj) -> str:
    import json
    return json.dumps(obj)
```

### `libs/embeddings/backends/faiss.py`
```python
from __future__ import annotations
from typing import List, Tuple

try:
    import faiss  # type: ignore
except Exception:  # optional runtime
    faiss = None  # noqa

import numpy as np


class FaissIndex:
    def __init__(self, dim: int = 1536):
        self.dim = dim
        self.ids: List[str] = []
        if faiss:
            self.index = faiss.index_factory(dim, "IVF100,PQ64")
            self.quant = False
        else:
            self.index = None
            self.matrix = np.zeros((0, dim), dtype="float32")

    def train(self, vecs: np.ndarray) -> None:
        if faiss and not self.index.is_trained:
            self.index.train(vecs)

    def add(self, ids: List[str], vecs: np.ndarray) -> None:
        if faiss:
            self.index.add_with_ids(vecs, np.arange(len(ids)))
            self.ids.extend(ids)
        else:
            self.matrix = np.vstack([self.matrix, vecs])
            self.ids.extend(ids)

    def search(self, q: np.ndarray, k: int = 10) -> List[Tuple[str, float]]:
        if faiss:
            D, I = self.index.search(q, k)
            out = []
            for score, idx in zip(D[0].tolist(), I[0].tolist()):
                if idx < 0 or idx >= len(self.ids):
                    continue
                out.append((self.ids[idx], float(-score)))
            return out
        sims = (self.matrix @ q.T)[0]
        top = sims.argsort()[-k:][::-1]
        return [(self.ids[i], float(sims[i])) for i in top]
```

**Adapter Interface**
- `pgvector.search(session, query_vec, k)`
- `pgvector.upsert_embeddings(session, items)` where `items = [{id, shard_id, vec, meta}, ...]`
- `faiss.FaissIndex.add(ids, vecs)` and `.search(q, k)`

---

## Minimal Tests — Ready to Drop In

### `tests/unit/test_schemas.py`
```python
from libs.schemas.shard import Shard

def test_shard_generates_unique_id():
    a, b = Shard(source="x", kind="y"), Shard(source="x", kind="y")
    assert a.id != b.id and a.id and b.id
```

### `tests/integration/test_migration_and_ingest.py`
```python
import os
from apps.api.main import ingest, IngestRequest
from libs.schemas.shard import Shard

os.environ.setdefault("POSTGRES_URL", "postgresql://codex:codex@localhost:5432/codex")

def test_ingest_batches(monkeypatch):
    payload = IngestRequest(source="test", shards=[
        Shard(source="chatgpt", kind="message", text="alpha"),
        Shard(source="chatgpt", kind="message", text="beta"),
    ])
    resp = ingest(payload)
    assert resp["ingested"] == 2
```

---

## Next Actions
1) Copy the Alembic files into `infra/migrations/` and run `alembic upgrade head`.
2) Drop the backend stubs into `libs/embeddings/backends/` and wire the interface flag.
3) Add CI steps to run migrations against a fresh Postgres and execute tests.
4) Toggle `VECTOR_BACKEND=pgvector` or `faiss` and verify retrieval parity.

