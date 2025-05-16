"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ResearchStage {
  id: number;
  name: string;
  description: string;
  completed: boolean;
  content?: string;
}

interface DeepResearchStagesProps {
  stages: ResearchStage[];
  selectedStage: number;
  onStageSelect: (index: number) => void;
}

export function DeepResearchStages({ 
  stages, 
  selectedStage, 
  onStageSelect,
}: DeepResearchStagesProps) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
        Research Stages
      </h2>
      
      <div className="space-y-2">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          
          return (
            <div key={stage.id} className="relative">
              <div 
                className={cn(
                  "flex items-start relative cursor-pointer group p-3 rounded-lg transition-all duration-200",
                  selectedStage === index 
                    ? "bg-zinc-100 dark:bg-zinc-800" 
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                )}
                onClick={() => onStageSelect(index)}
              >
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[19px] top-[30px] w-[2px] h-[calc(100%+8px)] bg-zinc-200 dark:bg-zinc-700" />
                )}
                
                {/* Checkmark circle */}
                <div className={cn(
                  "rounded-full h-8 w-8 flex items-center justify-center border relative z-10",
                  selectedStage === index
                    ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                )}>
                  <Check className={cn(
                    "h-4 w-4",
                    selectedStage === index
                      ? "text-white dark:text-zinc-900"
                      : "text-zinc-400 dark:text-zinc-500"
                  )} />
                </div>
                
                {/* Stage content */}
                <div className="ml-4 flex-1">
                  <h3 className={cn(
                    "font-medium",
                    selectedStage === index
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400"
                  )}>
                    {stage.name}
                  </h3>
                  <p className={cn(
                    "text-sm mt-1",
                    selectedStage === index
                      ? "text-zinc-600 dark:text-zinc-300"
                      : "text-zinc-500 dark:text-zinc-500"
                  )}>
                    {stage.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 