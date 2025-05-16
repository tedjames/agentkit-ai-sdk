"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { ContentBlock } from "./ContentBlock";
import { ResearchStage, ResearchUpdate } from "./types";
import { DeepResearchProgress } from "./DeepResearchProgress";
import { calculateProgress } from "./utils";

interface DeepResearchCardProps {
  stages: ResearchStage[];
  updates: ResearchUpdate[];
  selectedStage: number;
  onStageSelect: (stageId: number) => void;
}

export function DeepResearchCard({
  stages,
  updates,
  selectedStage,
  onStageSelect
}: DeepResearchCardProps) {
  const currentStage = stages.find(s => s.id === selectedStage);
  const latestUpdate = updates[updates.length - 1];
  const progress = calculateProgress(stages, latestUpdate);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden h-[600px]">
      <div className="flex h-full">
        {/* Left sidebar with stages */}
        <div className="w-[280px] min-w-[280px] border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex-shrink-0">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/80">
                <Search className="h-5 w-5" />
                <span className="font-medium">Research Progress</span>
              </div>
              <DeepResearchProgress
                percent={progress.percent}
                currentStep={progress.currentStep}
                agent={latestUpdate?.agent}
                className="mt-2"
              />
            </div>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto">
            {stages.map((stage) => {
              const isComplete = stage.reasoningComplete && stage.analysisComplete;
              return (
                <button
                  key={stage.id}
                  onClick={() => onStageSelect(stage.id)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2 transition-colors",
                    stage.id === selectedStage
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  )}
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    isComplete ? "bg-green-500" :
                    stage.id === selectedStage ? "bg-blue-500" :
                    "bg-zinc-600"
                  )} />
                  <span className="truncate">{stage.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Stage content */}
          <div className="p-4 space-y-4 overflow-y-auto h-full">
            {/* Stage description */}
            {currentStage && (
              <div className="text-zinc-300 text-sm">
                {currentStage.description}
              </div>
            )}

            {/* Research Progress with ContentBlocks */}
            {currentStage?.reasoningTree?.nodes && currentStage.reasoningTree.nodes.length > 0 && (
              <div className="mt-4">
                <div className="space-y-4">
                  {currentStage.reasoningTree.nodes.map((node, nodeIndex) => (
                    <ContentBlock
                      key={node.id}
                      query={node.query}
                      reasoning={node.reasoning}
                      findings={node.findings}
                      isPending={node.findings.length === 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stage analysis */}
            {currentStage?.analysis && (
              <div className="mt-6 p-4 bg-zinc-800 rounded-lg">
                <h3 className="text-lg font-medium text-white/90 mb-3">Analysis</h3>
                <div className="prose prose-invert max-w-none">
                  {currentStage.analysis}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 