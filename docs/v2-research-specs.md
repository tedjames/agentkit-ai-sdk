# AgentKit v2 Research Network Specifications

## Overview

The v2 Research Network aims to create a sophisticated AI-powered research system that uses multi-stage reasoning to deeply explore topics. The system implements a tree-based approach to reasoning inspired by techniques like Monte Carlo Tree Search (MCTS) and beam search, with the following key innovations:

- **Multi-stage reasoning** - Research proceeds through several distinct reasoning stages, each building upon previous ones
- **Self-discover prompting** - Uses a library of reasoning modules (questions) to guide exploration
- **Reasoning trees** - Creates tree structures of queries, findings, and reflections with configurable depth and breadth
- **Real-time web search** - Uses Exa API to gather up-to-date information from the web
- **Progressive refinement** - Each level of the tree builds on parent node reflections for deeper insights
- **Comparative analysis** - Later stages analyze and build upon the findings of earlier stages

## Research Flow

1. **Initial Queries (Depth 0)**:

   - Using self-discover prompting to generate 5 diverse root queries
   - Each query is sent to Exa API for real-time web search
   - Findings are summarized and given relevance scores
   - Reflections synthesize insights from each set of findings

2. **Follow-up Queries (Depth 1+)**:

   - For each parent node, generate 2 specific follow-up queries
   - Parent node reflections are included in the context
   - Each child query is sent to Exa API for targeted research
   - New findings are integrated with parent insights
   - Reflections build progressively deeper understanding

3. **Stage Analysis**:
   - After completing a reasoning tree, comprehensive analysis is generated
   - Insights are extracted from the most valuable nodes
   - Comparisons are made with previous stage analyses
   - Final synthesis spans all stages for complete understanding

## Web Search Integration

The system uses Exa API for real-time web search:

```
// Search with Exa and get text contents
const searchResults = await exa.searchAndContents(searchQuery, {
  text: true,
  numResults: 5,
  highlightMatches: true,
});
```

For each search result:

1. Content is processed and summarized if too long
2. Relevance scores are assigned (0-1)
3. Findings are formatted for reflection
4. If Exa returns no results, fallback findings are generated

## Tree Depth and Inference

Each depth in the reasoning tree performs specific operations:

- **Depth 0**: 5 root queries with self-discover prompting, Exa searches, and reflections
- **Depth 1+**: 2 follow-up queries per parent, with parent reflections in context

## Research Tree Architecture

Each research session consists of multiple reasoning stages, with each stage containing a reasoning tree:

```
Research Session
└── Reasoning Stage 1
    └── Reasoning Tree
        ├── Root Query 1 (depth=0) ┐
        │   ├── Findings          │
        │   │   └── [Search Results] │ 5 nodes at depth 0
        │   ├── Reflection         │
        │   └── Child Queries (depth=1) ┘
        │       ├── Child Query 1.1 ┐
        │       │   ├── Findings   │
        │       │   ├── Reflection  │ 2 nodes per parent at depth 1+
        │       │   └── Child Queries (depth=2) ┘
        │       └── Child Query 1.2
        │           └── ...
        └── Root Query 2 (depth=0)
            └── ...
└── Reasoning Stage 2
    └── ...
```

The tree is constructed with the following parameters:

- **maxDepth**: Maximum depth of the tree (e.g., 3 levels of queries)
- **maxBreadth**: Controls the initial breadth at depth 0 (currently 5 root queries)
- **childBreadth**: Fixed at 2 for all deeper levels (depth > 0)

## Self-Discover Prompting

The "self-discover prompting" strategy enhances exploration by:

1. Selecting a subset of questions from a pool of reasoning modules
2. Adapting those questions to the specific research context
3. Answering the adapted questions to generate new insights

This approach helps guide exploration by leveraging different cognitive frameworks and reasoning approaches.

## Core Data Structures

```typescript
interface NetworkState {
  // Core research inputs
  topic?: string;
  context?: string | null;

  // Configuration
  maxDepth: number; // How deep reasoning trees go
  maxBreadth: number; // How wide reasoning trees branch

  // Reasoning stage tracking
  reasoningStages: ReasoningStage[];
  stagingComplete: boolean;
  currentStageIndex: number;

  // Output data
  finalAnalysis?: string;
  networkComplete?: boolean;
  "session-uuid"?: string;

  // Legacy v1 support
  queryItems?: QueryItem[];
  queriesComplete?: boolean;
  researchComplete?: boolean;
  analysisComplete?: boolean;
  analysis?: string;
  completed?: boolean;
  messages?: Array<{
    type: string;
    role: string;
    content: string;
  }>;

  // Flag to use v2 research flow
  useV2?: boolean;
}

interface ReasoningStage {
  id: number;
  name: string;
  description: string;
  reasoningTree?: ReasoningTree;
  reasoningComplete: boolean;
  analysisComplete: boolean;
  analysis?: string;
}

interface ReasoningTree {
  nodes: ReasoningNode[];
}

interface ReasoningNode {
  id: string;
  parentId: string | null;
  depth: number;
  query: string;
  reasoning: string;
  findings: Finding[];
  reflection?: string;
  relevanceScore?: number;
  children: string[]; // Array of child node IDs
}

interface Finding {
  source: string;
  content: string;
  relevanceScore?: number;
}
```

