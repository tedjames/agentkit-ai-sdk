import {
  createNetwork,
  createAgent,
  openai,
  createState,
  TextMessage,
  Message,
} from "@inngest/agent-kit";
import { inngest } from "../client";

// Define the network state interface
interface NetworkState {
  query: string | undefined;
  networkComplete: boolean;
  response?: string;
  threadId?: string;
  messages: Message[];
}

// Create the Inngest function
export const simpleAgentFunction = inngest.createFunction(
  { id: "simple-agent-workflow" },
  { event: "simple-agent/run" },
  async ({ step, event, publish }) => {
    const { query, threadId, messages = [] } = event.data;

    console.log("=== Starting Simple Agent Function ===");
    console.log("Received event data:", {
      query,
      threadId,
      messageCount: messages.length,
      messages: messages,
    });

    // Create a simple agent that can respond to queries
    const simpleAgent = createAgent<NetworkState>({
      name: "simple_agent",
      description: "A simple agent that can respond to general queries",
      system: `You are a helpful assistant that can answer questions and engage in conversation.
  
When responding:
1. Be clear and concise
2. Use markdown formatting when appropriate
3. If you don't know something, say so

Previous conversation history will be provided in the network state's messages array. Use this context to provide relevant and contextual responses.`,
      model: openai({
        model: "gpt-4o",
      }),
    });

    // Add the current query as a user message
    const userMessage: TextMessage = {
      type: "text",
      role: "user",
      content: query,
    };

    console.log("Creating network state with messages:", {
      existingMessages: messages,
      newUserMessage: userMessage,
    });

    // Create properly typed state for this run
    const state = createState<NetworkState>({
      query,
      networkComplete: false,
      threadId,
      messages: [...messages, userMessage], // Include previous messages and current query
    });

    console.log("Created network state:", {
      messageCount: state.data.messages.length,
      messages: state.data.messages,
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
        console.log("Router called with state:", {
          messageCount: state.messages.length,
          messages: state.messages,
          networkComplete: state.networkComplete,
          resultsCount: network.state.results.length,
        });

        // If network is complete, stop
        if (state.networkComplete) {
          return undefined;
        }

        // Publish the agent's response if available
        if (network.state.results.length > 0) {
          const lastResult =
            network.state.results[network.state.results.length - 1];
          console.log("Processing last result:", {
            agentName: lastResult.agentName,
            outputCount: lastResult.output.length,
            output: lastResult.output,
          });

          const lastMessage = lastResult.output[0] as TextMessage;

          if (lastMessage?.type === "text") {
            // Store the response in state
            state.response =
              typeof lastMessage.content === "string"
                ? lastMessage.content
                : lastMessage.content[0].text;
            state.networkComplete = true;

            // Create the assistant message
            const assistantMessage: TextMessage = {
              type: "text",
              role: "assistant",
              content: state.response,
            };

            // Add to state messages
            state.messages.push(assistantMessage);

            console.log("Updated state messages after assistant response:", {
              messageCount: state.messages.length,
              messages: state.messages,
            });

            await publish({
              channel: `chat.${state.threadId}`,
              topic: "messages",
              data: {
                message: assistantMessage,
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
    console.log("Running network with state:", {
      messageCount: state.data.messages.length,
      messages: state.data.messages,
    });

    const response = await simpleNetwork.run(query, { state });

    console.log("Network run complete:", {
      messageCount: response.state.data.messages.length,
      messages: response.state.data.messages,
      response: response.state.data.response,
    });

    // Send completion event
    await publish({
      channel: `chat.${threadId}`,
      topic: "messages",
      data: {
        status: "complete",
      },
    });

    // Return the final response and messages
    return {
      response: response.state.data.response,
      messages: response.state.data.messages,
    };
  }
);
