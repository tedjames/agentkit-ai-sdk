import { createAgent, createTool, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { generateObject } from "ai";
import { openai as vercelOpenAI } from "@ai-sdk/openai";
import {
  NetworkState,
  ReasoningStage,
  ReasoningNode,
  ReasoningTree,
} from "../deep-research";
import { selfDiscoverPrompting } from "./prompting";
import { reasoningModules } from "./reasoning-modules";

/**
 * Helper function to generate a unique ID for reasoning nodes
 */
function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * StagingTool
 *
 * This tool creates reasoning stages for a research topic using self-discover prompting.
 * It generates a sequence of stages where each stage builds upon previous stages.
 * It also generates the initial depth 0 nodes for each stage in a single call.
 */
export const stagingTool = createTool({
  name: "create_reasoning_stages",
  description: "Create a sequence of reasoning stages for deep research",
  handler: async ({}, { network, step }) => {
    if (!network) return { error: "Network state unavailable" };

    const state = network.state.data as NetworkState;
    const { topic, context, configuration } = state;

    if (!configuration) {
      return { error: "Configuration is required but not provided" };
    }

    const { stageCount, queriesPerStage } = configuration;

    console.log("=== STAGING TOOL START ===");
    console.log(`Topic: ${topic}`);
    console.log(`Configuration: ${JSON.stringify(configuration)}`);

    try {
      // Step 1: Use self-discover prompting to explore research approaches
      const exploreResult = await selfDiscoverPrompting({
        reasoningModules,
        context: topic ?? "Unknown topic",
        numToSelect: stageCount * queriesPerStage, // Scale questions based on configuration
        skipAnswering: true, // Skip the answering phase for efficiency
        step,
      });

      // Extract adapted questions from the self-discover prompting
      const adaptedQuestions = exploreResult.adaptedQuestions;

      // Step 2: Generate reasoning stages AND initial queries in a single call
      const result = await step?.ai.wrap(
        "generate-stages-and-queries",
        async () => {
          return await generateObject({
            model: vercelOpenAI("gpt-4o"),
            schema: z.object({
              stages: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .describe("A descriptive name for the reasoning stage"),
                    description: z
                      .string()
                      .describe(
                        "A detailed description explaining what this stage explores"
                      ),
                    initialQueries: z
                      .array(
                        z.object({
                          query: z
                            .string()
                            .describe(
                              "The specific research question to explore for this stage"
                            ),
                          reasoning: z
                            .string()
                            .describe(
                              "Detailed reasoning behind why this query is important for this stage"
                            ),
                        })
                      )
                      .length(queriesPerStage)
                      .describe(
                        `Exactly ${queriesPerStage} initial research queries for this stage`
                      ),
                  })
                )
                .length(stageCount)
                .describe(
                  `An array of exactly ${stageCount} reasoning stages, each building on the previous`
                ),
            }),
            prompt: `
            You are an expert academic researcher. Given the following topic and context, let's create a comprehensive outline for a research plan.

            Note that you will have the ability to fetch data on the web to help you with your research. So make sure that each depth 0 node in every stage
            is a specific question that can be researched such as to contribute to its own section of in the final multi-stage research report.
            
            TOPIC: ${topic}
            ${context ? `CONTEXT: ${context}` : ""}
            
            Here are some thought-provoking questions about the topic to guide your thinking:
            ${adaptedQuestions
              .map((question, i) => `QUESTION ${i + 1}: ${question}`)
              .join("\n\n")}
            
            Part 1: Design exactly ${stageCount} distinct reasoning stages that will guide a systematic exploration of this topic.
            Each stage should:
            1. Represent a unique perspective or analytical approach
            2. Build upon insights gathered research in a specific sequence of stages such as to eventually compile all findings into a single report.
            3. Cover a different aspect of the topic
            4. Progress from fundamental understanding to more advanced/specialized insights
            
            The stages should follow a logical progression where insights from earlier stages inform later ones.
            Be specific about what each stage explores and why it's important to the overall research.
            
            Part 2: For EACH stage, generate exactly ${queriesPerStage} specific research queries.
            Each query should:
            1. Be focused and relevant to that stage - not too broad or general
            2. Address a different aspect of the stage's exploration
            3. Be phrased as a concrete question that can be researched
            4. Include detailed reasoning explaining why this query is important for this stage
            
            The queries within each stage should collectively provide comprehensive coverage of the key aspects relevant to that stage.
          `,
          });
        }
      );

      // Convert the generated stages and queries into ReasoningStage objects with initialized reasoningTrees
      const reasoningStages: ReasoningStage[] = (
        result?.object?.stages || []
      ).map((stage, index) => {
        // Create the depth 0 nodes from the initialQueries
        const nodes: ReasoningNode[] = (stage.initialQueries || []).map((q) => {
          const nodeId = generateNodeId();
          return {
            id: nodeId,
            parentId: null, // Root nodes have no parent
            depth: 0,
            query: q.query,
            reasoning: q.reasoning,
            findings: [], // No findings yet
            children: [], // No children yet
          };
        });

        // Create the reasoning tree with the nodes
        const reasoningTree: ReasoningTree = {
          nodes,
        };

        return {
          id: index,
          name: stage.name,
          description: stage.description,
          reasoningTree,
          reasoningComplete: false,
          analysisComplete: false,
        };
      });

      // Update the network state
      network.state.data = {
        ...state,
        reasoningStages,
        stagingComplete: true,
        currentStageIndex: 0,
      };

      console.log(`=== STAGING TOOL COMPLETE ===`);
      console.log(`Generated ${reasoningStages.length} reasoning stages:`);
      reasoningStages.forEach((stage, i) => {
        console.log(`Stage ${i + 1}: ${stage.name}`);
        console.log(`  ${stage.description.substring(0, 100)}...`);
        console.log(
          `  Initial queries: ${stage.reasoningTree?.nodes.length || 0}`
        );
      });

      return {
        success: true,
        stageCount: reasoningStages.length,
        stageNames: reasoningStages.map((s) => s.name),
        initialNodesCount: reasoningStages.reduce(
          (sum, stage) => sum + (stage.reasoningTree?.nodes.length || 0),
          0
        ),
      };
    } catch (error) {
      console.error("=== STAGING TOOL ERROR ===");
      console.error(error);

      // Create fallback stages in case of error
      const fallbackStages: ReasoningStage[] = Array.from(
        { length: stageCount },
        (_, i) => ({
          id: i,
          name:
            i === 0
              ? "Initial Exploration"
              : i === stageCount - 1
              ? "Synthesis & Implications"
              : `Stage ${i + 1} Analysis`,
          description:
            i === 0
              ? `Fundamental understanding of ${topic}`
              : i === stageCount - 1
              ? `Synthesis of findings and exploration of implications for ${topic}`
              : `Critical examination of key aspects of ${topic}`,
          reasoningTree: { nodes: [] },
          reasoningComplete: false,
          analysisComplete: false,
        })
      );

      // Update the network state with fallback stages
      network.state.data = {
        ...state,
        reasoningStages: fallbackStages,
        stagingComplete: true,
        currentStageIndex: 0,
      };

      return {
        success: false,
        error: String(error),
        fallbackUsed: true,
        stageCount: fallbackStages.length,
      };
    }
  },
});

