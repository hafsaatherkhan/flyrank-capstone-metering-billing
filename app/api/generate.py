from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_tenant
from app.db import get_db
from app.models import Tenant
from app.schemas import GenerateRequest
from app.services import metering as metering_svc
from app.services import pricing as pricing_svc
from app.services import quota as quota_svc

router = APIRouter()


@router.post("/generate")
def generate(
    body: GenerateRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    """
    Simulate an AI generation request.
    - Records 1 api_call event + 1 ai_tokens event atomically.
    - Enforces quota (FOR UPDATE lock).
    - Idempotent: same key + same payload → replays cached response.
    """
    total_tokens = (
        body.simulated_usage.input_tokens
        + body.simulated_usage.cached_input_tokens
        + body.simulated_usage.output_tokens
        + body.simulated_usage.reasoning_tokens
    )

    # ── 1. Idempotency pre-check ─────────────────────────────────────────────
    request_body_dict = body.model_dump()
    existing_ikey, req_hash = metering_svc.lookup_idempotency(
        db, tenant.id, idempotency_key, request_body_dict
    )
    if existing_ikey:
        return JSONResponse(
            status_code=existing_ikey.response_status,
            content=existing_ikey.response_body,
            headers={"Idempotent-Replayed": "true"},
        )

    # ── 2. Quota check (acquires FOR UPDATE lock on tenant row) ───────────────
    quota_svc.check_and_lock_quota(
        db, tenant,
        requested_calls=1,
        requested_tokens=total_tokens,
    )

    # ── 3. Compute costs (integer micro-USD) ──────────────────────────────────
    token_cost = pricing_svc.cost_for_tokens(
        body.simulated_usage.input_tokens,
        body.simulated_usage.cached_input_tokens,
        body.simulated_usage.output_tokens,
        body.simulated_usage.reasoning_tokens,
    )
    call_cost = pricing_svc.cost_for_api_call()

    # ── 4. Build canonical response body ─────────────────────────────────────
    usage_summary = {
        "input_tokens": body.simulated_usage.input_tokens,
        "cached_input_tokens": body.simulated_usage.cached_input_tokens,
        "output_tokens": body.simulated_usage.output_tokens,
        "reasoning_tokens": body.simulated_usage.reasoning_tokens,
        "total_tokens": total_tokens,
        "api_call_cost_micro_usd": call_cost,
        "token_cost_micro_usd": token_cost,
    }
    response_body = {
        "generated_text": f"[Simulated] Response to: {body.prompt[:50]}",
        "idempotency_key": idempotency_key,
        "usage": usage_summary,
    }

    # ── 5. Record usage atomically (UNIQUE constraint is the final guard) ─────
    metering_svc.record_usage_events(
        db=db,
        tenant_id=tenant.id,
        idempotency_key=idempotency_key,
        request_hash=req_hash,
        api_call_event={"quantity": 1, "cost_micro_usd": call_cost},
        token_event={
            "quantity": total_tokens,
            "cost_micro_usd": token_cost,
            "input_tokens": body.simulated_usage.input_tokens,
            "cached_input_tokens": body.simulated_usage.cached_input_tokens,
            "output_tokens": body.simulated_usage.output_tokens,
            "reasoning_tokens": body.simulated_usage.reasoning_tokens,
        },
        response_status=200,
        response_body=response_body,
    )

    return JSONResponse(status_code=200, content=response_body)
