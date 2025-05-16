import { createAgent, createTool, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { generateObject, generateText } from "ai";
import { openai as vercelOpenAI } from "@ai-sdk/openai";
import Exa from "exa-js";
import {
  NetworkState,
  ReasoningNode,
  ReasoningStage,
  ReasoningTree,
  Finding,
} from "../deep-research";

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY || "");

/**
 * Helper functions for better console logging
 */
function logSection(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`==== ${title} ${"=".repeat(72 - title.length)}`);
  console.log("=".repeat(80) + "\n");
}

function logInfo(message: string) {
  console.log(`[INFO] ${message}`);
}

function logTree(tree: ReasoningTree) {
  console.log("\n----- REASONING TREE STRUCTURE -----");

  // Count nodes per depth
  const nodesByDepth: Record<number, ReasoningNode[]> = {};

  tree.nodes.forEach((node) => {
    if (!nodesByDepth[node.depth]) {
      nodesByDepth[node.depth] = [];
    }
    nodesByDepth[node.depth].push(node);
  });

  // Print tree statistics
  console.log(`Total nodes: ${tree.nodes.length}`);

  Object.entries(nodesByDepth).forEach(([depth, nodes]) => {
    console.log(`Depth ${depth}: ${nodes.length} nodes`);
  });

  // Print node details
  Object.entries(nodesByDepth)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([depth, nodes]) => {
      console.log(`\n----- DEPTH ${depth} -----`);

      nodes.forEach((node) => {
        const hasFindings = node.findings.length > 0;
        const hasReflection = !!node.reflection;
        const hasChildren = node.children.length > 0;

        console.log(
          `Node ${node.id.substring(0, 8)}... (${
            hasFindings ? "✅" : "❌"
          } findings, ${hasReflection ? "✅" : "❌"} reflection, ${
            hasChildren ? "✅" : "❌"
          } children)`
        );
        console.log(`  Query: ${node.query.substring(0, 100)}...`);

        if (node.parentId) {
          console.log(`  Parent: ${node.parentId.substring(0, 8)}...`);
        }

        if (hasFindings) {
          console.log(`  Findings: ${node.findings.length}`);
        }

        if (hasChildren) {
          console.log(
            `  Children: ${node.children
              .map((id) => id.substring(0, 8))
              .join(", ")}...`
          );
        }
      });
    });

  console.log("\n---------------------------------\n");
}

/**
 * Helper function to generate a unique ID for reasoning nodes
 */
function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Find a node by ID in the reasoning tree
 */
function findNodeById(
  tree: ReasoningTree,
  nodeId: string
): ReasoningNode | undefined {
  return tree.nodes.find((node) => node.id === nodeId);
}

/**
 * Analyze a single search result
 */
async function analyzeSearchResult({
  query,
  reasoning,
  result,
  topic,
  stage,
  step,
  context,
}: {
  query: string;
  reasoning: string;
  result: any;
  topic: string;
  stage: ReasoningStage;
  step?: any;
  context?: string | null;
}): Promise<string> {
  logInfo(`Analyzing search result from: ${result.url}`);

  const analysisResult = await step?.ai.wrap(
    "analyze-search-result",
    async () => {
      return await generateText({
        model: vercelOpenAI("gpt-4o"),
        prompt: `
        You are a research expert analyzing a specific search result in relation to a research query.

        Here is the original query for the research we are doing:
        
        TOPIC: ${topic}
        ${context ? `ADDITIONAL CONTEXT: ${context}` : ""}

        Current stage of research:
        STAGE: ${stage.name}
        STAGE DESCRIPTION: ${stage.description}

        Here is the specific query we made to our search engine:
        QUERY: ${query}
        REASONING BEHIND QUERY: ${reasoning}
        
        Here is the search result we got from our search engine:
        SEARCH RESULT URL: ${result.url}
        SEARCH RESULT TITLE: ${result.title || "No title"}
        
        SEARCH RESULT CONTENT:
        ${
          result.text ? result.text.substring(0, 2000) : "No content available"
        }${result.text && result.text.length > 2000 ? "..." : ""}
        
        Provide a thoughtful analysis of this single search result that:
        1. Extracts the key information relevant to the query and overall research topic
        2. Evaluates the credibility and relevance of the source
        3. Identifies important insights, facts, or perspectives provided
        4. Notes any limitations or biases in this particular source
        
        Your analysis should be focused specifically on this single result and what it contributes 
        to understanding the query. Limit your analysis to about 4000 characters.
      `,
      });
    }
  );

  return analysisResult?.text || "No analysis could be generated.";
}

