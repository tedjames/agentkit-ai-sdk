# AgentKit-Chat Tasks

---

## v2 Research Network

Tasks, agents, etc - anything needed to develop v2 of the research network

- [ ] Global variables are used to define our maxDepth and maxBreadth paramaters for now

- [ ] StagingAgent - creates reasoning stages

  1. use self discover prompting to select and adapt a series of reasoning stages, all in one-shot. each stage. save this to state as an object of reasoning stages, each reasoning stage has state that we track to manage control flow including reasoningComplete and analysisComplete
  2. set stagingComplete to true

- [ ] ReasoningAgent - creates a reasoning tree for a given reasoning stage 0. get breadth, depth and current reasoning stage

  1. use self discover prompting to select and adapt initial n breadth worth of queries (each query should also have reasoning behind it in the QueryItem object)
  2. for each query and in parallel (if possible), generate n search queries
  3. for each QueryItem, generate a text-based reflection of the findings and a relevancyScore (from 0.0 - 1.0) given the original query and reasoning behind the query
  4. for each reflection/thought generated from a query, generate n breadth of additional queries (with query and reasoning) we might want to make via structured output until n depth of the tree has been reached
  5. repeat steps 3 and 4 until n depth has been reached
  6. when n depth limit has been reached set "reasoningComplete" for the current reasoning stage as true and "analysisComplete" for the current reasoning stage as false.

- [ ] Router - Publishes event with data:
      check to see which reasoning stage is not yet
      data: {
      type: "deep-research",
      message: `Reasoning`,
      tree: (reasoning tree)
      stageNumber: 1
      },

- [ ] AnalysisAgent - analyze reasoning stage 0. Goes through all reasoning trees in the right order by mapping through all stages in order of their index/stage number and check to see if analysisCompleted is false and if a reasoning tree is available.
      0.1. if current reasoning stage > 1 then get analysis from previous reasoning stage and use it to draw parallels with current results. do so by using self discover prompting to select and adapt question targeted around comparing each stage of analysis.
      0.2. answer each adapted question in parallel using generateObject
  1. if reasoning tree available, use it to then use self-discover prompting to select and adapt a series of reflective / analytical questions given the entire tree (include reflection/comparison between current and prior reasoning stage)
  2. In parallel, answer each question
  3. Create an outline for the paper including sections that cover each self-discovery question generated earlier, 3 additional "wildcard" / open-ended
  4. Generate text for each section of the report in parallel
  5. Given all prior sections, generate key findings, conclusion and introduction in one structured output
  6. make reasoning stage with reasoningComplete and analysisComplete as both true

notes:

what is self-discover prompting?

Self-discover prompting involves having an array of questions that are kind of specific to a state domain, or in our case, like specific to a particular stage of reasoning. So, you know, we'll have kind of a set of questions, and then the first thing we do is we give, yeah, we have a preset set of questions that are like having generalized ways of thinking almost like mixed models. I'll give you a few examples here in a second. And then you have the LL, we kind of like select a certain amount of those, depending on the breadth integration. So that might be like five to start. And then for each of those five questions that you've selected, you want to adapt those questions. So kind of contextualize them to the context of what we're trying to analyze and reflect upon. And then after we've adapted all of those questions, you have contextualized questions now, and then answer them in the context of whatever, you know, context you want to give it. So that could be the full reason, create the past node, the original input, and current node. And, you know, just to get the notes that I've laid out above as far as I want to handle that.

Example "Reasoning module" (aka a set of questions within a self discover prompting strategy):

