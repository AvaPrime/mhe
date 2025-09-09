
from fastapi import FastAPI

app = FastAPI(title="MHE API")

# Routers would be included here...

from mhe.obs.metrics import instrument_app
from mhe.obs.tracing import setup_tracing

# Initialize metrics & tracing
instrument_app(app)
setup_tracing(app)
