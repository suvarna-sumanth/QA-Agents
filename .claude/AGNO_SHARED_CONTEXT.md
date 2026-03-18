---
name: Agno Migration Shared Context Block
description: Unified context for all Claude sub-agents
type: reference
---

# Shared Context Block for Agno Migration Sub-Agents

**Purpose**: Single source of truth for all parallel sub-agents
**Last Updated**: March 18, 2026
**Binding**: All sub-agents MUST reference this document

---

## Current System Map

### Core Architecture
- **Type**: LangGraph-based state machine
- **Entry Point**: `agents/core/index.js` → `createCognitiveSystem()`
- **Main Agent**: `SupervisorAgent` (orchestrates LangGraph workflow)
- **Wrapper**: `SeniorEngineerAgent` (Agent base class)

### LangGraph Flow
```
planner → [condition] → execute → expand → [condition] → evaluate → END
```

### 7 Skills (Sequential Execution)
1. DiscoverArticlesSkill (find URLs)
2. DetectPlayerSkill (locate players)
3. TestPlayerSkill (test playback)
4. BypassCloudflareSkill (WAF bypass)
5. BypassPerimeterXSkill (WAF bypass)
6. DismissPopupsSkill (close popups)
7. TakeScreenshotSkill (capture)

### Memory Layer
- MemoryService (Supabase backend)
- SiteProfileStore (domain profiles)
- TestHistoryStore (job results)

### Infrastructure
- UndetectedBrowser (Playwright + stealth)
- ProxyRotation (BrightData zones)
- S3Storage (screenshot upload)

---

## Target System Map (Agno-Native)

### Architecture
- **Type**: Parent-Agent + 5 Sub-Agents (parallel)
- **Pattern**: Agno multi-agent orchestration
- **Memory**: Session (job) + Persistent (domain)
- **Prompts**: Explicit, versioned files

### Agent Structure
```
QA Parent Agent (orchestrator)
├─ Discovery Sub-Agent
├─ Detection Sub-Agent (parallel on URLs)
├─ Testing Sub-Agent (parallel on players)
├─ Bypass Sub-Agent (conditional, parallel)
└─ Evidence Sub-Agent (aggregate)
```

### Execution Model
```
Phase 1: Discovery (sequential)
Phase 2: Detection (parallel on articles)
Phase 3: Testing (parallel on players)
Phase 4: Bypass (conditional, parallel on failures)
Phase 5: Evidence (aggregate results)
```

---

## Constraints & Requirements

### Backward Compatibility
- ✅ API endpoint unchanged (`POST /api/jobs`)
- ✅ Job result format compatible
- ✅ Dashboard updates minimal
- ✅ Adapter layer for legacy code

### Production Readiness
- ✅ Same error handling
- ✅ Same memory persistence
- ✅ Same browser automation
- ✅ Same proxy rotation

### Code Quality
- ✅ 80%+ test coverage
- ✅ Clear agent roles
- ✅ Explicit contracts
- ✅ No tight coupling

---

## Key File Locations (Current)

```
agents/core/
├── index.js
├── Agent.js
├── SeniorEngineerAgent.js
├── graph/
│   ├── SupervisorAgent.js
│   ├── AgentGraph.js
│   └── nodes/
│       ├── plan.js
│       ├── execute.js
│       ├── expand.js
│       └── evaluate.js
├── skills/
│   ├── Skill.js
│   ├── SkillRegistry.js
│   ├── DiscoverArticlesSkill.js
│   ├── DetectPlayerSkill.js
│   ├── TestPlayerSkill.js
│   ├── BypassCloudflareSkill.js
│   ├── BypassPerimeterXSkill.js
│   ├── DismissPopupsSkill.js
│   └── TakeScreenshotSkill.js
└── memory/
    ├── MemoryService.js
    ├── SiteProfileStore.js
    ├── TestHistoryStore.js
    └── supabase-client.js

src/app/api/jobs/route.ts (API entry point)
agents/shivani/src/browser.js (browser pool)
agents/shivani/src/proxy-rotation.js (proxy management)
```

---

## Key File Locations (Target)

