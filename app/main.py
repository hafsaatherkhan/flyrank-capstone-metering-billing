from fastapi import FastAPI
from app.api import health, generate
from app.errors import register_error_handlers

app = FastAPI(title="FlyRank Metering & Billing API")

register_error_handlers(app)
app.include_router(health.router)
app.include_router(generate.router)
