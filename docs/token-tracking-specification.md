# Token Tracking Implementation Specification

## Overview

This document outlines the complete specification for implementing comprehensive token tracking across the deep research agent system. The feature will track all AI inference calls, calculate costs, and provide real-time usage data to the frontend.

## Requirements

### Core Functionality

- Track tokens for every `generateText` and `generateObject` call
- Store audit trail of all inference calls with metadata
- Calculate costs in real-time using configurable pricing
- Aggregate tokens at multiple levels (call, stage, total)
- Display usage data in the UI with detailed breakdowns
- Update token counts in real-time as inference completes

### User Experience

- Simple text counts displayed in UI (e.g., "15.2k tokens • $0.23")
- Detailed breakdown on hover (tooltip with token types)
- Stage-level token display in main content area
- Running totals prominently displayed
- Real-time updates as each inference completes

## Technical Architecture

### 1. Data Structures

#### NetworkState Extensions

```typescript
interface NetworkState {
  // ... existing fields ...

  tokenUsage?: {
    auditTrail: TokenAuditEntry[];
    stages: Map<number, StageTokenUsage>;
    total: TokenSummary;
  };
}

interface TokenAuditEntry {
  timestamp: string;
  agent: string;
  operation: string;
  model: string;
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens?: number;
    reasoningTokens?: number;
  };
  cost: number;
}

interface StageTokenUsage {
  stageId: number;
  stageName: string;
  auditTrail: TokenAuditEntry[];
  total: TokenSummary;
}

interface TokenSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens: number;
  reasoningTokens: number;
  cost: number;
}
```

#### Progress Event Extensions

```typescript
interface ProgressEvent {
  // ... existing fields ...

  tokenUsage?: {
    stage?: {
      stageId: number;
      stageName: string;
      total: TokenSummary;
    };
    total?: TokenSummary;
  } | null;
}
```

### 2. Token Tracking Utilities

#### Core Functions

```typescript
// token-tracking.ts

const OPENAI_PRICING = {
  "gpt-4o": {
    input: 0.0025, // per 1K tokens
    output: 0.01, // per 1K tokens
    cached: 0.00125, // per 1K cached tokens
  },
  "gpt-4o-mini": {
    input: 0.00015,
    output: 0.0006,
    cached: 0.000075,
  },
  o1: {
    input: 0.015,
    output: 0.06,
    reasoning: 0.06,
  },
  "o3-mini": {
    input: 0.025,
    output: 0.1,
    reasoning: 0.1,
  },
};

export function captureTokenUsage(
  result: any,
  agent: string,
  operation: string,
  model: string
): TokenAuditEntry | null;

export function updateTokenUsage(
  state: NetworkState,
  entry: TokenAuditEntry
): void;
```

### 3. Integration Points

#### Agent Integration Pattern

For each `generateText` and `generateObject` call:

```typescript
// Example integration in reasoning-agent.ts
const analysisResult = await step?.ai.wrap(
  "analyze-search-result",
  async () => {
    const result = await generateText({
      model: vercelOpenAI("gpt-4o"),
      prompt: `...`,
    });

    // Capture token usage after the call
    const tokenEntry = captureTokenUsage(
      result,
      "ReasoningAgent",
      "analyze-search-result",
      "gpt-4o"
    );

    if (tokenEntry && network) {
      updateTokenUsage(network.state.data, tokenEntry);
    }

    return result;
  }
);
```

#### Files Requiring Integration

- `inngest/functions/deep-research/reasoning-agent.ts` (multiple calls)
- `inngest/functions/deep-research/analysis-agent.ts` (multiple calls)
- `inngest/functions/deep-research/reporting-agent.ts` (multiple calls)
- `inngest/functions/deep-research/staging-agent.ts` (single call)
- `inngest/functions/deep-research/prompting.ts` (multiple calls)

### 4. Router Event Publishing

#### Event Publishing Pattern

```typescript
// In deep-research.ts router
if (state.tokenUsage) {
  const currentStageUsage = state.tokenUsage.stages.get(currentStageIndex);

  await publishProgressEvent({
    publish,
    uuid,
    message: `Token usage updated`,
    tokenUsage: {
      stage: currentStageUsage
        ? {
            stageId: currentStageUsage.stageId,
            stageName: currentStageUsage.stageName,
            total: currentStageUsage.total,
          }
        : undefined,
      total: state.tokenUsage.total,
    },
    // ... other fields
  });
}
```

### 5. Frontend Components

#### TokenUsageIndicator Component

```typescript
interface TokenUsageDisplay {
  tokens: number;
  cost: number;
  breakdown?: {
    promptTokens: number;
    completionTokens: number;
    cachedPromptTokens?: number;
    reasoningTokens?: number;
  };
}

function TokenUsageIndicator({ usage }: { usage: TokenUsageDisplay }) {
  // Simple display with detailed tooltip
}
```

