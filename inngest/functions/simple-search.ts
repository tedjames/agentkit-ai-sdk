import { State, createState } from "@inngest/agent-kit";
import Browserbase from "@browserbasehq/sdk";

import { inngest } from "../client";
import { getStagehand } from "./simple-search/utils";
import { searchNetwork } from "./simple-search/index";
import { SimpleSearchState } from "./simple-search/index";

export const simpleSearchAgent = inngest.createFunction(
  {
    id: "simple-search-agent-workflow",
  },
  {
    event: "app/simple-search-agent.run",
  },
  async ({ step, event, publish }) => {
    const { uuid } = event.data;

    const bb = new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY as string,
    });

    await publish({
      channel: `simple-search.${uuid}`,
      topic: "updates",
      data: `Starting search for "${event.data.input}"`,
    });

    const browserbaseSessionID = await step.run(
      "create_browserbase_session",
      async () => {
        const session = await bb.sessions.create({
          projectId: process.env.BROWSERBASE_PROJECT_ID as string,
          keepAlive: true,
        });
        return session.id;
      }
    );

    // Create a properly typed state instead of using the deprecated kv API
    const state = createState<SimpleSearchState>({
      browserbaseSessionID,
      "session-uuid": uuid
    });

    const response = await searchNetwork.run(event.data.input, {
      state,
    });

    const lastResult =
      response.state.results[response.state.results.length - 1];
    const answer =
      lastResult.output[0].type === "text"
        ? lastResult.output[0].content.toString()
        : "No answer found";

    await publish({
      channel: `simple-search.${uuid}`,
      topic: "updates",
      data: answer,
    });

    await publish({
      channel: `simple-search.${uuid}`,
      topic: "updates",
      data: "Search complete",
    });

    await step.run("close-browserbase-session", async () => {
      const stagehand = await getStagehand(browserbaseSessionID);
      await stagehand.close();
    });

    return {
      response,
    };
  }
);
