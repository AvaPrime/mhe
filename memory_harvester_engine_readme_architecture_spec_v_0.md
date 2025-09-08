# Memory Harvester Engine (MHE)

> **Cognitive–anamnetic system** for capturing multi‑assistant dialogues (ChatGPT, Claude, Gemini), extracting artifacts (code, docs, decisions), and organizing them into a chronologically faithful, semantically searchable memory substrate powering your RAG/agent stack.

---

## 1) System Overview
MHE is a five‑layer pipeline that turns raw chat transcripts into durable, queryable memory:

1. **Capture (Sensory Input):** Collect and normalize exports from assistants into a unified message schema.
2. **Extraction (Cognitive Processor):** Segment sessions, detect artifacts (code, docs, lists), perform thematic tagging, and mint **Memory Cards**.
3. **Memory (Long‑Term Core):** Store chronology & metadata in Postgres (incl. `pgvector` for embeddings). Optional blob store for large artifacts.
4. **Access (Recall Interface):** A FastAPI service offering hybrid search (keyword + vector), thread browsing, artifact retrieval, and RAG endpoints.
5. **Feedback & Consolidation (Dream State):** Periodic summarization, deduplication, principle distillation, and changelog of knowledge evolution.

**Design goals:** determinism at the edges (ingest, schema, IDs), probabilistic enrichment in the middle (LLM tagging/summarization), and observable outputs (artifacts, cards, decisions).

---

## 2) Data Flow Diagram
```mermaid
flowchart TD
    A[Assistant Exports\n(ChatGPT/Claude/Gemini JSON)] --> B[Capture\nnormalizer]
    B --> C[Raw Store\n(messages, threads)]
    C --> D[Extraction\nsessionizer + detectors]
    D --> E[Memory Cards\n(JSON docs)]
    E --> F[Embeddings\n(pgvector)]
    E --> G[Artifacts\n(code/docs/lists)]
    C -->|metadata| H[Postgres\nchronology + links]
    F --> H
    G --> H
    H --> I[Access API\nFastAPI]
    I --> J[(RAG Clients/Agents)]
    H --> K[Consolidator\n(dedup/summarize)]
    K --> H
```

---

## 3) Data Models

### 3.1 Postgres Schema (DDL)
Assumes Postgres ≥ 15 with `pgvector` extension. Namespaces under `mhe`.

