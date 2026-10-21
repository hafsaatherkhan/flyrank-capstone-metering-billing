from pydantic import BaseModel, Field
from typing import Optional


class SimulatedUsage(BaseModel):
    input_tokens: int = Field(..., ge=0)
    cached_input_tokens: int = Field(..., ge=0)
    output_tokens: int = Field(..., ge=0)
    reasoning_tokens: int = Field(..., ge=0)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    simulated_usage: SimulatedUsage


class GenerateUsageSummary(BaseModel):
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    reasoning_tokens: int
    total_tokens: int
    api_call_cost_micro_usd: int
    token_cost_micro_usd: int


class CheckoutResponse(BaseModel):
    checkout_url: str
    checkout_id: str

