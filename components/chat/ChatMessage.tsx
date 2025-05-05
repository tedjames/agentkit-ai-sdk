"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
// @ts-ignore
import { DeepResearchProcess } from './DeepResearchProcess';

export interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    researchProcess?: {
      steps: Array<{
        name: string;
        status: 'completed' | 'in-progress' | 'pending';
      }>;
    };
  };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="bg-blue-500 text-white p-3 rounded-lg max-w-3xl">
          <p>{message.content}</p>
        </div>
      ) : (
        <div className="max-w-3xl dark:text-white">
          <div className="prose dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              // @ts-ignore
              components={{
                // @ts-ignore
                code: (props: any) => {
                  const { children, className, inline } = props;
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div className="bg-gray-800 rounded-md p-4 my-4 overflow-x-auto">
                      <code className={className}>
                        {children}
                      </code>
                    </div>
                  ) : (
                    <code className={`${className || ''} px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-md`}>
                      {children}
                    </code>
                  );
                },
                // @ts-ignore
                pre: (props: any) => {
                  return <>{props.children}</>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
          {message.researchProcess && (
            <DeepResearchProcess steps={message.researchProcess.steps} />
          )}
        </div>
      )}
    </div>
  );
} 