import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow responses up to 5 minutes
export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('o3-mini'),
    system: `When displaying code, always wrap code blocks with triple backticks and include the appropriate language tag.

Example:
\`\`\`javascript
// This is well-formatted JavaScript code
function example() {
  const x = 10;
  return x * 2;
}
\`\`\`

Ensure all code is properly indented, well-spaced, and follows standard formatting conventions for the language. Preserve line breaks and indentation in code blocks. For inline code, use single backticks.`,
    messages,
  });

  return result.toDataStreamResponse();
}