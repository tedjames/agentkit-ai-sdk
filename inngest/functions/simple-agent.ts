import {
  createNetwork,
  createAgent,
  openai,
  createState,
  TextMessage,
} from "@inngest/agent-kit";
import { inngest } from "../client";

// Define the network state interface
interface NetworkState {
  query: string | undefined;
  networkComplete: boolean;
  response?: string;
  threadId?: string;
}

// Create the Inngest function
export const simpleAgentFunction = inngest.createFunction(
  { id: "simple-agent-workflow" },
  { event: "simple-agent/run" },
  async ({ step, event, publish }) => {
    const { query, threadId } = event.data;

    // Create a simple agent that can respond to queries
    const simpleAgent = createAgent<NetworkState>({
      name: "simple_agent",
      description: "A simple agent that can respond to general queries",
      system: `You are a helpful assistant that can answer questions and engage in conversation.
  
When responding:
1. Be clear and concise
2. Use markdown formatting when appropriate
3. If you don't know something, say so`,
      model: openai({
        model: "gpt-4o",
      }),
    });

    // Create properly typed state for this run
    const state = createState<NetworkState>({
      query,
      networkComplete: false,
      threadId,
      // add messages here
    });

    // Create the network
    const simpleNetwork = createNetwork<NetworkState>({
      name: "simple_network",
      agents: [simpleAgent],
      defaultModel: openai({
        model: "gpt-4o",
      }),
      defaultState: state,
      router: async ({ network }) => {
        const state = network.state.data;

        // If network is complete, stop
        if (state.networkComplete) {
          return undefined;
        }

        // Publish the agent's response if available
        if (network.state.results.length > 0) {
          const lastResult =
            network.state.results[network.state.results.length - 1];
          const lastMessage = lastResult.output[0] as TextMessage;

          if (lastMessage?.type === "text") {
            // Store the response in state
            state.response =
              typeof lastMessage.content === "string"
                ? lastMessage.content
                : lastMessage.content[0].text;
            state.networkComplete = true;

            await publish({
              channel: `chat.${state.threadId}`,
              topic: "messages",
              data: {
                message: {
                  type: "text",
                  role: "assistant",
                  content: state.response,
                },
              },
            });
          }
        }

        // Default to the simple agent
        return simpleAgent;
      },
      maxIter: 2, // Limit to 3 iterations to prevent infinite loops
    });

    // Run the network with the query
    const response = await simpleNetwork.run(query, { state });

    // Send completion event
    await publish({
      channel: `chat.${threadId}`,
      topic: "messages",
      data: {
        status: "complete",
      },
    });

    // Return the final response
    return {
      response: response.state.data.response,
    };
  }
);