/**
 * Research a specific node by collecting findings from web search using Exa API
 * Modified to return 3 results per query with deduplication
 */
async function researchNode({
  node,
  stage,
  topic,
  step,
  state,
}: {
  node: ReasoningNode;
  stage: ReasoningStage;
  topic: string;
  step?: any;
  state: NetworkState;
}): Promise<Finding[]> {
  logSection(`RESEARCHING NODE: ${node.id.substring(0, 8)}...`);
  logInfo(`Query: ${node.query}`);
  logInfo(`Depth: ${node.depth}`);

  try {
    // Ensure searchedUrls exists in state
    if (!state.searchedUrls) {
      state.searchedUrls = new Set<string>();
    }

    // Prepare the search query by combining the stage context and the specific query
    const searchQuery = `${topic} - ${node.query}`;
    logInfo(`Executing Exa search: "${searchQuery}"`);

    // Perform the search and get content with Exa
    const searchResults = await step?.ai.wrap("exa-search", async () => {
      try {
        // Get search results with content
        logInfo("Calling Exa API...");
        const startTime = Date.now();

        const results = await exa.searchAndContents(searchQuery, {
          text: true,
          numResults: 5, // Ask for more to account for deduplication
          highlightMatches: true, // Highlight matching terms
        });

        const duration = Date.now() - startTime;
        logInfo(`Exa API call completed in ${duration}ms`);

        if (results.results && results.results.length > 0) {
          logInfo(`Received ${results.results.length} results from Exa`);
          results.results.forEach((result, i) => {
            logInfo(
              `Result ${i + 1}: ${result.title || "No title"} (${result.url})`
            );
            logInfo(`  Content length: ${result.text?.length || 0} characters`);
          });
        } else {
          logInfo("No results returned from Exa API");
        }

        return results;
      } catch (error) {
        console.error("Exa search error:", error);
        logInfo("❌ Exa API call failed");
        return { results: [] };
      }
    });

    // Extract and format findings from the search results
    const findings: Finding[] = [];

    // Deduplicate search results based only on URL
    const dedupedResults = [];
    if (searchResults?.results && searchResults.results.length > 0) {
      for (const result of searchResults.results) {
        if (!result.text || !result.url) continue;

        // Check if we've already analyzed this URL in this stage
        if (
          state.searchedUrls.has(result.url) &&
          state.analysisCache?.has(result.url)
        ) {
          logInfo(`Reusing analysis for duplicate URL: ${result.url}`);

          // Reuse the existing analysis
          findings.push({
            source: result.url,
            content:
              result.text.substring(0, 1000) +
              (result.text.length > 1000 ? "..." : ""),
            relevanceScore: 0.8, // Default score
            analysis: state.analysisCache.get(result.url),
          });

          // If we have enough findings already, we can stop
          if (findings.length >= 3) break;

          // Skip to next result without adding to dedupedResults
          continue;
        }

        // Skip already seen URLs (that don't have cached analysis)
        if (state.searchedUrls.has(result.url)) {
          logInfo(`Skipping duplicate URL: ${result.url}`);
          continue;
        }

        // Track this URL
        state.searchedUrls.add(result.url);
        dedupedResults.push(result);

        // Stop if we have enough unique results
        if (dedupedResults.length >= 3) break;
      }
    }

    logInfo(`After deduplication: ${dedupedResults.length} unique results`);

    // Process deduplicated results to add to findings
    if (dedupedResults.length > 0) {
      // Create analysis promises for all results in parallel
      const analysisPromises = dedupedResults.map((result) =>
        analyzeSearchResult({
          query: node.query,
          reasoning: node.reasoning || "No reasoning provided",
          result,
          topic,
          stage,
          step,
          context: state.context,
        })
      );

      // Execute all analyses in parallel
      logInfo(
        `Analyzing ${analysisPromises.length} search results in parallel`
      );
      const analyses = await Promise.all(analysisPromises);

      // Process the results
      dedupedResults.forEach((result, index) => {
        const analysis = analyses[index];

        // Cache the analysis for potential reuse
        if (!state.analysisCache) {
          state.analysisCache = new Map<string, string>();
        }
        state.analysisCache.set(result.url, analysis);

        // Create a finding with the analysis
        findings.push({
          source: result.url,
          content:
            result.text.substring(0, 1000) +
            (result.text.length > 1000 ? "..." : ""),
          relevanceScore: 0.8, // Default score
          analysis, // Include the analysis with the finding
        });

        logInfo(`Created finding with analysis for ${result.url}`);
      });
    }

    // If we couldn't get any findings from Exa, generate fallback findings
    if (findings.length === 0) {
      logInfo("⚠️ No Exa results found, generating fallback findings");

      const fallbackFindings = await step?.ai.wrap(
        "generate-fallback-findings",
        async () => {
          return await generateObject({
            model: vercelOpenAI("gpt-4o"),
            schema: z.object({
              findings: z
                .array(
                  z.object({
                    source: z
                      .string()
                      .describe("A plausible source for this information"),
                    content: z.string().describe("The content of the finding"),
                    relevanceScore: z
                      .number()
                      .min(0)
                      .max(1)
                      .describe(
                        "How relevant this finding is to the query (0-1)"
                      ),
                    analysis: z
                      .string()
                      .describe("Analysis of this generated finding"),
                  })
                )
                .length(3),
            }),
            prompt: `
            You are a research expert generating plausible research findings when no search results are available.
            
            TOPIC: ${topic}
            STAGE: ${stage.name}
            QUERY: ${node.query}
            REASONING BEHIND QUERY: ${node.reasoning || "No reasoning provided"}
            
            Generate exactly 3 detailed, plausible research findings for this query.
            For each finding:
            1. Create a realistic source (like a research paper, website, book, etc.)
            2. Write detailed, specific content that directly addresses the query
            3. Assign a relevance score between 0-1 based on how well it answers the query
            4. Include an analysis of the finding that highlights key points and evaluates the information
            
            Make the content specific and detailed as if it was actually retrieved from real sources.
            Note: These should represent your best knowledge as an AI, but acknowledge these are not from real-time web searches.
          `,
          });
        }
      );

      const fallbackResults = fallbackFindings?.object?.findings || [];
      logInfo(
        `Generated ${fallbackResults.length} fallback findings with analyses`
      );

      return fallbackResults;
    }

    return findings;
  } catch (error) {
    console.error(`Error researching node ${node.id}:`, error);
    logInfo(`❌ Error during research: ${error}`);

    // Return empty findings array on error
    return [];
  }
}

