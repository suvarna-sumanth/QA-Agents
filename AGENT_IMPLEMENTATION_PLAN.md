# Agent Evolution Plan: From Automation to Intelligent Agents

> Implementation plan for converting QA-Agents from a stateless automation tool into a fully functional AI agent system with memory, planning, and skills — powered by LangGraph, Supabase, and LLM orchestration.

---

## Vision

Today, QA-Agents is a **task runner** — it executes a fixed 3-phase pipeline (discover, detect, test) with no learning, no memory, and no decision-making beyond what's hardcoded. The goal is to evolve it into a **cognitive agent system** where:

- Agents **remember** past test results and adapt behavior
- Agents **plan** their approach based on site characteristics
- Agents **learn** from failures and improve bypass strategies
- Agents have **skills** that can be composed and extended
- A **supervisor agent** orchestrates everything with LLM-powered reasoning

---

## Current State vs Target State

| Capability | Current | Target |
|---|---|---|
| **Memory** | None (stateless between runs) | Persistent memory (site profiles, test history, bypass strategies) |
| **Planning** | Hardcoded 3-phase pipeline | LLM-driven dynamic planning based on context |
| **Decision Making** | If/else protection detection | LLM reasoning about optimal approach |
| **Learning** | None | Feedback loops that improve success rates |
| **Skills** | Monolithic functions | Composable, pluggable skill modules |
| **Orchestration** | SwarmOrchestrator (parallel exec) | LangGraph state machine with conditional routing |
| **Storage** | In-memory + S3 | Supabase (PostgreSQL + real-time + auth) |
| **Observability** | Console.log | Structured traces, LangSmith integration |

---

## Architecture

```
┌────────────────────────────────────────────────┐
│                 Supervisor Agent                │
│          (LangGraph + LLM Reasoning)           │
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Planner  │  │ Memory   │  │ Skill Router │ │
│  │  Node    │  │  Node    │  │    Node      │ │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│       │              │               │         │
└───────┼──────────────┼───────────────┼─────────┘
        │              │               │
        ▼              ▼               ▼
┌──────────┐   ┌──────────────┐  ┌──────────────┐
│ LangGraph│   │   Supabase   │  │    Skills     │
│  State   │   │              │  │              │
│ Machine  │   │ ┌──────────┐ │  │ ┌──────────┐ │
│          │   │ │ Memory   │ │  │ │ Discover │ │
│ ┌──────┐ │   │ │ Store    │ │  │ ├──────────┤ │
│ │Plan  │ │   │ ├──────────┤ │  │ │ Detect   │ │
│ ├──────┤ │   │ │ Site     │ │  │ ├──────────┤ │
│ │Exec  │ │   │ │ Profiles │ │  │ │ Test     │ │
│ ├──────┤ │   │ ├──────────┤ │  │ ├──────────┤ │
│ │Eval  │ │   │ │ Test     │ │  │ │ Bypass   │ │
│ ├──────┤ │   │ │ History  │ │  │ ├──────────┤ │
│ │Learn │ │   │ ├──────────┤ │  │ │ Report   │ │
│ └──────┘ │   │ │ Strategy │ │  │ ├──────────┤ │
│          │   │ │ Cache    │ │  │ │ Screenshot│ │
│          │   │ └──────────┘ │  │ └──────────┘ │
└──────────┘   └──────────────┘  └──────────────┘
```

---

## Phase 1: Memory Layer (Supabase)

**Goal:** Give agents persistent memory so they learn from past interactions.

### 1.1 Supabase Setup