```
agents/core/
├── index.js (updated: export createAgnoSystem)
├── base/
│   ├── AgnoAgent.js (NEW)
│   ├── AgnoSubAgent.js (NEW)
│   └── AgnoMemory.js (NEW)
├── agents/
│   ├── QAParentAgent.js (NEW)
│   ├── DiscoverySubAgent.js (NEW)
│   ├── DetectionSubAgent.js (NEW)
│   ├── TestingSubAgent.js (NEW)
│   ├── BypassSubAgent.js (NEW)
│   └── EvidenceSubAgent.js (NEW)
├── tools/
│   ├── SubAgentInvoker.js (NEW)
│   ├── DiscoverArticlesTool.js (REFACTORED)
│   ├── DetectPlayerTool.js (REFACTORED)
│   ├── TestPlayTool.js (REFACTORED)
│   ├── BypassCloudfareTool.js (REFACTORED)
│   ├── BypassPerimeterXTool.js (REFACTORED)
│   ├── DismissPopupsTool.js (REFACTORED)
│   └── TakeScreenshotTool.js (REFACTORED)
├── memory/
│   ├── SessionMemory.js (NEW)
│   ├── PersistentMemory.js (NEW)
│   ├── MemoryService.js (REFACTORED)
│   └── supabase-client.js (unchanged)
├── prompts/ (NEW)
│   ├── system.md
│   ├── discovery.md
│   ├── detection.md
│   ├── testing.md
│   ├── bypass.md
│   ├── evidence.md
│   └── coordinator.md
└── adapters/
    └── LegacyAPI.js (NEW)
```

---

## Required Output Format (All Sub-Agents)

```json
{
  "subagent": "name",
  "component": "category",
  "responsibility": "short description",
  "inputs": ["list of input types"],
  "outputs": ["list of output types"],
  "dependencies": ["other components"],
  "artifacts": [
    {
      "type": "file|interface|design|pseudocode",
      "path": "target location",
      "content": "full content or reference"
    }
  ],
  "conflicts": ["any conflicts detected"],
  "contracts": {
    "input_schema": {},
    "output_schema": {},
    "error_handling": "strategy"
  },
  "status": "complete|review|blocked",
  "notes": "any additional context"
}
```

---

## Agent Roles & Responsibilities (Strict)

### Discovery Sub-Agent
**Responsibility**: Find article URLs
**Tools**: Sitemap parser, RSS parser, crawler
**Result**: List of URLs with metadata
**No Overlap**: Doesn't touch detection or testing

### Detection Sub-Agent
**Responsibility**: Locate video players
**Tools**: DOM scanner, HTML5 detector, HLS detector
**Result**: Player info per URL
**No Overlap**: Doesn't touch testing or bypass

### Testing Sub-Agent
**Responsibility**: Test playback functionality
**Tools**: Play button clicker, audio detector, control tester
**Result**: Playback status per player
**No Overlap**: Doesn't handle WAF or evidence

### Bypass Sub-Agent
**Responsibility**: Handle WAF obstacles
**Tools**: Cloudflare solver, PerimeterX bypass, proxy rotator
**Result**: WAF bypass results
**No Overlap**: Only invoked on failed tests

### Evidence Sub-Agent
**Responsibility**: Organize & aggregate
**Tools**: Screenshot uploader, manifest creator
**Result**: S3 URLs, organized by URL
**No Overlap**: Doesn't execute other tests

---

## Interface Contracts (Enforce)

### Tool Interface
```javascript
class AgnoTool {
  async execute(input) { }           // Main execution
  validate(input) { }                // Input validation
  toDefinition() { }                 // LLM-friendly metadata
  onBefore(input) { }                // Lifecycle hook
  onAfter(result) { }                // Lifecycle hook
  onError(error) { }                 // Error hook
}
```

### Sub-Agent Interface
```javascript
class AgnoSubAgent {
  async execute(input) { }           // Main execution
  getSchema() { }                    // Input/output schema
  validate(input) { }                // Validation
  getMetadata() { }                  // Metadata
}
```

### Parent Agent Interface
```javascript
class AgnoAgent {
  async think(input) { }             // LLM-based thinking
  async dispatch(task) { }           // Dispatch to sub-agent
  async synthesize(results) { }      // Combine results
  getMetadata() { }                  // Metadata
}
```

