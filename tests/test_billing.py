"""
Test suite for Phase 3:
- Checkout endpoint (POST /checkout) with mocked/controlled Polar client
- Webhook signature verification (Standard Webhooks HMAC)
- Webhook deduplication via webhook-id header (200 duplicate_ignored)
- Webhook event transitions:
    - subscription.created / subscription.active -> upgrade to Pro, status active
    - subscription.updated -> sync status and current_period_end; handle past_due/unpaid
    - subscription.canceled -> status cancel_at_period_end, remains pro until period end
    - subscription.revoked -> downgrade to free, status canceled
- Error cases: forged signature (400), malformed json (400), unknown events (200 ignored)
"""

import base64
import hashlib
import hmac
import json
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models import Plan, Subscription, Tenant, WebhookEvent
from tests.conftest import TestingSessionLocal, make_plan, make_tenant

client = TestClient(app)

TEST_SECRET = "whsec_" + base64.b64encode(b"test_secret_32_bytes_long_key!!").decode("utf-8")


def generate_polar_headers(body: str, secret: str = TEST_SECRET, msg_id: str | None = None, timestamp: int | None = None):
    """Generate signed Standard Webhooks headers as Polar sends them."""
    if msg_id is None:
        msg_id = f"msg_{int(time.time()*1000)}"
    if timestamp is None:
        timestamp = int(time.time())

    key = base64.b64decode(secret.removeprefix("whsec_"))
    signed_payload = f"{msg_id}.{timestamp}.{body}".encode("utf-8")
    sig = "v1," + base64.b64encode(hmac.new(key, signed_payload, hashlib.sha256).digest()).decode("utf-8")

    return {
        "webhook-id": msg_id,
        "webhook-timestamp": str(timestamp),
        "webhook-signature": sig,
        "Content-Type": "application/json",
    }


class TestCheckout:
    def test_checkout_missing_api_key_returns_422(self):
        resp = client.post("/checkout")
        assert resp.status_code == 422

    def test_checkout_invalid_api_key_returns_401(self):
        resp = client.post("/checkout", headers={"X-API-Key": "invalid_api_key_val"})
        assert resp.status_code == 401
        assert resp.json()["detail"]["error"] == "invalid_api_key"

    def test_checkout_success(self, db, free_tenant):
        tenant, raw_key, _ = free_tenant

        mock_checkout = MagicMock()
        mock_checkout.url = "https://sandbox.polar.sh/checkout/chk_12345"
        mock_checkout.id = "chk_12345"

        with patch("app.api.checkout.Polar") as mock_polar_cls:
            mock_client = MagicMock()
            mock_client.checkouts.create.return_value = mock_checkout
            mock_polar_cls.return_value = mock_client

            resp = client.post("/checkout", headers={"X-API-Key": raw_key})
            assert resp.status_code == 200
            data = resp.json()
            assert data["checkout_url"] == "https://sandbox.polar.sh/checkout/chk_12345"
            assert data["checkout_id"] == "chk_12345"

            # Verify tenant was passed as external_customer_id and in metadata
            mock_client.checkouts.create.assert_called_once()
            _, kwargs = mock_client.checkouts.create.call_args
            assert kwargs["external_customer_id"] == str(tenant.id)
            assert kwargs["metadata"]["tenant_id"] == str(tenant.id)