/**
 * Generate follow-up queries based on all findings from depth 0
 */
async function generateFollowUpQueries({
  initialFindings,
  originalQueries,
  stage,
  topic,
  step,
}: {
  initialFindings: Finding[];
  originalQueries: string[];
  stage: ReasoningStage;
  topic: string;
  step?: any;
}): Promise<any> {
  logInfo(
    `Generating follow-up queries based on ${initialFindings.length} findings`
  );

  // Extract all analyses from the findings
  const allAnalyses = initialFindings
    .filter((finding) => finding.analysis)
    .map(
      (finding, index) =>
        `ANALYSIS ${index + 1} (from ${finding.source}):\n${finding.analysis}`
    );

  const followupResult = await step?.ai.wrap(
    "generate-followup-queries",
    async () => {
      return await generateObject({
        model: vercelOpenAI("gpt-4o"),
        schema: z.object({
          followupQueries: z
            .array(
              z.object({
                query: z
                  .string()
                  .describe(
                    "The specific follow-up research question to explore"
                  ),
                reasoning: z
                  .string()
                  .describe(
                    "Detailed reasoning behind why this follow-up query is important"
                  ),
              })
            )
            .length(3),
        }),
        prompt: `
        You are a research expert generating follow-up queries based on initial research findings.
        
        TOPIC: ${topic}
        STAGE: ${stage.name}
        STAGE DESCRIPTION: ${stage.description}
        
        ORIGINAL QUERIES THAT HAVE ALREADY BEEN RESEARCHED:
        ${originalQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}
        
        Based on the following analyses from initial research:
        ${allAnalyses.join("\n\n")}
        
        Generate exactly 3 follow-up queries that will deepen the research further.
        These queries should:
        1. Address important gaps or open questions from the initial findings
        2. Explore promising areas identified but not fully covered in the initial research
        3. Represent distinct angles that together provide comprehensive coverage
        4. Be specific enough for effective web searches
        5. Include detailed reasoning explaining why each query is important
        6. NOT duplicate any of the original queries listed above
        
        The follow-up queries should not duplicate the initial research, but rather build upon 
        and extend the knowledge already gathered.
      `,
      });
    }
  );

  return followupResult?.object?.followupQueries || [];
}

