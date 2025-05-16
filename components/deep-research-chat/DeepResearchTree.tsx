"use client";

import { cn } from "@/lib/utils";
import { ReasoningNode } from "./types";

interface Finding {
  source: string;
  content: string;
  analysis?: string;
  relevanceScore?: number;
}

interface DeepResearchTreeProps {
  nodes: ReasoningNode[];
  className?: string;
}

export function DeepResearchTree({ nodes, className }: DeepResearchTreeProps) {
  // Group nodes by depth
  const nodesByDepth = nodes.reduce((acc, node) => {
    if (!acc[node.depth]) {
      acc[node.depth] = [];
    }
    acc[node.depth].push(node);
    return acc;
  }, {} as Record<number, ReasoningNode[]>);

  return (
    <div className={cn("space-y-6", className)}>
      {Object.entries(nodesByDepth).map(([depth, depthNodes]) => (
        <div key={depth} className="space-y-4">
          <h3 className="text-lg font-medium text-white/80">
            {depth === "0" ? "Initial Queries" : `Level ${depth} Follow-up Queries`}
          </h3>
          
          <div className="space-y-4">
            {depthNodes.map((node) => (
              <div key={node.id} className="bg-white/5 rounded-lg p-4 space-y-3">
                <h4 className="text-white/90 font-medium">{node.query}</h4>
                
                {/* Reasoning section */}
                <div className="bg-white/5 rounded p-3">
                  <p className="text-sm text-white/80">{node.reasoning}</p>
                </div>

                {/* Findings section */}
                {node.findings.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-white/70">Findings</h5>
                    {node.findings.map((finding, index) => (
                      <div key={index} className="bg-white/5 rounded p-3 space-y-2">
                        <a 
                          href={finding.source}
                          target="_blank"
                          rel="noopener noreferrer" 
                          className="text-sm text-blue-400 hover:underline"
                        >
                          {finding.source}
                        </a>
                        <p className="text-sm text-white/80">{finding.content}</p>
                        {finding.analysis && (
                          <div className="border-t border-white/10 pt-2 mt-2">
                            <p className="text-sm text-white/70 italic">Analysis:</p>
                            <p className="text-sm text-white/70">{finding.analysis}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reflection section */}
                {node.reflection && (
                  <div className="bg-white/5 rounded p-3">
                    <p className="text-sm font-medium text-white/70 mb-1">Reflection</p>
                    <p className="text-sm text-white/80">{node.reflection}</p>
                  </div>
                )}

                {/* Metadata footer */}
                <div className="flex items-center gap-4 text-xs text-white/50">
                  {node.relevanceScore !== undefined && (
                    <span>Relevance: {(node.relevanceScore * 100).toFixed(1)}%</span>
                  )}
                  {node.children.length > 0 && (
                    <span>{node.children.length} follow-up queries</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 