reasoning_modules = [
"1. How could I devise an experiment to help solve that problem?",
"2. Make a list of ideas for solving this problem, and apply them one by one to the problem to see if any progress can be made.",
# "3. How could I measure progress on this problem?",
"4. How can I simplify the problem so that it is easier to solve?",
"5. What are the key assumptions underlying this problem?",
"6. What are the potential risks and drawbacks of each solution?",
"7. What are the alternative perspectives or viewpoints on this problem?",
"8. What are the long-term implications of this problem and its solutions?",
"9. How can I break down this problem into smaller, more manageable parts?",
"10. Critical Thinking: This style involves analyzing the problem from different perspectives, questioning assumptions, and evaluating the evidence or information available. It focuses on logical reasoning, evidence-based decision-making, and identifying potential biases or flaws in thinking.",
"11. Try creative thinking, generate innovative and out-of-the-box ideas to solve the problem. Explore unconventional solutions, thinking beyond traditional boundaries, and encouraging imagination and originality.",
# "12. Seek input and collaboration from others to solve the problem. Emphasize teamwork, open communication, and leveraging the diverse perspectives and expertise of a group to come up with effective solutions.",
"13. Use systems thinking: Consider the problem as part of a larger system and understanding the interconnectedness of various elements. Focuses on identifying the underlying causes, feedback loops, and interdependencies that influence the problem, and developing holistic solutions that address the system as a whole.",
"14. Use Risk Analysis: Evaluate potential risks, uncertainties, and tradeoffs associated with different solutions or approaches to a problem. Emphasize assessing the potential consequences and likelihood of success or failure, and making informed decisions based on a balanced analysis of risks and benefits.",
# "15. Use Reflective Thinking: Step back from the problem, take the time for introspection and self-reflection. Examine personal biases, assumptions, and mental models that may influence problem-solving, and being open to learning from past experiences to improve future approaches.",
"16. What is the core issue or problem that needs to be addressed?",
"17. What are the underlying causes or factors contributing to the problem?",
"18. Are there any potential solutions or strategies that have been tried before? If yes, what were the outcomes and lessons learned?",
"19. What are the potential obstacles or challenges that might arise in solving this problem?",
"20. Are there any relevant data or information that can provide insights into the problem? If yes, what data sources are available, and how can they be analyzed?",
"21. Are there any stakeholders or individuals who are directly affected by the problem? What are their perspectives and needs?",
"22. What resources (financial, human, technological, etc.) are needed to tackle the problem effectively?",
"23. How can progress or success in solving the problem be measured or evaluated?",
"24. What indicators or metrics can be used?",
"25. Is the problem a technical or practical one that requires a specific expertise or skill set? Or is it more of a conceptual or theoretical problem?",
"26. Does the problem involve a physical constraint, such as limited resources, infrastructure, or space?",
"27. Is the problem related to human behavior, such as a social, cultural, or psychological issue?",
"28. Does the problem involve decision-making or planning, where choices need to be made under uncertainty or with competing objectives?",
"29. Is the problem an analytical one that requires data analysis, modeling, or optimization techniques?",
"30. Is the problem a design challenge that requires creative solutions and innovation?",
"31. Does the problem require addressing systemic or structural issues rather than just individual instances?",
"32. Is the problem time-sensitive or urgent, requiring immediate attention and action?",
"33. What kinds of solution typically are produced for this kind of problem specification?",
"34. Given the problem specification and the current best solution, have a guess about other possible solutions."
"35. Let’s imagine the current best solution is totally wrong, what other ways are there to think about the problem specification?"
"36. What is the best way to modify this current best solution, given what you know about these kinds of problem specification?"
"37. Ignoring the current best solution, create an entirely new solution to the problem."
# "38. Let’s think step by step."
"39. Let’s make a step by step plan and implement it with good notation and explanation.",
]

So when we are using a self-centered strategy, but you want to have a specific set of questions to select from that are relevant to the current reasoning stage. For example, if we are analyzing the prior reasoning stage in relation to the current reasoning and the later stage of reasoning, then we would probably want to... ...to have a set of questions that are more relevant to what it means to compare between two recent stages. So more comparative questions, perhaps I'm not sure. But most importantly, the idea is that each of these reasoning modules or array of questions should be highly generalized. And almost like help the LLM explore different kinds of schools of thought in a way for mental models. Yeah. So, I think that's a good question.

Let's make sure to turn these self-discover reasoning prompting strategies into a reusable function with thinking.

on another note, When it comes to how we're going to be handling tracking each reasoning stages, let's just make sure that that data structure does allow us to find which number that that stage should be in. And for the prompt that we use to actually generate reasoning stages, we should make sure to take note of how the AI should effectively orchestrate/order reasoning stages. It should be picking reasoning stages that flow into each other. So one stage of reasoning kind of provides the context for another stage of reasoning.

So, overall, the idea behind all of this is that we have these different stages of reasoning that we're orchestrating. We get to the final stage. That final stage is kind of like reflecting on the previous stage, which in and of itself is a reflection of both the prior reasoning stage and that reasoning stage. And so we have this kind of like compounding effect where all these different reasoning trees within every given reasoning stage kind of flow into the next. And then we ultimately land on one final analysis. And then, you know, within the analysis, you know, we have all these kind of like structured reasoning processes that we've outlined above. So we ultimately do get the kind of like this deep research capability that allows our agents to deeply reflect upon many different thoughts and context fetched.