```sql
-- Site profiles: what we know about each domain
CREATE TABLE site_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  protection_type TEXT,              -- 'cloudflare' | 'perimeterx' | 'none'
  cloudflare_tier TEXT,              -- 'free' | 'pro' | 'enterprise'
  has_instaread_player BOOLEAN,
  player_version TEXT,
  typical_popup_types TEXT[],        -- ['cookie-consent', 'newsletter', 'ad-overlay']
  bypass_success_rate FLOAT,         -- 0.0 to 1.0
  avg_challenge_solve_time_ms INT,
  last_tested_at TIMESTAMPTZ,
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test history: every test run with results
CREATE TABLE test_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  site_profile_id UUID REFERENCES site_profiles(id),
  url TEXT NOT NULL,
  overall_status TEXT,               -- 'pass' | 'fail' | 'partial' | 'error'
  steps JSONB,                       -- array of step results
  bypass_method_used TEXT,           -- 'curl-impersonate' | 'browser-turnstile' | 'press-hold'
  bypass_succeeded BOOLEAN,
  challenge_solve_time_ms INT,
  total_duration_ms INT,
  error_message TEXT,
  screenshots JSONB,                 -- S3 keys
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy cache: what bypass approach works best for each site
CREATE TABLE bypass_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  strategy_name TEXT NOT NULL,       -- 'http-curl' | 'browser-headed' | 'browser-headless'
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  avg_duration_ms INT,
  last_used_at TIMESTAMPTZ,
  config JSONB,                      -- strategy-specific config (hold duration, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, strategy_name)
);

-- Agent memory: general-purpose key-value memory for agents
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,         -- 'episodic' | 'semantic' | 'procedural'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  relevance_score FLOAT DEFAULT 1.0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, memory_type, key)
);

-- Enable real-time subscriptions for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE test_history;
ALTER PUBLICATION supabase_realtime ADD TABLE site_profiles;
```

### 1.2 Memory Service

```
agents/
└── core/
    └── memory/
        ├── MemoryService.js        # High-level memory API
        ├── SiteProfileStore.js     # Site-specific knowledge
        ├── TestHistoryStore.js     # Historical test results
        ├── StrategyCache.js        # Bypass strategy rankings
        └── supabase-client.js      # Supabase connection
```

**Key APIs:**

```javascript
class MemoryService {
  // Before testing a site, recall what we know
  async recallSiteProfile(domain)
  // → { protection, bypassSuccessRate, bestStrategy, lastTested, knownPopups }

  // After testing, store what we learned
  async recordTestResult(jobId, url, result)

  // Get the best bypass strategy for a domain based on history
  async getBestStrategy(domain)
  // → { strategy: 'browser-headed', confidence: 0.85, avgDuration: 12000 }

  // Store arbitrary agent memory (semantic knowledge)
  async remember(agentId, key, value, type = 'semantic')
  async recall(agentId, key, type = 'semantic')

  // Prune old/low-relevance memories
  async consolidateMemory(agentId)
}
```

### 1.3 Integration Points

Replace the current in-memory `domainProtectionCache` with Supabase-backed `SiteProfileStore`:

```javascript
// BEFORE (stateless):
const domainProtectionCache = new Map();

// AFTER (persistent):
const protection = await memoryService.recallSiteProfile(domain);
if (protection) {
  // Use cached knowledge — skip HTTP detection
  return protection.protection_type;
}
// First time seeing this domain — detect and store
const detected = await detectProtection(url);
await memoryService.updateSiteProfile(domain, { protection_type: detected });
```

---

## Phase 2: LangGraph State Machine

**Goal:** Replace the hardcoded 3-phase pipeline with a dynamic state machine that can reason about its next step.

### 2.1 Graph Definition

