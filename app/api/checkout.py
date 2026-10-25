"""
Checkout API route for creating Polar subscriptions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from polar.v2027_01 import Polar
from polar.base import PolarClientError

from app.api.deps import get_tenant
from app.config import settings
from app.db import get_db
from app.models import Tenant
from app.schemas import CheckoutResponse

router = APIRouter()


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    tenant: Tenant = Depends(get_tenant),
    db: Session = Depends(get_db),
):
    """
    Create a Polar checkout session for upgrading to the Pro plan.
    - Tenant must be authenticated via X-API-Key.
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
        # Use Polar SDK client targeting configured environment (e.g. sandbox or production)
        client = Polar(
            access_token=settings.polar_access_token,
            environment=settings.polar_server,
        )

        checkout_session = client.checkouts.create(
            products=[settings.polar_pro_product_id],
            external_customer_id=str(tenant.id),
            metadata={"tenant_id": str(tenant.id)},
            customer_metadata={"tenant_id": str(tenant.id)},
            success_url=f"{settings.app_base_url}/checkout/success",
        )

        return CheckoutResponse(
            checkout_url=checkout_session.url,
            checkout_id=checkout_session.id,
        )

    except PolarClientError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Polar API error: {err}",
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create checkout session: {err}",
        )
