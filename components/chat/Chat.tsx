"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { Brain, Paperclip, ChevronDown } from 'lucide-react';

export function Chat() {
  const [chatId, setChatId] = useState(Date.now().toString());
  
  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit: originalHandleSubmit,
    status,
    error
  } = useChat({
    api: '/api/chat',
    id: chatId
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isProgrammaticScrolling, setIsProgrammaticScrolling] = useState(false);
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState("Customer Support");
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(false);
  const workflowMenuRef = useRef<HTMLDivElement>(null);
  
  // Custom pulsing animation keyframes
  const brainPulseKeyframes = `
    @keyframes brainPulse {
      0% {
        filter: drop-shadow(0 0 2px rgba(219, 39, 119, 0.3));
        opacity: 0.7;
      }
      50% {
        filter: drop-shadow(0 0 6px rgba(219, 39, 119, 0.8));
        opacity: 1;
      }
      100% {
        filter: drop-shadow(0 0 2px rgba(219, 39, 119, 0.3));
        opacity: 0.7;
      }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(10px); }
    }
    
    .scroll-button-show {
      animation: fadeIn 0.3s forwards;
    }
    
    .scroll-button-hide {
      animation: fadeOut 0.3s forwards;
      pointer-events: none;
    }
  `;
  
  // Custom scrollbar styles with custom visible scrollbar implementation
  const scrollbarStyles = `
    /* Hide the native scrollbar completely */
    .custom-scrollbar {
      position: relative;
      overflow-y: auto;
      scrollbar-width: none; /* Firefox */
    }
    
    .custom-scrollbar::-webkit-scrollbar {
      display: none; /* WebKit browsers */
    }
    
    /* Custom scrollbar track */
    .scrollbar-track {
      position: absolute;
      top: 0;
      right: 0;
      width: 8px;
      height: 100%;
      background-color: transparent;
      z-index: 10;
      cursor: pointer;
    }
    
    /* Custom scrollbar thumb */
    .scrollbar-thumb {
      position: absolute;
      width: 6px;
      right: 1px;
      border-radius: 3px;
      background-color: rgba(156, 163, 175, 0.5);
      cursor: grab;
      transition: background-color 0.2s, width 0.2s, right 0.2s;
    }
    
    .scrollbar-thumb:hover,
    .scrollbar-thumb:active {
      background-color: rgba(156, 163, 175, 0.8);
      width: 8px;
      right: 0;
    }
    
    .scrollbar-thumb.dragging {
      cursor: grabbing;
      background-color: rgba(156, 163, 175, 0.8);
      width: 8px;
      right: 0;
    }
    
    .dark .scrollbar-thumb {
      background-color: rgba(161, 161, 170, 0.5);
    }
    
    .dark .scrollbar-thumb:hover,
    .dark .scrollbar-thumb:active,
    .dark .scrollbar-thumb.dragging {
      background-color: rgba(161, 161, 170, 0.8);
    }
  `;
  
  // Close workflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workflowMenuRef.current && !workflowMenuRef.current.contains(event.target as Node)) {
        setWorkflowMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Workflow options with their deep research configuration
  const workflowOptions = [
    { name: "Customer Support", deepResearchEnabled: false },
    { name: "Research Assistant", deepResearchEnabled: true },
    { name: "Technical Support", deepResearchEnabled: true },
    { name: "General Chat", deepResearchEnabled: false }
  ];
  
  // Handle workflow change
  const handleWorkflowChange = (workflowName: string) => {
    setSelectedWorkflow(workflowName);
    const workflow = workflowOptions.find(w => w.name === workflowName);
    if (workflow) {
      setDeepSearchEnabled(workflow.deepResearchEnabled);
    }
  };

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

  // Custom submit handler that enables auto-scrolling
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setAutoScroll(true); // Re-enable auto-scrolling when submitting a message
    originalHandleSubmit(e);
  };

  // Handle textarea key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = textarea.value.substring(0, cursorPosition);
      const textAfterCursor = textarea.value.substring(cursorPosition);
      
      const newValue = textBeforeCursor + '\n' + textAfterCursor;
      textarea.value = newValue;
      
      // Update the input state
      handleInputChange({
        target: { value: newValue }
      } as React.ChangeEvent<HTMLTextAreaElement>);
      
      // Set cursor position after the new line
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = cursorPosition + 1;
      }, 0);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && status === 'ready') {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  // Auto-resize textarea
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset the height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (with a max of ~6 lines)
    const lineHeight = 24; // Approximated line height in pixels
    const maxHeight = lineHeight * 6;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    
    textarea.style.height = `${newHeight}px`;
    
    // Update custom scrollbar
    updateCustomScrollbar();
  };
  
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startScrollTop, setStartScrollTop] = useState(0);
  
  // Function to update custom scrollbar position and size
  const updateCustomScrollbar = () => {
    const textarea = textareaRef.current;
    const thumb = thumbRef.current;
    
    if (!textarea || !thumb) return;
    
    const scrollPercentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
    const thumbHeight = Math.max(20, (textarea.clientHeight / textarea.scrollHeight) * textarea.clientHeight);
    
    thumb.style.height = `${thumbHeight}px`;
    
    // Only show thumb if content exceeds max height
    if (textarea.scrollHeight > textarea.clientHeight) {
      thumb.style.display = 'block';
      const thumbPosition = scrollPercentage * (textarea.clientHeight - thumbHeight);
      thumb.style.top = `${thumbPosition}px`;
    } else {
      thumb.style.display = 'none';
    }
  };
  
  // Handle thumb drag start
  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    
    const textarea = textareaRef.current;
    if (textarea) {
      setStartScrollTop(textarea.scrollTop);
    }
  };
  
  // Handle thumb dragging
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const deltaY = e.clientY - startY;
    const scrollFactor = textarea.scrollHeight / textarea.clientHeight;
    
    textarea.scrollTop = startScrollTop + (deltaY * scrollFactor);
    updateCustomScrollbar();
  };
  
  // Handle thumb drag end
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Add and remove mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY, startScrollTop]);
  
  // Handle textarea scroll to update custom scrollbar
  const handleTextareaScroll = () => {
    updateCustomScrollbar();
  };
  
  // Handle track click to jump to position
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = e.currentTarget;
    const textarea = textareaRef.current;
    const thumb = thumbRef.current;
    
    if (!textarea || !thumb) return;
    
    // Get relative position in the track
    const rect = track.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    // Calculate thumb height
    const thumbHeight = Math.max(20, (textarea.clientHeight / textarea.scrollHeight) * textarea.clientHeight);
    
    // Calculate new scroll position
    const scrollableHeight = textarea.scrollHeight - textarea.clientHeight;
    const percentage = (relativeY - thumbHeight / 2) / (textarea.clientHeight - thumbHeight);
    const scrollAmount = percentage * scrollableHeight;
    
    // Update scroll position
    textarea.scrollTop = Math.max(0, Math.min(scrollAmount, scrollableHeight));
    updateCustomScrollbar();
  };

  // Resize textarea when input changes
  useEffect(() => {
    resizeTextarea();
  }, [input]);
  
  // Initialize textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      resizeTextarea();
      updateCustomScrollbar();
    }
  }, []);

  // Handle user scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      // Check if scrolled to bottom
      const isScrolledToBottom = 
        container.scrollHeight - container.clientHeight <= container.scrollTop + 10; // 10px threshold
      
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

  // Scroll to bottom when new messages come in or during streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  const handleNewChat = () => {
    setChatId(Date.now().toString());
  };

  const handleShareChat = () => {
    console.log('Share chat clicked');
  };

  const handleViewConversations = () => {
    console.log('View conversations clicked');
  };

  const handleViewProfile = () => {
    console.log('View profile clicked');
  };

  const formattedMessages = messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    researchProcess: undefined
  }));

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900">
      <style>{brainPulseKeyframes}</style>
      <style>{scrollbarStyles}</style>
      <ChatHeader
        onNewChat={handleNewChat}
        onShareChat={handleShareChat}
        onViewConversations={handleViewConversations}
        onViewProfile={handleViewProfile}
      />

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 px-8"
      >
        {formattedMessages.length === 0 ? (
          <div className="flex items-center justify-start h-full ml-4">
            <div className="text-left">
              <h2 className="text-2xl font-semibold mb-1 dark:text-white">Hey there 👋</h2>
              <p className="text-xl text-gray-500 dark:text-zinc-400 mb-4">
                How can I help you today?
              </p>
            </div>
          </div>
        ) : (
          formattedMessages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))
        )}
        
        {(status === 'submitted') && (
          <div className="flex justify-start">
            <div className="max-w-3xl dark:text-white">
              <div className="flex space-x-2 items-center">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex justify-start">
            <div className="max-w-3xl text-red-500 dark:text-red-400 p-3 border border-red-300 dark:border-red-700 rounded-lg">
              <p>Sorry, there was an error processing your request. Please try again.</p>
              <p className="text-sm mt-1">{error.message}</p>
            </div>
          </div>
        )}
        
        {/* Floating scroll to bottom button */}
        {!autoScroll && !isProgrammaticScrolling && (
          <button 
            onClick={() => {
              scrollToBottom(true, true);
            }}
            className={`fixed bottom-36 right-8 w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center shadow-md hover:bg-gray-300 dark:hover:bg-zinc-600 focus:outline-none z-10 scroll-button-show`}
          >
            <ChevronDown size={20} className="text-gray-800 dark:text-zinc-200" />
          </button>
        )}
      </div>

      <div className="p-3 bg-white dark:bg-zinc-900 px-8">
        <form onSubmit={handleSubmit} className="relative">
          <div className="w-full rounded-[24px] px-2.5 pb-2.5 pt-5 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm flex flex-col">
            {/* First row - Textarea with custom scrollbar */}
            <div className="w-full mb-3 relative">
              <div className="relative">
                <textarea 
                  ref={textareaRef}
                  className="custom-scrollbar w-full px-2.5 pb-2 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 resize-none min-h-[24px]"
                  placeholder="How can AgentKit help?"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onScroll={handleTextareaScroll}
                  rows={1}
                  disabled={status !== 'ready'}
                  style={{
                    height: 'auto',
                  }}
                />
                <div className="scrollbar-track" onClick={handleTrackClick}>
                  <div 
                    ref={thumbRef} 
                    className={`scrollbar-thumb ${isDragging ? 'dragging' : ''}`}
                    onMouseDown={handleThumbMouseDown}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Second row - All buttons */}
            <div className="flex items-center justify-between">
              {/* Left side buttons */}
              <div className="flex items-center space-x-2">
                {/* Attachment button */}
                <button 
                  type="button"
                  className="py-2 px-2 rounded-2xl border border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 focus:outline-none"
                  disabled={status !== 'ready'}
                >
                  <Paperclip size={16} className='rotate-[315deg]' />
                </button>
                
                {/* Deep Research status indicator */}
                {deepSearchEnabled && (
                  <div className="flex items-center py-2 px-3 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-300 dark:border-violet-800/30">
                    <style>
                      {`
                        .brain-gradient {
                          stroke: url(#brainGradient);
                        }
                      `}
                    </style>
                    <svg width="0" height="0">
                      <defs>
                        <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#db2777" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <Brain 
                      className="brain-gradient mr-1.5"
                      size={16}
                      style={{
                        filter: "drop-shadow(0 0 2px rgba(219, 39, 119, 0.5))",
                        animation: "brainPulse 2s infinite ease-in-out"
                      }}
                    />
                    Deep Research
                  </div>
                )}
              </div>
              
              {/* Right side buttons */}
              <div className="flex items-center">
                {/* Workflow selector */}
                <div className="relative">
                  <button
                    type="button"
                    className="py-1 px-3 rounded-full text-sm flex items-center text-gray-800 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 focus:outline-none"
                    onClick={() => setWorkflowMenuOpen(prev => !prev)}
                    disabled={status !== 'ready'}
                  >
                    {selectedWorkflow}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down ml-1">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  
                  {/* Workflow dropdown menu */}
                  {workflowMenuOpen && (
                    <div 
                      ref={workflowMenuRef}
                      className="absolute bottom-full mb-1 right-0 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-10"
                    >
                      <ul className="py-1">
                        {workflowOptions.map((workflow) => (
                          <li key={workflow.name}>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center"
                              onClick={() => {
                                handleWorkflowChange(workflow.name);
                                setWorkflowMenuOpen(false);
                              }}
                            >
                              {workflow.name}
                              {workflow.deepResearchEnabled && (
                                <Brain
                                  className="brain-gradient ml-2"
                                  size={12}
                                />
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* Submit button */}
                <button 
                  type="submit"
                  className="p-2 ml-1 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  disabled={!input.trim() || status !== 'ready'}
                >
                  {status === 'submitted' || status === 'streaming' ? (
                    <div className="h-5 w-5 border-t-2 border-current rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up">
                      <path d="m12 19-7-7 7-7"/>
                      <path d="M5 12h14"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 