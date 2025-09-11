# Mnemos MindWeaver — Advanced Memory & Recall System (v3.0)

*Continuous, sovereign memory for agentic co‑consciousness: ingestion → reflection → recall → feedback → governance.*

---

## Quickstart

```bash
# 1) Clone + env
cp .env.example .env   # fill POSTGRES_URL, VECTOR_BACKEND, OPENAI_API_KEY

# 2) Local stack
docker compose -f infra/docker/docker-compose.yml up -d --build
alembic upgrade head

# 3) Seed + smoke
python scripts/cli.py ingest_chatgpt ./data/exports/chatgpt.json
curl 'http://localhost:8000/recall' -X POST -H 'Content-Type: application/json' \
  -d '{"text":"Remind me of the Threshold insight about refactors"}'
```

---

## System Architecture

```
            ┌────────────────────────────────────────────────────────────┐
            │                         UI (React)                         │
            │  Harmonic stack: Codestone • Evidence • Codecell • Lineage │
            └──────────────▲───────────────────────┬─────────────────────┘
                           │                       │
                      /v1/recall              /v1/feedback
                           │                       │
        ┌──────────────────┴───────────────────────▼───────────────────┐
        │                         API (FastAPI)                        │
        │ Recall Service • Resonance/Personalization • Policy Guard    │
        └───────▲─────────────┬──────────────▲──────────────┬─────────┘
                │             │              │              │
          Hybrid Search   Reflection Orchs   Embeddings     Governance
                │             │              │              │
        ┌───────▼───────┐ ┌──▼───────────┐ ┌─▼──────────┐ ┌─▼────────┐
        │ Retriever     │ │ Workers      │ │ Backends   │ │ OPA/Spire│
        │ (BM25+Vector) │ │ (Ray/Temporal)││ (pgvector/ │ │ Policies │
        └───────▲───────┘ └──▲───────────┘ │  FAISS)    │ └─▲────────┘
                │             │             └────▲───────┘   │
                │             │                  │           │
        ┌───────┴─────────────┴──────────────┐   │    SPIFFE/SVID
        │                DB                   │◄──┘  + mTLS
        │ Shards • Embeddings • Lineage Graph │
        │ Activation Traces • Personal Myth    │
        └──────────────────────────────────────┘
```

---

## Data Model (Pydantic → SQL)

**Shard** — smallest unit of meaning.
```python
class Shard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str            # chatgpt | claude | gemini | github | drive | ...
    kind: str              # message | code | doc | note | commit | ...
    conversation_id: Optional[str] = None
    actor: Optional[str] = None  # user | assistant | system | author
    timestamp: Optional[datetime] = None
    text: Optional[str] = None
    metadata: Dict = {}
    provenance: Dict = {}
    parents: Optional[List[str]] = []
    children: Optional[List[str]] = []
```

