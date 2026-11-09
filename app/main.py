import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, checkout, cron, generate, health, usage, webhooks
from app.config import settings
from app.errors import register_error_handlers

# Structured logging: ISO timestamps, no secrets ever emitted
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("app.request")

app = FastAPI(title="HisaabLedger Metering & Billing API")


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """
    Production Request ID & Timing Middleware:
    - Ingests incoming X-Request-ID or generates a cryptographically random UUID4.
    - Attaches request_id to request.state for downstream loggers and exception handlers.
    - Measures wall-clock execution duration in ms.
    - Appends X-Request-ID and X-Response-Time-Ms headers to outgoing response.
    """
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id

    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.2f}"

    # Structured request audit line (excluding high-frequency health probes)
    if not request.url.path.startswith("/health"):
        logger.info(
            "%s %s %d %.2fms [request_id=%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )

    return response


origins = [settings.web_origin] if settings.web_origin else ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["X-API-Key", "Idempotency-Key", "Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["Idempotent-Replayed", "X-Request-ID", "X-Response-Time-Ms"],
)

register_error_handlers(app)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(usage.router)
app.include_router(checkout.router)
app.include_router(webhooks.router)
app.include_router(cron.router)