---

## Memory Model (Shared)

### Session Memory (Job-Scoped)
```javascript
{
  jobId: "job-123",
  target: "domain.com",
  articles: [],
  detectionResults: [],
  testingResults: [],
  bypassResults: [],
  evidenceResult: {},
  startTime: 0,
  currentPhase: "discovery|detection|testing|bypass|evidence"
}
```

### Persistent Memory (Domain-Scoped)
```javascript
{
  domain: "domain.com",
  lastTested: "2026-03-18T...",
  playerTypes: { html5: 15, hls: 3 },
  wafDetected: "cloudflare",
  discoveryMethods: ["sitemap", "rss"],
  successRate: 0.85,
  recommendations: []
}
```

---

## Execution Flow (Pseudocode)

```
1. Parent Agent receives job
2. Load site profile from persistent memory
3. Create session memory
4. PHASE 1: Discovery
   - Invoke Discovery Sub-Agent
   - Wait for result
5. PHASE 2: Detection (parallel)
   - For each article: Invoke Detection Sub-Agent
   - Wait for all results
6. PHASE 3: Testing (parallel)
   - For each detected player: Invoke Testing Sub-Agent
   - Wait for all results
7. PHASE 4: Bypass (conditional, parallel)
   - If failures exist:
     - For each failed URL: Invoke Bypass Sub-Agent
     - Merge results back to testing
8. PHASE 5: Evidence
   - Invoke Evidence Sub-Agent
   - Collect all screenshots
9. Synthesize final report
10. Update persistent memory
11. Clear session memory
12. Return results
```

---

## No-Overlap Rules (Enforce)

- ✅ Each sub-agent has ONE responsibility
- ✅ No shared state between agents
- ✅ No calling other sub-agents directly
- ✅ Parent agent only orchestrator
- ✅ Tools are stateless
- ✅ Memory is managed by AgnoMemory

---

## Validation Checkpoints

### Phase Completion
- [ ] All artifacts produced
- [ ] No overlapping responsibilities
- [ ] Contracts documented
- [ ] Schema validation works
- [ ] Error handling defined
- [ ] Tests passing (when applicable)

### Integration Validation
- [ ] All outputs fit contracts
- [ ] No missing dependencies
- [ ] Naming consistent
- [ ] Schemas compatible
- [ ] Parent agent can invoke all
- [ ] Memory layer operational

---

## Known Constraints

1. **Browser**: Uses Playwright + UndetectedBrowser (don't change)
2. **Proxy**: BrightData zones (don't change)
3. **Storage**: S3 (don't change)
4. **Database**: Supabase (don't change)
5. **API**: Must remain backward compatible
6. **Performance**: Target ~8 minutes execution time

---

## Decision Log (Reference)

- **Parent-Child Pattern**: Modular, testable, parallelizable
- **Keep LangGraph Abstracted**: Easy to swap, used only in parent
- **Single LLM (Claude)**: Cost control, specialists deterministic
- **Session + Persistent Memory**: Clean separation of concerns
- **4-5 Week Timeline**: Phased, low-risk approach
- **Adapter Layer**: Zero API breaking changes

---

## Sub-Agent Scope Definition

**ANALYZER**: Code analysis, modules, patterns
**ARCHITECT**: Agent design, roles, communication
**TOOLING**: Tool definitions, schemas
**MEMORY**: Memory model, layering, contracts
**ORCHESTRATION**: Flow, sequencing, synthesis
**PROMPTS**: System prompts, role-specific
**REPO_REFACTOR**: File structure, organization
**INTEGRATION**: Final merging, conflict resolution

---

## Critical Success Factors

1. **Contract Enforcement**: All outputs follow standard format
2. **No Overlap**: Clear responsibility boundaries
3. **Schema Validation**: Input/output validation explicit
4. **Integration Readiness**: All artifacts mergeable
5. **Backward Compatibility**: Adapter layer working
6. **Test Coverage**: 80%+ coverage maintained

---

**This document is BINDING for all sub-agents.**
**Reference constantly. Enforce contracts strictly.**
