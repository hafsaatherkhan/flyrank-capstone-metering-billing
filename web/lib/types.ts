export interface TenantMe {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
}

export interface UsageQuota {
  used: number;
  limit: number;
}

export interface UsageCost {
  api_calls_micro_usd: number;
  tokens_micro_usd: number;
  total_micro_usd: number;
  total_usd_display: string;
}

export interface UsageSummary {
  period: string;
  plan: string;
  subscription_status: string;
  api_calls: UsageQuota;
  ai_tokens: UsageQuota;
  cost: UsageCost;
}

export interface TokenBreakdown {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

export interface UsageEventItem {
  id: string;
  usage_type: "api_call" | "ai_tokens";
  quantity: number;
  token_breakdown: TokenBreakdown;
  cost_micro_usd: number;
  cost_usd_display: string;
  idempotency_key: string;
  created_at: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  checkout_id: string;
}

export interface GenerateRequestPayload {
  prompt: string;
  simulated_usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
  };
}
