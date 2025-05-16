import { ResearchStage, ResearchUpdate } from "./types";

interface ProgressInfo {
  percent: number;
  currentStep: string;
}

export function calculateProgress(
  stages: ResearchStage[],
  latestUpdate: ResearchUpdate | undefined
): ProgressInfo {
  // If no stages yet, we're in initialization/planning
  if (!stages.length) {
    return {
      percent: 5,
      currentStep: "Initializing research...",
    };
  }

  // If we have a final report being generated
  if (latestUpdate?.agent === "ReportingAgent") {
    return {
      percent: 97,
      currentStep: "Generating final report...",
    };
  }

  // If we have a completion event
  if (latestUpdate?.eventType === "complete") {
    return {
      percent: 100,
      currentStep: "Research complete",
    };
  }

  // Get current stage info from the latest update
  const currentStageIndex = latestUpdate?.stage?.index ?? 0;
  const totalStages = latestUpdate?.stage?.totalStages ?? stages.length;
  const currentStage = stages[currentStageIndex];

  if (!currentStage) {
    return {
      percent: 5,
      currentStep: "Initializing research...",
    };
  }

  // Calculate base progress from stage index
  const stageWeight = 90 / totalStages; // Reserve 5% for start, 5% for end
  const baseProgress = 5 + currentStageIndex * stageWeight;

  // Calculate progress within current stage
  let stageProgress = 0;
  if (currentStage.reasoningTree?.nodes) {
    const totalQueries = currentStage.reasoningTree.nodes.length;
    if (totalQueries > 0) {
      const queriesWithFindings = currentStage.reasoningTree.nodes.filter(
        (n) => n.findings.length > 0
      ).length;

      // Queries are 80% of stage weight, analysis is 20%
      const queryWeight = (stageWeight * 0.8) / totalQueries;
      stageProgress = queriesWithFindings * queryWeight;

      if (currentStage.analysisComplete) {
        stageProgress += stageWeight * 0.2;
      }
    }
  }

  // Generate appropriate status message
  let currentStep = `Stage ${currentStageIndex + 1}/${totalStages}: `;

  // Use the message from the latest update if available
  if (latestUpdate?.message && !latestUpdate.message.includes("Stage")) {
    currentStep += latestUpdate.message;
  } else if (!currentStage.reasoningTree?.nodes?.length) {
    currentStep += "Starting research...";
  } else {
    const pendingQueries = currentStage.reasoningTree.nodes.filter(
      (n) => n.findings.length === 0
    );

    if (pendingQueries.length > 0) {
      currentStep += `Searching for information...`;
    } else if (!currentStage.analysisComplete) {
      currentStep += "Analyzing findings...";
    } else {
      currentStep += "Stage complete";
    }
  }

  const totalProgress = Math.min(Math.round(baseProgress + stageProgress), 95);

  return {
    percent: totalProgress,
    currentStep,
  };
}
