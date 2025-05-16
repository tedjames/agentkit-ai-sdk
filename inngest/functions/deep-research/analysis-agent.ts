import { createAgent, createTool, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { generateObject, generateText } from "ai";
import { openai as vercelOpenAI } from "@ai-sdk/openai";
import { NetworkState, ReasoningStage, ReasoningNode } from "../deep-research";
import { selfDiscoverPrompting } from "./prompting";
import { stageComparisonModules } from "./reasoning-modules";

/**
 * Extract key insights from a reasoning tree with parallel processing
 */
async function extractTreeInsights({
  stage,
  topic,
  step,
}: {
  stage: ReasoningStage;
  topic: string;
  step?: any;
}): Promise<{ insights: string[]; nodeCount: number; findingsCount: number }> {
  if (
    !stage.reasoningTree ||
    !stage.reasoningTree.nodes ||
    stage.reasoningTree.nodes.length === 0
  ) {
    return { insights: [], nodeCount: 0, findingsCount: 0 };
  }

  const tree = stage.reasoningTree;
  const nodes = tree.nodes;

  // Get nodes with findings and reflections
  const nodesWithFindings = nodes.filter(
    (node) => node.findings && node.findings.length > 0 && node.reflection
  );

  // Total findings across all nodes
  const totalFindings = nodes.reduce(
    (sum, node) => sum + (node.findings?.length || 0),
    0
  );

  // Extract insights from the most valuable nodes
  // In a real implementation, we would sort by relevanceScore and select top nodes
  const insightNodes = nodesWithFindings.slice(
    0,
    Math.min(nodesWithFindings.length, 5)
  );

  if (insightNodes.length === 0) {
    return {
      insights: ["Insufficient data in reasoning tree to extract insights."],
      nodeCount: nodes.length,
      findingsCount: totalFindings,
    };
  }

  console.log(
    `Extracting insights from ${insightNodes.length} nodes in parallel`
  );

  // Generate insights for each selected node in parallel
  const insights = await Promise.all(
    insightNodes.map(async (node) => {
      const insightResult = await step?.ai.wrap(
        `extract-insight-${node.id.substring(0, 8)}`,
        async () => {
          return await generateObject({
            model: vercelOpenAI("gpt-4o"),
            schema: z.object({
              insight: z
                .string()
                .describe(
                  "A concise, insightful takeaway from this node's findings and reflection"
                ),
            }),
            prompt: `
            You are a research expert extracting key insights from research findings.
            
            TOPIC: ${topic}
            STAGE: ${stage.name}
            QUERY: ${node.query}
            
            FINDINGS:
            ${node.findings
              .map(
                (f, i) => `Finding ${i + 1}: ${f.content.substring(0, 200)}...`
              )
              .join("\n\n")}
            
            REFLECTION:
            ${node.reflection}
            
            Extract one concise, high-value insight from this data. Focus on unexpected patterns, contradictions, 
            or important connections that advance understanding of the topic. Your insight should be specific, 
            evidence-based, and directly relevant to the query.
          `,
          });
        }
      );

      return (
        insightResult?.object?.insight ||
        `Insight from query: "${node.query.substring(
          0,
          50
        )}..." - Insufficient data for insight generation.`
      );
    })
  );

  console.log(`Generated ${insights.length} insights in parallel`);

  return {
    insights,
    nodeCount: nodes.length,
    findingsCount: totalFindings,
  };
}

/**
 * Compare the current stage with previous stages using parallel processing
 */
async function compareWithPreviousStages({
  state,
  currentStageIndex,
  topic,
  step,
}: {
  state: NetworkState;
  currentStageIndex: number;
  topic: string;
  step?: any;
}): Promise<string[]> {
  // If this is the first stage, no comparison is possible
  if (currentStageIndex === 0 || !state.reasoningStages) {
    return [];
  }

  const currentStage = state.reasoningStages[currentStageIndex];
  const previousStages = state.reasoningStages.slice(0, currentStageIndex);

  // Filter to stages that have completed analyses
  const analyzedPrevStages = previousStages.filter(
    (stage) => stage.analysisComplete && stage.analysis
  );

  if (analyzedPrevStages.length === 0) {
    return ["No previous stages with completed analyses to compare with."];
  }

  // Use self-discover prompting with stageComparisonModules to generate comparison questions
  const comparisonContext = `
    TOPIC: ${topic}
    CURRENT STAGE: ${currentStage.name}
    CURRENT STAGE DESCRIPTION: ${currentStage.description}
    PREVIOUS STAGES: ${analyzedPrevStages.map((s) => s.name).join(", ")}
  `;

  const sdpResult = await selfDiscoverPrompting({
    reasoningModules: stageComparisonModules,
    context: comparisonContext,
    numToSelect: 3, // Select 3 comparison questions
    step,
  });

  console.log(
    `Generating ${sdpResult.adaptedQuestions.length} stage comparisons in parallel`
  );

  // Generate comparisons using the self-discovered questions in parallel
  const comparisons = await Promise.all(
    sdpResult.adaptedQuestions.map(async (question) => {
      const comparisonResult = await step?.ai.wrap(
        `stage-comparison-${question
          .substring(0, 20)
          .replace(/[^a-zA-Z0-9]/g, "-")}`,
        async () => {
          return await generateObject({
            model: vercelOpenAI("gpt-4o"),
            schema: z.object({
              comparison: z
                .string()
                .describe(
                  "A thoughtful comparison between the current and previous stages"
                ),
            }),
            prompt: `
            You are a research expert comparing findings across different research stages.
            
            TOPIC: ${topic}
            COMPARISON QUESTION: ${question}
            
            CURRENT STAGE: 
            Name: ${currentStage.name}
            Description: ${currentStage.description}
            ${
              currentStage.analysis
                ? `Analysis: ${currentStage.analysis.substring(0, 300)}...`
                : "No analysis yet."
            }
            
            PREVIOUS STAGES:
            ${analyzedPrevStages
              .map(
                (stage) => `
              Stage: ${stage.name}
              Description: ${stage.description}
              Analysis: ${
                stage.analysis
                  ? stage.analysis.substring(0, 300)
                  : "No analysis."
              }...
            `
              )
              .join("\n\n")}
            
            Please provide a thoughtful comparison that specifically addresses the comparison question.
            Focus on how insights have evolved, new perspectives gained, contradictions found, or gaps identified
            when comparing the current stage with previous stages.
          `,
          });
        }
      );

      return (
        comparisonResult?.object?.comparison ||
        `Comparison based on "${question}" - Unable to generate a detailed comparison.`
      );
    })
  );

  console.log(`Generated ${comparisons.length} stage comparisons in parallel`);

  return comparisons;
}

/**
 * Generate a structured analysis of a reasoning tree with parallel processing
 */
async function generateStructuredAnalysis({
  stage,
  insights,
  comparisons,
  topic,
  step,
}: {
  stage: ReasoningStage;
  insights: string[];
  comparisons: string[];
  topic: string;
  step?: any;
}): Promise<string> {
  // Generate an outline for the analysis
  const outlineResult = await step?.ai.wrap(
    "generate-analysis-outline",
    async () => {
      return await generateObject({
        model: vercelOpenAI("gpt-4o"),
        schema: z.object({
          outline: z
            .array(
              z.object({
                title: z.string().describe("Section title"),
                description: z
                  .string()
                  .describe("Brief description of this section's content"),
              })
            )
            .min(3)
            .max(6),
        }),
        prompt: `
        You are a research expert creating an outline for an analysis report.
        
        TOPIC: ${topic}
        STAGE: ${stage.name}
        STAGE DESCRIPTION: ${stage.description}
        
        KEY INSIGHTS:
        ${insights.map((insight, i) => `${i + 1}. ${insight}`).join("\n")}
        
        COMPARISONS WITH PREVIOUS STAGES:
        ${
          comparisons.length > 0
            ? comparisons
                .map(
                  (comp, i) =>
                    `Comparison ${i + 1}: ${comp.substring(0, 200)}...`
                )
                .join("\n\n")
            : "No comparisons with previous stages."
        }
        
        Create an outline for a structured analysis report with 3-6 sections.
        The outline should include a logical flow from introduction through key findings to implications.
        Each section should have a clear title and brief description of what it will cover.
        Make sure the outline addresses the main aspects of the stage and incorporates the key insights.
      `,
      });
    }
  );

  const outline = outlineResult?.object?.outline || [
    { title: "Introduction", description: "Overview of the research stage" },
    {
      title: "Key Findings",
      description: "Primary insights from the research",
    },
    { title: "Conclusion", description: "Summary and implications" },
  ];

  console.log(`Generating content for ${outline.length} sections in parallel`);

  // Generate content for each section in parallel
  const sectionContents = await Promise.all(
    outline.map(async (section: { title: string; description: string }) => {
      const sectionResult = await step?.ai.wrap(
        `generate-section-${section.title.replace(/\s+/g, "-").toLowerCase()}`,
        async () => {
          return await generateObject({
            model: vercelOpenAI("gpt-4o"),
            schema: z.object({
              content: z
                .string()
                .describe("The content for this section of the analysis"),
            }),
            prompt: `
            You are a research expert writing a section of an analysis report.
            
            TOPIC: ${topic}
            STAGE: ${stage.name}
            STAGE DESCRIPTION: ${stage.description}
            
            SECTION: ${section.title}
            SECTION DESCRIPTION: ${section.description}
            
            KEY INSIGHTS:
            ${insights.map((insight, i) => `${i + 1}. ${insight}`).join("\n")}
            
            COMPARISONS WITH PREVIOUS STAGES:
            ${
              comparisons.length > 0
                ? comparisons
                    .map(
                      (comp, i) =>
                        `Comparison ${i + 1}: ${comp.substring(0, 200)}...`
                    )
                    .join("\n\n")
                : "No comparisons with previous stages."
            }
            
            Write a detailed, insightful section for the analysis report based on the section title and description.
            Incorporate relevant insights and comparisons that fit this section's focus.
            The content should be substantive, evidence-based, and directly relevant to the research stage.
          `,
          });
        }
      );

      return {
        title: section.title,
        content:
          sectionResult?.object?.content ||
          `[Content generation failed for section: ${section.title}]`,
      };
    })
  );

  console.log(
    `Generated content for ${sectionContents.length} sections in parallel`
  );

  // Assemble the final analysis
  const analysis = `
# Analysis of ${stage.name}

${sectionContents
  .map(
    (section) => `
## ${section.title}

${section.content}
`
  )
  .join("\n")}

---
*This analysis was generated based on a reasoning tree with ${
    stage.reasoningTree?.nodes.length || 0
  } nodes 
exploring different aspects of "${topic}" during the "${stage.name}" stage.*
`;

  return analysis;
}

/**
 * AnalyzeReasoningTreeTool
 *
 * This tool analyzes a reasoning tree to generate insights and analysis.
 * It uses self-discover prompting and comparison logic for multi-stage analysis.
 */
export const analyzeReasoningTreeTool = createTool({
  name: "analyze_reasoning_tree",
  description: "Analyze the reasoning tree of the current stage",
  handler: async ({}, { network, step }) => {
    if (!network) return { error: "Network state unavailable" };

    const state = network.state.data as NetworkState;
    const {
      topic,
      context,
      reasoningStages = [],
      currentStageIndex = 0,
    } = state;

    console.log("=== ANALYZE REASONING TREE TOOL START ===");
    console.log(`Topic: ${topic}, CurrentStageIndex: ${currentStageIndex}`);

    // Check if we have stages to work with
    if (!reasoningStages || reasoningStages.length === 0) {
      return {
        error: "No reasoning stages found. StagingAgent should run first.",
      };
    }

    // Get the current stage
    const currentStage = reasoningStages[currentStageIndex];
    if (!currentStage) {
      return { error: `Invalid stage index: ${currentStageIndex}` };
    }

    // Check if reasoning is complete for this stage
    if (!currentStage.reasoningComplete) {
      return {
        error: `Reasoning for stage "${currentStage.name}" is not complete.`,
      };
    }

    try {
      console.log(`Analyzing reasoning tree for stage: ${currentStage.name}`);

      // Step 1: Extract insights from the reasoning tree
      console.log("Extracting insights from reasoning tree...");
      const { insights, nodeCount, findingsCount } = await extractTreeInsights({
        stage: currentStage,
        topic: topic || "Unknown topic",
        step,
      });

      console.log(
        `Extracted ${insights.length} insights from ${nodeCount} nodes with ${findingsCount} findings`
      );

      // Step 2: Compare with previous stages if not the first stage
      console.log("Comparing with previous stages...");
      const comparisons = await compareWithPreviousStages({
        state,
        currentStageIndex,
        topic: topic || "Unknown topic",
        step,
      });

      console.log(
        `Generated ${comparisons.length} comparisons with previous stages`
      );

      // Step 3: Generate structured analysis
      console.log("Generating structured analysis...");
      const analysis = await generateStructuredAnalysis({
        stage: currentStage,
        insights,
        comparisons,
        topic: topic || "Unknown topic",
        step,
      });

      console.log(`Generated analysis of ${analysis.length} characters`);

      // Update the current stage with the analysis
      currentStage.analysis = analysis;
      currentStage.analysisComplete = true;

      // Update the state
      network.state.data = {
        ...state,
        reasoningStages: [
          ...reasoningStages.slice(0, currentStageIndex),
          currentStage,
          ...reasoningStages.slice(currentStageIndex + 1),
        ],
      };

      return {
        success: true,
        message: `Generated analysis for stage "${currentStage.name}"`,
        analysisLength: analysis.length,
        insightsCount: insights.length,
        comparisonsCount: comparisons.length,
      };
    } catch (error) {
      console.error("=== ANALYZE REASONING TREE TOOL ERROR ===");
      console.error(error);

      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Generate a final synthesis of all stage analyses
 */
async function generateFinalSynthesis({
  stages,
  topic,
  step,
}: {
  stages: ReasoningStage[];
  topic: string;
  step?: any;
}): Promise<string> {
  // Get stages with completed analyses
  const analyzedStages = stages.filter(
    (stage) => stage.analysisComplete && stage.analysis
  );

  if (analyzedStages.length === 0) {
    return "No stage analyses found to synthesize.";
  }

  // Generate the final synthesis
  const synthesisResult = await step?.ai.wrap(
    "generate-final-synthesis",
    async () => {
      return await generateText({
        model: vercelOpenAI("gpt-4o"),
        prompt: `
        You are a research expert synthesizing findings from multiple research stages.
        
        TOPIC: ${topic}
        NUMBER OF STAGES: ${analyzedStages.length}
        
        STAGE ANALYSES:
        ${analyzedStages
          .map(
            (stage) => `
          STAGE: ${stage.name}
          DESCRIPTION: ${stage.description}
          ANALYSIS SUMMARY: ${stage.analysis?.substring(0, 500)}...
        `
          )
          .join("\n\n")}
        
        Create a comprehensive synthesis that:
        1. Integrate the key findings across all stages
        2. Identify overarching patterns, themes, and connections
        3. Highlight the most significant insights from the entire research process
        4. Address contradictions or tensions between different stage findings
        5. Suggest implications and potential next steps for further research
        
        Your synthesis should not just summarize each stage separately but create a coherent
        narrative that shows how our understanding of the topic evolved through the research stages.
      `,
      });
    }
  );

  return (
    synthesisResult.text ||
    "Error generating final synthesis. Please check individual stage analyses."
  );
}

/**
 * AnalysisAgent
 *
 * This agent is responsible for analyzing reasoning trees for each stage.
 * It uses self-discover prompting and multi-stage comparison.
 */
export const analysisAgent = createAgent<NetworkState>({
  name: "Analysis Agent",
  description: "Analyzes reasoning trees to generate insights",
  system: `You are an expert analyst who synthesizes information from reasoning trees.
  
Your primary responsibility is to analyze the reasoning tree for the current stage and generate insights.

When invoked, you will:
1. Check which stage of reasoning is currently active
2. Review the stage's reasoning tree containing queries, findings, and reflections
3. Use the 'analyze_reasoning_tree' tool to generate a comprehensive analysis
4. The tool will:
   - Extract key insights from the reasoning tree
   - Compare with analyses from previous stages (if not the first stage)
   - Generate a structured analysis with multiple sections
   - Create a coherent narrative that synthesizes the findings

Your goal is to create a cohesive analysis that synthesizes the findings from the reasoning tree.
Use the 'analyze_reasoning_tree' tool to generate and store the analysis in the network state.

For the final stage, you will also generate a comprehensive synthesis across all stages.`,
  model: openai({ model: "gpt-4o" }),
  tools: [analyzeReasoningTreeTool],
  lifecycle: {
    onStart: async ({ input, network, prompt, history }) => {
      console.log("=== ANALYSIS AGENT START ===");

      if (network) {
        const state = network.state.data as NetworkState;
        const currentStage =
          state.reasoningStages?.[state.currentStageIndex || 0];

        console.log(`Current stage: ${currentStage?.name || "Unknown"}`);
        console.log(
          `Stage description: ${
            currentStage?.description?.substring(0, 100) || "None"
          }...`
        );

        if (state.currentStageIndex && state.currentStageIndex > 0) {
          console.log(
            `This is stage ${state.currentStageIndex + 1} of ${
              state.reasoningStages?.length
            }. Will compare with previous stages.`
          );
        } else {
          console.log(
            "This is the first stage. No previous stages to compare with."
          );
        }

        console.log(
          `Reasoning tree has ${
            currentStage?.reasoningTree?.nodes.length || 0
          } nodes.`
        );
      }

      return {
        prompt,
        history: history || [],
        stop: false,
      };
    },
    onFinish: async ({ result, network }) => {
      console.log("=== ANALYSIS AGENT FINISH ===");

      if (network) {
        const state = network.state.data as NetworkState;
        const currentStage =
          state.reasoningStages?.[state.currentStageIndex || 0];

        if (currentStage && currentStage.analysisComplete) {
          console.log(`Analysis complete for stage: ${currentStage.name}`);
          console.log(
            `Analysis length: ${currentStage.analysis?.length || 0} characters`
          );

          // Generate final synthesis if this is the last stage
          if (
            state.currentStageIndex ===
              (state.reasoningStages?.length || 0) - 1 &&
            state.reasoningStages
          ) {
            console.log(
              "This is the final stage. Generating comprehensive synthesis..."
            );

            // Generate final synthesis across all stages
            const finalSynthesis = await generateFinalSynthesis({
              stages: state.reasoningStages,
              topic: state.topic || "Unknown topic",
              step: undefined,
            });

            // Store the final synthesis in the network state
            network.state.data = {
              ...state,
              finalAnalysis: finalSynthesis,
            };

            console.log(
              `Generated final synthesis of ${finalSynthesis.length} characters`
            );
          }
        }
      }

      return result;
    },
  },
});
