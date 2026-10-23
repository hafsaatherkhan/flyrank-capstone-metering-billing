"""
Subscription reconciliation background job with reliable retries and failure alerting.

Compares local subscription status with Polar's live status via the API and
logs mismatches loudly. Does NOT auto-fix — only reports.
Maintains read-only semantics against the payment provider.

Features:
  - Bounded exponential backoff with jitter for retryable transient errors (network timeouts, 429, 5xx).
  - Respects Retry-After header on HTTP 429.
  - Distinguishes transient vs permanent errors (401, 403, 404, invalid configuration are NOT retried).
  - Emits structured FailureAlerts on exhausted retries or job-level crashes.
  - Deduplicates repeated failure alerts to prevent alert fatigue.
  - Concurrent job execution protection via atomic execution lock.
  - Non-blocking execution for both CLI and background worker/cron modes.
"""
from __future__ import annotations

import logging
import random
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.jobs.alerts import AlertDispatcher, FailureAlert, default_alert_dispatcher
from app.models import Subscription, Tenant

logger = logging.getLogger(__name__)

# In-memory execution lock to prevent overlapping runs within the same process
_JOB_LOCK = threading.Lock()


def _get_polar_client(timeout: Optional[float] = None):
    """Return a configured Polar SDK client for the sandbox environment."""
    req_timeout = timeout if timeout is not None else settings.reconcile_request_timeout
    try:
        from polar.v2027_01 import Polar  # type: ignore
        return Polar(
            access_token=settings.polar_access_token,
            environment=settings.polar_server,
            timeout=req_timeout,
        )
    except Exception as exc:
        logger.error("Failed to initialise Polar client: %s", type(exc).__name__)
        return None


def is_transient_error(exc: Exception) -> Tuple[bool, Optional[int]]:
    """
    Determine whether an exception represents a retryable transient failure.
    Returns (is_transient, retry_after_seconds).
    
    Retryable:
      - Network errors, timeouts (httpx.RequestError, PolarNetworkError)
      - HTTP 429 (PolarRateLimitError or PolarClientError with status 429)
      - HTTP 500, 502, 503, 504 (PolarServerError or status >= 500)
    
    Non-retryable (permanent):
      - 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable
    """
    # Check for PolarRateLimitError or 429
    retry_after = getattr(exc, "retry_after", None)
    status_code = getattr(exc, "status_code", None)

    exc_class_name = type(exc).__name__

    # PolarRateLimitError or status_code == 429
    if exc_class_name == "PolarRateLimitError" or status_code == 429:
        return True, retry_after

    # Network / Timeout errors
    if exc_class_name in ("PolarNetworkError", "TimeoutException", "ConnectTimeout", "ReadTimeout", "NetworkError"):
        return True, None
    if isinstance(exc, (httpx.RequestError, TimeoutError, ConnectionError)):
        return True, None

    # Server errors (5xx)
    if exc_class_name == "PolarServerError" or (isinstance(status_code, int) and 500 <= status_code <= 599):
        return True, None

    # If PolarClientError with 4xx other than 429 -> permanent error
    if exc_class_name == "PolarClientError" or (isinstance(status_code, int) and 400 <= status_code < 500):
        return False, None

    # Any generic client-side ValueError, TypeError, KeyError -> permanent
    if isinstance(exc, (ValueError, TypeError, KeyError)):
        return False, None

    return False, None


def compute_backoff(
    attempt: int,
    base: float,
    max_backoff: float,
    retry_after: Optional[int] = None,
) -> float:
    """
    Calculate backoff sleep duration using exponential backoff with full jitter,
    or the server-provided Retry-After header if provided.
    """
    if retry_after is not None and retry_after > 0:
        return float(retry_after)
    exp = min(max_backoff, base * (2 ** (attempt - 1)))
    # Add random jitter between 0 and 0.5 * exp
    jitter = random.uniform(0, 0.5 * exp)
    return min(max_backoff, exp + jitter)


def fetch_provider_subscription_with_retry(
    client: Any,
    provider_subscription_id: str,
    run_id: str,
    tenant_label: str,
    max_retries: Optional[int] = None,
    backoff_base: Optional[float] = None,
    backoff_max: Optional[float] = None,
    sleeper=time.sleep,
) -> Tuple[Optional[Any], Optional[Exception], int]:
    """
    Fetches subscription from Polar using bounded retry policy with exponential backoff & jitter.
    
    Returns:
      (provider_sub, last_exception, total_attempts)
    """
    limit_retries = max_retries if max_retries is not None else settings.reconcile_max_retries
    base = backoff_base if backoff_base is not None else settings.reconcile_backoff_base
    cap = backoff_max if backoff_max is not None else settings.reconcile_backoff_max

    attempt = 0
    while True:
        attempt += 1
        try:
            logger.info(
                "PROVIDER_FETCH_ATTEMPT job=reconciliation run_id=%s sub=%s tenant=%s attempt=%d/%d",
                run_id,
                provider_subscription_id,
                tenant_label,
                attempt,
                limit_retries + 1,
            )
            provider_sub = client.subscriptions.get(provider_subscription_id)
            return provider_sub, None, attempt
        except Exception as exc:
            is_transient, retry_after = is_transient_error(exc)
            fail_category = "TRANSIENT_ERROR" if is_transient else "PERMANENT_ERROR"

            logger.warning(
                "PROVIDER_FETCH_FAILED job=reconciliation run_id=%s sub=%s tenant=%s attempt=%d/%d category=%s error=%s",
                run_id,
                provider_subscription_id,
                tenant_label,
                attempt,
                limit_retries + 1,
                fail_category,
                type(exc).__name__,
            )

            # Do not retry permanent errors
            if not is_transient:
                return None, exc, attempt

            # Stop if retry budget exhausted
            if attempt > limit_retries:
                logger.error(
                    "RETRIES_EXHAUSTED job=reconciliation run_id=%s sub=%s tenant=%s total_attempts=%d",
                    run_id,
                    provider_subscription_id,
                    tenant_label,
                    attempt,
                )
                return None, exc, attempt

            sleep_duration = compute_backoff(attempt, base, cap, retry_after)
            logger.info(
                "RETRY_BACKOFF job=reconciliation run_id=%s sub=%s sleep_seconds=%.2f",
                run_id,
                provider_subscription_id,
                sleep_duration,
            )
            sleeper(sleep_duration)


