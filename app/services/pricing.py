"""
Pure integer pricing functions. All values in micro-USD.
Prices are per 1,000,000 tokens. No floats in money math.
Rounding: round_half_up once per event, at the end.
"""
from decimal import Decimal, ROUND_HALF_UP

# Micro-USD per 1,000,000 tokens
P_IN: int = 300_000        # fresh input tokens
P_CACHED: int = 30_000     # cached input tokens
P_OUT: int = 2_500_000     # output tokens (reasoning billed same)
P_API_CALL: int = 1_000    # per API call, flat


def _round_half_up(value: Decimal) -> int:
    return int(value.to_integral_value(rounding=ROUND_HALF_UP))


def cost_for_tokens(
    input_tokens: int,
    cached_input_tokens: int,
    output_tokens: int,
    reasoning_tokens: int,
) -> int:
    """
    Returns cost in micro-USD using integer-safe Decimal math.
    Formula: round_half_up(
        (input*P_IN + cached*P_CACHED + (output+reasoning)*P_OUT) / 1_000_000
    )
    Rounds once at the end — never per-category.
    """
    raw = (
        Decimal(input_tokens) * P_IN
        + Decimal(cached_input_tokens) * P_CACHED
        + Decimal(output_tokens + reasoning_tokens) * P_OUT
    ) / Decimal(1_000_000)
    return _round_half_up(raw)


def cost_for_api_call() -> int:
    """Returns cost of one API call in micro-USD (flat rate)."""
    return P_API_CALL
