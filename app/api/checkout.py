"""
Checkout API route for creating Polar subscriptions.
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from polar.v2027_01 import Polar
from polar.base import PolarClientError

from app.api.deps import get_tenant
from app.config import settings
from app.db import get_db
from app.models import Tenant, User
from app.schemas import CheckoutResponse
from app.services.auth import decode_token

router = APIRouter()


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    """
    Create a Polar checkout session for upgrading to the Pro plan.
    - Tenant can be authenticated via X-API-Key OR JWT Bearer token.
    - Passes tenant.id as external_customer_id and in metadata so webhooks can identify the tenant.
    - Configured for the sandbox environment.
    """
    if not settings.polar_access_token or settings.polar_access_token == "polar_oat_placeholder":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Polar access token is not configured.",
        )

    if not settings.polar_pro_product_id or settings.polar_pro_product_id == "polar_product_placeholder":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Polar Pro product ID is not configured.",
        )

    try:
        # Use direct httpx call to Polar API to avoid SDK version deserialization issue
        # (polar SDK 1.0.2 fails adapting product_price_id on the new Checkout response schema)
        base_url = (
            "https://sandbox-api.polar.sh/v1"
            if settings.polar_server == "sandbox"
            else "https://api.polar.sh/v1"
        )
        headers = {
            "Authorization": f"Bearer {settings.polar_access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "products": [settings.polar_pro_product_id],
            "external_customer_id": str(tenant.id),
            "metadata": {"tenant_id": str(tenant.id)},
            "customer_metadata": {"tenant_id": str(tenant.id)},
            "success_url": f"{settings.web_origin}/dashboard?checkout=success",
        }

        import httpx
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(f"{base_url}/checkouts/", headers=headers, json=payload)
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Billing service is temporarily unavailable. Please try again later.",
                )
            data = resp.json()

        checkout_url = data.get("url")
        checkout_id = data.get("id")

        if not checkout_url or not checkout_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Billing service is temporarily unavailable. Please try again later.",
            )

        return CheckoutResponse(
            checkout_url=checkout_url,
            checkout_id=checkout_id,
        )

    except HTTPException:
        raise
    except Exception as err:
        import logging
        logging.getLogger("app.billing").error(f"Failed to create checkout session: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Billing service is temporarily unavailable. Please try again later.",
        )