def run_reconcile(
    db: Session,
    alert_dispatcher: Optional[AlertDispatcher] = None,
    client: Optional[Any] = None,
    sleeper=time.sleep,
) -> dict:
    """
    Execute background reconciliation with retries, failure alerting, and concurrency safety.
    """
    dispatcher = alert_dispatcher or default_alert_dispatcher
    run_id = str(uuid.uuid4())[:8]

    # Acquire concurrency lock to avoid duplicate parallel runs
    if not _JOB_LOCK.acquire(blocking=False):
        logger.warning("RECONCILIATION_SKIPPED job=reconciliation run_id=%s reason=already_running", run_id)
        return {
            "run_id": run_id,
            "checked": 0,
            "mismatched": 0,
            "errored": 0,
            "aborted": True,
            "reason": "concurrent_execution_prevented",
        }

    try:
        start_time = datetime.now(timezone.utc).isoformat()
        logger.info("RECONCILIATION_STARTED job=reconciliation run_id=%s start_time=%s", run_id, start_time)

        if client is None:
            client = _get_polar_client()

        if client is None:
            logger.error("RECONCILIATION_ABORTED job=reconciliation run_id=%s reason=client_unavailable", run_id)
            dispatcher.send_alert(
                FailureAlert(
                    job_name="reconciliation",
                    run_id=run_id,
                    failure_category="CLIENT_INIT_FAILED",
                    severity="CRITICAL",
                    message="Failed to initialize Polar payment provider client.",
                    attempt_count=1,
                )
            )
            return {"run_id": run_id, "checked": 0, "mismatched": 0, "errored": 0, "aborted": True}

        subscriptions: list[Subscription] = db.query(Subscription).all()
        checked = 0
        mismatched = 0
        errored = 0

        for sub in subscriptions:
            checked += 1
            tenant_label = str(sub.tenant_id)[:8] if sub.tenant_id else "unknown"

            provider_sub, last_exc, attempts = fetch_provider_subscription_with_retry(
                client=client,
                provider_subscription_id=sub.provider_subscription_id,
                run_id=run_id,
                tenant_label=tenant_label,
                sleeper=sleeper,
            )

            if last_exc is not None:
                errored += 1
                is_transient, _ = is_transient_error(last_exc)
                category = "RETRIES_EXHAUSTED" if is_transient else "PERMANENT_ERROR"

                dispatcher.send_alert(
                    FailureAlert(
                        job_name="reconciliation",
                        run_id=run_id,
                        failure_category=category,
                        severity="ERROR",
                        message=f"Failed to fetch live status from provider after {attempts} attempts: {type(last_exc).__name__}",
                        attempt_count=attempts,
                        tenant_identifier=tenant_label,
                        subscription_identifier=sub.provider_subscription_id,
                        details={"error_type": type(last_exc).__name__},
                    )
                )
                # Ensure one subscription's failure does not prevent processing others
                continue

            provider_status: Optional[str] = getattr(provider_sub, "status", None)

            if provider_status and provider_status != sub.status:
                mismatched += 1
                logger.warning(
                    "STATUS_MISMATCH job=reconciliation run_id=%s tenant=%s sub=%s local_status=%s provider_status=%s",
                    run_id,
                    tenant_label,
                    sub.provider_subscription_id,
                    sub.status,
                    provider_status,
                )
            else:
                logger.info(
                    "STATUS_MATCH job=reconciliation run_id=%s tenant=%s sub=%s status=%s",
                    run_id,
                    tenant_label,
                    sub.provider_subscription_id,
                    sub.status,
                )

        logger.info(
            "RECONCILIATION_COMPLETED job=reconciliation run_id=%s checked=%d mismatched=%d errored=%d",
            run_id,
            checked,
            mismatched,
            errored,
        )
        return {
            "run_id": run_id,
            "checked": checked,
            "mismatched": mismatched,
            "errored": errored,
            "aborted": False,
        }

    except Exception as exc:
        logger.exception("RECONCILIATION_CRASHED job=reconciliation run_id=%s error=%s", run_id, type(exc).__name__)
        dispatcher.send_alert(
            FailureAlert(
                job_name="reconciliation",
                run_id=run_id,
                failure_category="JOB_CRASH",
                severity="CRITICAL",
                message=f"Reconciliation job encountered unexpected unhandled exception: {type(exc).__name__}",
                attempt_count=1,
            )
        )
        raise exc
    finally:
        _JOB_LOCK.release()


def main() -> None:
    """Entry point for `python -m app.jobs.reconcile`."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    db = SessionLocal()
    try:
        summary = run_reconcile(db)
        print(summary)
    finally:
        db.close()


if __name__ == "__main__":
    main()
