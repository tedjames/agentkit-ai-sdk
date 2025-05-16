"use client";

import { useState, useRef, useEffect } from "react";
import { DeepResearchMessage } from "./DeepResearchMessage";
import { DeepResearchCard } from "./DeepResearchCard";
import { ChatHeader } from "../chat/ChatHeader";
import { ChevronDown, Loader2 } from "lucide-react";
import { ResearchStage, ResearchUpdate } from "./types";

interface Finding {
  source: string;
  content: string;
  relevanceScore?: number;
  analysis?: string;
}

interface ReasoningNode {
  id: string;
  parentId: string | null;
  depth: number;
  query: string;
  reasoning: string;
  findings: Finding[];
  reflection?: string;
  relevanceScore?: number;
  children: string[];
}

export function DeepResearchChat() {
  const [updates, setUpdates] = useState<ResearchUpdate[]>([]);
  const [stages, setStages] = useState<ResearchStage[]>([]);
  const [selectedStage, setSelectedStage] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userQuery, setUserQuery] = useState<string>("");
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [isInputVisible, setIsInputVisible] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isProgrammaticScrolling, setIsProgrammaticScrolling] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Get the latest update
  const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;
  
  // Get the most recent progress percentage
  const progressPercent = latestUpdate?.progress?.percent ?? 0;

  // Scroll to bottom function
  const scrollToBottom = (force = false, smooth = false) => {
    if (chatContainerRef.current && (autoScroll || force)) {
      if (smooth) {
        setIsProgrammaticScrolling(true);
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
  };

  // Handle user scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const isScrolledToBottom = 
        container.scrollHeight - container.clientHeight <= container.scrollTop + 10;
      
      if (isScrolledToBottom) {
        setAutoScroll(true);
        if (isProgrammaticScrolling) {
          setIsProgrammaticScrolling(false);
        }
      } else if (!isProgrammaticScrolling) {
        setAutoScroll(false);
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isProgrammaticScrolling]);

  // Scroll to bottom when new updates come in
  useEffect(() => {
    scrollToBottom();
  }, [updates]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    console.log("Starting research with query:", userQuery);

    // Hide the input with animation
    setIsInputVisible(false);
    setIsLoading(true);
    setUpdates([]);
    setStages([]);
    setFinalReport(null);
    setAutoScroll(true);

    try {
      console.log("Making fetch request...");
      const response = await fetch("/api/deep-research", {
        method: "POST",
        body: JSON.stringify({ 
          topic: userQuery,
          useV2: true
        }),
      });

      console.log("Response received:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        type: response.type,
        bodyUsed: response.bodyUsed
      });

      // Handle response
      const reader = response.body?.getReader();
      console.log("Reader created:", !!reader);

      if (!reader) {
        console.error("No reader available");
        setIsLoading(false);
        setIsInputVisible(true);
        return;
      }

      let buffer = '';
      const decoder = new TextDecoder();
      console.log("Starting to read stream...");

      try {
        while (true) {
          console.log("Reading chunk...");
          const { done, value } = await reader.read();
          
          if (done) {
            console.log("Stream complete");
            break;
          }

          // Decode the chunk and add to buffer
          const newText = decoder.decode(value, { stream: true });
          console.log("Decoded text:", newText);
          
          buffer += newText;
          
          // Process complete messages from buffer
          const lines = buffer.split('\n');
          console.log("Split lines:", lines);
          
          // Keep the last potentially incomplete line in buffer
          buffer = lines.pop() || '';
          console.log("Remaining buffer:", buffer);

          for (const line of lines) {
            if (line.trim() === '') {
              console.log("Skipping empty line");
              continue;
            }
            
            try {
              console.log("Processing line:", line);
              const event = JSON.parse(line);
              console.log("Successfully parsed JSON:", event);

              if (event.data) {
                const updateData = event.data as ResearchUpdate;
                console.log("Processing update:", {
                  message: updateData.message,
                  progress: updateData.progress,
                  stage: updateData.stage,
                  agent: updateData.agent,
                  tree: updateData.tree,
                  stages: updateData.stages
                });

                // Check if this is the initial event
                if (updateData.eventType === "progress" && 
                    updateData.progress?.percent === 5 && 
                    updateData.progress?.currentStep === "Initializing") {
                  setIsInitializing(true);
                }

                // If we receive stages, we're past initialization
                if (updateData.stages && updateData.stages.length > 0) {
                  setIsInitializing(false);
                }

                // Update state
                setUpdates(prev => {
                  console.log("Current updates:", prev);
                  // Only add the update if it's not already present
                  if (!prev.some(u => 
                    u.timestamp === updateData.timestamp && 
                    u.message === updateData.message
                  )) {
                    const newUpdates = [...prev, updateData];
                    console.log("New updates:", newUpdates);
                    return newUpdates;
                  }
                  return prev;
                });

                // Handle stages array first if present
                if (updateData.stages && updateData.stages.length > 0) {
                  console.log("Received stages update:", updateData.stages);
                  setStages(prev => {
                    // Create a map of existing stages for quick lookup
                    const existingStagesMap = new Map(prev.map(s => [s.id, s]));
                    
                    // Process each stage from the update
                    const updatedStages = updateData.stages!.map(newStage => {
                      const existing = existingStagesMap.get(newStage.id);
                      return {
                        id: newStage.id,
                        name: newStage.name,
                        description: newStage.description,
                        completed: existing?.completed || false,
                        reasoningTree: newStage.reasoningTree || existing?.reasoningTree,
                        analysis: newStage.analysis || existing?.analysis,
                        reasoningComplete: newStage.reasoningComplete ?? existing?.reasoningComplete ?? false,
                        analysisComplete: newStage.analysisComplete ?? existing?.analysisComplete ?? false
                      };
                    });

                    console.log("Updated stages:", updatedStages);
                    return updatedStages;
                  });
                }

                // Then handle individual stage updates
                if (updateData.stage) {
                  const newStage: ResearchStage = {
                    id: updateData.stage.index,
                    name: updateData.stage.name,
                    description: updateData.stage.description,
                    completed: false,
                    reasoningTree: updateData.stage.reasoningTree,
                    reasoningComplete: false,
                    analysisComplete: false
                  };

                  setStages(prev => {
                    // Find if this stage already exists
                    const existingIndex = prev.findIndex(s => s.id === newStage.id);
                    
                    if (existingIndex === -1) {
                      // If it's a new stage, add it
                      return [...prev, newStage];
                    } else {
                      // If it exists, update it while preserving existing properties
                      return prev.map((stage, index) => 
                        index === existingIndex ? {
                          ...stage,
                          ...newStage,
                          // Preserve completion states unless explicitly provided
                          reasoningComplete: newStage.reasoningComplete ?? stage.reasoningComplete,
                          analysisComplete: newStage.analysisComplete ?? stage.analysisComplete,
                          // Properly merge reasoning trees using a Map for deduplication by query
                          reasoningTree: {
                            nodes: (() => {
                              // Create a Map using query as the key for deduplication
                              const nodeMap = new Map(
                                (stage.reasoningTree?.nodes || []).map(node => [node.query, node])
                              );
                              
                              // Update or add new nodes, preferring newer nodes for the same query
                              (newStage.reasoningTree?.nodes || []).forEach(node => {
                                // If we have an existing node with this query
                                const existingNode = nodeMap.get(node.query);
                                if (existingNode) {
                                  // Only update if the new node has more information
                                  if (node.findings.length > existingNode.findings.length ||
                                      node.children.length > existingNode.children.length ||
                                      node.reflection !== undefined ||
                                      node.relevanceScore !== undefined) {
                                    nodeMap.set(node.query, node);
                                  }
                                } else {
                                  // No existing node with this query, add the new one
                                  nodeMap.set(node.query, node);
                                }
                              });
                              
                              // Convert back to array
                              return Array.from(nodeMap.values());
                            })()
                          }
                        } : stage
                      );
                    }
                  });

                  // Only update selected stage if it's not already selected
                  if (selectedStage !== updateData.stage.index) {
                    setSelectedStage(updateData.stage.index);
                  }
                }

                // Handle completion
                if (updateData.eventType === 'complete' && updateData.completed) {
                  console.log("Research complete, setting final report");
                  console.log("Final analysis:", updateData.analysis);
                  setFinalReport(updateData.analysis || null);
                  setIsLoading(false);
                  reader.cancel();
                  break;
                }
              } else {
                console.log("Event has no data property:", event);
              }
            } catch (error) {
              console.error("Error processing line:", error);
              console.log("Problematic line:", line);
            }
          }
        }
      } catch (error) {
        console.error("Error in stream reading:", error);
      }
    } catch (error) {
      console.error("Error in research:", error);
    } finally {
      console.log("Request complete");
      setIsLoading(false);
      setIsInputVisible(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (userQuery.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const handleNewChat = () => {
    setUserQuery("");
    setUpdates([]);
    setStages([]);
    setFinalReport(null);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900">
      <ChatHeader
        onNewChat={handleNewChat}
        onShareChat={() => {}}
        onViewConversations={() => {}}
        onViewProfile={() => {}}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 px-4 sm:px-8 md:px-12 lg:px-20 xl:px-[20%]"
        >
          {/* Initial message */}
          {updates.length === 0 ? (
            <div className="flex items-center justify-start h-full ml-4 xl:justify-center xl:ml-0">
              <div className="text-left xl:text-center">
                <h2 className="text-2xl font-semibold mb-1 dark:text-white">Deep Research 🔍</h2>
                <p className="text-xl text-gray-500 dark:text-zinc-400 mb-4">
                  What would you like me to research?
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* User query */}
              <DeepResearchMessage 
                role="user"
                content={userQuery}
              />

              {/* Initial loading state */}
              {isInitializing && (
                <div className="flex justify-start">
                  <div className="w-full max-w-[1200px] mx-auto">
                    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                        <span className="text-zinc-300">Creating research plan...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Research process card */}
              {!isInitializing && stages.length > 0 && (
                <div className="flex justify-start">
                  <div className="w-full max-w-[1200px] mx-auto">
                    <DeepResearchCard
                      stages={stages}
                      updates={updates}
                      selectedStage={selectedStage}
                      onStageSelect={setSelectedStage}
                    />
                  </div>
                </div>
              )}

              {/* Final report */}
              {finalReport && (
                <DeepResearchMessage 
                  role="assistant"
                  content={finalReport}
                />
              )}
            </>
          )}

          {/* Floating scroll to bottom button */}
          {!autoScroll && !isProgrammaticScrolling && (
            <button 
              onClick={() => scrollToBottom(true, true)}
              className="fixed bottom-36 right-8 w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shadow-md hover:bg-zinc-300 dark:hover:bg-zinc-600 focus:outline-none z-10"
            >
              <ChevronDown size={20} className="text-zinc-800 dark:text-zinc-200" />
            </button>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleSubmit} className="relative">
            <div className="w-full rounded-[24px] px-4 py-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-2">
              <textarea 
                ref={inputRef}
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 resize-none min-h-[24px] max-h-[200px] overflow-y-auto"
                placeholder="Enter a research topic..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none disabled:opacity-50 transition-all duration-200"
                disabled={isLoading || !userQuery.trim()}
              >
                {isLoading ? (
                  <div className="h-5 w-5 rounded-full border-2 border-white dark:border-zinc-900 border-t-transparent animate-spin" />
                ) : (
                  "Research"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 