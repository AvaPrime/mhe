
from __future__ import annotations
import os
from fastapi import FastAPI

from opentelemetry import trace
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# Instrumentations
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

def setup_tracing(app: FastAPI, sqlalchemy_engines: list = None):
    if os.getenv("MHE_TRACING_ENABLED", "true").lower() not in ("1","true","yes"):
        return

    resource = Resource(attributes={SERVICE_NAME: os.getenv("MHE_SERVICE_NAME", "mhe-api")})
    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    exporter = OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces")
    provider.add_span_processor(BatchSpanProcessor(exporter))

    # FastAPI auto-instrumentation
    FastAPIInstrumentor.instrument_app(app)

    # Optional: instrument SQLAlchemy if engines provided later
    if sqlalchemy_engines:
        for eng in sqlalchemy_engines:
            SQLAlchemyInstrumentor().instrument(engine=eng.sync_engine if hasattr(eng, 'sync_engine') else None)

    # HTTPX for outbound LLM calls etc.
    HTTPXClientInstrumentor().instrument()
