Below are **drop‑in files** you can paste into your latest Mnemos repo. Paths are relative to the repo root. If a file already exists, replace it with the version here. After copying, rebuild the relevant services.

---

## 0) Compose delta (add Grafana/Prometheus/Pushgateway if you don’t have them yet)
**Append** this under `services:` in your existing `docker-compose.yml`:
```yaml
  pushgateway:
    image: prom/pushgateway:latest
    ports: ["9091:9091"]

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports: ["9090:9090"]
    depends_on: [pushgateway]

  grafana:
    image: grafana/grafana:10.4.5
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports: ["3000:3000"]
    volumes:
      - ./infra/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./infra/grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on: [prometheus]
```

---

## 1) `infra/postgres/init.sql`
```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Full‑text search index
CREATE INDEX IF NOT EXISTS idx_memory_items_fts
ON memory_items USING GIN (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body_md,''))
);

-- Prefer HNSW; fallback to ivfflat when HNSW isn’t available
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_embeddings_vec_hnsw
           ON embeddings USING hnsw (vec vector_cosine_ops)
           WITH (m=16, ef_construction=64)';
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_embeddings_vec
             ON embeddings USING ivfflat (vec vector_cosine_ops)
             WITH (lists=100)';
    RAISE NOTICE 'HNSW not available; ivfflat created.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No ANN index created.';
  END;
END$$;
```

---

## 2) `infra/prometheus/prometheus.yml`
```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'api'
    static_configs: [{ targets: ['api:8000'] }]
  - job_name: 'pushgateway'
    static_configs: [{ targets: ['pushgateway:9091'] }]
```

---

## 3) Grafana provisioning files
### `infra/grafana/provisioning/datasources/datasource.yml`
```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    jsonData: { httpMethod: POST }
```

### `infra/grafana/provisioning/dashboards/dashboards.yml`
```yaml
apiVersion: 1
providers:
  - name: 'Mnemos Dashboards'
    orgId: 1
    folder: 'Mnemos'
    type: file
    disableDeletion: false
    options:
      path: /var/lib/grafana/dashboards
```

### `infra/grafana/dashboards/mnemos-overview.json`
```json
{
  "title": "Mnemos — Overview",
  "schemaVersion": 38,
  "version": 1,
  "refresh": "10s",
  "panels": [
    { "type": "stat", "title": "Reflections (total)", "gridPos": {"x":0,"y":0,"w":6,"h":4}, "targets": [{"expr":"sum(mnemos_reflections_total)"}] },
    { "type": "stat", "title": "Embeddings (total)", "gridPos": {"x":6,"y":0,"w":6,"h":4}, "targets": [{"expr":"sum(mnemos_embeddings_total)"}] },
    { "type": "timeseries", "title": "Reflections rate (5m)", "gridPos": {"x":0,"y":4,"w":12,"h":8}, "targets": [{"expr":"sum(increase(mnemos_reflections_total[5m]))"}] },
    { "type": "timeseries", "title": "Embeddings rate (5m)", "gridPos": {"x":0,"y":12,"w":12,"h":8}, "targets": [{"expr":"sum(increase(mnemos_embeddings_total[5m]))"}] }
  ]
}
```

---

## 4) `services/api/app/search_federated.py`
```python
from __future__ import annotations
from typing import List, Dict
import asyncio, httpx
from .settings import settings
from .search import hybrid_search_with_rerank

def _normalize_scores(items: List[Dict]) -> List[Dict]:
    if not items: return items
    scores = [float(i.get("score", 0.0)) for i in items]
    lo, hi = min(scores), max(scores)
    rng = (hi - lo) or 1.0
    for i in items:
        i["score"] = (float(i.get("score", 0.0)) - lo) / rng
    return items

async def _fetch_peer(client: httpx.AsyncClient, base: str, q: str, kinds: str | None, strength: str | None, limit: int) -> List[Dict]:
    try:
        r = await client.get(f"{base}/v1/recall/search", params={"q": q, "kinds": kinds, "strength": strength, "limit": limit}, timeout=5.0)
        r.raise_for_status()
        out = r.json()
        for o in out: o["source"] = base
        return out
    except Exception:
        return []

async def federated_query(db_session, q: str, kinds: list[str] | None, strength: list[str] | None, limit: int = 20) -> List[Dict]:
    local = hybrid_search_with_rerank(db_session, q=q, kinds=kinds, strength=strength, limit=limit)
    for o in local: o["source"] = "local"
    peers = [p.strip() for p in (settings.federation_peers or "").split(",") if p.strip()]
    remote: List[Dict] = []
    if peers:
        async with httpx.AsyncClient() as client:
            rs = await asyncio.gather(*[
                _fetch_peer(client, p, q,
                            ",".join(kinds) if kinds else None,
                            ",".join(strength) if strength else None,
                            limit)
                for p in peers
            ], return_exceptions=False)
            for r in rs: remote.extend(r)
    local = _normalize_scores(local); remote = _normalize_scores(remote)
    merged = sorted(local + remote, key=lambda x: x.get("score", 0.0), reverse=True)
    seen, uniq = set(), []
    for m in merged:
        key = f"{m.get('source')}::{m.get('id')}"
        if key in seen: continue
        seen.add(key); uniq.append(m)
        if len(uniq) >= limit: break
    return uniq
```