## Agent Roles and Workflow

1. **StagingAgent**: Creates reasoning stages

   - Uses self-discover prompting to select and adapt reasoning stages
   - Stages should build on each other in a logical progression
   - Sets stagingComplete to true

2. **ReasoningAgent**: Creates reasoning trees for each stage

   - Generates initial breadth-worth of queries with reasoning
   - For each query, gathers findings via search
   - Generates reflections and relevance scores for findings
   - Recursively generates additional queries up to maxDepth
   - Operates in a breadth-first manner within each stage
   - Sets reasoningComplete to true when maxDepth is reached

3. **AnalysisAgent**: Analyzes reasoning trees for insights

   - For stages after the first, compares with previous stage analyses
   - Uses self-discover prompting to generate analytical questions
   - Answers questions in parallel using structured generation
   - Creates outlines and section content for comprehensive reports
   - Generates findings, conclusions, and introductions
   - Sets analysisComplete to true when complete

4. **Router**: Orchestrates the workflow
   - Determines which agent to invoke based on state
   - Manages progression through stages
   - Publishes events for UI updates

## Development Plan

> **Important Note**: Each phase requires updates to the router and agent network configuration to enable testing at the network level. We cannot test agents in isolation, so each phase must build a testable network.

### Phase 1: Foundation - Self-Discover Prompting & Initial Network Setup

**Goal**: Implement the self-discover prompting mechanism and set up the basic network infrastructure.

#### Todos:

- [x] Create a library of reasoning modules (questions) in a separate configuration file
- [x] Implement `selfDiscoverPrompting` function with the following signature:
  ```typescript
  async function selfDiscoverPrompting({
    reasoningModules: string[],
    context: string,
    numToSelect: number,
    model: Model
  }): Promise<{
    selectedQuestions: string[],
    adaptedQuestions: string[],
    answers: string[]
  }>
  ```
- [x] Update the NetworkState interface and default state initialization
- [x] Create a minimal router that can be extended in future phases
- [x] Set up a basic network with no agents yet but with proper state structure

**Testing**: Create a test function that initializes the network and calls selfDiscoverPrompting directly to verify it works.

**Status**: Complete ✅ - Implemented in `inngest/functions/deep-research/prompting.ts`, `inngest/functions/deep-research/reasoning-modules.ts`, and tested with `inngest/functions/deep-research/v2-test.ts`.

### Phase 2: StagingAgent Implementation

**Goal**: Create the StagingAgent that will define the reasoning stages for a given research topic.

#### Todos:

- [x] Create the stagingTool implementation:
  ```typescript
  export const stagingTool = createTool({
    name: "create_reasoning_stages",
    description: "Create a sequence of reasoning stages for deep research",
    handler: async ({}, { network, step }) => {
      // Implementation here
    },
  });
  ```
- [x] Implement the StagingAgent using the createAgent function
- [x] Write the system prompt for the StagingAgent
- [x] Update the router to direct to the StagingAgent when stagingComplete is false
- [x] Update the network configuration to include the StagingAgent
- [x] Ensure proper state updates (setting stagingComplete to true)

**Testing**: Test the complete network with just the StagingAgent by providing a research topic and verifying it creates appropriate reasoning stages.

**Status**: Complete ✅ - Implemented in `inngest/functions/deep-research/staging-agent.ts` and tested with `inngest/functions/deep-research/v2-test.ts`.

### Phase 3: ReasoningAgent Foundation

**Goal**: Implement the core of the ReasoningAgent that builds reasoning trees.

#### Todos:

- [x] Create a simplified `buildReasoningTree` function
- [x] Implement initial query generation using self-discover prompting
- [x] Create reasoningTool that uses the function:
  ```typescript
  export const reasoningTool = createTool({
    name: "build_reasoning_tree",
    description: "Build a reasoning tree for the current stage",
    handler: async ({}, { network, step }) => {
      // Implementation here
    },
  });
  ```
- [x] Implement the ReasoningAgent with a basic system prompt
- [x] Update the router to direct to the ReasoningAgent after the StagingAgent completes
- [x] Update the network configuration to include the ReasoningAgent
- [x] Ensure proper state transitions between agents

