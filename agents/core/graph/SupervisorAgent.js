import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "./AgentGraph.js";
import { planNode } from "./nodes/plan.js";
import { executeNode } from "./nodes/execute.js";
import { expandNode } from "./nodes/expand.js";
import { evaluateNode } from "./nodes/evaluate.js";
import { cleanupBrowserPool } from "../../shivani/src/browser.js";

/**
 * The core cognitive agent that orchestrates Skills using Memory.
 */
export class SupervisorAgent {
  constructor(memoryService, skillRegistry) {
    this.memory = memoryService;
    this.skills = skillRegistry;
    this.graph = this.buildGraph();
  }

  buildGraph() {
    const workflow = new StateGraph(AgentState)
      .addNode("planner", planNode(this.memory))
      .addNode("execute", executeNode(this.skills))
      .addNode("expand", expandNode)
      .addNode("evaluate", evaluateNode(this.memory));

    workflow.addEdge(START, "planner");
    
    // The plan node figures out what to do, then we start executing.
    workflow.addConditionalEdges("planner", (state) => {
      if (!state.plan || state.plan.length === 0) {
        return "evaluate";
      }
      return "execute";
    });
    
    // After executing a skill, we go to expand to see if we need more steps
    workflow.addEdge("execute", "expand");

    // After expanding (or matching), we decide if we need to execute the next step
    workflow.addConditionalEdges("expand", (state) => {
      if (state.currentStep < state.plan.length) {
        return "execute";
      }
      return "evaluate";
    });

    workflow.addEdge("evaluate", END);

    return workflow.compile();
  }

  async run(jobId, incomingUrl, sharedBrowserContext = null, onProgress = null, options = {}) {
    let url = incomingUrl;
    // Basic normalization: ensure protocol and separator
    if (url.includes(':') && !url.includes('://')) {
      url = url.replace(':', '://');
    } else if (!url.includes('://')) {
      url = 'https://' + url;
    }

    let domain;
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }

    const config = options?.config ?? options ?? {};
    const maxArticles = typeof config.maxArticles === 'number' && config.maxArticles >= 1
      ? Math.min(config.maxArticles, 100)
      : 3;

    const initialState = {
      jobId,
      url,
      domain,
      maxArticles,
      plan: [],
      currentStep: 0,
      results: [],
      startTime: Date.now(),
      context: { sharedBrowser: sharedBrowserContext }
    };

    console.log(`[SupervisorAgent] \u25b6 Starting run for ${url} (Job: ${jobId})`);
    try {
      const finalState = await this.graph.invoke(initialState);
      console.log(`[SupervisorAgent] \u25a0 Finished run for ${url}`);
      return finalState;
    } finally {
      await cleanupBrowserPool().catch((err) => {
        console.warn('[SupervisorAgent] Browser pool cleanup error:', err?.message || err);
      });
    }
  }
}

export default SupervisorAgent;