/**
 * StagingAgent
 *
 * This agent is responsible for creating reasoning stages for a research topic.
 * It uses the stagingTool to generate a sequence of stages where each stage builds upon previous stages.
 */
export const stagingAgent = createAgent<NetworkState>({
  name: "Staging Agent",
  description: "Creates reasoning stages for a research topic",
  system: `You are a research planning expert specialized in structuring complex investigations.
Your primary responsibility is to create a logical sequence of reasoning stages for exploring a research topic.

When invoked, you will:
1. Analyze the research topic and configuration provided in the network state
2. Create a series of distinct reasoning stages using the 'create_reasoning_stages' tool
3. Each stage should build upon insights from previous stages
4. Stages should progress from fundamental understanding to specialized insights
5. Each stage will include a configurable number of initial research queries (depth 0 nodes)

Your goal is to provide a structured framework that guides the subsequent research process.
The number of stages and queries per stage will be determined by the configuration settings.
Use the 'create_reasoning_stages' tool to generate and store these stages in the network state.`,
  model: openai({ model: "gpt-4o" }),
  tools: [stagingTool],
  lifecycle: {
    onStart: async ({ input, network, prompt, history }) => {
      console.log("=== STAGING AGENT START ===");

      if (network) {
        const state = network.state.data as NetworkState;
        console.log(
          `Topic: ${state.topic}, Context: ${state.context || "None"}`
        );
        console.log(`Configuration: ${JSON.stringify(state.configuration)}`);
      }

      return {
        prompt,
        history: history || [],
        stop: false,
      };
    },
    onFinish: async ({ result, network }) => {
      console.log("=== STAGING AGENT FINISH ===");

      if (network) {
        const state = network.state.data as NetworkState;
        // Ensure stagingComplete is set to true
        if (state.reasoningStages && state.reasoningStages.length > 0) {
          state.stagingComplete = true;
        }
      }

      return result;
    },
  },
});
