"use client";

import React, { useEffect, useState } from 'react';
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

// Component for client-side markdown rendering
function ClientMarkdown({ content }: { content: string }) {
  const [MarkdownComponent, setMarkdownComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    // Dynamically import markdown components only on client
    async function loadMarkdown() {
      try {
        const [
          ReactMarkdown, 
          remarkGfm, 
          rehypeRaw, 
          rehypeHighlight
        ] = await Promise.all([
          import('react-markdown').then(mod => mod.default),
          import('remark-gfm').then(mod => mod.default),
          import('rehype-raw').then(mod => mod.default),
          import('rehype-highlight').then(mod => mod.default)
        ]);
        
        // Load highlight.js styles by creating a link element
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css';
        document.head.appendChild(link);
        
        // Add custom styles for code formatting
        const codeStyle = document.createElement('style');
        codeStyle.textContent = `
          .prose pre {
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .code-block {
            background-color: rgb(30, 30, 30);
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
            overflow-x: auto;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 14px;
            line-height: 1.5;
            tab-size: 2;
            -moz-tab-size: 2;
          }
          .code-block code {
            padding: 0 !important;
            background: transparent !important;
            white-space: pre;
            display: block;
          }
          .inline-code {
            background-color: rgba(110, 118, 129, 0.4);
            border-radius: 3px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 85%;
            padding: 0.2em 0.4em;
          }
        `;
        document.head.appendChild(codeStyle);
        
        // Create a component with all plugins configured
        const CustomMarkdown = (props: { children: string }) => (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
            components={{
              code: (codeProps: any) => {
                const { children, className, inline } = codeProps;
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <div className="code-block">
                    <code className={className}>
                      {children}
                    </code>
                  </div>
                ) : (
                  <code className="inline-code">
                    {children}
                  </code>
                );
              },
              pre: (preProps: any) => {
                return <>{preProps.children}</>;
              },
            }}
          >
            {props.children}
          </ReactMarkdown>
        );
        
        setMarkdownComponent(() => CustomMarkdown);
      } catch (error) {
        console.error("Error loading markdown components:", error);
      }
    }
    
    loadMarkdown();
  }, []);
  
  if (!MarkdownComponent) {
    // Fallback until markdown is loaded
    return (
      <>
        {content.split('\n\n').map((paragraph, i) => (
          <p key={i} className="mb-4">{paragraph}</p>
        ))}
      </>
    );
  }
  
  return <MarkdownComponent>{content}</MarkdownComponent>;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [isClient, setIsClient] = useState(false);
  
  // Only enable client-side features after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="bg-blue-500 text-white p-3 rounded-lg max-w-3xl">
          <p>{message.content}</p>
        </div>
      ) : (
        <div className="max-w-3xl dark:text-white">
          <div className="prose dark:prose-invert prose-sm max-w-none">
            {isClient ? (
              <ClientMarkdown content={message.content} />
            ) : (
              // Server-side or initial client render
              message.content.split('\n\n').map((paragraph, i) => (
                <p key={i} className="mb-4">{paragraph}</p>
              ))
            )}
          </div>
          
          {message.researchProcess && (
            <DeepResearchProcess steps={message.researchProcess.steps} />
          )}
        </div>
      )}
    </div>
  );
} 