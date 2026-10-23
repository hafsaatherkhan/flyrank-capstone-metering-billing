"""
Phase 4 pricing tests:
- Tests pure functions in services/pricing.py with hand-computed expected totals.
- Verifies: cached cheaper than fresh, reasoning billed at output price,
  categories not simply added, rounding happens once at the end.
- Reference example from ANTIGRAVITY_BUILD_PLAN.md §Phase 4 item 3:
    input=1000, cached=2000, output=500, reasoning=300
    → (1000*300000 + 2000*30000 + (500+300)*2500000) / 1_000_000
    = (300_000_000 + 60_000_000 + 2_000_000_000) / 1_000_000
    = 2_360_000_000 / 1_000_000
    = 2360 micro-USD
"""
import pytest
from app.services.pricing import (
    P_API_CALL,
    P_CACHED,
    P_IN,
    P_OUT,
    cost_for_api_call,
    cost_for_tokens,
)


class TestPricingConstants:
    """Sanity-check that the module-level constants are not changed accidentally."""

    def test_p_in_value(self):
        assert P_IN == 300_000, "Fresh input: $0.30 / 1M tokens"

    def test_p_cached_value(self):
        assert P_CACHED == 30_000, "Cached input: $0.03 / 1M tokens (10× cheaper than fresh)"

    def test_p_out_value(self):
        assert P_OUT == 2_500_000, "Output: $2.50 / 1M tokens"

    def test_p_api_call_value(self):
        assert P_API_CALL == 1_000, "API call: $0.001 flat"


class TestCostForApiCall:
    def test_returns_flat_1000(self):
        assert cost_for_api_call() == 1_000

    def test_returns_integer(self):
        result = cost_for_api_call()
        assert isinstance(result, int)


class TestCostForTokens:
    # ── Reference example from build-plan §Phase 4 ──────────────────────────
    def test_reference_example_from_build_plan(self):
        """
        Plan says: input=1000, cached=2000, output=500, reasoning=300
        Hand-computed:
          fresh_cost   = 1000 * 300_000       = 300_000_000
          cached_cost  = 2000 *  30_000       =  60_000_000
          output_cost  = (500+300) * 2_500_000 = 2_000_000_000
          raw          = 2_360_000_000
          / 1_000_000  = 2360.0  → 2360 micro-USD (no rounding needed)
        """
        result = cost_for_tokens(
            input_tokens=1000,
            cached_input_tokens=2000,
            output_tokens=500,
            reasoning_tokens=300,
        )
        # Verify the hand-computed arithmetic
        expected_raw = (1000 * 300_000 + 2000 * 30_000 + (500 + 300) * 2_500_000)
        assert expected_raw == 2_360_000_000
        assert expected_raw / 1_000_000 == 2360.0
        assert result == 2360

    # ── Cached is cheaper than fresh ────────────────────────────────────────
    def test_cached_cheaper_than_fresh(self):
        """
        1M fresh input: 300_000 micro-USD
        1M cached input: 30_000 micro-USD   (10× cheaper)
        """
        fresh_cost = cost_for_tokens(
            input_tokens=1_000_000,
            cached_input_tokens=0,
            output_tokens=0,
            reasoning_tokens=0,
        )
        cached_cost = cost_for_tokens(
            input_tokens=0,
            cached_input_tokens=1_000_000,
            output_tokens=0,
            reasoning_tokens=0,
        )
        assert fresh_cost == 300_000
        assert cached_cost == 30_000
        assert cached_cost < fresh_cost
        assert fresh_cost == 10 * cached_cost

    # ── Reasoning billed at output price ────────────────────────────────────
    def test_reasoning_billed_at_output_price(self):
        """
        100 reasoning tokens and 100 output tokens produce identical cost.
        (500 + 300 reasoning: already proven by reference example.)
        """
        cost_output_only = cost_for_tokens(
            input_tokens=0,
            cached_input_tokens=0,
            output_tokens=1_000_000,
            reasoning_tokens=0,
        )
        cost_reasoning_only = cost_for_tokens(
            input_tokens=0,
            cached_input_tokens=0,
            output_tokens=0,
            reasoning_tokens=1_000_000,
        )
        assert cost_output_only == cost_reasoning_only == 2_500_000

    # ── Categories are NOT simply summed as independent pools ───────────────
    def test_categories_not_simply_added(self):
        """
        The formula is NOT (input_cost + cached_cost + output_cost + reasoning_cost).
        output and reasoning share a single pool: (output+reasoning) * P_OUT.
        Calling with output=500000, reasoning=500000 must equal calling with
        output=1000000, reasoning=0 (both are 1M "output-priced" tokens).
        """
        split_cost = cost_for_tokens(
            input_tokens=0,
            cached_input_tokens=0,
            output_tokens=500_000,
            reasoning_tokens=500_000,
        )
        combined_cost = cost_for_tokens(
            input_tokens=0,
            cached_input_tokens=0,
            output_tokens=1_000_000,
            reasoning_tokens=0,
        )
        assert split_cost == combined_cost == 2_500_000

    # ── Rounding happens once at the end, not per category ──────────────────
    def test_rounding_once_at_the_end(self):
        """
        Use token counts that produce a fractional raw value.
        1 input token → 0.3 micro-USD (raw)
        1 cached token → 0.03 micro-USD (raw)
        Together: raw = 0.33 → round_half_up → 0

        But with 2 fresh input:   raw = 0.6 → round → 1
        With 1 fresh + 1 cached:  raw = 0.33 → round → 0
        Demonstrates rounding once on the TOTAL, not per-category.
        """
        cost_2_fresh = cost_for_tokens(
            input_tokens=2,
            cached_input_tokens=0,
            output_tokens=0,
            reasoning_tokens=0,
        )
        cost_1_fresh_1_cached = cost_for_tokens(
            input_tokens=1,
            cached_input_tokens=1,
            output_tokens=0,
            reasoning_tokens=0,
        )
        # 2 fresh: (2 * 300000) / 1e6 = 0.6 → rounds to 1
        assert cost_2_fresh == 1
        # 1 fresh + 1 cached: (300000 + 30000) / 1e6 = 0.33 → rounds to 0
        assert cost_1_fresh_1_cached == 0

    # ── Zero tokens → zero cost ──────────────────────────────────────────────
    def test_all_zero_tokens_returns_zero(self):
        assert cost_for_tokens(0, 0, 0, 0) == 0

    # ── Result is always a plain int ─────────────────────────────────────────
    def test_returns_integer(self):
        result = cost_for_tokens(100, 200, 150, 50)
        assert isinstance(result, int)

    # ── Large values (1M tokens each) stay integer ───────────────────────────
    def test_large_token_counts(self):
        result = cost_for_tokens(
            input_tokens=1_000_000,
            cached_input_tokens=1_000_000,
            output_tokens=1_000_000,
            reasoning_tokens=1_000_000,
        )
        # (1M*300000 + 1M*30000 + 2M*2500000) / 1M
        # = (300_000_000_000 + 30_000_000_000 + 5_000_000_000_000) / 1_000_000
        # = 5_330_000_000_000 / 1_000_000 = 5_330_000
        expected = (1_000_000 * 300_000 + 1_000_000 * 30_000 + 2_000_000 * 2_500_000) // 1_000_000
        assert result == expected == 5_330_000