```javascript
import { StateGraph, END } from '@langchain/langgraph';

const agentGraph = new StateGraph({
  channels: {
    job: { value: null },           // Job config
    siteProfile: { value: null },   // What we know about this site
    strategy: { value: null },      // Chosen bypass strategy
    discoveredUrls: { value: [] },  // URLs found during discovery
    detectionResults: { value: [] },// Player detection results
    testResults: { value: [] },     // Functional test results
    errors: { value: [] },          // Accumulated errors
    plan: { value: [] },            // Execution plan steps
    currentStep: { value: 0 },      // Current plan step index
  }
});

// Nodes
agentGraph.addNode('recall_memory', recallMemoryNode);
agentGraph.addNode('plan', planNode);
agentGraph.addNode('select_strategy', selectStrategyNode);
agentGraph.addNode('discover', discoverNode);
agentGraph.addNode('detect', detectNode);
agentGraph.addNode('test', testNode);
agentGraph.addNode('evaluate', evaluateNode);
agentGraph.addNode('learn', learnNode);
agentGraph.addNode('report', reportNode);

// Edges (conditional routing)
agentGraph.addEdge('recall_memory', 'plan');
agentGraph.addEdge('plan', 'select_strategy');
agentGraph.addConditionalEdges('select_strategy', (state) => {
  if (state.job.type === 'url') return 'detect';  // Skip discovery for single URL
  return 'discover';
});
agentGraph.addEdge('discover', 'detect');
agentGraph.addConditionalEdges('detect', (state) => {
  const playersFound = state.detectionResults.filter(r => r.hasPlayer);
  if (playersFound.length === 0) return 'report';  // No players, skip testing
  return 'test';
});
agentGraph.addEdge('test', 'evaluate');
agentGraph.addConditionalEdges('evaluate', (state) => {
  if (state.errors.length > 3) return 'learn';  // Too many failures, adapt
  return 'report';
});
agentGraph.addEdge('learn', 'select_strategy');  // Retry with new strategy
agentGraph.addEdge('report', 'learn');           // Always learn from results
agentGraph.addEdge('learn', END);

agentGraph.setEntryPoint('recall_memory');
```

### 2.2 Node Implementations

**Recall Memory Node** — loads site knowledge before doing anything:

```javascript
async function recallMemoryNode(state) {
  const domain = new URL(state.job.target).hostname;
  const profile = await memoryService.recallSiteProfile(domain);
  const bestStrategy = await memoryService.getBestStrategy(domain);

  return {
    siteProfile: profile,
    strategy: bestStrategy,
  };
}
```

**Plan Node** — LLM decides execution plan based on context:

```javascript
async function planNode(state) {
  const plan = await llm.invoke({
    system: `You are a QA test planner. Given what we know about a site,
             decide the optimal testing approach.`,
    user: `
      Site: ${state.job.target}
      Protection: ${state.siteProfile?.protection_type || 'unknown'}
      Historical success rate: ${state.siteProfile?.bypass_success_rate || 'no data'}
      Best known strategy: ${state.strategy?.strategy_name || 'none'}
      Job type: ${state.job.type}

      Plan the testing steps. Consider:
      - Should we try HTTP bypass first or go straight to browser?
      - How many articles should we test?
      - Should we use headed or headless mode?
      - What popup dismissal strategies are needed?
    `
  });

  return { plan: plan.steps };
}
```

**Learn Node** — updates memory based on results:

```javascript
async function learnNode(state) {
  const domain = new URL(state.job.target).hostname;

  // Update site profile with latest results
  await memoryService.updateSiteProfile(domain, {
    bypass_success_rate: calculateSuccessRate(state.testResults),
    last_tested_at: new Date(),
    typical_popup_types: extractPopupTypes(state.testResults),
  });

  // Update strategy success/failure counts
  await memoryService.recordStrategyResult(domain, state.strategy.strategy_name, {
    succeeded: state.errors.length === 0,
    duration: state.testResults.reduce((sum, r) => sum + r.duration, 0),
  });

  // Store any new learnings as semantic memory
  if (state.errors.some(e => e.includes('new popup type'))) {
    await memoryService.remember('agent-shivani', `popup-${domain}`, {
      newPopupSelectors: extractNewSelectors(state.errors),
    });
  }

  return {};
}
```

---

## Phase 3: Skill System

**Goal:** Break monolithic functions into composable, registrable skills that agents can invoke.

### 3.1 Skill Interface

