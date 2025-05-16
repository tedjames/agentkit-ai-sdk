import { createAgent, createTool, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { generateObject, generateText } from "ai";
import { openai as vercelOpenAI } from "@ai-sdk/openai";
import { NetworkState } from "../deep-research";

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

/**
 * Generate a report outline based on stage analyses
 */
async function generateReportOutline({
  stageAnalyses,
  topic,
  step,
}: {
  stageAnalyses: string[];
  topic: string;
  step?: any;
}): Promise<any> {
  logInfo("Generating report outline");

  const outlineResult = await step?.ai.wrap(
    "generate-report-outline",
    async () => {
      return await generateObject({
        model: vercelOpenAI("gpt-4o"),
        schema: z.object({
          title: z
            .string()
            .describe("Compelling title for the research report"),
          introduction: z
            .string()
            .describe(
              "Brief description of what should be included in the introduction"
            ),
          sections: z
            .array(
              z.object({
                title: z.string().describe("Section title"),
                description: z
                  .string()
                  .describe("Brief description of the section content"),
                keyPoints: z
                  .array(z.string())
                  .describe("Key points to address in this section"),
              })
            )
            .min(3)
            .max(8)
            .describe("Main report sections"),
          conclusion: z
            .string()
            .describe(
              "Brief description of what should be included in the conclusion"
            ),
        }),
        prompt: `
        You are a research expert creating an outline for a comprehensive report.
        
        TOPIC: ${topic}
        
        Based on the following stage analyses:
        ${stageAnalyses
          .map(
            (analysis, i) =>
              `STAGE ${i + 1} ANALYSIS:\n${analysis.substring(0, 500)}...`
          )
          .join("\n\n")}
        
        Generate a detailed outline for a comprehensive research report that:
        1. Has a compelling title that captures the essence of the research
        2. Includes 3-8 coherent sections that flow logically
        3. Covers all the major aspects revealed in the stage analyses
        4. Highlights the most significant findings and implications
        
        For each section, provide:
        - A clear, descriptive title
        - A brief description of what the section should cover
        - 3-5 key points that should be addressed in that section
        
        Also include brief descriptions of what should be in the introduction and conclusion.
        
        The outline should be comprehensive yet focused, emphasizing the most important insights
        from the research while maintaining a cohesive narrative throughout.
      `,
      });
    }
  );

  return (
    outlineResult?.object || {
      title: `Research Report on ${topic}`,
      sections: [
        {
          title: "Overview and Context",
          description: "Background information on the topic",
          keyPoints: [
            "Historical context",
            "Current relevance",
            "Scope of research",
          ],
        },
        {
          title: "Key Findings",
          description: "Main discoveries from the research",
          keyPoints: [
            "Primary insights",
            "Supporting evidence",
            "Implications",
          ],
        },
        {
          title: "Conclusion and Recommendations",
          description: "Summary and next steps",
          keyPoints: ["Research summary", "Limitations", "Future directions"],
        },
      ],
    }
  );
}

/**
 * Generate a report section based on the outline and stage analyses
 */
async function generateSection({
  section,
  outline,
  stageAnalyses,
  topic,
  step,
}: {
  section: any;
  outline: any;
  stageAnalyses: string[];
  topic: string;
  step?: any;
}): Promise<string> {
  logInfo(`Generating report section: ${section.title}`);

  const sectionResult = await step?.ai.wrap(
    "generate-report-section",
    async () => {
      return await generateText({
        model: vercelOpenAI("gpt-4o"),
        prompt: `
        You are a research expert writing a specific section of a comprehensive report.
        
        TOPIC: ${topic}
        REPORT TITLE: ${outline.title}
        SECTION TO WRITE: ${section.title}
        SECTION DESCRIPTION: ${section.description}
        
        KEY POINTS TO ADDRESS:
        ${section.keyPoints.map((point: string) => `- ${point}`).join("\n")}
        
        Based on the following analyses:
        ${stageAnalyses
          .map((analysis, i) => `STAGE ${i + 1} ANALYSIS:\n${analysis}`)
          .join("\n\n")}
        
        Write a complete, detailed section for the report that:
        1. Has a clear heading using markdown (## Section Title)
        2. This should be a comprehensive 5-7 paragraphs long section with subheadings (### Subheading) before certain sets of paragraphs
        3. Thoroughly addresses all the key points listed for this section
        4. Incorporates relevant information from the stage analyses
        5. Uses proper formatting with subheadings, paragraphs, and bullet points as appropriate
        6. Maintains a formal, academic tone appropriate for a research report
        7. Includes relevant examples, data points, or evidence from the research findings

        
        
        The section should be comprehensive, well-structured, and flow naturally. Use markdown 
        formatting for headings, emphasis, lists, etc. Each section should stand as a complete
        part of the larger report while connecting to the overall narrative.
      `,
      });
    }
  );

  return (
    sectionResult?.text ||
    `## ${section.title}\n\nContent for this section could not be generated.`
  );
}

/**
 * Generate the introduction for the report
 */
async function generateIntroduction({
  outline,
  topic,
  step,
}: {
  outline: any;
  topic: string;
  step?: any;
}): Promise<string> {
  logInfo("Generating report introduction");

  const introResult = await step?.ai.wrap("generate-introduction", async () => {
    return await generateObject({
      model: vercelOpenAI("gpt-4o"),
      schema: z.object({
        introduction: z
          .string()
          .describe("Complete introduction for the report"),
      }),
      prompt: `
        You are a research expert writing the introduction to a comprehensive report.
        
        TOPIC: ${topic}
        REPORT TITLE: ${outline.title}
        INTRODUCTION GUIDANCE: ${outline.introduction}
        
        REPORT SECTIONS:
        ${outline.sections
          .map((section: any) => `- ${section.title}: ${section.description}`)
          .join("\n")}
        
        Write a complete introduction for the report that:
        1. Begins with a compelling hook that engages the reader
        2. Establishes the context and importance of the research topic
        3. Clearly states the purpose and scope of the report
        4. Briefly outlines the methodology or approach used
        5. Previews the main sections of the report
        6. Sets the tone for a formal, academic research document
        
        The introduction should be comprehensive yet concise, providing readers with all 
        necessary background while motivating them to read the full report. Use markdown 
        formatting as appropriate.
      `,
    });
  });

  return (
    introResult?.object?.introduction ||
    "# Introduction\n\nThe introduction could not be generated."
  );
}

/**
 * Generate the conclusion for the report
 */
async function generateConclusion({
  outline,
  topic,
  step,
}: {
  outline: any;
  topic: string;
  step?: any;
}): Promise<string> {
  logInfo("Generating report conclusion");

  const conclusionResult = await step?.ai.wrap(
    "generate-conclusion",
    async () => {
      return await generateObject({
        model: vercelOpenAI("gpt-4o"),
        schema: z.object({
          conclusion: z.string().describe("Complete conclusion for the report"),
        }),
        prompt: `
        You are a research expert writing the conclusion to a comprehensive report.
        
        TOPIC: ${topic}
        REPORT TITLE: ${outline.title}
        CONCLUSION GUIDANCE: ${outline.conclusion}
        
        REPORT SECTIONS:
        ${outline.sections
          .map((section: any) => `- ${section.title}: ${section.description}`)
          .join("\n")}
        
        Write a complete conclusion for the report that:
        1. Summarizes the key findings and insights from the research
        2. Connects these findings back to the original purpose of the report
        3. Discusses broader implications of the research
        4. Addresses limitations or gaps in the current research
        5. Suggests directions for future research or investigation
        6. Ends with a strong closing statement about the significance of the work
        
        The conclusion should synthesize rather than merely summarize, providing a coherent 
        closing to the report that leaves readers with a clear understanding of the research's 
        value and implications. Use markdown formatting as appropriate.
      `,
      });
    }
  );

  return (
    conclusionResult?.object?.conclusion ||
    "# Conclusion\n\nThe conclusion could not be generated."
  );
}

/**
 * GenerateReport Tool
 */
export const generateReportTool = createTool({
  name: "generate_report",
  description: "Generate a comprehensive research report",
  handler: async ({}, { network, step }) => {
    if (!network) return { error: "Network state unavailable" };

    const state = network.state.data as NetworkState;
    const { topic, reasoningStages = [] } = state;

    logSection("GENERATE REPORT TOOL");
    logInfo(`Topic: ${topic}`);
    logInfo(`Number of stages: ${reasoningStages.length}`);

    try {
      // 1. Get all stage analyses
      const stageAnalyses = reasoningStages.map(
        (stage) => stage.analysis || "No analysis available"
      );

      if (
        stageAnalyses.every(
          (analysis) => !analysis || analysis === "No analysis available"
        )
      ) {
        return {
          error:
            "No stage analyses available. Stage research must be completed first.",
        };
      }

      // 2. Generate report outline
      const outline = await generateReportOutline({
        stageAnalyses,
        topic: topic || "Unknown topic",
        step,
      });

      logInfo(`Generated outline with ${outline.sections.length} sections`);

      // 3. Generate all sections in parallel
      logInfo(`Generating ${outline.sections.length} sections in parallel`);
      const generateSectionPromises = outline.sections.map((section: any) =>
        generateSection({
          section,
          outline,
          stageAnalyses,
          topic: topic || "Unknown topic",
          step,
        })
      );

      // Wait for all section generation to complete
      const sections = await Promise.all(generateSectionPromises);

      // Log completion of all sections
      outline.sections.forEach((section: any, index: number) => {
        logInfo(`Generated content for section: ${section.title}`);
      });

      // 4. Generate introduction and conclusion
      const introduction = await generateIntroduction({
        outline,
        topic: topic || "Unknown topic",
        step,
      });

      const conclusion = await generateConclusion({
        outline,
        topic: topic || "Unknown topic",
        step,
      });

      // 5. Assemble final report in markdown
      const finalReport = `
# ${outline.title}

${introduction}

${sections.join("\n\n")}

${conclusion}
`;

      // Update network state
      network.state.data = {
        ...state,
        finalReport,
      };

      logInfo("✅ Report generation complete!");

      return {
        success: true,
        reportLength: finalReport.length,
        sectionCount: outline.sections.length,
      };
    } catch (error) {
      console.error("=== GENERATE REPORT TOOL ERROR ===");
      console.error(error);

      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * ReportingAgent
 *
 * This agent is responsible for generating a comprehensive final report
 * based on all stage analyses.
 */
export const reportingAgent = createAgent<NetworkState>({
  name: "Reporting Agent",
  description: "Generates comprehensive research reports",
  system: `You are an expert research writer specializing in creating comprehensive, well-structured reports.

Your primary responsibility is to synthesize research findings into a polished, professional report.

When invoked, you will:
1. Review all the stage analyses from the completed research
2. Use the 'generate_report' tool to:
   - Create a logical report outline with sections
   - Generate detailed content for each section
   - Produce introduction and conclusion sections
   - Assemble everything into a complete markdown report

Your goal is to create a cohesive, in-depth report that:
- Clearly communicates the key findings and insights from the research
- Maintains a professional, academic tone
- Uses proper formatting and structure for readability
- Provides a comprehensive analysis of the topic based on the research conducted

Use the 'generate_report' tool to synthesize all stage analyses into a final deliverable.`,
  model: openai({ model: "gpt-4o" }),
  tools: [generateReportTool],
  lifecycle: {
    onStart: async ({ input, network, prompt, history }) => {
      console.log("=== REPORTING AGENT START ===");

      if (network) {
        const state = network.state.data as NetworkState;
        console.log(`Topic: ${state.topic || "Unknown"}`);
        console.log(`Stages completed: ${state.reasoningStages?.length || 0}`);
      }

      return {
        prompt,
        history: history || [],
        stop: false,
      };
    },
    onFinish: async ({ result, network }) => {
      console.log("=== REPORTING AGENT FINISH ===");

      if (network && network.state.data.finalReport) {
        console.log("Report generation complete");
        console.log(
          `Report length: ${network.state.data.finalReport.length} characters`
        );
      }

      return result;
    },
  },
});