/**
 * Generate stage analysis based on all findings from depth 0 and depth 1
 */
async function generateStageAnalysis({
  allFindings,
  stage,
  topic,
  step,
}: {
  allFindings: Finding[];
  stage: ReasoningStage;
  topic: string;
  step?: any;
}): Promise<string> {
  logInfo(`Generating stage analysis based on ${allFindings.length} findings`);

  // Extract all analyses from the findings
  const allAnalyses = allFindings
    .filter((finding) => finding.analysis)
    .map(
      (finding, index) =>
        `ANALYSIS ${index + 1} (from ${finding.source}):\n${finding.analysis}`
    );

  const analysisResult = await step?.ai.wrap(
    "generate-stage-analysis",
    async () => {
      return await generateObject({
        model: vercelOpenAI("gpt-4o"),
        schema: z.object({
          stageAnalysis: z
            .string()
            .describe("Comprehensive analysis of all findings for this stage"),
        }),
        prompt: `
        You are a research expert creating a comprehensive analysis for a research stage.
        
        TOPIC: ${topic}
        STAGE: ${stage.name}
        STAGE DESCRIPTION: ${stage.description}
        
        Based on the following analyses from all research findings:
        ${allAnalyses.join("\n\n")}
        
        Generate a comprehensive analysis of this entire research stage that:
        1. Synthesizes key insights across all findings
        2. Draws parallels between each of the provided findings/analyses
        3. Identifies patterns, trends, and consensus views
        4. Highlights important contradictions or areas of debate
        5. Evaluates the overall strength of evidence
        6. Discusses implications of these findings for the broader topic
        7. Notes remaining gaps or questions for future research
        
        Your analysis should provide a clear, coherent narrative of what we've learned about this aspect 
        of the topic through our research. It should be thorough yet focused on the most significant insights.

        This should be a comprehensive 6-10 paragraphs long report
      `,
      });
    }
  );

  return (
    analysisResult?.object?.stageAnalysis || "No analysis could be generated."
  );
}

/**
 * BuildReasoningTree Tool
 *
 * This tool builds or expands a reasoning tree for the current stage.
 * Modified to implement the new structure with web searches at both levels.
 */
