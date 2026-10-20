"""
Atomic usage event recording with idempotency.

Strategy (from DESIGN.md):
  1. Lookup: query idempotency_keys by (tenant_id, key).
  2. If found:
       - Matching request_hash  → return cached record (caller replays response).
       - Mismatched request_hash → raise 409 idempotency_key_reused.
  3. If not found: insert usage_events + idempotency_keys in one transaction.
     The UNIQUE constraint on usage_events is the final race guard.
"""
import hashlib
import hmac
import json
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import IdempotencyKey, UsageEvent


def _hash_body(body: dict) -> str:
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def get_period_start() -> datetime:
    """Returns UTC midnight of the first day of the current calendar month."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def lookup_idempotency(
    db: Session,
    tenant_id,
    key: str,
    request_body: dict,
):
    """
    Returns (existing_record | None, request_hash).
    Raises HTTPException 409 if the key exists with a different payload hash.
    """
    req_hash = _hash_body(request_body)
    existing = (
        db.query(IdempotencyKey)
        .filter_by(tenant_id=tenant_id, key=key)
        .first()
    )
    if existing:
        if not hmac.compare_digest(existing.request_hash, req_hash):
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "idempotency_key_reused",
                    "message": "Same idempotency key used with a different request payload.",
                },
            )
        return existing, req_hash
    return None, req_hash


def record_usage_events(
    db: Session,
    tenant_id,
    idempotency_key: str,
    request_hash: str,
    api_call_event: dict,
    token_event: dict,
    response_status: int,
    response_body: dict,
) -> IdempotencyKey:
    """
    Atomically inserts:
      - 1 UsageEvent row for api_call
      - 1 UsageEvent row for ai_tokens
      - 1 IdempotencyKey row
    All in one transaction. UNIQUE constraint on usage_events is the final
    concurrency guard against races that slip past the quota lock.
    """
    period_start = get_period_start()

    ikey_record = IdempotencyKey(
        tenant_id=tenant_id,
        key=idempotency_key,
        request_hash=request_hash,
        response_status=response_status,
        response_body=response_body,
    )
    call_ev = UsageEvent(
        tenant_id=tenant_id,
        usage_type="api_call",
        quantity=api_call_event["quantity"],
        input_tokens=0,
        cached_input_tokens=0,
        output_tokens=0,
        reasoning_tokens=0,
        cost_micro_usd=api_call_event["cost_micro_usd"],
        idempotency_key=idempotency_key,
        period_start=period_start,
    )
    token_ev = UsageEvent(
        tenant_id=tenant_id,
        usage_type="ai_tokens",
        quantity=token_event["quantity"],
        input_tokens=token_event.get("input_tokens", 0),
        cached_input_tokens=token_event.get("cached_input_tokens", 0),
        output_tokens=token_event.get("output_tokens", 0),
        reasoning_tokens=token_event.get("reasoning_tokens", 0),
        cost_micro_usd=token_event["cost_micro_usd"],
        idempotency_key=idempotency_key,
        period_start=period_start,
    )

    db.add_all([call_ev, token_ev, ikey_record])
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Another concurrent request already committed — fetch and return it
        existing = (
            db.query(IdempotencyKey)
            .filter_by(tenant_id=tenant_id, key=idempotency_key)
            .first()
        )
        if existing:
            return existing
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": "Concurrent write conflict; please retry.",
            },
        )
    return ikey_record