```javascript
// agents/core/skills/Skill.js
export class Skill {
  constructor(name, description, inputSchema, outputSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
  }

  async execute(input, context) {
    throw new Error('Subclass must implement execute()');
  }

  // LLM-friendly description for tool selection
  toToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.inputSchema,
    };
  }
}
```

### 3.2 Skill Registry

```javascript
// agents/core/skills/SkillRegistry.js
export class SkillRegistry {
  constructor() {
    this.skills = new Map();
  }

  register(skill) {
    this.skills.set(skill.name, skill);
  }

  getToolDefinitions() {
    return [...this.skills.values()].map(s => s.toToolDefinition());
  }

  async execute(skillName, input, context) {
    const skill = this.skills.get(skillName);
    if (!skill) throw new Error(`Unknown skill: ${skillName}`);
    return skill.execute(input, context);
  }
}
```

### 3.3 Concrete Skills

```
agents/core/skills/
├── Skill.js                    # Base class
├── SkillRegistry.js            # Registry + execution
├── DiscoverArticlesSkill.js    # Find articles from a domain
├── DetectPlayerSkill.js        # Check if URL has <instaread-player>
├── TestPlayerSkill.js          # Run 7-step QA suite
├── BypassCloudflareSkill.js    # Solve Cloudflare Turnstile
├── BypassPerimeterXSkill.js    # Solve PerimeterX press-hold
├── DismissPopupsSkill.js       # Remove overlays
├── TakeScreenshotSkill.js      # Capture and upload screenshot
├── GenerateReportSkill.js      # Aggregate and format results
├── LaunchBrowserSkill.js       # Browser pool management
└── RecallMemorySkill.js        # Query persistent memory
```

**Example: BypassCloudflareSkill**

```javascript
export class BypassCloudflareSkill extends Skill {
  constructor() {
    super(
      'bypass_cloudflare',
      'Solve a Cloudflare Turnstile challenge on the current page. Returns true if the challenge was resolved.',
      {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'ID of the browser page to act on' },
          maxWaitMs: { type: 'number', default: 60000 },
          strategy: { type: 'string', enum: ['http-curl', 'browser-headed', 'browser-headless'] },
        },
        required: ['pageId'],
      },
      { type: 'object', properties: { success: { type: 'boolean' }, method: { type: 'string' } } }
    );
  }

  async execute(input, context) {
    const { pageId, maxWaitMs, strategy } = input;
    const page = context.browserPool.getPage(pageId);

    if (strategy === 'http-curl') {
      return await this.curlBypass(page);
    }
    return await this.browserBypass(page, maxWaitMs);
  }
}
```

### 3.4 LLM Tool Use Integration

The supervisor agent gets skills as tools it can call:

```javascript
const tools = skillRegistry.getToolDefinitions();

const response = await llm.invoke({
  messages: [
    { role: 'system', content: 'You are a QA agent. Use your tools to test the audio player.' },
    { role: 'user', content: `Test the player at ${url}` },
  ],
  tools: tools,
});

// Execute the tool call
if (response.tool_calls) {
  for (const call of response.tool_calls) {
    const result = await skillRegistry.execute(call.name, call.arguments, context);
    // Feed result back to LLM for next decision
  }
}
```

---

## Phase 4: Supervisor Agent

**Goal:** An LLM-powered agent that reasons about what to do, invokes skills, handles errors, and adapts.

### 4.1 Supervisor Loop