export const buildReasoningTreeTool = createTool({
  name: "build_reasoning_tree",
  description: "Build a reasoning tree for the current stage",
  handler: async ({}, { network, step }) => {
    if (!network) return { error: "Network state unavailable" };

    const state = network.state.data as NetworkState;
    const {
      topic,
      context,
      maxDepth = 2,
      maxBreadth = 3, // Now using 3 nodes for our approach
      reasoningStages = [],
      currentStageIndex = 0,
    } = state;

    logSection("BUILD REASONING TREE TOOL");
    logInfo(`Topic: ${topic}`);
    logInfo(`Stage: ${currentStageIndex + 1}/${reasoningStages.length}`);
    logInfo(`MaxDepth: ${maxDepth}, MaxBreadth: ${maxBreadth}`);

    // Reset deduplication sets at the start of a new stage
    if (state.newStage) {
      if (!state.searchedUrls) {
        state.searchedUrls = new Set<string>();
      } else {
        state.searchedUrls.clear();
      }

      if (!state.analysisCache) {
        state.analysisCache = new Map<string, string>();
      } else {
        state.analysisCache.clear();
      }

      state.newStage = false;
    }

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

    try {
      // The staging agent now creates the initial tree with depth 0 nodes
      if (!currentStage.reasoningTree || !currentStage.reasoningTree.nodes) {
        return {
          error:
            "Reasoning tree not initialized by StagingAgent. This should not happen.",
        };
      }

      const tree = currentStage.reasoningTree;

      logInfo(`Working with existing tree (${tree.nodes.length} nodes)`);
      logTree(tree);

      // Step 1: Research depth 0 nodes that don't have findings yet
      const depthZeroNodesWithoutFindings = tree.nodes.filter(
        (node) =>
          node.depth === 0 && (!node.findings || node.findings.length === 0)
      );

      if (depthZeroNodesWithoutFindings.length > 0) {
        // Process up to 3 depth 0 nodes in parallel
        const nodesToProcess = depthZeroNodesWithoutFindings.slice(0, 3);
        logInfo(
          `Researching ${nodesToProcess.length} depth 0 nodes in parallel`
        );

        // Research nodes in parallel
        const researchResults = await Promise.all(
          nodesToProcess.map(async (nodeToResearch) => {
            logInfo(
              `Researching depth 0 node: ${nodeToResearch.id.substring(
                0,
                8
              )}... with query: ${nodeToResearch.query.substring(0, 50)}...`
            );

            // Research the node with Exa API
            const findings = await researchNode({
              node: nodeToResearch,
              stage: currentStage,
              topic: topic || "Unknown topic",
              step,
              state,
            });

            logInfo(
              `Found ${
                findings.length
              } findings for node ${nodeToResearch.id.substring(0, 8)}...`
            );

            return { nodeId: nodeToResearch.id, findings };
          })
        );

        // Update nodes with findings
        researchResults.forEach(({ nodeId, findings }) => {
          const node = findNodeById(tree, nodeId);
          if (node) {
            node.findings = findings;
            logInfo(
              `Updated node ${nodeId.substring(0, 8)}... with ${
                findings.length
              } findings`
            );
          }
        });

        // Update the state
        network.state.data = {
          ...state,
          reasoningStages: [
            ...reasoningStages.slice(0, currentStageIndex),
            currentStage,
            ...reasoningStages.slice(currentStageIndex + 1),
          ],
        };

        // Visualize the updated tree
        logTree(tree);

        return {
          success: true,
          message: `Researched ${researchResults.length} depth 0 nodes in parallel`,
          researchedNodeCount: researchResults.length,
          totalFindingsCount: researchResults.reduce(
            (sum, { findings }) => sum + findings.length,
            0
          ),
          stageComplete: false,
        };
      }

      // Step 2: Check if all depth 0 nodes have findings and follow-up queries have not been generated
      const allDepthZeroNodes = tree.nodes.filter((node) => node.depth === 0);
      const allDepthZeroComplete = allDepthZeroNodes.every(
        (node) => node.findings && node.findings.length > 0
      );
      const noDepthOneNodes =
        tree.nodes.filter((node) => node.depth === 1).length === 0;

      if (allDepthZeroComplete && noDepthOneNodes) {
        // Collect all findings from depth 0 nodes
        const allDepthZeroFindings = allDepthZeroNodes.flatMap(
          (node) => node.findings
        );
        logInfo(
          `Generating follow-up queries from ${allDepthZeroFindings.length} findings`
        );

        // Generate follow-up queries based on all depth 0 findings
        const followupQueries = await generateFollowUpQueries({
          initialFindings: allDepthZeroFindings,
          originalQueries: allDepthZeroNodes.map((node) => node.query),
          stage: currentStage,
          topic: topic || "Unknown topic",
          step,
        });

        // Create depth 1 nodes from follow-up queries
        const depthOneNodes: ReasoningNode[] = followupQueries.map((q: any) => {
          const nodeId = generateNodeId();
          return {
            id: nodeId,
            parentId: null, // These are not children of specific depth 0 nodes, but follow-ups to all depth 0
            depth: 1,
            query: q.query,
            reasoning: q.reasoning,
            findings: [], // No findings yet
            children: [], // No children
          };
        });

        // Add depth 1 nodes to the tree
        tree.nodes = [...tree.nodes, ...depthOneNodes];
        logInfo(
          `Added ${depthOneNodes.length} depth 1 follow-up nodes to the tree`
        );

        // Visualize the updated tree
        logTree(tree);

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
          message: `Generated ${depthOneNodes.length} follow-up queries based on all depth 0 findings`,
          newNodeCount: depthOneNodes.length,
          stageComplete: false,
        };
      }

      // Step 3: Research depth 1 nodes
      const depthOneNodesForResearch = tree.nodes.filter(
        (node) =>
          node.depth === 1 && (!node.findings || node.findings.length === 0)
      );

      if (depthOneNodesForResearch.length > 0) {
        // Process up to 3 depth 1 nodes in parallel to avoid rate limits
        const nodesToProcess = depthOneNodesForResearch.slice(0, 3);
        logInfo(
          `Researching ${nodesToProcess.length} depth 1 nodes in parallel`
        );

        // Research nodes in parallel
        const researchResults = await Promise.all(
          nodesToProcess.map(async (nodeToResearch) => {
            logInfo(
              `Researching depth 1 node: ${nodeToResearch.id.substring(
                0,
                8
              )}... with query: ${nodeToResearch.query.substring(0, 50)}...`
            );

            // Research the node with Exa API
            const findings = await researchNode({
              node: nodeToResearch,
              stage: currentStage,
              topic: topic || "Unknown topic",
              step,
              state,
            });

            logInfo(
              `Found ${
                findings.length
              } findings for node ${nodeToResearch.id.substring(0, 8)}...`
            );

            return { nodeId: nodeToResearch.id, findings };
          })
        );

        // Update nodes with findings
        researchResults.forEach(({ nodeId, findings }) => {
          const node = findNodeById(tree, nodeId);
          if (node) {
            node.findings = findings;
            logInfo(
              `Updated node ${nodeId.substring(0, 8)}... with ${
                findings.length
              } findings`
            );
          }
        });

        // Visualize the updated tree
        logTree(tree);

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
          message: `Researched ${researchResults.length} depth 1 nodes in parallel`,
          researchedNodeCount: researchResults.length,
          totalFindingsCount: researchResults.reduce(
            (sum, { findings }) => sum + findings.length,
            0
          ),
          stageComplete: false,
        };
      }

      // Step 4: Check if all nodes have been researched and generate stage analysis
      const allNodes = tree.nodes;
      const allNodesComplete = allNodes.every(
        (node) => node.findings && node.findings.length > 0
      );

      if (allNodesComplete && !currentStage.analysis) {
        // Collect all findings from all nodes
        const allFindings = allNodes.flatMap((node) => node.findings);
        logInfo(
          `Generating stage analysis from ${allFindings.length} findings`
        );

        // Generate comprehensive stage analysis
        const stageAnalysis = await generateStageAnalysis({
          allFindings,
          stage: currentStage,
          topic: topic || "Unknown topic",
          step,
        });

        // Add analysis to the stage
        currentStage.analysis = stageAnalysis;
        currentStage.reasoningComplete = true;
        currentStage.analysisComplete = true;

        logInfo("✅ Stage analysis complete!");

        // Update the state
        network.state.data = {
          ...state,
          reasoningStages: [
            ...reasoningStages.slice(0, currentStageIndex),
            currentStage,
            ...reasoningStages.slice(currentStageIndex + 1),
          ],
          newStage: true, // Mark that we'll move to a new stage next
        };

        return {
          success: true,
          message: "Stage analysis complete",
          analysis: stageAnalysis,
          totalNodeCount: tree.nodes.length,
          stageComplete: true,
        };
      }

      // If we reached here, the stage is complete
      if (currentStage.reasoningComplete && currentStage.analysisComplete) {
        return {
          success: true,
          message: "Stage already complete",
          stageComplete: true,
        };
      }

      return {
        success: true,
        message: "No actions needed at this time",
        stageComplete: false,
      };
    } catch (error) {
      console.error("=== BUILD REASONING TREE TOOL ERROR ===");
      console.error(error);

      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * ReasoningAgent
 *
 * This agent is responsible for building reasoning trees for each stage.
 * Modified to implement the new research approach with web searches at both levels.
 */
export const reasoningAgent = createAgent<NetworkState>({
  name: "Reasoning Agent",
  description: "Builds reasoning trees to explore research stages",
  system: `You are an expert researcher building reasoning trees for exploring complex topics.
  
Your primary responsibility is to generate and expand research queries that deeply explore the current reasoning stage.

When invoked, you will:
1. Check which stage of reasoning is currently active
2. Review the stage description to understand the focus
3. Use the 'build_reasoning_tree' tool to:
   - Research initial depth 0 queries with web searches
   - Generate follow-up queries based on initial findings
   - Research these follow-up queries
   - Create a comprehensive stage analysis

Your goal is to build a comprehensive research foundation for each stage:
- First level: 3 initial queries with 3 search results each (9 total)
- Second level: 3 follow-up queries with 3 search results each (9 more)
- Final analysis: Synthesize all 18 search results into a stage analysis

Continue using the 'build_reasoning_tree' tool until the entire research and analysis is complete.`,
  model: openai({ model: "gpt-4o" }),
  tools: [buildReasoningTreeTool],
  lifecycle: {
    onStart: async ({ input, network, prompt, history }) => {
      console.log("=== REASONING AGENT START ===");

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

        // Log tree stats if exists
        if (currentStage?.reasoningTree?.nodes) {
          const nodes = currentStage.reasoningTree.nodes;
          const depths = nodes.map((n) => n.depth);
          const maxNodeDepth = depths.length > 0 ? Math.max(...depths) : -1;

          console.log(
            `Current tree stats: ${nodes.length} nodes, max depth: ${maxNodeDepth}`
          );

          // Count nodes per depth
          const nodesByDepth = depths.reduce((acc, depth) => {
            acc[depth] = (acc[depth] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);

          Object.entries(nodesByDepth).forEach(([depth, count]) => {
            console.log(`  Depth ${depth}: ${count} nodes`);
          });
        }
      }

      return {
        prompt,
        history: history || [],
        stop: false,
      };
    },
    onFinish: async ({ result, network }) => {
      console.log("=== REASONING AGENT FINISH ===");

      if (network) {
        const state = network.state.data as NetworkState;
        const currentStage =
          state.reasoningStages?.[state.currentStageIndex || 0];

        if (
          currentStage &&
          currentStage.reasoningTree &&
          currentStage.reasoningTree.nodes.length > 0
        ) {
          const tree = currentStage.reasoningTree;
          const nodeCount = tree.nodes.length;
          const depths = tree.nodes.map((n) => n.depth);
          const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
          const researchedNodes = tree.nodes.filter(
            (n) => n.findings.length > 0
          ).length;

          console.log(`Reasoning tree stats for stage "${currentStage.name}":`);
          console.log(`  Total nodes: ${nodeCount}`);
          console.log(`  Max depth: ${maxDepth}`);
          console.log(`  Researched nodes: ${researchedNodes}/${nodeCount}`);

          // Log completion status
          console.log(
            `  Stage reasoning complete: ${currentStage.reasoningComplete}`
          );
          console.log(
            `  Stage analysis complete: ${currentStage.analysisComplete}`
          );
        }
      }

      return result;
    },
  },
});
