import logging

from fastapi import FastAPI

from app.api import checkout, cron, generate, health, usage, webhooks
from app.errors import register_error_handlers

# Structured logging: ISO timestamps, no secrets ever emitted
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="FlyRank Metering & Billing API")

register_error_handlers(app)
app.include_router(health.router)
app.include_router(generate.router)
app.include_router(usage.router)
app.include_router(checkout.router)
app.include_router(webhooks.router)
app.include_router(cron.router)

