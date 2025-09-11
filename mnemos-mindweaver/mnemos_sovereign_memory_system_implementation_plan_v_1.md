# Mnemos MindWeaver — Advanced Memory & Recall System (v2.2)

*Continuous, sovereign memory for agentic co‑consciousness: ingestion → reflection → recall → feedback.*

---

## Repository Scaffold

```
mnemos-mindweaver/
├── apps/
│   ├── api/                        # FastAPI/GraphQL for recall & admin
│   │   ├── main.py                  # Ingest, reflect, recall, feedback
│   │   ├── routers/                 # Endpoint modules
│   │   └── dependencies.py
│   ├── workers/                    # Task runners for ingest/reflect/index
│   │   ├── worker.py
│   │   └── tasks/
│   └── forge/                      # RAMForge (Ray/Temporal) for variant gen
│       ├── ray_forge.py
│       ├── pipelines/
│       └── tests/
├── libs/
│   ├── schemas/                    # Pydantic models, JSON schema validators
│   │   └── shard.py
│   ├── connectors/                 # chat, socials, docs, repos, bookmarks, mail
│   │   ├── chatgpt_normalizer.py   # + Claude, Gemini, Olama, OpenWebUI, PageAssist
│   │   ├── claude_normalizer.py
│   │   ├── gemini_normalizer.py
│   │   ├── discord_normalizer.py   # + Slack, WhatsApp (opt‑in), Email, RSS, Web
│   │   ├── github_connector.py     # + Drive/Docs, Notion, Confluence
│   │   └── base.py
│   ├── reflection/                 # Distill/Synthesize/Mythogenesis passes
│   │   ├── summarizer.py
│   │   ├── codestone_extractor.py
│   │   └── passes/                 # seed_detector, thread_closer, archetype_tagger, linker
│   ├── recall/                     # Recall codex & API surface
│   │   ├── resonance.py            # emotional gradient, seed continuity, cadence
│   │   ├── personalization.py      # activation traces → creative signatures
│   │   └── recall_service.py
│   ├── embeddings/                 # Backends: pgvector | faiss
│   │   ├── embedder.py
│   │   └── backends/
│   │       ├── pgvector.py
│   │       └── faiss.py
│   ├── search/                     # Hybrid retrieval (BM25 + vector + rerank)
│   │   └── retriever.py
│   ├── lineage/                    # Graph ops: shard ↔ codestone ↔ codecell ↔ lineage
│   │   └── lineage_graph.py
│   ├── governance/                 # OPA hooks & policies (Rego)
│   │   ├── opa_client.py
│   │   └── policies/
│   └── ui/                         # React Recall Panel (light/dark, neon ambience)
│       └── recall-panel/
├── infra/
│   ├── docker/                     # Dockerfiles, Compose, k8s manifests
│   ├── migrations/                 # Alembic
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   └── opa/                        # Rego policies & bundles
├── data/
│   ├── exports/                    # Sample chat exports (ChatGPT, Claude, Gemini)
│   └── samples/                    # Normalized JSONL fixtures
├── notebooks/
│   └── exploration.ipynb
├── scripts/                        # CLI utilities
│   └── cli.py
└── tests/                          # Unit + integration + e2e
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Core API Endpoints (apps/api/main.py)

- `POST /ingest` — normalize → batch‑embed → bulk upsert shards.
- `POST /reflect/run` — run reflection pipeline at cadence windows.
- `POST /recall` — hybrid retrieve → resonance/personalization rerank → layered surface (codestone, evidence, codecell, lineage).
- `POST /feedback` — capture activation traces, adjust priors, update personal mythology.

### Transaction‑safe session helper

```python
# libs/db/db.py
from contextlib import contextmanager
from sqlalchemy.orm import sessionmaker

SessionLocal = sessionmaker(autoflush=False, autocommit=False, future=True)

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
```

### Ingest with batched embeddings + bulk upsert (Postgres)

```python
# apps/api/main.py
from sqlalchemy.dialects.postgresql import insert
from libs.embeddings.service import embed
from libs.db.models import ShardRow