class TestWebhooksPolar:
    @pytest.fixture(autouse=True)
    def patch_webhook_secret(self, monkeypatch):
        monkeypatch.setattr(settings, "polar_webhook_secret", TEST_SECRET)

    def test_forged_or_invalid_signature_returns_400(self, db):
        body = json.dumps({"type": "subscription.created", "data": {"id": "sub_1"}})
        headers = {
            "webhook-id": "msg_bad",
            "webhook-timestamp": str(int(time.time())),
            "webhook-signature": "v1,invalid_signature_here",
            "Content-Type": "application/json",
        }
        resp = client.post("/webhooks/polar", content=body, headers=headers)
        assert resp.status_code == 400

        # Verify no DB records created
        assert db.query(WebhookEvent).count() == 0

    def test_missing_headers_returns_400(self):
        body = json.dumps({"type": "subscription.created", "data": {"id": "sub_1"}})
        resp = client.post("/webhooks/polar", content=body)
        # Missing webhook-id header is caught by FastAPI boundary validation or signature check
        assert resp.status_code in (400, 422)

    def test_subscription_created_and_active_upgrades_to_pro(self, db, free_tenant):
        tenant, _, free_p = free_tenant
        pro_p = make_plan(db, name="pro", api_calls_limit=50000, ai_tokens_limit=5000000)

        payload = {
            "type": "subscription.created",
            "data": {
                "id": "sub_polar_100",
                "status": "active",
                "customer_id": "cust_polar_1",
                "cancel_at_period_end": False,
                "current_period_end": "2026-11-20T00:00:00Z",
                "metadata": {"tenant_id": str(tenant.id)},
                "customer": {
                    "id": "cust_polar_1",
                    "external_id": str(tenant.id),
                },
            },
        }
        body = json.dumps(payload)
        msg_id = "msg_sub_created_1"
        headers = generate_polar_headers(body, msg_id=msg_id)

        resp = client.post("/webhooks/polar", content=body, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "processed"

        # Check tenant upgraded to pro
        db.refresh(tenant)
        assert tenant.plan_id == pro_p.id
        assert tenant.subscription_status == "active"
        assert tenant.provider_customer_id == "cust_polar_1"

        # Check subscription record
        sub = db.query(Subscription).filter_by(provider_subscription_id="sub_polar_100").first()
        assert sub is not None
        assert sub.tenant_id == tenant.id
        assert sub.status == "active"
        assert sub.cancel_at_period_end is False

        # Check webhook event recorded
        wh_event = db.query(WebhookEvent).filter_by(event_id=msg_id).first()
        assert wh_event is not None
        assert wh_event.type == "subscription.created"

    def test_duplicate_webhook_returns_200_duplicate_ignored(self, db, free_tenant):
        tenant, _, _ = free_tenant
        make_plan(db, name="pro")

        payload = {
            "type": "subscription.active",
            "data": {
                "id": "sub_polar_dup",
                "status": "active",
                "metadata": {"tenant_id": str(tenant.id)},
            },
        }
        body = json.dumps(payload)
        msg_id = "msg_duplicate_test"
        headers = generate_polar_headers(body, msg_id=msg_id)

        # First delivery
        r1 = client.post("/webhooks/polar", content=body, headers=headers)
        assert r1.status_code == 200
        assert r1.json()["status"] == "processed"

        # Duplicate delivery
        r2 = client.post("/webhooks/polar", content=body, headers=headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate_ignored"

        # Exactly 1 webhook event in DB
        assert db.query(WebhookEvent).filter_by(event_id=msg_id).count() == 1

    def test_subscription_updated_past_due_maps_to_past_due(self, db, free_tenant):
        tenant, _, _ = free_tenant
        pro_p = make_plan(db, name="pro")
        tenant.plan_id = pro_p.id
        tenant.subscription_status = "active"
        db.commit()

        # Existing subscription row
        sub = Subscription(
            tenant_id=tenant.id,
            provider_subscription_id="sub_polar_update",
            status="active",
        )
        db.add(sub)
        db.commit()

        payload = {
            "type": "subscription.updated",
            "data": {
                "id": "sub_polar_update",
                "status": "past_due",
                "metadata": {"tenant_id": str(tenant.id)},
            },
        }
        body = json.dumps(payload)
        headers = generate_polar_headers(body)

        resp = client.post("/webhooks/polar", content=body, headers=headers)
        assert resp.status_code == 200

        db.refresh(tenant)
        db.refresh(sub)
        assert tenant.subscription_status == "past_due"
        assert sub.status == "past_due"

    def test_subscription_canceled_sets_cancel_at_period_end(self, db, free_tenant):
        tenant, _, _ = free_tenant
        pro_p = make_plan(db, name="pro")
        tenant.plan_id = pro_p.id
        tenant.subscription_status = "active"
        db.commit()

        sub = Subscription(
            tenant_id=tenant.id,
            provider_subscription_id="sub_polar_cancel",
            status="active",
            cancel_at_period_end=False,
        )
        db.add(sub)
        db.commit()

        payload = {
            "type": "subscription.canceled",
            "data": {
                "id": "sub_polar_cancel",
                "status": "canceled",
                "cancel_at_period_end": True,
                "current_period_end": "2026-12-31T23:59:59Z",
                "metadata": {"tenant_id": str(tenant.id)},
            },
        }
        body = json.dumps(payload)
        headers = generate_polar_headers(body)

        resp = client.post("/webhooks/polar", content=body, headers=headers)
        assert resp.status_code == 200

        db.refresh(tenant)
        db.refresh(sub)
        # Stays on Pro plan until period end
        assert tenant.plan_id == pro_p.id
        assert sub.cancel_at_period_end is True

    def test_subscription_revoked_downgrades_to_free(self, db, free_tenant):
        tenant, _, free_p = free_tenant
        pro_p = make_plan(db, name="pro")
        tenant.plan_id = pro_p.id
        tenant.subscription_status = "active"
        db.commit()

        sub = Subscription(
            tenant_id=tenant.id,
            provider_subscription_id="sub_polar_revoke",
            status="active",
        )
        db.add(sub)
        db.commit()

        payload = {
            "type": "subscription.revoked",
            "data": {
                "id": "sub_polar_revoke",
                "status": "revoked",
                "metadata": {"tenant_id": str(tenant.id)},
            },
        }
        body = json.dumps(payload)
        headers = generate_polar_headers(body)

        resp = client.post("/webhooks/polar", content=body, headers=headers)
        assert resp.status_code == 200

        db.refresh(tenant)
        db.refresh(sub)
        # Downgraded to free plan
        assert tenant.plan_id == free_p.id
        assert tenant.subscription_status == "canceled"
        assert sub.status == "revoked"

    def test_unknown_event_type_recorded_and_ignored(self, db):
        payload = {
            "type": "custom.unknown_event",
            "data": {"foo": "bar"},
        }
        body = json.dumps(payload)
        msg_id = "msg_unknown_1"
        headers = generate_polar_headers(body, msg_id=msg_id)

        resp = client.post("/webhooks/polar", content=body, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "processed"

        # Webhook event was recorded
        wh = db.query(WebhookEvent).filter_by(event_id=msg_id).first()
        assert wh is not None
        assert wh.type == "custom.unknown_event"
