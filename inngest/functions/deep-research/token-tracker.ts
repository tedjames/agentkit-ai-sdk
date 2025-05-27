import {
  NetworkState,
  TokenUsageEntry,
  StageTokenUsage,
  TotalTokenUsage,
} from "../deep-research";

/**
 * OpenAI Pricing Configuration (as of Dec 2024)
 * Prices are in USD per 1M tokens
 * Can be easily updated when OpenAI changes pricing
 */
export const OPENAI_PRICING = {
  "gpt-4o": {
    input: 2.5, // $2.50 per 1M input tokens
    output: 10.0, // $10.00 per 1M output tokens
  },
  "gpt-4o-mini": {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.6, // $0.60 per 1M output tokens
  },
  "gpt-4-turbo": {
    input: 10.0,
    output: 30.0,
  },
  "gpt-4": {
    input: 30.0,
    output: 60.0,
  },
  "gpt-3.5-turbo": {
    input: 0.5,
    output: 1.5,
  },
  o1: {
    input: 15.0,
    output: 60.0,
    reasoning: 60.0, // Same as output for o1
  },
  "o1-mini": {
    input: 3.0,
    output: 12.0,
    reasoning: 12.0,
  },
  "o3-mini": {
    input: 1.1,
    output: 4.4,
    reasoning: 4.4,
  },
} as const;

type ModelPricing = typeof OPENAI_PRICING;
type ModelName = keyof ModelPricing;

/**
 * Calculate cost for token usage
 */
export function calculateTokenCost(
  model: string,
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
  }
): {
  promptCost: number;
  completionCost: number;
  reasoningCost?: number;
  totalCost: number;
} {
  // Extract base model name (handle fine-tuned models)
  const baseModel = model.split("-ft-")[0] as ModelName;
  const pricing = OPENAI_PRICING[baseModel] || OPENAI_PRICING["gpt-4o"]; // Default to gpt-4o pricing

  const promptTokens = usage.promptTokens || 0;
  const completionTokens = usage.completionTokens || 0;
  const reasoningTokens = usage.reasoningTokens || 0;

  // Calculate costs (convert from per 1M to actual cost)
  const promptCost = (promptTokens / 1_000_000) * pricing.input;
  const completionCost = (completionTokens / 1_000_000) * pricing.output;
  const reasoningCost =
    reasoningTokens > 0 && "reasoning" in pricing
      ? (reasoningTokens / 1_000_000) * pricing.reasoning!
      : undefined;

  const totalCost = promptCost + completionCost + (reasoningCost || 0);

  return {
    promptCost,
    completionCost,
    reasoningCost,
    totalCost,
  };
}

/**
 * Initialize token tracking in network state
 */
export function initializeTokenTracking(state: NetworkState): void {
  if (!state.tokenUsage) {
    state.tokenUsage = {
      auditTrail: [],
      byStage: new Map(),
      total: {
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        cost: {
          promptCost: 0,
          completionCost: 0,
          totalCost: 0,
        },
        inferenceCount: 0,
      },
    };
  }
}

/**
 * Track token usage from AI SDK response
 */
export function trackTokenUsage(
  state: NetworkState,
  {
    agent,
    operation,
    model,
    usage,
    metadata,
  }: {
    agent: string;
    operation: string;
    model: string;
    usage: any; // AI SDK usage object
    metadata?: Record<string, any>;
  }
): TokenUsageEntry | null {
  // Initialize if needed
  initializeTokenTracking(state);

  // Extract usage data from AI SDK response
  const tokenUsage = {
    promptTokens: usage?.promptTokens || 0,
    completionTokens: usage?.completionTokens || 0,
    totalTokens: usage?.totalTokens || 0,
    reasoningTokens: usage?.reasoningTokens || 0,
  };

  // Skip if no tokens were used
  if (tokenUsage.totalTokens === 0) {
    return null;
  }

  // Calculate costs
  const cost = calculateTokenCost(model, tokenUsage);

  // Create audit entry
  const entry: TokenUsageEntry = {
    id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    agent,
    operation,
    model,
    usage: tokenUsage,
    cost,
    metadata,
  };

  // Add to audit trail
  state.tokenUsage!.auditTrail.push(entry);

  // Update stage aggregation
  const currentStageIndex = state.currentStageIndex || 0;
  const currentStage = state.reasoningStages?.[currentStageIndex];

  if (currentStage) {
    let stageUsage = state.tokenUsage!.byStage.get(currentStageIndex);

    if (!stageUsage) {
      stageUsage = {
        stageId: currentStageIndex,
        stageName: currentStage.name,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        cost: {
          promptCost: 0,
          completionCost: 0,
          totalCost: 0,
        },
        inferenceCount: 0,
      };
      state.tokenUsage!.byStage.set(currentStageIndex, stageUsage);
    }

    // Update stage totals
    stageUsage.usage.promptTokens += tokenUsage.promptTokens;
    stageUsage.usage.completionTokens += tokenUsage.completionTokens;
    stageUsage.usage.totalTokens += tokenUsage.totalTokens;
    if (tokenUsage.reasoningTokens) {
      stageUsage.usage.reasoningTokens =
        (stageUsage.usage.reasoningTokens || 0) + tokenUsage.reasoningTokens;
    }

    stageUsage.cost.promptCost += cost.promptCost;
    stageUsage.cost.completionCost += cost.completionCost;
    stageUsage.cost.totalCost += cost.totalCost;
    if (cost.reasoningCost) {
      stageUsage.cost.reasoningCost =
        (stageUsage.cost.reasoningCost || 0) + cost.reasoningCost;
    }

    stageUsage.inferenceCount += 1;
  }

  // Update total aggregation
  const total = state.tokenUsage!.total;
  total.usage.promptTokens += tokenUsage.promptTokens;
  total.usage.completionTokens += tokenUsage.completionTokens;
  total.usage.totalTokens += tokenUsage.totalTokens;
  if (tokenUsage.reasoningTokens) {
    total.usage.reasoningTokens =
      (total.usage.reasoningTokens || 0) + tokenUsage.reasoningTokens;
  }

  total.cost.promptCost += cost.promptCost;
  total.cost.completionCost += cost.completionCost;
  total.cost.totalCost += cost.totalCost;
  if (cost.reasoningCost) {
    total.cost.reasoningCost =
      (total.cost.reasoningCost || 0) + cost.reasoningCost;
  }

  total.inferenceCount += 1;

  return entry;
}

/**
 * Get token usage summary for a specific stage
 */
export function getStageTokenUsage(
  state: NetworkState,
  stageIndex: number
): StageTokenUsage | null {
  return state.tokenUsage?.byStage.get(stageIndex) || null;
}

/**
 * Get total token usage across all stages
 */
export function getTotalTokenUsage(
  state: NetworkState
): TotalTokenUsage | null {
  return state.tokenUsage?.total || null;
}

/**
 * Format token count for display (with K suffix for thousands)
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Format cost for display (USD with 2 decimal places)
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}
