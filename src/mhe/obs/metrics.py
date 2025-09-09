from __future__ import annotations
from prometheus_client import Counter, Histogram
from prometheus_fastapi_instrumentator import Instrumentator
from time import perf_counter
from typing import Callable
from fastapi import Request

# --- Core metrics ---
INGEST_MESSAGES = Counter(
    "mhe_ingest_messages_total", "Total messages ingested", labelnames=("source",)
)
ARTIFACTS_CREATED = Counter(
    "mhe_artifacts_created_total", "Total artifacts created", labelnames=("kind",)
)
MEMORY_CARDS_MINTED = Counter(
    "mhe_memory_cards_minted_total", "Total memory cards minted"
)
API_REQ_LATENCY = Histogram(
    "mhe_api_request_duration_seconds",
    "Latency of MHE API calls",
    labelnames=("route", "method"),
    buckets=(0.01,0.025,0.05,0.1,0.25,0.5,1,2,5,10)
)

def instrument_app(app):
    # Expose default FastAPI metrics plus our custom histogram
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    @app.middleware("http")
    async def _latency_mw(request: Request, call_next: Callable):
        start = perf_counter()
        try:
            response = await call_next(request)
            return response
        finally:
            # route path may be unavailable before resolution; fall back to raw path
            route = getattr(request.scope.get("route"), "path", request.url.path)
            method = request.method
            API_REQ_LATENCY.labels(route=route, method=method).observe(perf_counter()-start)