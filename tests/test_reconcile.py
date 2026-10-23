"""
Unit and integration tests for background subscription reconciliation job,
including bounded retries, jittered backoff, failure alerts, deduplication, and isolation.
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import RequestError
from polar.base import PolarClientError, PolarNetworkError, PolarRateLimitError, PolarServerError

from app.jobs.alerts import AlertDispatcher, FailureAlert
from app.jobs.reconcile import (
    compute_backoff,
    fetch_provider_subscription_with_retry,
    is_transient_error,
    run_reconcile,
)
from app.models import Plan, Subscription, Tenant


class MockPolarSub:
    def __init__(self, status: str = "active"):
        self.status = status


def test_is_transient_error_classification():
    """Verify categorization of transient vs permanent errors."""
    # Transient errors
    assert is_transient_error(PolarNetworkError("timeout"))[0] is True
    assert is_transient_error(PolarServerError(502, "Bad Gateway"))[0] is True
    assert is_transient_error(PolarRateLimitError(429, retry_after=5))[0] is True
    assert is_transient_error(PolarRateLimitError(429, retry_after=5))[1] == 5
    assert is_transient_error(RequestError("DNS resolution failed"))[0] is True
    assert is_transient_error(TimeoutError("Connection timed out"))[0] is True

    # Permanent errors
    assert is_transient_error(PolarClientError(401, "Unauthorized"))[0] is False
    assert is_transient_error(PolarClientError(403, "Forbidden"))[0] is False
    assert is_transient_error(PolarClientError(404, "Not Found"))[0] is False
    assert is_transient_error(ValueError("Bad configuration"))[0] is False


def test_compute_backoff():
    """Verify exponential backoff and Retry-After header override."""
    # Retry-After header should take precedence
    assert compute_backoff(1, base=1.0, max_backoff=10.0, retry_after=7) == 7.0

    # Backoff increases with attempt count and is capped by max_backoff
    b1 = compute_backoff(1, base=1.0, max_backoff=10.0)
    b2 = compute_backoff(2, base=1.0, max_backoff=10.0)
    assert 1.0 <= b1 <= 1.5
    assert 2.0 <= b2 <= 3.0
    b_capped = compute_backoff(10, base=1.0, max_backoff=10.0)
    assert b_capped <= 10.0


# ── Requirement 1: Successful reconciliation completes without retries ─────────
def test_reconciliation_success_no_retries():
    mock_client = MagicMock()
    mock_client.subscriptions.get.return_value = MockPolarSub("active")
    sleep_calls = []

    sub, exc, attempts = fetch_provider_subscription_with_retry(
        client=mock_client,
        provider_subscription_id="sub_123",
        run_id="test_run",
        tenant_label="tenant_a",
        max_retries=3,
        sleeper=sleep_calls.append,
    )

    assert exc is None
    assert sub.status == "active"
    assert attempts == 1
    assert len(sleep_calls) == 0
    assert mock_client.subscriptions.get.call_count == 1


# ── Requirement 2: Transient failure succeeds on a subsequent retry ───────────
def test_transient_failure_succeeds_on_retry():
    mock_client = MagicMock()
    # Fails first with PolarNetworkError, then succeeds
    mock_client.subscriptions.get.side_effect = [
        PolarNetworkError("Connection reset"),
        MockPolarSub("active"),
    ]
    sleep_calls = []

    sub, exc, attempts = fetch_provider_subscription_with_retry(
        client=mock_client,
        provider_subscription_id="sub_123",
        run_id="test_run",
        tenant_label="tenant_a",
        max_retries=3,
        sleeper=sleep_calls.append,
    )

    assert exc is None
    assert sub.status == "active"
    assert attempts == 2
    assert len(sleep_calls) == 1
    assert mock_client.subscriptions.get.call_count == 2


# ── Requirement 3: Repeated transient failures stop after configured max ───────
def test_repeated_transient_failures_stop_after_max():
    mock_client = MagicMock()
    mock_client.subscriptions.get.side_effect = PolarServerError(503, "Service Unavailable")
    sleep_calls = []

    sub, exc, attempts = fetch_provider_subscription_with_retry(
        client=mock_client,
        provider_subscription_id="sub_123",
        run_id="test_run",
        tenant_label="tenant_a",
        max_retries=2,  # max 2 retries -> 1 initial + 2 retries = 3 total attempts
        sleeper=sleep_calls.append,
    )

    assert sub is None
    assert isinstance(exc, PolarServerError)
    assert attempts == 3
    assert len(sleep_calls) == 2
    assert mock_client.subscriptions.get.call_count == 3


# ── Requirement 4: Permanent failures are not retried unnecessarily ───────────
def test_permanent_failures_not_retried():
    mock_client = MagicMock()
    # 404 Not Found is a permanent client error
    mock_client.subscriptions.get.side_effect = PolarClientError(404, "Subscription not found")
    sleep_calls = []

    sub, exc, attempts = fetch_provider_subscription_with_retry(
        client=mock_client,
        provider_subscription_id="sub_invalid",
        run_id="test_run",
        tenant_label="tenant_a",
        max_retries=3,
        sleeper=sleep_calls.append,
    )

    assert sub is None
    assert isinstance(exc, PolarClientError)
    assert attempts == 1  # Stopped on attempt 1 without retry
    assert len(sleep_calls) == 0
    assert mock_client.subscriptions.get.call_count == 1


# ── Requirement 5: Exhausted retries produce a verifiable failure alert ────────
def test_exhausted_retries_produces_failure_alert(db):
    plan = Plan(name="plan_test_alert", api_calls_limit=1000, ai_tokens_limit=100000)
    db.add(plan)
    db.flush()
    tenant = Tenant(name="T1", api_key_hash="hash1", plan_id=plan.id)
    db.add(tenant)
    db.flush()
    sub = Subscription(
        tenant_id=tenant.id,
        provider_subscription_id="sub_exhaust_test",
        status="active",
    )
    db.add(sub)
    db.commit()

    mock_client = MagicMock()
    mock_client.subscriptions.get.side_effect = PolarServerError(500, "Internal Server Error")
    mock_dispatcher = MagicMock(spec=AlertDispatcher)
    mock_dispatcher.send_alert.return_value = True

    summary = run_reconcile(
        db=db,
        alert_dispatcher=mock_dispatcher,
        client=mock_client,
        sleeper=lambda _: None,
    )

    assert summary["errored"] == 1
    assert summary["checked"] == 1
    assert mock_dispatcher.send_alert.call_count == 1
    sent_alert: FailureAlert = mock_dispatcher.send_alert.call_args[0][0]
    assert sent_alert.failure_category == "RETRIES_EXHAUSTED"
    assert sent_alert.subscription_identifier == "sub_exhaust_test"
    assert sent_alert.severity == "ERROR"


# ── Requirement 6: One subscription failure does not prevent others ───────────
def test_one_failure_does_not_prevent_others(db):
    plan = Plan(name="plan_test_isolation", api_calls_limit=1000, ai_tokens_limit=100000)
    db.add(plan)
    db.flush()
    tenant = Tenant(name="T2", api_key_hash="hash2", plan_id=plan.id)
    db.add(tenant)
    db.flush()
    sub1 = Subscription(
        tenant_id=tenant.id,
        provider_subscription_id="sub_fail",
        status="active",
    )
    sub2 = Subscription(
        tenant_id=tenant.id,
        provider_subscription_id="sub_ok",
        status="active",
    )
    db.add_all([sub1, sub2])
    db.commit()

    def side_effect(sub_id):
        if sub_id == "sub_fail":
            raise PolarClientError(404, "Not Found")
        return MockPolarSub("active")

    mock_client = MagicMock()
    mock_client.subscriptions.get.side_effect = side_effect
    mock_dispatcher = MagicMock(spec=AlertDispatcher)

    summary = run_reconcile(
        db=db,
        alert_dispatcher=mock_dispatcher,
        client=mock_client,
        sleeper=lambda _: None,
    )

    assert summary["checked"] == 2
    assert summary["errored"] == 1
    assert summary["mismatched"] == 0
    # sub_ok was checked and succeeded


# ── Requirement 7: Alert delivery failure is handled safely without crashing ───
def test_alert_delivery_failure_is_handled_safely():
    dispatcher = AlertDispatcher(webhook_url="http://invalid-alert-endpoint.local", dedupe_ttl_seconds=60)
    alert = FailureAlert(
        job_name="reconciliation",
        run_id="run_err",
        failure_category="TEST_FAILURE",
        severity="ERROR",
        message="Test alert delivery failure handling",
        attempt_count=1,
    )

    with patch("httpx.Client.post", side_effect=RequestError("Network error sending alert")):
        # Must not raise an exception; returns True because logged and attempted
        result = dispatcher.send_alert(alert)
        assert result is True


def test_alert_deduplication():
    dispatcher = AlertDispatcher(webhook_url=None, dedupe_ttl_seconds=60.0)
    alert = FailureAlert(
        job_name="reconciliation",
        run_id="run_dedupe",
        failure_category="RETRIES_EXHAUSTED",
        severity="ERROR",
        message="Duplicated alert test",
        attempt_count=3,
        subscription_identifier="sub_dedupe_123",
    )

    # First call sends
    assert dispatcher.send_alert(alert) is True
    # Immediate repeat call is deduplicated
    assert dispatcher.send_alert(alert) is False


# ── Requirement 8: Concurrent job execution safety ─────────────────────────────
def test_concurrent_job_execution_safety(db):
    from app.jobs.reconcile import _JOB_LOCK

    # Simulate an active running job holding the lock
    _JOB_LOCK.acquire()
    try:
        summary = run_reconcile(db=db)
        assert summary["aborted"] is True
        assert summary["reason"] == "concurrent_execution_prevented"
    finally:
        _JOB_LOCK.release()


# ── Requirement 9: The job can run independently of HTTP request path ──────────
def test_job_runs_independently_via_cli_and_cron_background(client):
    # Verify the HTTP cron endpoint can schedule work asynchronously via sync=false
    # Note: Requires valid CRON_SECRET header
    from app.config import settings
    headers = {"Authorization": f"Bearer {settings.cron_secret}"}

    # Asynchronous off-the-request-path invocation
    res = client.get("/api/cron/reconcile?sync=false", headers=headers)
    assert res.status_code == 202
    assert res.json()["status"] == "accepted"
