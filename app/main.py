import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, checkout, cron, generate, health, usage, webhooks
from app.config import settings
from app.errors import register_error_handlers

# Structured logging: ISO timestamps, no secrets ever emitted
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="HisaabLedger Metering & Billing API")

origins = [settings.web_origin] if settings.web_origin else ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["X-API-Key", "Idempotency-Key", "Content-Type", "Authorization"],
    expose_headers=["Idempotent-Replayed"],
)

register_error_handlers(app)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(generate.router)
app.include_router(usage.router)
app.include_router(checkout.router)
app.include_router(webhooks.router)
app.include_router(cron.router)