```javascript
import { ChatOpenAI } from '@langchain/openai';

class SupervisorAgent {
  constructor(memoryService, skillRegistry) {
    this.memory = memoryService;
    this.skills = skillRegistry;
    this.llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });
  }

  async runJob(job) {
    // 1. Recall context
    const siteKnowledge = await this.memory.recallSiteProfile(job.domain);
    const pastResults = await this.memory.getRecentResults(job.domain, 5);

    // 2. Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(siteKnowledge, pastResults);

    // 3. Agentic loop
    let messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Execute QA job: ${JSON.stringify(job)}` },
    ];

    const maxIterations = 20;
    for (let i = 0; i < maxIterations; i++) {
      const response = await this.llm.invoke({
        messages,
        tools: this.skills.getToolDefinitions(),
      });

      // Check if agent is done
      if (response.finish_reason === 'stop') {
        return this.parseResult(response);
      }

      // Execute tool calls
      for (const toolCall of response.tool_calls || []) {
        try {
          const result = await this.skills.execute(
            toolCall.name,
            toolCall.arguments,
            { memoryService: this.memory }
          );
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }
    }
  }
}
```

---

## Phase 5: Real-Time Dashboard (Supabase)

**Goal:** Replace polling-based dashboard with real-time updates using Supabase subscriptions.

### 5.1 Real-Time Integration

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Dashboard component subscribes to real-time updates
useEffect(() => {
  const channel = supabase
    .channel('test-results')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'test_history',
    }, (payload) => {
      // Live update as tests complete
      setResults(prev => [payload.new, ...prev]);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

### 5.2 Replace In-Memory Job Registry

```javascript
// BEFORE: In-memory Map (lost on restart)
const jobRegistry = new Map();

// AFTER: Supabase table with real-time
const { data, error } = await supabase
  .from('jobs')
  .insert({ job_id: jobId, agent_id: agentId, status: 'queued', target })
  .select()
  .single();