#### Integration Points

- `DeepResearchCard.tsx` - Stage content area
- `DeepResearchChat.tsx` - Event processing and state management
- `DeepResearchStages.tsx` - Optional stage list display

## Implementation Plan

### Phase 1: Core Infrastructure

1. Create `token-tracking.ts` utility file
2. Update `NetworkState` interface in `deep-research.ts`
3. Update `ProgressEvent` interface
4. Create token capture and aggregation functions

### Phase 2: Agent Integration

1. Update all AI inference calls in agent files
2. Add token capture after each `generateText`/`generateObject`
3. Ensure proper error handling for missing usage data

### Phase 3: Router Integration

1. Update router in `deep-research.ts`
2. Publish token usage events after agent completions
3. Include both stage and total usage data

### Phase 4: Frontend Integration

1. Create `TokenUsageIndicator` component
2. Update `DeepResearchChat.tsx` to handle token events
3. Add token display to `DeepResearchCard.tsx`
4. Implement tooltip with detailed breakdown

### Phase 5: UI Polish

1. Format numbers with appropriate units (k, M)
2. Add proper currency formatting ($0.23)
3. Implement responsive design
4. Add loading states and error handling

## Configuration

### Pricing Configuration

```typescript
// Easily configurable pricing structure
const PRICING_CONFIG = {
  models: {
    "gpt-4o": { input: 0.0025, output: 0.01, cached: 0.00125 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006, cached: 0.000075 },
    // ... more models
  },
  currency: "USD",
  precision: 2, // decimal places for cost display
};
```

### Display Configuration

```typescript
const DISPLAY_CONFIG = {
  tokenFormat: {
    threshold: 1000, // when to use k/M notation
    precision: 1, // decimal places for formatted numbers
  },
  costFormat: {
    currency: "USD",
    precision: 2,
    showCents: true,
  },
};
```

## Data Flow

### 1. Token Capture Flow

```
AI Inference Call → Token Usage Extraction → Audit Entry Creation → State Update
```

### 2. Aggregation Flow

```
Individual Entry → Stage Aggregation → Total Aggregation → Event Publishing
```

### 3. Frontend Flow

```
Progress Event → State Update → Component Re-render → UI Display
```

## Error Handling

### Missing Token Data

- Gracefully handle AI SDK responses without usage data
- Log warnings for missing token information
- Continue operation without breaking the flow

### Cost Calculation Errors

- Fallback to default pricing if model not found
- Handle edge cases (negative tokens, missing fields)
- Provide meaningful error messages

### UI Error States

- Show "N/A" for unavailable token data
- Graceful degradation when token tracking fails
- Maintain functionality even without token data

## Testing Considerations

### Unit Tests

- Token capture function with various AI SDK responses
- Cost calculation with different models and token types
- Aggregation logic for stage and total calculations

### Integration Tests

- End-to-end token tracking through agent execution
- Event publishing and frontend state updates
- UI component rendering with various data states

### Performance Tests

- Impact of token tracking on inference call performance
- Memory usage with large audit trails
- Frontend rendering performance with frequent updates

## Security Considerations

### Data Privacy

- Token usage data contains no sensitive content
- Audit trail includes only metadata, not prompt/response content
- Safe to store and transmit usage statistics

### Cost Monitoring

- Implement alerts for unusual token usage patterns
- Consider rate limiting based on token consumption
- Monitor for potential cost overruns

## Future Enhancements

### Advanced Analytics

- Token usage trends over time
- Cost optimization recommendations
- Model performance comparisons

### Export Capabilities

- CSV export of audit trail
- Usage reports for billing/analysis
- Integration with external monitoring tools

### Real-time Monitoring

- Live dashboard for token consumption
- Alerts for high usage periods
- Budget tracking and limits

## Dependencies

### Required Packages

- No new dependencies required
- Uses existing AI SDK response structure
- Leverages current event system

### Version Compatibility

- Compatible with current Vercel AI SDK version
- Works with existing OpenAI pricing structure
- Future-proof for new models and pricing changes

## Rollout Strategy

### Development Phase

1. Implement core utilities and test thoroughly
2. Integrate with one agent first (staging-agent)
3. Gradually add to remaining agents
4. Add frontend components incrementally

### Testing Phase

1. Test with various models and token types
2. Verify cost calculations against OpenAI billing
3. Load test with high-frequency inference calls
4. UI testing across different browsers/devices

### Production Deployment

1. Deploy backend changes first
2. Monitor for any performance impact
3. Enable frontend components gradually
4. Full rollout after validation period

---

This specification provides a complete roadmap for implementing comprehensive token tracking across the deep research agent system. The implementation should be done incrementally, with thorough testing at each phase to ensure reliability and performance.