---

## 5) `services/api/app/main.py` (drop‑in replacement)
```python
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy.orm import Session
from sqlalchemy import select
from temporalio.client import Client as TemporalClient
from pydantic import BaseModel

from .db import Base, engine, SessionLocal
from .settings import settings
from .schemas import SearchResult
from .search import hybrid_search_with_rerank
from .search_federated import federated_query
from .policy import check_policy
from .models import MemoryItem, Reflection, Edge

app = FastAPI(title="Mnemos Recall API")
Base.metadata.create_all(bind=engine)

temporal_client: TemporalClient | None = None

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@app.on_event("startup")
async def startup() -> None:
    global temporal_client
    temporal_client = await TemporalClient.connect(settings.temporal_host, namespace=settings.temporal_namespace)

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/metrics")
def metrics(): return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/ui/graph")
def ui_graph():
    html = open("/app/app/ui_graph.html", "r", encoding="utf-8").read()
    return HTMLResponse(html)

@app.get("/v1/recall/search", response_model=list[SearchResult])
def recall_search(q: str, kinds: str | None = None, strength: str | None = None, limit: int = 20, db: Session = Depends(get_db)):
    kinds_list = kinds.split(",") if kinds else None
    strength_list = strength.split(",") if strength else None
    results = hybrid_search_with_rerank(db, q=q, kinds=kinds_list, strength=strength_list, limit=limit)
    return [SearchResult(**r) for r in results]

@app.get("/v1/recall/federated", response_model=list[SearchResult])
async def recall_federated(q: str, kinds: str | None = Query(default=None), strength: str | None = Query(default=None), limit: int = 20, db: Session = Depends(get_db)):
    kinds_list = kinds.split(",") if kinds else None
    strength_list = strength.split(",") if strength else None
    results = await federated_query(db, q=q, kinds=kinds_list, strength=strength_list, limit=limit)
    return [SearchResult(id=r['id'], kind=r['kind'], title=r['title'], score=float(r.get('score') or 0.0), snippet=r.get('snippet')) for r in results]

class ReflectRequest(BaseModel):
    interaction_id: int | None = None
    text: str | None = None
    policies: list[str] | None = None
    sinks: list[str] | None = None

class ReflectResponse(BaseModel):
    workflow_id: str
    run_id: str

@app.post("/v1/reflect", response_model=ReflectResponse)
async def reflect(req: ReflectRequest):
    assert temporal_client is not None, "Temporal client not initialized"
    payload = {"interaction_id": req.interaction_id, "text": req.text, "policies": req.policies or ["default"], "sinks": req.sinks or []}
    wf = await temporal_client.start_workflow(
        "ReflectAndIndexWorkflow",
        payload,
        id=f"reflect-{hash(str(payload))%10**10}",
        task_queue=settings.temporal_task_queue,
    )
    return ReflectResponse(workflow_id=wf.id, run_id=wf.run_id)

@app.get("/v1/memory/{item_id}/stack")
def get_harmonic_stack(item_id: int, db: Session = Depends(get_db)):
    item = db.get(MemoryItem, item_id)
    if not item: raise HTTPException(404, "memory item not found")
    edges = db.execute(select(Edge).where((Edge.src_id == item.id) | (Edge.dst_id == item.id))).scalars().all()
    refl = db.execute(select(Reflection).where(Reflection.source_item_id == item.id).order_by(Reflection.created_ts.desc()).limit(1)).scalars().first()
    return {
        "codestone": {"id": item.id, "title": item.title, "kind": item.kind.value, "strength": item.strength.value},
        "reflection": {"id": getattr(refl, "id", None), "summary": getattr(refl, "summary_md", None), "insights": getattr(refl, "insights_md", None)},
        "edges": [{"id": e.id, "src_id": e.src_id, "dst_id": e.dst_id, "rel": e.rel} for e in edges],
    }

class StrengthUpdate(BaseModel):
    strength: str

@app.patch("/v1/memory/{item_id}/strength")
def set_strength(item_id: int, body: StrengthUpdate, db: Session = Depends(get_db)):
    if not check_policy("memory.set_strength", {"id": item_id, "strength": body.strength}, {"id":"phoenix","roles":["admin"]}):
        raise HTTPException(403, "policy denied")
    item = db.get(MemoryItem, item_id)
    if not item: raise HTTPException(404, "memory item not found")
    from .models import Strength as S
    try: item.strength = S(body.strength)
    except Exception: raise HTTPException(400, "invalid strength")
    db.add(item); db.commit()
    return {"ok": True, "id": item.id, "strength": item.strength.value}
```

---

