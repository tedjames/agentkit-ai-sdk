/**
 * Reasoning Modules Library
 *
 * This file contains pre-defined reasoning modules (questions) used by the
 * self-discover prompting function to guide research exploration.
 *
 * These questions represent different thinking approaches and cognitive frameworks
 * that help agents explore research topics from multiple perspectives.
 */

export const reasoningModules = [
  // Critical Analysis Questions
  "How could I devise an experiment to help solve this problem?",
  "What are the key assumptions underlying this topic?",
  "What are the potential risks and drawbacks of each approach to this topic?",
  "What are the alternative perspectives or viewpoints on this topic?",
  "What are the long-term implications of this topic and its various aspects?",
  "How can I break down this topic into smaller, more manageable parts?",

  // Creative Thinking
  "What unconventional or innovative approaches might apply to this topic?",
  "How might this topic look from a completely different field or discipline?",
  "What if the conventional understanding of this topic is completely wrong?",

  // Systems Thinking
  "What are the underlying systems and feedback loops related to this topic?",
  "How do different elements of this topic interact with each other?",
  "What are the emergent properties that arise from these interactions?",

  // Risk Analysis
  "What uncertainties exist in our current understanding of this topic?",
  "What are the potential unintended consequences of different approaches?",
  "How might our understanding of this topic change with new information?",

  // Problem Framing
  "What is the core issue or problem within this topic that needs to be addressed?",
  "What are the underlying causes or factors contributing to this topic?",
  "Are there previous approaches or solutions that have been tried? What were the outcomes?",

  // Stakeholder Analysis
  "Who are the key stakeholders affected by or interested in this topic?",
  "What are their perspectives, needs, and concerns?",
  "How might different stakeholders define success differently?",

  // Resource Consideration
  "What resources (financial, human, technological) are needed to advance understanding of this topic?",
  "What are the constraints or limitations that must be considered?",

  // Measurement and Evaluation
  "How can progress or success in understanding this topic be measured?",
  "What indicators or metrics would be most appropriate?",

  // Problem Classification
  "Is this topic primarily technical, practical, conceptual, or theoretical in nature?",
  "Does this topic involve physical constraints, human behavior, or decision-making under uncertainty?",
  "Is this topic an analytical challenge, a design challenge, or a systems challenge?",

  // Solution Approach
  "What kinds of solutions are typically produced for this kind of topic?",
  "If current approaches are incorrect, what other ways might we think about this topic?",
  "How can we modify current approaches given what we know about this topic?",

  // Methodological
  "What systematic approach would be most effective for exploring this topic?",
  "How can we best organize our investigation of this topic?",
];

// Specialized modules for stage comparisons
export const stageComparisonModules = [
  "How has our understanding of the topic evolved from the previous stage to the current one?",
  "What new insights emerged in this stage that weren't present in previous stages?",
  "Are there any contradictions between the findings of different stages?",
  "How do the perspectives of different stages complement each other?",
  "What gaps identified in previous stages have been addressed in the current stage?",
  "What new questions arise when comparing the analyses from different stages?",
  "How might we synthesize the key insights from all stages so far?",
  "What patterns or trends become visible when looking across multiple stages?",
  "Which stage has provided the most unexpected or counter-intuitive insights?",
  "How might the combination of insights from multiple stages lead to novel approaches?",
];
