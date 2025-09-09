from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI

app = FastAPI(title="MHE API")

# Routers would be included here...

from mhe.obs.metrics import instrument_app
from mhe.obs.tracing import setup_tracing

# Initialize metrics & tracing
instrument_app(app)
setup_tracing(app)

from mhe.access.routers import threads

app.include_router(threads.router, prefix="/threads", tags=["threads"])
# Dev CORS (adjust origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
