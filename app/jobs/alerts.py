"""
Failure alerting service for background jobs.

Handles structured alert generation, deduplication, durable recording / logging,
and dispatching to external notification endpoints (e.g. webhooks, Slack, PagerDuty).
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class FailureAlert:
    job_name: str
    run_id: str
    failure_category: str  # e.g., 'PERMANENT_ERROR', 'RETRIES_EXHAUSTED', 'JOB_CRASH', 'CLIENT_INIT_FAILED'
    severity: str          # 'CRITICAL' | 'ERROR' | 'WARNING'
    message: str
    attempt_count: int
    tenant_identifier: Optional[str] = None
    subscription_identifier: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class AlertDispatcher:
    """
    Manages generation, deduplication, and delivery of failure alerts.
    Keeps track of recent alert keys to prevent alert storms / alert spam.
    """

    def __init__(self, webhook_url: Optional[str] = None, dedupe_ttl_seconds: float = 300.0):
        self.webhook_url = webhook_url or settings.alert_webhook_url
        self.dedupe_ttl_seconds = dedupe_ttl_seconds
        # Stores alert_key -> timestamp of last dispatch
        self._sent_alerts: dict[str, float] = {}

    def _get_alert_key(self, alert: FailureAlert) -> str:
        """Derive a deduplication key using failure category and target identifier."""
        target = alert.subscription_identifier or alert.tenant_identifier or "global"
        return f"{alert.job_name}:{alert.failure_category}:{target}"

    def is_duplicate(self, alert: FailureAlert) -> bool:
        """Check if an identical alert was sent recently within the dedupe window."""
        key = self._get_alert_key(alert)
        now = time.time()
        last_sent = self._sent_alerts.get(key)
        if last_sent and (now - last_sent) < self.dedupe_ttl_seconds:
            return True
        return False

    def mark_sent(self, alert: FailureAlert) -> None:
        key = self._get_alert_key(alert)
        self._sent_alerts[key] = time.time()

    def send_alert(self, alert: FailureAlert) -> bool:
        """
        Record and dispatch an alert.
        Returns True if alert was logged and/or dispatched, False if deduplicated.
        Safe against infinite loops and delivery errors.
        """
        if self.is_duplicate(alert):
            logger.info(
                "ALERT_DEDUPLICATED job=%s run_id=%s sub=%s category=%s",
                alert.job_name,
                alert.run_id,
                alert.subscription_identifier,
                alert.failure_category,
            )
            return False

        # Mark sent in-memory for deduplication
        self.mark_sent(alert)

        # 1. Structured log output (always observable in logs/monitoring)
        logger.error(
            "FAILURE_ALERT: %s",
            json.dumps(alert.to_dict(), default=str),
        )

        # 2. Extensible external delivery if webhook configured
        if self.webhook_url:
            try:
                # Bounded timeout for alert delivery; ignore failures safely
                with httpx.Client(timeout=3.0) as client:
                    resp = client.post(self.webhook_url, json=alert.to_dict())
                    if resp.is_error:
                        logger.warning(
                            "ALERT_DELIVERY_WARNING: Webhook returned HTTP %d for alert %s",
                            resp.status_code,
                            alert.run_id,
                        )
            except Exception as exc:
                # Observable delivery failure without raising or retrying infinitely
                logger.warning(
                    "ALERT_DELIVERY_FAILED: Could not deliver alert webhook: %s",
                    type(exc).__name__,
                )

        return True


default_alert_dispatcher = AlertDispatcher()
