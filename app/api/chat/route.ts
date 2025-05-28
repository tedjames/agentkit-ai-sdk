import { simpleAgentFunction } from "@/inngest/functions/simple-agent";
import { inngest } from "@/inngest/client";
import { subscribe } from "@inngest/realtime";

// Allow responses up to 5 minutes
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  const { query, threadId } = body;

  if (!query || !threadId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: query and threadId" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Send the event to trigger the agent
  try {
    await inngest.send({
      name: "simple-agent/run",
      data: {
        query,
        threadId,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to run agent" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Subscribe to the stream of updates using the same threadId
  const stream = await subscribe({
    app: inngest,
    channel: `chat.${threadId}`,
    topics: ["messages"],
  });

  return new Response(stream.getEncodedStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