```sql
CREATE SCHEMA IF NOT EXISTS mhe;
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive text

-- Assistants / sources (optional lookup)
CREATE TABLE IF NOT EXISTS mhe.assistant (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         CITEXT NOT NULL,                 -- e.g., chatgpt, claude, gemini
  version      TEXT,
  UNIQUE (name, version)
);

-- A conversation thread (platform’s notion)
CREATE TABLE IF NOT EXISTS mhe.thread (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT,                            -- platform thread id
  assistant_id UUID REFERENCES mhe.assistant(id) ON DELETE SET NULL,
  title        TEXT,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  raw_meta     JSONB DEFAULT '{}'::jsonb
);

-- Individual message within a thread
CREATE TABLE IF NOT EXISTS mhe.message (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    UUID NOT NULL REFERENCES mhe.thread(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  author       TEXT,                            -- display name if available
  content      TEXT NOT NULL,                   -- raw text
  content_md   TEXT,                            -- optional markdown rendering
  created_at   TIMESTAMPTZ NOT NULL,
  tokens       INT,
  raw_meta     JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_message_thread_time ON mhe.message(thread_id, created_at);

-- Extracted artifacts (code blocks, docs, lists)
CREATE TABLE IF NOT EXISTS mhe.artifact (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID NOT NULL REFERENCES mhe.message(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('code','doc','list','diagram','other')),
  language      TEXT,                            -- e.g., python, ts, sql, mermaid
  mime_type     TEXT,                            -- text/markdown, text/x-python
  content       TEXT NOT NULL,
  sha256        TEXT NOT NULL,                   -- dedup key
  line_start    INT,
  line_end      INT,
  extracted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_artifact_sha ON mhe.artifact(sha256);
CREATE INDEX IF NOT EXISTS idx_artifact_message ON mhe.artifact(message_id);

-- Memory Card: structured summary unit anchored to messages/artifacts
CREATE TABLE IF NOT EXISTS mhe.memory_card (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID REFERENCES mhe.thread(id) ON DELETE SET NULL,
  summary       TEXT NOT NULL,                  -- concise description
  rationale     TEXT,                            -- optional, why it matters
  created_from  JSONB NOT NULL,                  -- pointers to message/artifact IDs
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memory_card_thread ON mhe.memory_card(thread_id);
CREATE INDEX IF NOT EXISTS idx_memory_card_tags ON mhe.memory_card USING GIN (tags);

-- Embeddings linked to either a message, artifact, or memory card
CREATE TYPE mhe.embed_target AS ENUM ('message','artifact','memory_card');

CREATE TABLE IF NOT EXISTS mhe.embedding (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind   mhe.embed_target NOT NULL,
  target_id     UUID NOT NULL,
  model         TEXT NOT NULL,                  -- e.g., text-embedding-3-large
  dim           INT NOT NULL,
  vector        VECTOR NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_kind, target_id, model)
);
-- Helpful composite index for ANN search via ivfflat (built after data load)
-- CREATE INDEX idx_embedding_ann ON mhe.embedding USING ivfflat (vector vector_l2_ops) WITH (lists = 100);

-- Free-form tags (message-level). Use ARRAY or many-to-many; here many-to-many.
CREATE TABLE IF NOT EXISTS mhe.tag (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  CITEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS mhe.message_tag (
  message_id UUID REFERENCES mhe.message(id) ON DELETE CASCADE,
  tag_id     UUID REFERENCES mhe.tag(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, tag_id)
);

-- Consolidations (periodic dream-state outputs)
CREATE TABLE IF NOT EXISTS mhe.consolidation (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start TIMESTAMPTZ NOT NULL,
  window_end   TIMESTAMPTZ NOT NULL,
  report_md    TEXT NOT NULL,                    -- human-readable summary
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Notes**
- Keep artifacts deduplicated via `sha256` to reduce storage and cross‑link identical code across threads.
- Embeddings table is polymorphic via `target_kind`; enforce referential integrity in application layer.
- Prefer `citext` for human labels to avoid case headaches.

---

### 3.2 Memory Card JSON Schema (Draft 2020‑12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://codessian.dev/mhe/memory-card.schema.json",
  "title": "MemoryCard",
  "type": "object",
  "required": ["id", "summary", "created_from", "timestamps"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "summary": { "type": "string", "minLength": 1 },
    "rationale": { "type": "string" },
    "topics": { "type": "array", "items": { "type": "string" } },
    "tags": { "type": "array", "items": { "type": "string" } },
    "importance": { "type": "string", "enum": ["low", "medium", "high", "critical"] },
    "created_from": {
      "type": "object",
      "required": ["messages"],
      "properties": {
        "messages": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "role"],
            "properties": {
              "id": { "type": "string", "format": "uuid" },
              "role": { "type": "string", "enum": ["user", "assistant", "system"] },
              "assistant": { "type": "string" },
              "thread_id": { "type": "string", "format": "uuid" }
            }
          }
        },
        "artifacts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "kind"],
            "properties": {
              "id": { "type": "string", "format": "uuid" },
              "kind": { "type": "string", "enum": ["code", "doc", "list", "diagram", "other"] },
              "language": { "type": "string" }
            }
          }
        }
      }
    },
    "timestamps": {
      "type": "object",
      "required": ["created_at"],
      "properties": {
        "created_at": { "type": "string", "format": "date-time" },
        "first_source_at": { "type": "string", "format": "date-time" },
        "last_source_at": { "type": "string", "format": "date-time" }
      }
    },
    "links": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["kind", "ref"],
        "properties": {
          "kind": { "type": "string", "enum": ["thread", "message", "artifact", "external"] },
          "ref": { "type": "string" },
          "title": { "type": "string" }
        }
      }
    }
  }
}
```

**Semantics**
- **`summary`** is the atomic recall hook; keep it < 280 chars when possible.
- **`topics`** are stable conceptual anchors (e.g., `distributed-systems/trust`).
- **`importance`** drives retention & surfacing in UIs.

---

## 4) API Specification (Access Layer)
FastAPI service offering deterministic, composable endpoints.

### 4.1 Health & Metadata
- `GET /health` → `{ status: "ok", ts }`
- `GET /config` → returns model names, embed dims, limits.

### 4.2 Ingest
- `POST /ingest/export`
  - **Body:** `{ source: "chatgpt|claude|gemini", payload: <export_json>, opts?: { dry_run?: bool } }`
  - **Behavior:** Parses, normalizes to threads/messages; returns counts and thread IDs.

### 4.3 Query (Hybrid Search)
- `POST /search`
  - **Body:** `{ q: "text", kind?: "message|artifact|memory_card|any", time?: { from?: iso, to?: iso }, tags?: ["..."], k?: 20 }`
  - **Returns:** ranked union of lexical (tsvector) and vector ANN across targets with explain scores.

- `POST /rag/query`
  - **Body:** `{ query: "...", k?: 8, target?: "auto|message|artifact|memory_card", with_chunks?: true }`
  - **Returns:** `{ contexts: [...], citations: [...], prompt: "synthesized system prompt" }`

### 4.4 Threads & Messages
- `GET /threads` (filters: `assistant`, `from`, `to`)
- `GET /threads/{id}` → thread metadata + message list
- `GET /messages/{id}` → full message + artifacts + tags