```

---

## Implementation Roadmap

### Milestone 1: Memory Foundation (2-3 weeks)

- [ ] Set up Supabase project and database schema
- [ ] Implement `MemoryService` with `SiteProfileStore` and `TestHistoryStore`
- [ ] Integrate `StrategyCache` into browser.js (replace `domainProtectionCache`)
- [ ] Record test results to Supabase after each run
- [ ] Add memory recall before detection phase

### Milestone 2: Skill Decomposition (2 weeks)

- [ ] Define `Skill` base class and `SkillRegistry`
- [ ] Extract `discover.js` into `DiscoverArticlesSkill`
- [ ] Extract `detect.js` into `DetectPlayerSkill`
- [ ] Extract `test-player.js` into `TestPlayerSkill`
- [ ] Extract bypass functions into `BypassCloudflareSkill` and `BypassPerimeterXSkill`
- [ ] Extract popup handling into `DismissPopupsSkill`
- [ ] Wire skills into existing `AgentShivani.runJob()` flow

### Milestone 3: LangGraph Integration (2-3 weeks)

- [ ] Install `@langchain/langgraph` and `@langchain/openai`
- [ ] Define state graph with nodes (recall, plan, execute, evaluate, learn)
- [ ] Implement conditional edges (skip discovery for URL type, skip testing if no players)
- [ ] Add the learn node that updates Supabase after each run
- [ ] Replace `SwarmOrchestrator` with LangGraph graph execution
- [ ] Add LangSmith tracing for observability

### Milestone 4: Supervisor Agent (2-3 weeks)

- [ ] Implement `SupervisorAgent` with LLM tool-use loop
- [ ] Build system prompt with site knowledge context
- [ ] Enable LLM to select and invoke skills dynamically
- [ ] Add error handling and retry logic in the agentic loop
- [ ] Implement multi-turn reasoning (LLM decides next action based on results)

### Milestone 5: Real-Time Dashboard (1-2 weeks)

- [ ] Integrate Supabase client into Next.js frontend
- [ ] Replace API polling with Supabase real-time subscriptions
- [ ] Migrate job registry from in-memory to Supabase
- [ ] Add live progress indicators (test step currently executing)
- [ ] Add historical trend charts (bypass success rate over time)

### Milestone 6: Advanced Features (ongoing)

- [ ] Multi-agent collaboration (one agent discovers issues, another triages)
- [ ] Automated bypass strategy evolution (agent experiments with variations)
- [ ] Natural language job submission ("test all articles on publisher.com that were published this week")
- [ ] Slack/email notifications on test failures
- [ ] Scheduled recurring tests (cron-based)

---

## Technology Choices

| Component | Technology | Why |
|---|---|---|
| **State Machine** | LangGraph | Purpose-built for agent workflows with cycles, persistence, and human-in-the-loop |
| **LLM** | GPT-4o-mini (or Claude) | Cost-effective for planning/routing; full models for complex reasoning |
| **Memory** | Supabase (PostgreSQL) | Free tier, real-time subscriptions, Row Level Security, good JS SDK |
| **Vector Search** | Supabase pgvector | Semantic memory retrieval (find similar past experiences) |
| **Observability** | LangSmith | Trace every LLM call, tool invocation, and agent decision |
| **Job Queue** | Supabase + pg_cron | Scheduled jobs, persistent queue, no extra infrastructure |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| LLM latency adds overhead | Slower test runs | Use fast models (4o-mini), cache common decisions |
| LLM makes wrong tool choices | Failed tests | Fallback to deterministic pipeline if agent fails |
| Supabase free tier limits | Blocked at scale | Monitor usage, upgrade to Pro when needed ($25/mo) |
| Over-engineering before validation | Wasted effort | Ship each milestone independently, validate before proceeding |
| Memory grows unbounded | Slow queries | TTL on episodic memory, periodic consolidation |

---

## File Structure (Target)

```
agents/
├── core/
│   ├── Agent.js                    # (existing) Base agent
│   ├── AgentRegistry.js            # (existing) Agent discovery
│   ├── bootstrap.js                # (existing) System init
│   ├── memory/                     # NEW: Memory layer
│   │   ├── MemoryService.js
│   │   ├── SiteProfileStore.js
│   │   ├── TestHistoryStore.js
│   │   ├── StrategyCache.js
│   │   └── supabase-client.js
│   ├── skills/                     # NEW: Skill system
│   │   ├── Skill.js
│   │   ├── SkillRegistry.js
│   │   ├── DiscoverArticlesSkill.js
│   │   ├── DetectPlayerSkill.js
│   │   ├── TestPlayerSkill.js
│   │   ├── BypassCloudflareSkill.js
│   │   ├── BypassPerimeterXSkill.js
│   │   ├── DismissPopupsSkill.js
│   │   ├── TakeScreenshotSkill.js
│   │   └── GenerateReportSkill.js
│   └── graph/                      # NEW: LangGraph orchestration
│       ├── AgentGraph.js           # State graph definition
│       ├── nodes/                  # Graph nodes
│       │   ├── recallMemory.js
│       │   ├── plan.js
│       │   ├── selectStrategy.js
│       │   ├── discover.js
│       │   ├── detect.js
│       │   ├── test.js
│       │   ├── evaluate.js
│       │   ├── learn.js
│       │   └── report.js
│       └── SupervisorAgent.js      # LLM-powered supervisor
├── shivani/                        # (existing) QA agent
│   └── src/                        # Refactored to use skills
└── package.json                    # Add langgraph, supabase deps
```

---

## Dependencies to Add

```json
{
  "@langchain/langgraph": "^0.2.0",
  "@langchain/openai": "^0.3.0",
  "@langchain/core": "^0.3.0",
  "@supabase/supabase-js": "^2.45.0",
  "langsmith": "^0.2.0"
}
```

---

## Summary

This plan transforms QA-Agents from a **stateless automation script** into a **learning agent system** in 5 incremental milestones. Each milestone is independently valuable and shippable:

1. **Memory** makes agents aware of history
2. **Skills** make capabilities composable
3. **LangGraph** makes orchestration flexible
4. **Supervisor** adds LLM reasoning
5. **Real-time dashboard** completes the user experience

The key principle: **each milestone works without the next one.** Memory is useful without LangGraph. Skills are useful without an LLM supervisor. Ship incrementally, validate each step.
