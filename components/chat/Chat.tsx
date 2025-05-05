"use client";

import React, { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';

export function Chat() {
  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit,
    status,
    error 
  } = useChat({
    api: '/api/chat'
  });

  const handleNewChat = () => {
    window.location.reload();
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
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      <ChatHeader
        onNewChat={handleNewChat}
        onShareChat={handleShareChat}
        onViewConversations={handleViewConversations}
        onViewProfile={handleViewProfile}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {formattedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2 dark:text-white">Welcome to AgentKit</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Ask me anything or enable deep research for in-depth answers
              </p>
            </div>
          </div>
        ) : (
          formattedMessages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))
        )}
        
        {(status === 'submitted' || status === 'streaming') && (
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
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
        <form onSubmit={handleSubmit} className="relative flex items-end">
          <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pr-24 min-h-12 max-h-60 overflow-y-auto bg-white dark:bg-gray-800">
            <textarea 
              name="prompt"
              className="w-full resize-none outline-none bg-transparent text-gray-900 dark:text-white" 
              placeholder="Message AgentKit..."
              rows={1}
              value={input}
              onChange={handleInputChange}
              disabled={status !== 'ready'}
            />
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button 
              type="button"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="Attach files (coming soon)"
              disabled={status !== 'ready'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-paperclip">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button 
              type="button"
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="Deep research (coming soon)"
              disabled={status !== 'ready'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span className="sr-only">Deep Research</span>
            </button>
            <button 
              type="submit"
              className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!input.trim() || status !== 'ready'}
              title="Send message"
            >
              {status === 'submitted' || status === 'streaming' ? (
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
        </form>
      </div>
    </div>
  );
} 