### 4.5 Artifacts & Memory Cards
- `GET /artifacts/{id}` → code/doc content + source pointers
- `GET /memory-cards` (filters: `topics`, `tags`, `from`, `to`)
- `GET /memory-cards/{id}`
- `POST /memory-cards` → create/update (admin only)

### 4.6 Consolidation
- `POST /consolidations/run` → kicks off summarization window job (admin)
- `GET /consolidations/{id}` → rendered report

**Notes**
- All `GET` endpoints must be **idempotent** and cache‑friendly.
- Provide `?format=md|json` for artifact/card bodies.
- Emit deterministic `stable_id` for deduped exports.

---

## 5) Directory Structure (Python Monorepo Slice)

```
memory-harvester-engine/
├─ README.md
├─ docker-compose.yml
├─ .env.example
├─ alembic/
│  ├─ env.py
│  └─ versions/
├─ pyproject.toml
├─ src/
│  └─ mhe/
│     ├─ __init__.py
│     ├─ common/
│     │  ├─ config.py              # pydantic settings
│     │  ├─ logging.py
│     │  └─ ids.py                 # stable hashing, ULIDs
│     ├─ capture/
│     │  ├─ parsers/
│     │  │  ├─ chatgpt.py
│     │  │  ├─ claude.py
│     │  │  └─ gemini.py
│     │  └─ normalizer.py          # unified schema
│     ├─ extract/
│     │  ├─ sessionizer.py         # thread segmentation
│     │  ├─ detectors.py           # code/doc/list/diagram
│     │  ├─ tagger.py              # topics/tags via LLM + rules
│     │  └─ cards.py               # MemoryCard minting
│     ├─ memory/
│     │  ├─ db.py                  # SQLAlchemy / asyncpg
│     │  ├─ models.py              # ORM models
│     │  ├─ embeddings.py          # pgvector ops
│     │  ├─ search.py              # lexical + vector fusion
│     │  └─ store.py               # artifact blob store (optional)
│     ├─ access/
│     │  ├─ api.py                 # FastAPI app
│     │  ├─ routers/
│     │  │  ├─ ingest.py
│     │  │  ├─ query.py
│     │  │  ├─ threads.py
│     │  │  ├─ artifacts.py
│     │  │  └─ cards.py
│     │  └─ schemas.py             # pydantic models
│     └─ consolidate/
│        ├─ jobs.py                # periodic summarization
│        └─ heuristics.py          # dedup & principle distillation
├─ tests/
│  ├─ unit/
│  └─ integration/
└─ ops/
   ├─ docker/
   │  ├─ api.Dockerfile
   │  └─ worker.Dockerfile
   └─ k8s/
      ├─ deployment.yaml
      └─ secrets.example.yaml
```

---

## 6) Implementation Notes & Defaults
- **Embeddings:** start with `text-embedding-3-large` (3072‑D) or local alternative; store in `mhe.embedding` as `VECTOR(3072)`.
- **Lexical Search:** use `tsvector` columns via generated columns on `message.content` and `artifact.content` for BM25‑style ranking; fuse scores with vector ANN via weighted sum.
- **Detectors:** deterministic regex for fenced code (```lang ...```), heuristic for lists, mermaid/plantuml detection, and LLM fallback for malformed fences.
- **IDs:** stable IDs for exports via SHA‑256 of `(platform, thread_external_id, message_index, timestamp, content_hash)` to avoid duplicates.
- **Privacy:** redaction hooks during ingest (emails, API keys) with reversible vault mapping if needed.
- **Observability:** emit counters (ingested messages, artifacts, cards minted), latency histograms, ANN recall metrics.

---

## 7) Minimal `docker-compose.yml` (excerpt)
```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: mhe
      POSTGRES_USER: mhe
      POSTGRES_PASSWORD: mhe
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "mhe"]
  api:
    build: ./ops/docker
    env_file: .env
    depends_on: [db]
    ports: ["8000:8000"]
```

---

## 8) Test Queries (examples)
- *Chronology:* “All Claude messages about Router Service between 2025‑08‑01 and 2025‑09‑01.”
- *Semantic:* “Show me snippets related to ‘trust is computed’ and ‘distributed reputation’.”
- *RAG:* `POST /rag/query { query: "Design a consolidation job for weekly summaries" }`

---

## 9) Roadmap
- Add UI (Next.js) with **Chrono View** (timeline) and **Concept View** (topic graph).
- Add **Provenance Chips** to every retrieval context.
- Streaming ingest via webhook bridges (when vendors expose them) in addition to exports.
- Optional S3/OCI blob store for large artifacts and audio.

---

**End of spec v0.1** — ready for implementation scaffolding (SQLAlchemy models, FastAPI routers, and first parser).

