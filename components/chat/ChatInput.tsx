"use client";

import React, { useState } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string, deepResearch: boolean) => void;
  onAttachFiles: () => void;
}

export function ChatInput({ onSendMessage, onAttachFiles }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [deepResearch, setDeepResearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendMessage = () => {
    if (message.trim()) {
      try {
        setIsSubmitting(true);
        console.log('Sending message from input component:', message);
        
        // Store message to local variable before clearing input
        const messageToSend = message.trim();
        
        // Clear input immediately for better UX
        setMessage('');
        
        // Send the message
        onSendMessage(messageToSend, deepResearch);
        
        // Keep deep research toggle state for better UX
      } catch (error) {
        console.error('Error sending message:', error);
        // Restore message if there was an error
        setMessage(message);
      } finally {
        setTimeout(() => {
          setIsSubmitting(false);
        }, 500); // Small delay to prevent multiple sends
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize the textarea based on content
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);
    
    // Reset height to shrink if needed
    textarea.style.height = 'auto';
    
    // Set the height based on scrollHeight (content height)
    const newHeight = Math.min(textarea.scrollHeight, 200); // Max height of 200px
    textarea.style.height = `${newHeight}px`;
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
      <div className="relative flex items-end">
        <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pr-24 min-h-12 max-h-60 overflow-y-auto bg-white dark:bg-gray-800">
          <textarea 
            className="w-full resize-none outline-none bg-transparent text-gray-900 dark:text-white" 
            placeholder="Message AgentKit..."
            rows={1}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button 
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            onClick={onAttachFiles}
            title="Attach files"
            disabled={isSubmitting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-paperclip">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <button 
            className={`p-2 rounded-md ${
              deepResearch 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setDeepResearch(!deepResearch)}
            title="Toggle deep research (Coming soon)"
            disabled={isSubmitting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span className="sr-only">Deep Research</span>
          </button>
          <button 
            className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSendMessage}
            disabled={!message.trim() || isSubmitting}
            title="Send message"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 border-t-2 border-white rounded-full animate-spin"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
            <span className="sr-only">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
} 