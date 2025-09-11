
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .db import Base, engine, SessionLocal
from .schemas import SearchQuery, SearchResult
from .search import search_memory

app = FastAPI(title="Mnemos Recall API")

# Create tables on first run (dev only).
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/v1/recall/search", response_model=list[SearchResult])
def recall_search(q: str, kinds: str | None = None, strength: str | None = None, limit: int = 20, db: Session = Depends(get_db)):
    kinds_list = kinds.split(",") if kinds else None
    strength_list = strength.split(",") if strength else None
    results = search_memory(db, q=q, kinds=kinds_list, strength=strength_list, limit=limit)
    return [SearchResult(**r) for r in results]

class ReflectRequest(BaseModel):
    interaction_id: int | None = None
    text: str | None = None

@app.post("/v1/reflect")
def reflect(req: ReflectRequest):
    # TODO: trigger Temporal workflow wf_reflect_and_index
    return {"accepted": True, "note": "Temporal trigger is stubbed in the starter."}
