from __future__ import annotations
import argparse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mhe.common.config import settings
from mhe.access.routers import ingest, artifacts, cards

app = FastAPI(title="Memory Harvester Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/config")
async def config():
    return {"embed_model": settings.embed_model, "embed_dim": settings.embed_dim}

app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--init-db", action="store_true", help="Create schema and tables (dev only)")
    args = parser.parse_args()
    if args.init_db:
        import asyncio
        from mhe.memory.db import init_db
        asyncio.run(init_db())
        print("DB initialized.")

app.include_router(artifacts.router, prefix="/artifacts", tags=["artifacts"])
app.include_router(cards.router, prefix="/memory-cards", tags=["memory-cards"])