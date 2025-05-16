- [ ] Define events to publish for Deep Research functionality
- [ ] Determine event schema and structure
- [ ] Plan how the frontend will consume these events

Events to publish and logic before/after each:

1. "processing" - fetching memories

   - simulated memory fetching with step.sleep for now

2. "processing" - analyzing query

   - analyst agent
   - enhance query with LLM
   - generate an analysis of the query and 4-6 clarifying questions

3. "human_input_needed" - Please answer the following clarifying questions

   - wait for event needed here with uuid and event ID sent to/from the frontend
   - just simulate this for now with step.sleep

4. "processing" - fetching memories

   - simulated memory fetching with step.sleep for now

5. "processing" - creating a research plan...

   - planner agent checks plan_completed state, if true then it look at an object mapping (agent_mapping) of
     all available agents + tools they have access to (for now, just EXA)
   - planner agent uses self discover prompting strategy to generate a reflection
   - planner agent uses agent_mapping and reflection to generate a plan consisting of 3-5 stages of research here are some notes on how this will work:
     - each reasoning stage consists of many agents collaborating together
     - each agent has access to certain tools (EXA API for now) and they each generate a tree of thoughts
     - each tree of thought consists of both thoughts and tool calls to fetch context
     - the tree of thought is configured via default network state to have a specific depth and breadth
     - this depth indicates how deep the tree goes and breadth is in reference to how many thoughts are generated
     - thoughts are generated via structured output from an LLM where n breadth of thoughts are generated
     - for each thought the agent has the option to either call the EXA API tool or generate another thought until the depth limit is reached
     - as apart of the research plan process a "plan" object is created and "plan_approved" state is set to false
     - plan object contains a data stucture with mutliple reasoning stages each with a high-level description and tasks for each agent to be done in that stage
     - this plan is generated as a json structured output from an LLM

6. "human_input_needed" - Please approve or provide feedback on the plan

   - simulated approval with step.sleep for now

7. "processing" - Executing research stage 1

8. "human_input_needed" - Please review our phase 1 of our research
   [after each stage of reasoning]

   - present analysis, next steps and ask user for feedback and/or approval to move onto the next step
   - planner agent determines if feedback is related to current stage of reasoning or the next stage
   - if related to current stage, suggest a new plan for current reasoning stage and ask for approval/feedback
   - if approval/feedback is provided, proceed to retry current reasoning stage
   - for now, just simulate this with step.sleep

9. "processing" - Executing research stage 2 & "human_input_needed" - Please review our phase 2 of our research
   (continue with thi processing and human_input_needed events until all reasoning stages are complete)

[after all reasoning stages are complete...]

9. "processing" - Genearating final analysis...

   - aggregates all analyses across all reasoning stages into a single LLM inference call to generate a final analysis
   - saves to final_analysis in network state

10. "complete" - Research complete!

---

todo later:

- [ ] Turn this into a configurable thing where users can define agent/tool mappings to enable multiple reasoning trees in
