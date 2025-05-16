Integrations
Smithery - MCP Registry
Provide your Agents with hundred of prebuilt tools to interact with

Smithery is an MCP (Model Context Protocol) servers registry, listing more than 2,000 MCP servers across multiple use cases:

Code related tasks (ex: GitHub, E2B)
Web Search Integration (ex: Brave, Browserbase)
Database Integration (ex: Neon, Supabase)
Financial Market Data
Data & App Analysis
And more…
​
Adding a Smithery MCP Server to your Agent
1
Install AgentKit

Within an existing project, install AgentKit along with the Smithery SDK:


npm

pnpm

yarn

Copy
npm install @inngest/agent-kit @smithery/sdk

Don't have an existing project?

2
2. Setup an AgentKit Newtork with an Agent

Create an Agent and its associated Network, for example a Neon Assistant Agent:


Copy
import { z } from "zod";
import {
  anthropic,
  createAgent,
  createNetwork,
  createTool,
} from "@inngest/agent-kit";

const neonAgent = createAgent({
  name: "neon-agent",
  system: `You are a helpful assistant that help manage a Neon account.
  IMPORTANT: Call the 'done' tool when the question is answered.
  `,
  tools: [
    createTool({
      name: "done",
      description: "Call this tool when you are finished with the task.",
      parameters: z.object({
        answer: z.string().describe("Answer to the user's question."),
      }),
      handler: async ({ answer }, { network }) => {
        network?.state.kv.set("answer", answer);
      },
    }),
  ],
});

const neonAgentNetwork = createNetwork({
  name: "neon-agent",
  agents: [neonAgent],
  defaultModel: anthropic({
    model: "claude-3-5-sonnet-20240620",
    defaultParameters: {
      max_tokens: 1000,
    },
  }),
  router: ({ network }) => {
    if (!network?.state.kv.get("answer")) {
      return neonAgent;
    }
    return;
  },
});
3
Add the Neon MCP Smithery Server to your Agent

Add the Neon MCP Smithery Server to your Agent by using createSmitheryUrl() from the @smithery/sdk/config.js module and providing it to the Agent via the mcpServers option:


Copy
import {
  anthropic,
  createAgent,
  createNetwork,
  createTool,
} from "@inngest/agent-kit";
import { createSmitheryUrl } from "@smithery/sdk/config.js";
import { z } from "zod";

const smitheryUrl = createSmitheryUrl("https://server.smithery.ai/neon/ws", {
  neonApiKey: process.env.NEON_API_KEY,
});

const neonAgent = createAgent({
  name: "neon-agent",
  system: `You are a helpful assistant that help manage a Neon account.
  IMPORTANT: Call the 'done' tool when the question is answered.
  `,
  tools: [
    createTool({
      name: "done",
      description: "Call this tool when you are finished with the task.",
      parameters: z.object({
        answer: z.string().describe("Answer to the user's question."),
      }),
      handler: async ({ answer }, { network }) => {
        network?.state.kv.set("answer", answer);
      },
    }),
  ],
  mcpServers: [
    {
      name: "neon",
      transport: {
        type: "ws",
        url: smitheryUrl.toString(),
      },
    },
  ],
});

const neonAgentNetwork = createNetwork({
  name: "neon-agent",
  agents: [neonAgent],
  defaultModel: anthropic({
    model: "claude-3-5-sonnet-20240620",
    defaultParameters: {
      max_tokens: 1000,
    },
  }),
  router: ({ network }) => {
    if (!network?.state.kv.get("answer")) {
      return neonAgent;
    }
    return;
  },
});
Integrating Smithery with AgentKit requires using the createSmitheryUrl() function to create a valid URL for the MCP server.

Most Smithery servers instruct to use the createTransport() function which is not supported by AgentKit. To use the createSmitheryUrl() function, simply append /ws to the end of the Smithery server URL provided by Smithery.