import { createState, createNetwork, openai } from "@inngest/agent-kit";
import { inngest } from "../client";
import { NetworkState } from "./deep-research";
import { selfDiscoverPrompting } from "./deep-research/prompting";
import { reasoningModules } from "./deep-research/reasoning-modules";
import { stagingAgent } from "./deep-research/staging-agent";

/**
 * Test function for v2 Phase 1: Self-discover prompting
 *
 * This function initializes a minimal network and tests the
 * selfDiscoverPrompting function with real inputs.
 */
export const testSelfDiscoverPromptingFunction = inngest.createFunction(
  {
    id: "v2-test-self-discover-prompting",
  },
  {
    event: "v2-test/self-discover-prompting",
  },
  async ({ step, event }) => {
    const { topic, context, uuid } = event.data;

    console.log(`=== TESTING SELF-DISCOVER PROMPTING ===`);
    console.log(`Topic: ${topic}`);
    console.log(`Context: ${context || "None provided"}`);

    // Create a minimal network with just the state structure
    const testNetwork = createNetwork<NetworkState>({
      name: "Test Network",
      agents: [],
      maxIter: 1,
      defaultModel: openai({ model: "gpt-4o" }),
      router: async () => undefined, // No routing needed for the test
      defaultState: createState<NetworkState>({
        topic,
        context: context || null,
        maxDepth: 3,
        maxBreadth: 3,
        reasoningStages: [],
        stagingComplete: false,
        currentStageIndex: 0,
        networkComplete: false,
        "session-uuid": uuid,
      }),
    });

    // Run the self-discover prompting function directly
    try {
      const result = await selfDiscoverPrompting({
        reasoningModules,
        context: topic, // Use the topic as the context for the prompting
        numToSelect: 3, // Select 3 questions for the test
        step,
      });

      console.log("=== SELF-DISCOVER PROMPTING RESULTS ===");
      console.log("Selected questions:");
      result.selectedQuestions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q}`);
      });

      console.log("\nAdapted questions:");
      result.adaptedQuestions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q}`);
      });

      console.log("\nAnswers (truncated):");
      result.answers.forEach((a, i) => {
        const truncated = a.length > 100 ? a.substring(0, 100) + "..." : a;
        console.log(`  ${i + 1}. ${truncated}`);
      });

      return {
        success: true,
        selectedQuestions: result.selectedQuestions,
        adaptedQuestions: result.adaptedQuestions,
        answers: result.answers,
      };
    } catch (error) {
      console.error("=== ERROR TESTING SELF-DISCOVER PROMPTING ===");
      console.error(error);

      return {
        success: false,
        error: String(error),
      };
    }
  }
);

/**
 * Test function for v2 Phase 2: StagingAgent
 *
 * This function creates a network with the StagingAgent and tests
 * its ability to generate reasoning stages.
 */
export const testStagingAgentFunction = inngest.createFunction(
  {
    id: "v2-test-staging-agent",
  },
  {
    event: "v2-test/staging-agent",
  },
  async ({ step, event, publish }) => {
    const { topic, context, uuid } = event.data;

    console.log(`=== TESTING STAGING AGENT ===`);
    console.log(`Topic: ${topic}`);
    console.log(`Context: ${context || "None provided"}`);

    // Create a test network with the StagingAgent
    const testNetwork = createNetwork<NetworkState>({
      name: "Staging Agent Test Network",
      agents: [stagingAgent],
      maxIter: 3, // Allow a few iterations for the agent to complete its work
      defaultModel: openai({ model: "gpt-4o" }),
      router: async ({ network }) => {
        const state = network.state.data;
        console.log("TEST ROUTER - Current state:", {
          stagingComplete: state.stagingComplete,
          stageCount: state.reasoningStages?.length || 0,
        });

        // If staging is complete or we already have stages, we're done
        if (
          state.stagingComplete ||
          (state.reasoningStages && state.reasoningStages.length > 0)
        ) {
          console.log("TEST ROUTER - Staging complete, stopping");
          state.stagingComplete = true;
          state.networkComplete = true;
          return undefined;
        }

        // Otherwise, route to StagingAgent
        console.log("TEST ROUTER - Routing to StagingAgent");
        return stagingAgent;
      },
      defaultState: createState<NetworkState>({
        topic,
        context: context || null,
        maxDepth: 3,
        maxBreadth: 3,
        reasoningStages: [],
        stagingComplete: false,
        currentStageIndex: 0,
        networkComplete: false,
        "session-uuid": uuid,
      }),
    });

    // Run the test network
    try {
      const state = createState<NetworkState>({
        topic,
        context: context || null,
        maxDepth: 3,
        maxBreadth: 3,
        reasoningStages: [],
        stagingComplete: false,
        currentStageIndex: 0,
        networkComplete: false,
        "session-uuid": uuid,
      });

      // Run the network
      const response = await testNetwork.run(topic, { state });

      // Check the results
      const finalState = response.state.data;
      const stages = finalState.reasoningStages || [];

      console.log("=== STAGING AGENT TEST RESULTS ===");
      console.log(`Generated ${stages.length} reasoning stages:`);

      stages.forEach((stage, i) => {
        console.log(`Stage ${i + 1}: ${stage.name}`);
        console.log(`  Description: ${stage.description}`);
      });

      // Publish an event with the results
      if (uuid) {
        await publish({
          channel: `v2-test.${uuid}`,
          topic: "staging-agent-results",
          data: {
            success: true,
            stageCount: stages.length,
            stages: stages.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
            })),
          },
        });
      }

      return {
        success: true,
        stageCount: stages.length,
        stages: stages.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })),
      };
    } catch (error) {
      console.error("=== ERROR TESTING STAGING AGENT ===");
      console.error(error);

      // Publish an error event
      if (uuid) {
        await publish({
          channel: `v2-test.${uuid}`,
          topic: "staging-agent-results",
          data: {
            success: false,
            error: String(error),
          },
        });
      }

      return {
        success: false,
        error: String(error),
      };
    }
  }
);