@app.post("/ingest")
def ingest(payload: IngestRequest):
    with get_session() as s:
        texts, idx = [], {}
        for i, sh in enumerate(payload.shards):
            if sh.text:
                idx[i] = len(texts)
                texts.append(sh.text)
        vecs = embed(texts) if texts else []
        rows = []
        for i, sh in enumerate(payload.shards):
            emb = vecs[idx[i]] if i in idx and idx[i] < len(vecs) else None
            rows.append({
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
        if not rows:
            return {"ingested": 0}
        stmt = insert(ShardRow).values(rows)
        upd = {c.name: getattr(stmt.excluded, c.name) for c in ShardRow.__table__.columns if c.name != "id"}
        s.execute(stmt.on_conflict_do_update(index_elements=[ShardRow.id], set_=upd))
    return {"ingested": len(rows)}
```

---

## Shard Model (libs/schemas/shard.py)

```python
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
```

---

## Reflection Codex — Distillation → Synthesis → Mythogenesis

**Stages**

1. *Distillation* (Shard → Codestone): essence, context frame, resonance type, seed markers.
2. *Synthesis* (Codestone → Codecell): emergent pattern, cross‑domain span, generative potential.
3. *Mythogenesis* (Codecell → Symbolic Lineage): archetype name, universal principle, invocation phrases.

**Passes**

- `seed_detector.py` — interrogatives, hedges, novelty spikes → seed markers.
- `thread_closer.py` — open/close flags, momentum trails.
- `archetype_tagger.py` — Bridge, Seed, Phoenix, Weaver, Mirror, Spiral, Threshold.
- `linker.py` — lineage edges (parents/children), constellation formation.

**Cadence**

- Daily: hot→warm reflection, codestone birth.
- Weekly: codecell evolution and pruning.
- Monthly/Seasonal: archetypal recognition and lineage weaving.

---

## Recall Codex — Precision · Intuition · Myth

**Modes**

- Direct Recall: exact fact/codestone with lineage proof.
- Associative Recall: codecell constellation + resonant neighbors.
- Archetypal Recall: symbolic lineage + principle + invocations.

**Scoring**

- Hybrid base: BM25 + vector (cosine) → normalized.
- Resonance: seed continuity, emotional gradient, cadence alignment.
- Personalization: activation trace frequencies, archetype priors, time‑of‑day rhythm.

**API contract**

```json
{
  "priors": {"precision": 0.33, "intuition": 0.44, "myth": 0.23},
  "layers": {
    "codestone": {"id": "cs_...", "essence": "...", "lineage": ["sh_1", "sh_2"]},
    "evidence": [{"id": "sh_1", "snippet": "...", "meta": {"source": "chat"}}],
    "codecell": {"id": "cc_...", "name": "...", "members": [...]},
    "lineage": {"name": "Threshold", "principle": "..."}
  }
}
```

---

## Embeddings & Search

**pgvector (Postgres)**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  shard_id TEXT NOT NULL,
  vec vector(1536),
  meta JSONB
);
CREATE INDEX IF NOT EXISTS embeddings_vec_idx ON embeddings USING ivfflat (vec vector_cosine_ops) WITH (lists = 100);
```

- `VECTOR_BACKEND=pgvector | faiss`.
- `libs/embeddings/backends/pgvector.py` implements `upsert_embeddings()` and `search()`.

**FAISS option**

- IVF/PQ on‑disk index; periodic snapshotting; warm start on API boot.

**Hybrid Retrieval**

- SQL BM25 (tsvector) + vector score weighted mix; resonance + personalization rerank.

---

## Connectors & Ingestion Playbook

**Supported sources (opt‑in)**

- Chat systems: ChatGPT, Claude, Gemini, Olama/local LLM (OpenWebUI/PageAssist), Discord, Slack, WhatsApp (where permitted).
- Docs & repos: Google Drive/Docs, Notion, Confluence, GitHub/GitLab.
- Mail & feeds: Gmail/IMAP, RSS.
- Web bookmarks & DocSites: curated URLs with crawl depth limits.

**Granular selection**

- Full archives, chosen threads, or ranges; per‑thread segment/quote selection; seed markers preserved.

---

## Governance & Security (OPA · SPIFFE · Policies)

- **AuthN**: SPIFFE/SPIRE workload identities for API/workers.
- **AuthZ**: OPA/Rego policy checks (row/field level) on shards and lineage traversals.
- **Privacy**: deterministic tokenization / FPE at ingestion for PII; vault‑managed secrets.
- **Audit**: append‑only activation traces; export to SIEM.
- **Retention**: per‑source TTL; right‑to‑be‑forgotten jobs.

---

## Alembic Migrations

1. `poetry add alembic sqlalchemy psycopg2-binary`
2. `alembic init infra/migrations`
3. `infra/migrations/env.py` — wire `POSTGRES_URL` and `Base.metadata`.
4. `alembic revision -m "core tables"` then define:
   - `shards`, `embeddings`, `activation_traces`, `personal_myth`.
5. `alembic upgrade head`.

---

## Testing Strategy

**Unit**

- Normalizers (ChatGPT/Claude/Gemini): schema conformance, timestamp parsing, ID stability.
- Reflection passes: seed detection, archetype tagging, linker graph integrity.
- Embedding adapters: shape/dim checks, batching, error paths.

**Integration**

- Ingest → Reflect → Embed → Recall via Docker Compose (ephemeral Postgres/Redis).
- Hybrid ranking snapshot tests (golden files).

**E2E**

- `/recall` layered response contract; `/feedback` updates priors & traces.
- UI smoke (React panel): query → render harmonic stack → provide feedback.

**CI**

- Lint (ruff/black), type check (mypy/pyright), pytest matrix (pgvector|faiss), coverage gate, container build, Trivy scan.

---

## UI — React Recall Panel (light/dark, neon ambience)

- Theme toggle, neon gradient ambience, hover elevation.
- Display: codestone essence → evidence list → codecell constellation → lineage card.
- Feedback controls write to `/v1/feedback`; priors chip shows channel mix.

---

## RAMForge & Orchestration

- Default Ray forge (`apps/forge/ray_forge.py`) for parallel explorations.
- Optional swap: Temporal workflows for long‑lived orchestration.
- Queue compatibility: RQ/Celery alternative for simple deployments.

---

## Observability

- Structured logs (JSON), OpenTelemetry traces, Prometheus metrics.
- Dashboards: ingestion throughput, reflection latencies, recall hitrate, feedback loop health.

---

## Roadmap (90‑day)

1. Week 0‑2 — Core ingest + batch embedding + bulk upsert; `/recall` MVP.
2. Week 3‑5 — Reflection passes v1; priors learning; React panel polish.
3. Week 6‑8 — Governance (OPA/SPIFFE) pilot; pgvector/FAISS parity; ranking evals.
4. Week 9‑12 — Temporal orchestration, advanced personalization, multi‑tenant policies.

---

### Deliverable

A production‑ready Mnemos MindWeaver with batched embeddings, hybrid search, reflection & recall codices, governance controls, and a full test/CI posture—ready to weave continuous, sovereign memory across your agentic mindspace.

