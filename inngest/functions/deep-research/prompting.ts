import { generateObject } from "ai";
import { z } from "zod";
import { openai as vercelOpenAI } from "@ai-sdk/openai";

/**
 * Self-discover prompting function
 *
 * This function implements a technique called "self-discover prompting" which:
 * 1. Selects a subset of questions from a pool of reasoning modules
 * 2. Adapts those questions to the specific research context
 * 3. Optionally answers the adapted questions (can be skipped)
 *
 * This approach helps guide exploration by leveraging different reasoning frameworks.
 */
export async function selfDiscoverPrompting({
  reasoningModules,
  context,
  numToSelect,
  skipAnswering = false,
  step,
}: {
  reasoningModules: string[];
  context: string;
  numToSelect: number;
  skipAnswering?: boolean;
  step?: any;
}): Promise<{
  selectedQuestions: string[];
  adaptedQuestions: string[];
  answers: string[];
}> {
  // Step 1: Select questions
  const selectionResult = await step?.ai.wrap("select-questions", async () => {
    return await generateObject({
      model: vercelOpenAI("gpt-4o"),
      schema: z.object({
        selectedIndices: z
          .array(
            z
              .number()
              .min(0)
              .max(reasoningModules.length - 1)
          )
          .min(Math.min(numToSelect, reasoningModules.length))
          .max(Math.min(numToSelect, reasoningModules.length))
          .describe(
            "Indices of the selected questions from the reasoningModules array"
          ),
      }),
      prompt: `
        You are a research expert selecting the most appropriate reasoning approaches for exploring a topic.
        
        TOPIC: ${context}
        
        Below is a list of reasoning approaches (numbered starting at 0):
        ${reasoningModules
          .map((module, i: number) => `${i}: ${module}`)
          .join("\n")}
        
        Select exactly ${numToSelect} approaches that would be most effective for exploring this topic.
        Choose approaches that:
        1. Are diverse and cover different thinking styles
        2. Are specifically relevant to this particular topic
        3. Would yield the most insightful exploration
        
        Return the indices of the selected approaches (0 to ${
          reasoningModules.length - 1
        }).
      `,
    });
  });

  // Extract the selected questions
  const selectedIndices = selectionResult?.object?.selectedIndices || [];
  const selectedQuestions = selectedIndices.map(
    (index: number) => reasoningModules[index]
  );

  // Step 2: Adapt questions to the specific context
  const adaptationResult = await step?.ai.wrap("adapt-questions", async () => {
    return await generateObject({
      model: vercelOpenAI("gpt-4o"),
      schema: z.object({
        adaptedQuestions: z
          .array(z.string())
          .length(selectedQuestions.length)
          .describe(
            "The selected questions adapted to the specific research context"
          ),
      }),
      prompt: `
        You are a research expert adapting general reasoning approaches to a specific topic.
        
        TOPIC: ${context}
        
        Below are general reasoning questions that have been selected:
        ${selectedQuestions
          .map((q: string, i: number) => `${i + 1}. ${q}`)
          .join("\n")}
        
        Adapt each question to specifically address the topic of "${context}". 
        Make the questions more specific, concrete, and directly applicable 
        to this particular research context. 
        
        Keep the same thinking approach but tailor the language and focus to this topic.
      `,
    });
  });

  // Extract the adapted questions
  const adaptedQuestions =
    adaptationResult?.object?.adaptedQuestions || selectedQuestions;

  // Skip the answering step if requested
  if (skipAnswering) {
    return {
      selectedQuestions,
      adaptedQuestions,
      answers: [],
    };
  }

  // Step 3: Answer the adapted questions
  const answerPromises = adaptedQuestions.map(
    (question: string, index: number) =>
      step?.ai.wrap(`answer-question-${index}`, async () => {
        return await generateObject({
          model: vercelOpenAI("gpt-4o"),
          schema: z.object({
            answer: z
              .string()
              .describe(
                "A thoughtful, detailed answer to the adapted question"
              ),
          }),
          prompt: `
          You are a research expert answering important questions about a research topic.
          
          TOPIC: ${context}
          QUESTION: ${question}
          
          Provide a thoughtful, nuanced, and detailed answer to this question.
          Include a comprehensive report of how this relates to ongoing research, important considerations, and implications when relevant.
          Think deeply about different aspects of the topic that relate to this question.
        `,
        });
      })
  );

  // Execute all answer generations in parallel
  const answerResults = await Promise.all(answerPromises);

  // Extract the answers
  const answers = answerResults.map(
    (result) => result?.object?.answer || "No answer generated"
  );

  return {
    selectedQuestions,
    adaptedQuestions,
    answers,
  };
}
