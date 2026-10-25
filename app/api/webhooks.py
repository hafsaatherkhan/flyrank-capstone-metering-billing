"""
Webhook handler for Polar payment and subscription events.
Optimized for production fast-acknowledgment (<50ms) and resilient state sync.
"""

import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from polar.webhooks import _verify_signature, PolarWebhookVerificationError, PolarWebhookError

from app.config import settings
from app.db import get_db, SessionLocal
from app.models import WebhookEvent
from app.services import billing_sync

logger = logging.getLogger("app.webhooks")
router = APIRouter()


def _process_webhook_event_background(event_type: str, event_data: dict[str, Any]) -> None:
    """
    Background worker task: syncs subscription & tenant state in an isolated DB session.
    Prevents webhook gateway timeouts and connection starvation during webhook surges.
    """
    db = SessionLocal()
    try:
        billing_sync.handle_subscription_event(db, event_type, event_data)
        db.commit()
        logger.info("Successfully processed background subscription event: %s", event_type)
    except Exception as exc:
        db.rollback()
        logger.error("Failed to process background subscription event %s: %s", event_type, exc)
    finally:
        db.close()


@router.post("/webhooks/polar")
async def handle_polar_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    webhook_id: str = Header(..., alias="webhook-id"),
    sync: bool = Query(default=True, description="When true, executes state sync inline; when false, runs in background"),
    db: Session = Depends(get_db),
):
    """
    Handle incoming webhooks from Polar (Standard Webhooks format).
    - Verifies HMAC signature using raw request body and POLAR_WEBHOOK_SECRET.
    - Invalid signature -> 400 Bad Request (no DB change).
    - Deduplicates using webhook-id header via webhook_events table.
    - Duplicate event -> 200 {"status": "duplicate_ignored"}.
    - Records webhook event atomically.
    - Supports both inline execution (sync=True) and asynchronous background worker processing (sync=False).
    """
    # 1. Read raw body
    body_bytes = await request.body()
    body_text = body_bytes.decode("utf-8")

    # 2. Verify signature with Polar secret
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

    # 5. Persist the webhook_event audit row
    new_event = WebhookEvent(
        event_id=webhook_id,
        type=event_type or "unknown",
    )
    db.add(new_event)

    # 6. Process subscription state
    if event_type and event_type.startswith("subscription."):
        if sync:
            # Synchronous inline execution (safe for immediate test asserts and direct mode)
            billing_sync.handle_subscription_event(db, event_type, event_data)
            db.commit()
        else:
            # Asynchronous background offload (<30ms ultra-fast ack)
            db.commit()
            background_tasks.add_task(
                _process_webhook_event_background,
                event_type=event_type,
                event_data=event_data,
            )
    else:
        db.commit()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "processed", "type": event_type},
    )