**ActivationTrace** — how memory was surfaced and used.
```sql
CREATE TABLE activation_traces (
  id             text PRIMARY KEY,
  user_id        text NOT NULL,
  event_id       text NOT NULL,
  surfaced       jsonb NOT NULL DEFAULT '{}'::jsonb,
  chosen_ids     jsonb,
  dwell_ms       integer,
  spawned_artifacts jsonb,
  feedback       jsonb,
  outcome        text NOT NULL DEFAULT 'partial',
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

**PersonalMyth** — personalization state.
```sql
CREATE TABLE personal_myth (
  user_id           text PRIMARY KEY,
  archetype_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  metaphor_map      jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence_profile   jsonb NOT NULL DEFAULT '{}'::jsonb,
  seed_forms        jsonb NOT NULL DEFAULT '[]'::jsonb,
  rerank_bias       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

---

## API — Contracts & Errors

### `POST /ingest`
Request:
```json
{ "source": "chatgpt", "shards": [ {"id":"...","text":"...", "kind": "message", "timestamp": "2025-08-20T09:00:00Z"} ] }
```
Response:
```json
{ "ingested": 42 }
```
Errors: `400` invalid schema, `413` too large, `409` duplicate IDs (non‑upsert backends).

### `POST /reflect/run`
Request:
```json
{ "window": "daily" }
```
Response: `202 Accepted` + job id.

### `POST /recall`
Request:
```json
{ "text": "Where did we define Threshold refactor?", "user_id":"phoenix", "k": 12 }
```
Response:
```json
{
  "priors": {"precision":0.31,"intuition":0.49,"myth":0.20},
  "layers": {
    "codestone": {"id":"cs_9f...","essence":"...","lineage":["sh_a","sh_b"]},
    "evidence": [{"id":"sh_a","snippet":"...","score":0.81}],
    "codecell": {"id":"cc_18...","name":"Refactor-as-Threshold","members":["cs_9f..."]},
    "lineage": {"name":"Threshold","principle":"Pause, then cross with clarity."}
  }
}
```
Errors: `422` bad input, `429` rate limited, `403` policy denied.

### `POST /feedback`
Request:
```json
{ "user_id":"phoenix", "event_id":"evt_123", "surfaced": {"shards":["sh_a","sh_b"]},
  "feedback": {"rating": 1, "notes":"Perfect."}, "outcome":"success" }
```
Response: `204 No Content`.

**Error model**
```json
{ "error": { "code":"POLICY_DENIED", "message":"Shard restricted", "policy_id":"opa:shard_row_level" } }
```

---

## Retrieval & Ranking (Hybrid + Resonance + Personalization)

1. **Candidate generation**
   - BM25: `tsvector` over `tsv` column → top `N_bm25`.
   - Vector: cosine over `embedding` (pgvector/FAISS) → top `N_vec`.
2. **Blend**
   - Normalize to `[0,1]`, then `score_hybrid = α·score_vec + β·score_bm25`.
   - Recency boost: `+ γ·exp(-Δt/τ)`; policy mask removes restricted shards.
3. **Resonance re‑rank**
   - Seed continuity (overlap with active seeds), emotional gradient, cadence alignment.
4. **Personalization**
   - EWMA on archetype priors, time‑of‑day bias, activation frequency.
5. **Layering**
   - Condense evidence → Codestone; cluster → Codecell; infer archetype → Lineage.

Default weights: `α=0.6, β=0.4, γ=0.15, τ=14 days`.

---

## Embeddings — Backends & Batching

- **Batching**: gather `texts` → one call → map by index. Size: 256/512 tokens per text; batch = 64‑128 items.
- **Caching**: content‑hash keyed; warm cache on startup for hottest shards.
- **Backends**:
  - pgvector: `vector(1536)`, `ivfflat` index; `lists=100` (tune by corpus size).
  - FAISS: `IVF100,PQ64` (CPU) with periodic snapshot; GPU index optional (FlatIP / IVF‑PQ).
- **Normalization**: L2 normalize vectors on write & query.

---

## Reflection Pipeline (Temporal/Ray/RQ)

- **Passes**: `seed_detector → summarizer → codestone_extractor → archetype_tagger → linker`.
- **Cadence**: daily (hot→warm), weekly (codecell), monthly/seasonal (lineage).
- **Idempotency**: pass key = `(shard_id, pass_name, version)`; upserts only on change.
- **Backpressure**: rate limit per source; DLQ for poison shards.

---

## Personalization Math (sketch)

- **Archetype prior**: `w_t = (1-λ)·w_{t-1} + λ·r_t` where `r_t ∈ [0,1]` from feedback.
- **Cadence phase**: circular mean of activation hours → daypart bias.
- **Seed continuity**: Jaccard over active seed set vs. shard seed markers.

---

## Governance & Security

### OPA (Rego) — row/field level
```rego
package mnemos.shards

default allow = false
allow {
  input.user.role == "owner"
}
allow {
  input.user.role == "reader"
  not input.row.metadata.sensitive
}
redact[field] {
  input.row.metadata.pii[field]
}
```
**Enforcement points**: `/recall` (candidate mask), `/ingest` (reject/mark), `/export` (redact).

### SPIFFE/SPIRE
- Issue SVIDs for API + Workers; enforce mTLS between services; bind JWT‑SVID to request context for OPA.

### Privacy & Safety
- Deterministic tokenization/FPE of PII at ingestion; reversible vault mapping.
- Prompt‑injection & data‑poisoning guards: source trust scores; quarantine on anomaly.
- Rate limiting, quotas, per‑tenant resource caps.

---

## Observability

- **Tracing**: OpenTelemetry spans for `/ingest`, `/reflect`, `/recall`, `/feedback`.
- **Metrics**: `ingest_throughput`, `embed_latency_ms`, `hybrid_latency_ms`, `rank_hitrate@k`, `feedback_ctr`.
- **Logs**: JSON, PII‑redacted fields with hash placeholders.
- **Dashboards**: latency heatmaps, recall hitrate, policy denials, cache hit ratio.

PromQL examples:
```promql
histogram_quantile(0.95, sum(rate(hybrid_latency_ms_bucket[5m])) by (le))
sum(rate(ingest_records_total[1m]))
sum(rate(policy_denied_total[5m])) by (policy_id)
```

---

## Testing & QA

- **Unit**: schema validation, normalizers, reflection passes, embedding adapters.
- **Property‑based**: idempotent reflection, stable hashing.
- **Integration**: end‑to‑end ingest→recall with golden ranking snapshots.
- **Load**: k6/Locust scripts for recall RPS curves; saturation study.
- **Chaos**: kill worker pods; verify DLQ + replay.

---

## CI/CD (GitHub Actions sketch)

```yaml
name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: codex
          POSTGRES_PASSWORD: codex
          POSTGRES_DB: codex
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: alembic upgrade head
      - run: pytest -q
  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t mnemos-api -f infra/docker/Dockerfile.api .
      - run: docker build -t mnemos-worker -f infra/docker/Dockerfile.worker .
```

---

## Deployment (Kubernetes sketch)

- **API**: `Deployment` (3 replicas), `Service` (ClusterIP), `Ingress` (TLS), HPA (CPU+RPS).
- **Worker**: `Deployment` with queue; PDB to keep ≥1.
- **DB**: managed Postgres (pgvector enabled); read replica for analytics.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: mnemos-api }
spec:
  minReplicas: 3
  maxReplicas: 12
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: mnemos-api }
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

