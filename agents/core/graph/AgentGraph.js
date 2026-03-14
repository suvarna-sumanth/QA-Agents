import { Annotation } from "@langchain/langgraph";

// Define the state schema for our QA Agent cognitive loop
export const AgentState = Annotation.Root({
  jobId: Annotation({ default: () => null }),
  url: Annotation({ default: () => null }),
  domain: Annotation({ default: () => null }),
  maxArticles: Annotation({ default: () => 3 }),
  siteProfile: Annotation({ default: () => null }),
  plan: Annotation({ default: () => [] }),
  currentStep: Annotation({ default: () => 0 }),
  results: Annotation({ 
    default: () => [],
    reducer: (x, y) => x.concat(y)
  }),
  startTime: Annotation({ default: () => Date.now() }),
  totalDuration: Annotation({ default: () => 0 }),
  context: Annotation({ default: () => ({}) })
});
