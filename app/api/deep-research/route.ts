import crypto from "crypto";
import { inngest } from "@/inngest/client";
import { subscribe } from "@inngest/realtime";

export async function POST(req: Request) {
  const json = await req.json();
  const { topic, context, useV2 = true } = json;

  if (!topic) {
    return new Response(
      JSON.stringify({ error: "A research topic is required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const uuid = crypto.randomUUID();

  await inngest.send({
    name: "deep-research/run",
    data: {
      uuid,
      topic,
      context: context || "",
      useV2, // Pass the useV2 flag to control which engine version to use
    },
  });

  const stream = await subscribe({
    app: inngest,
    channel: `deep-research.${uuid}`,
    topics: ["updates"], // subscribe to updates from the research process
  });

  return new Response(stream.getEncodedStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