---

## Performance & SLOs (initial)

- **Ingest throughput**: ≥ 500 shards/s (batched embeddings, bulk upsert).
- **Recall p95 latency**: ≤ 250 ms (cached) / ≤ 600 ms (cold).
- **Index freshness**: ≤ 60 s from ingest to recallable.
- **Durability**: RPO ≤ 5 min, RTO ≤ 15 min.

Tuning knobs: batch size, ivfflat lists, ts_rank weighting, cache TTL, rerank feature caps.

---

## Cost Controls

- Embedding cache hit ≥ 70%; batch ≥ 64; adaptive backoff on provider 429.
- Vector index compaction nightly; cold storage for old shards; tiered retention by source.

---

## Data Lifecycle

- **Retention**: per‑source TTL; exceptions for canonical knowledge.
- **Right‑to‑be‑forgotten**: tombstone graph edges; cascade delete embeddings; rebuild affected codecells.
- **Export**: per‑tenant ZIP (JSONL + policy manifest); signed URL.
- **Backups**: PITR; weekly full + daily incremental.

---

## Roadmap (90‑day + stretch)

- 0–2 w: Finish hybrid retriever v1, ranking eval harness, UI polish.
- 3–6 w: Reflection passes v1, policy enforcement hooks, seed continuity model.
- 7–10 w: Temporal orchestration, FAISS GPU path, red‑team prompts & poisoning defense.
- 11–13 w: Multi‑tenant isolation, billing meters, admin console.
- Stretch: cross‑user consensual mesh (opt‑in), federated recall, offline packs.

---

### Appendix

**Env matrix**
```
POSTGRES_URL=postgresql://codex:codex@db:5432/codex
VECTOR_BACKEND=pgvector|faiss
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=...  # optional; fallback to hash embedder
OPA_URL=http://opa:8181/v1/data
SPIFFE_TRUST_DOMAIN=mnemos.local
```

**Common errors**
- `POLICY_DENIED`: OPA block; inspect `policy_id`.
- `BACKEND_UNAVAILABLE`: vector engine down; use BM25‑only degraded mode.
- `RANK_EMPTY`: no candidates after policy mask; broaden query or lower constraints.

