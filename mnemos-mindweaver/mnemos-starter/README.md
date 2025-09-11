
# Mnemos Memory System — Starter Repo Skeleton

A minimal, production-leaning scaffold that maps Ava’s memory concepts into the Mnemos architecture:
Temporal (workflows), Ray (heavy tasks), FastAPI (Recall API), Postgres+pgvector (memory store), NATS (events),
and OPA (policy).

## Quick start (dev)
```bash
cp .env.example .env
docker compose up -d postgres nats temporal temporal-ui ray-head
# Build and launch app & worker
docker compose up --build api worker
# Check API
curl http://localhost:8000/health
curl "http://localhost:8000/v1/recall/search?q=hello&limit=5"
```
Open Temporal UI: http://localhost:8080  | Ray Dashboard: http://localhost:8265

## Services
- **API (FastAPI)** — `/v1/recall`, `/v1/reflect` and admin utilities.
- **Worker** — Temporal workflows & Ray tasks: `wf_ingest_raw`, `wf_reflect_and_index`.
- **Postgres (pgvector)** — Durable memory store.
- **NATS** — Event bus.
- **Temporal + UI** — Orchestration & visibility.
- **OPA** — Policy checks (sample policy included).

> This is a walking skeleton intended for local dev. Production hardening (K8s, Linkerd mTLS, SPIFFE) is left to your platform.