## 6) `services/api/app/ui_graph.html`
```html
<!doctype html><html><head><meta charset="utf-8"/><title>Mnemos Graph</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#0b0f14;color:#e6edf3}header{padding:12px 16px;border-bottom:1px solid #1f2937}#graph{width:100vw;height:calc(100vh - 56px)}.node circle{stroke:#94a3b8;stroke-width:1.5px;fill:#111827}.node text{fill:#e6edf3;font-size:12px;pointer-events:none}line.link{stroke:#334155;stroke-opacity:.8;stroke-width:1.2px}</style></head>
<body><header><strong>Mnemos Harmonic Stack</strong><span id="title" style="opacity:.7;margin-left:8px;"></span></header>
<svg id="graph"></svg><script src="https://cdn.jsdelivr.net/npm/d3@7"></script><script>
(async function(){const p=new URLSearchParams(location.search);const id=p.get('id')||'1';
const r=await fetch(`/v1/memory/${id}/stack`);const d=await r.json();document.getElementById('title').textContent=`id=${id} — ${d.codestone.title}`;
const nodes=[],links=[];nodes.push({id:`codestone:${d.codestone.id}`,label:d.codestone.title,kind:'codestone'});
if(d.reflection&&d.reflection.id){nodes.push({id:`reflection:${d.reflection.id}`,label:'Reflection',kind:'reflection'});links.push({source:`reflection:${d.reflection.id}`,target:`codestone:${d.codestone.id}`});}
for(const e of d.edges){const a=`item:${e.src_id}`,b=`item:${e.dst_id}`;if(!nodes.find(n=>n.id===a))nodes.push({id:a,label:`Item ${e.src_id}`,kind:'item'});
if(!nodes.find(n=>n.id===b))nodes.push({id:b,label:`Item ${e.dst_id}`,kind:'item'});links.push({source:a,target:b});}
const svg=d3.select('#graph'),w=svg.node().clientWidth,h=svg.node().clientHeight;
const sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(d=>d.id).distance(80).strength(.3)).force('charge',d3.forceManyBody().strength(-200)).force('center',d3.forceCenter(w/2,h/2));
const link=svg.append('g').selectAll('line').data(links).enter().append('line').attr('class','link');
const node=svg.append('g').selectAll('g').data(nodes).enter().append('g').attr('class','node');
node.append('circle').attr('r',10);node.append('text').attr('x',12).attr('y',3).text(d=>d.label);
node.call(d3.drag().on('start',(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=e.x;d.fy=e.y;}).on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y;}).on('end',(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;}));
sim.on('tick',()=>{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);node.attr('transform',d=>`translate(${d.x},${d.y})`);});})();
</script></body></html>
```

---

## 7) `services/api/app/policy.py`
```python
import json, http.client, urllib.parse
from .settings import settings

def check_policy(action: str, payload: dict, actor: dict | None = None) -> bool:
    data = {"input": {"action": action, "payload": payload, "actor": actor or {"id":"dev","roles":["admin"]}}}
    try:
        parsed = urllib.parse.urlparse(settings.opa_url)
        conn = http.client.HTTPConnection(parsed.hostname, parsed.port)
        conn.request("POST", parsed.path, body=json.dumps(data), headers={"content-type":"application/json"})
        resp = conn.getresponse()
        res = json.loads(resp.read().decode("utf-8"))
        return bool(res.get("result", False) or res.get("result", {}).get("allow", False))
    except Exception:
        return True
```

---

## 8) `.github/workflows/ci.yml`
```yaml
name: CI
on:
  pull_request:
    branches: ["**"]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - name: API deps
        working-directory: services/api
        run: |
          python -m pip install -U pip
          pip install -e .[dev] || pip install -e .
      - name: Worker deps
        working-directory: services/worker
        run: |
          python -m pip install -U pip
          pip install -e .[dev] || pip install -e .
      - name: Lint (ruff)
        run: |
          pip install ruff
          ruff check .
          ruff format --check .
      - name: Unit tests (placeholder)
        run: echo "TODO: add tests" && exit 0
```

---

## 9) Minimal dependency bumps (merge into your existing files)

### `services/api/pyproject.toml` — add to `[project].dependencies`
```toml
httpx>=0.27
prometheus-client>=0.20
notion-client>=2.2
```

### `services/worker/pyproject.toml` — add to `[project].dependencies`
```toml
prometheus-client>=0.20
requests>=2.32
```

---

## 10) `README.md` snippet (append)
```md
## Federation
Set peers in `.env`:

FEDERATION_PEERS=http://node2:8000,http://node3:8000

Call:

GET /v1/recall/federated?q=spiral&limit=20

## Grafana
Grafana at http://localhost:3000 (admin/admin). Prometheus at http://localhost:9090. Pushgateway at http://localhost:9091.
```

---

### How to apply
1) Create any missing dirs and paste files into the exact paths above.
2) Merge the dependency lines into your `pyproject.toml` files.
3) Rebuild: `docker compose up --build api worker` and `docker compose up -d grafana prometheus pushgateway`.

If you’d like a **tiny React Admin** (search, graph, strength slider) as a separate pack, I can drop only those files next.