**Testing**: Test the network flow from StagingAgent to ReasoningAgent, verifying the ReasoningAgent generates initial queries.

**Status**: Complete ✅ - Implemented in `inngest/functions/deep-research/reasoning-agent.ts` and integrated into main workflow with updated router.

### Phase 4: Complete ReasoningAgent

**Goal**: Extend the ReasoningAgent to build complete reasoning trees with proper depth and breadth.

#### Todos:

- [ ] Enhance the `buildReasoningTree` function to support recursive tree building
- [ ] Implement the search functionality to gather findings for each query using Exa
- [ ] Add reflection generation for findings
- [ ] Generate relevance scores for findings
- [ ] Implement efficient memory management for large trees
- [ ] Use parallel processing for batch operations where possible
- [ ] Update state to mark reasoningComplete when done
- [ ] Update the router to handle the completed reasoning state

**Testing**: Test the end-to-end flow with StagingAgent and an enhanced ReasoningAgent, verifying complete tree generation.

### Phase 5: Enhanced AnalysisAgent Implementation

**Goal**: Create an improved AnalysisAgent that uses self-discover prompting and can compare between stages.

#### Todos:

- [ ] Implement a new analysis tool that uses self-discover prompting:
  ```typescript
  export const analyzeReasoningTreeTool = createTool({
    name: "analyze_reasoning_tree",
    description:
      "Analyze a reasoning tree and generate insights using self-discover prompting",
    handler: async ({}, { network, step }) => {
      // Implementation here
    },
  });
  ```
- [ ] Create comparison logic to reference previous stage analyses
- [ ] Implement outline generation for comprehensive reports
- [ ] Add parallel answer generation for analytical questions
- [ ] Include final synthesis logic for overall conclusions
- [ ] Update the router to direct to the AnalysisAgent after reasoning is complete
- [ ] Ensure proper state transitions to and from the AnalysisAgent

**Testing**: Test the complete flow with StagingAgent → ReasoningAgent → AnalysisAgent, verifying analysis generation.

### Phase 6: Multi-Stage Workflow

**Goal**: Implement the ability to handle multiple reasoning stages in sequence.

#### Todos:

- [ ] Update the router to handle multiple reasoning stages
- [ ] Implement stage progression logic
- [ ] Add comparison logic in AnalysisAgent to reference previous stages
- [ ] Update the system prompts to account for multi-stage workflows
- [ ] Implement stage tracking and transition logic

**Testing**: Test a complete multi-stage research flow, ensuring proper transitions between stages and agents.

### Phase 7: Event Publishing and Progress Reporting

**Goal**: Add mechanisms to report progress to the client.

#### Todos:

- [ ] Implement event publishing for key progress points
- [ ] Add stage progress tracking
- [ ] Create meaningful progress messages
- [ ] Implement a consistent event structure for client consumption
- [ ] Add summary information to events for UI display

**Testing**: Test the system's ability to report progress at various points in the research flow.

### Phase 8: Tree Visualization Format

**Goal**: Create a standardized format for tree visualization on the client.

#### Todos:

- [ ] Design a serialized tree format optimized for client rendering
- [ ] Implement tree serialization in relevant events
- [ ] Add metadata to help client understand tree structure
- [ ] Create helper functions to transform internal tree to client format
- [ ] Ensure proper handling of large trees

**Testing**: Test the serialization of reasoning trees and verify they can be properly visualized.

### Phase 9: Performance Optimization

**Goal**: Optimize the system for performance and token efficiency.

#### Todos:

- [ ] Implement memory optimization for large reasoning trees
- [ ] Add caching mechanisms for repeated queries
- [ ] Optimize prompt templates to reduce token usage
- [ ] Implement parallel processing where possible
- [ ] Add performance metrics to track system efficiency

**Testing**: Test the system with complex research topics and measure performance improvements.

### Phase 10: Error Handling and Resilience

**Goal**: Make the system robust against errors and unexpected scenarios.

#### Todos:

- [ ] Add comprehensive error handling throughout the system
- [ ] Implement recovery mechanisms for failed searches or analyses
- [ ] Add detailed logging for debugging purposes
- [ ] Create fallback mechanisms for each agent
- [ ] Implement graceful degradation for various failure modes

**Testing**: Test the system's resilience by introducing various failure scenarios.

## Phase 11: Token Consumption Metrics & Optimization

**Goal**: Track tokens consumed during LLM calls and use this data to optimize performance and—optionally—bound tree generation by cost instead of depth/breadth alone.

#### Todos:

- [ ] Instrument every `step.ai.wrap` and `step.ai.infer` call to capture `usage.tokens` (or equivalent) from the response
- [ ] Aggregate token counts at the router level and store them in `NetworkState`
