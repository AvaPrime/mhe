# Memory Harvester Engine — Scaffold

This is a runnable scaffold matching the approved architecture. It includes:
- SQLAlchemy models mirroring the DDL
- FastAPI app with `/health`, `/config`, and `/ingest/export` (ChatGPT parser)
- Alembic configured (autogenerate ready)
- Docker Compose with Postgres (pgvector)

## Quickstart

```bash
# 1) Start Postgres with pgvector
docker compose up -d db

# 2) Set env (copy and edit)
cp .env.example .env

# 3) Create tables (first-run dev shortcut)
#    For prod, prefer Alembic migrations (see MIGRATIONS.md)
python -m mhe.access.api --init-db

# 4) Run API
uvicorn mhe.access.api:app --reload --port 8000
```

### Ingest a ChatGPT export
Export from ChatGPT (settings → data controls → export) and upload `conversations.json`:

```bash
curl -F "source=chatgpt" -F "file=@/path/to/conversations.json" http://localhost:8000/ingest/export
```

You can also POST JSON directly:
```bash
curl -X POST http://localhost:8000/ingest/export \
  -H "Content-Type: application/json" \
  -d '{"source":"chatgpt","payload":{ "conversations": [] }}'
```

See `/docs` for interactive API.
