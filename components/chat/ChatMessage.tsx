"use client";

import React, { useEffect, useState, useRef } from 'react';
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
            margin: 16px 0;
            overflow: hidden;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 14px;
            line-height: 1.5;
            tab-size: 2;
            -moz-tab-size: 2;
          }
          .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background-color: rgb(40, 40, 40);
            border-bottom: 1px solid rgb(60, 60, 60);
          }
          .language-label {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
          }
          .copy-button {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            color: rgba(255, 255, 255, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .copy-button:hover {
            background-color: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
          }
          .copy-icon {
            width: 16px;
            height: 16px;
          }
          .code-content {
            padding: 16px;
            overflow-x: auto;
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
          
          /* Extremely aggressive fix for unselectable backticks */
          .code-content code::before,
          .code-content code::after {
            content: none !important;
            display: none !important;
          }
          
          /* Completely disable any auto-inserted content */
          .hljs::before,
          .hljs::after {
            content: none !important;
            display: none !important;
          }
          
          /* Target highlight.js span elements that might contain backticks */
          .hljs span:first-of-type,
          .hljs span:last-of-type {
            position: relative;
          }
          
          /* Hide text that starts with a backtick at the beginning of code */
          .hljs > span:first-of-type {
            display: inline-block;
          }
          
          .hljs > span:first-of-type[data-backtick-fixed]::before {
            content: "";
            display: none;
          }
        `;
        document.head.appendChild(codeStyle);
        
        // Function to copy code to clipboard
        const copyToClipboard = (element: HTMLElement | null) => {
          if (!element) return;
          
          // Get the actual text content from the DOM element
          const textContent = element.textContent || '';
          
          navigator.clipboard.writeText(textContent).then(() => {
            // Could add a toast notification here
            console.log('Code copied to clipboard');
          }).catch(err => {
            console.error('Could not copy text: ', err);
          });
        };
        
        // Create a component with all plugins configured
        const CustomMarkdown = (props: { children: string }) => {
          // Apply more aggressive backtick cleaning to the input markdown string
          let cleanedMarkdown = props.children;

          // First, handle the specific pattern of backticks around code blocks
          // 1. Remove backtick at the start of a code block
          cleanedMarkdown = cleanedMarkdown.replace(/```([a-z]*)\n`/g, '```$1\n');
          
          // 2. Remove backtick at the end of a code block
          cleanedMarkdown = cleanedMarkdown.replace(/`\n```/g, '\n```');
          
          // 3. Handle case where the entire first line after code fence is just a backtick
          cleanedMarkdown = cleanedMarkdown.replace(/```([a-z]*)\n`\n/g, '```$1\n\n');
          
          // 4. Handle case where the last line before the end fence is just a backtick
          cleanedMarkdown = cleanedMarkdown.replace(/\n`\n```/g, '\n\n```');
          
          // 5. Remove backticks at the very start of content within a code block 
          // (after the opening fence, but without a newline)
          cleanedMarkdown = cleanedMarkdown.replace(/```([a-z]*)(`)/g, '```$1');
          
          // 6. Remove backticks at the very end of content within a code block
          // (right before the closing fence, but without a newline)
          cleanedMarkdown = cleanedMarkdown.replace(/(`)(```)$/gm, '$2');
          
          return (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={{
                code: (codeProps: any) => {
                  const { children, className, inline } = codeProps;
                  const match = /language-(\w+)/.exec(className || '');
                  const codeRef = useRef<HTMLElement>(null);
                  
                  // Simple string cleaning for code content
                  let cleanedContent = children;
                  if (typeof children === 'string') {
                    cleanedContent = children.replace(/^`|`$/g, '');
                  }
                  
                  if (!inline && match) {
                    const language = match[1];
                    
                    return (
                      <div className="code-block">
                        <div className="code-header">
                          <span className="language-label">{language}</span>
                          <button 
                            className="copy-button" 
                            onClick={() => copyToClipboard(codeRef.current)}
                            aria-label="Copy code"
                          >
                            <svg className="copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        <div className="code-content">
                          <code ref={codeRef} className={className}>
                            {cleanedContent}
                          </code>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <code className="inline-code">
                      {cleanedContent}
                    </code>
                  );
                },
                pre: (preProps: any) => {
                  return <>{preProps.children}</>;
                },
              }}
            >
              {cleanedMarkdown}
            </ReactMarkdown>
          );
        };
        
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
    
    // Direct fix for backticks in code blocks after a short delay to ensure content is rendered
    const timeoutId = setTimeout(() => {
      // Find all code blocks
      const codeBlocks = document.querySelectorAll('.code-content code');
      
      codeBlocks.forEach((codeBlock) => {
        // Directly manipulate the DOM to replace the content 
        // by removing backticks at the beginning and end
        const content = codeBlock.innerHTML;
        
        // Check for backtick at the start
        if (content.startsWith('`') || content.startsWith('<span class="hljs-punctuation">`</span>')) {
          // First try to replace a plain backtick
          let newContent = content.replace(/^`/, '');
          
          // If that didn't work, try to replace a highlighted backtick
          newContent = newContent.replace(/^<span class="hljs-punctuation">`<\/span>/, '');
          
          // Apply the changes directly to the DOM
          if (newContent !== content) {
            codeBlock.innerHTML = newContent;
          }
        }
        
        // Check for backtick at the end
        const updatedContent = codeBlock.innerHTML;
        if (updatedContent.endsWith('`') || updatedContent.endsWith('<span class="hljs-punctuation">`</span>')) {
          // First try to replace a plain backtick at the end
          let newContent = updatedContent.replace(/`$/, '');
          
          // If that didn't work, try to replace a highlighted backtick
          newContent = newContent.replace(/<span class="hljs-punctuation">`<\/span>$/, '');
          
          // Apply the changes
          if (newContent !== updatedContent) {
            codeBlock.innerHTML = newContent;
          }
        }
      });
    }, 100); // Short delay to ensure content is rendered
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white p-3 rounded-xl max-w-3xl border border-zinc-300 dark:border-zinc-600">
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