"""
Webhook handler for Polar payment and subscription events.
"""

import json
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from polar.webhooks import _verify_signature, PolarWebhookVerificationError, PolarWebhookError

from app.config import settings
from app.db import get_db
from app.models import WebhookEvent
from app.services import billing_sync

router = APIRouter()


@router.post("/webhooks/polar")
async def handle_polar_webhook(
    request: Request,
    webhook_id: str = Header(..., alias="webhook-id"),
    db: Session = Depends(get_db),
):
    """
    Handle incoming webhooks from Polar (Standard Webhooks format).
    - Verifies HMAC signature using raw request body and POLAR_WEBHOOK_SECRET.
    - Invalid signature -> 400 Bad Request (no DB change).
    - Deduplicates using webhook-id header via webhook_events table.
    - Duplicate event -> 200 {"status": "duplicate_ignored"}.
    - Atomic transaction: event recording + tenant state sync.
    """
    # 1. Read raw body
    body_bytes = await request.body()
    body_text = body_bytes.decode("utf-8")

    # 2. Verify signature with Polar secret
    # Convert incoming request headers to a case-insensitive dictionary
    headers = dict(request.headers)

    try:
        _verify_signature(body_text, headers, settings.polar_webhook_secret)
    except (PolarWebhookVerificationError, PolarWebhookError, Exception):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature or malformed request.",
        )

    # 3. Parse JSON body
    try:
        payload = json.loads(body_text)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        )

    event_type = payload.get("type")
    event_data = payload.get("data") or {}

    # 4. Check for duplicate webhook_id (deduplication)
    existing_event = (
        db.query(WebhookEvent)
        .filter(WebhookEvent.event_id == webhook_id)
        .first()
    )
    if existing_event:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "duplicate_ignored"},
        )

    # 5. Atomic transaction: record webhook_event and sync billing state
    new_event = WebhookEvent(
        event_id=webhook_id,
        type=event_type or "unknown",
    )
    db.add(new_event)

    # If subscription event, sync internal tenant/subscription state
    if event_type and event_type.startswith("subscription."):
        billing_sync.handle_subscription_event(db, event_type, event_data)

    db.commit()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "processed", "type": event_type},
    )
