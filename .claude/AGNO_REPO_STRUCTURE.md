---
name: Agno Repository Structure
description: Complete file organization and folder hierarchy for Agno-native system
type: reference
---

# Agno Repository Structure

**Status**: Complete
**Last Updated**: March 18, 2026
**Scope**: File organization, naming conventions, directory hierarchy

---

## Target Repository Layout

```
QA-Agents/
├── agents/
│   ├── core/
│   │   ├── index.js                          ← Export createAgnoSystem()
│   │   │
│   │   ├── base/
│   │   │   ├── AgnoAgent.js                  ← Base class for parent agent
│   │   │   ├── AgnoSubAgent.js               ← Base class for sub-agents
│   │   │   ├── AgnoTool.js                   ← Base class for tools
│   │   │   ├── AgnoMemory.js                 ← Memory interface
│   │   │   └── AgnoRegistry.js               ← Tool/agent registry
│   │   │
│   │   ├── agents/
│   │   │   ├── QAParentAgent.js              ← Orchestrator (main agent)
│   │   │   ├── DiscoverySubAgent.js
│   │   │   ├── DetectionSubAgent.js
│   │   │   ├── TestingSubAgent.js
│   │   │   ├── BypassSubAgent.js
│   │   │   └── EvidenceSubAgent.js
│   │   │
│   │   ├── tools/
│   │   │   ├── SubAgentInvoker.js            ← Tool for invoking sub-agents
│   │   │   │
│   │   │   ├── discovery/                    ← Discovery phase tools
│   │   │   │   ├── SitemapParserTool.js
│   │   │   │   ├── RSSParserTool.js
│   │   │   │   └── WebCrawlerTool.js
│   │   │   │
│   │   │   ├── detection/                    ← Detection phase tools
│   │   │   │   ├── DOMScannerTool.js
│   │   │   │   ├── HTML5PlayerDetectorTool.js
│   │   │   │   ├── HLSPlayerDetectorTool.js
│   │   │   │   ├── YouTubeDetectorTool.js
│   │   │   │   ├── VimeoDetectorTool.js
│   │   │   │   └── CustomPlayerDetectorTool.js
│   │   │   │
│   │   │   ├── testing/                      ← Testing phase tools
│   │   │   │   ├── PlayButtonClickerTool.js
│   │   │   │   ├── AudioDetectorTool.js
│   │   │   │   ├── ControlTesterTool.js
│   │   │   │   ├── ProgressDetectorTool.js
│   │   │   │   ├── ErrorListenerTool.js
│   │   │   │   └── ScreenshotCapturerTool.js
│   │   │   │
│   │   │   ├── bypass/                       ← Bypass phase tools
│   │   │   │   ├── CloudflareBypassTool.js
│   │   │   │   ├── PerimeterXBypassTool.js
│   │   │   │   ├── ProxyRotationTool.js
│   │   │   │   ├── UserAgentRotationTool.js
│   │   │   │   ├── CookieManagementTool.js
│   │   │   │   └── RetryWithBackoffTool.js
│   │   │   │
│   │   │   └── evidence/                     ← Evidence phase tools
│   │   │       ├── ScreenshotUploaderTool.js
│   │   │       ├── ManifestCreatorTool.js
│   │   │       └── LogAggregatorTool.js
│   │   │
│   │   ├── memory/
│   │   │   ├── SessionMemory.js              ← Job-scoped memory
│   │   │   ├── PersistentMemory.js           ← Domain-scoped memory (Supabase)
│   │   │   ├── MemoryService.js              ← Memory manager
│   │   │   ├── SessionMemoryStore.js         ← In-memory session store
│   │   │   └── supabase-client.js            ← DB client (unchanged)
│   │   │
│   │   ├── prompts/                          ← System prompts (versioned)
│   │   │   ├── system.md                     ← System role definition
│   │   │   ├── discovery.md                  ← Discovery sub-agent role
│   │   │   ├── detection.md                  ← Detection sub-agent role
│   │   │   ├── testing.md                    ← Testing sub-agent role
│   │   │   ├── bypass.md                     ← Bypass sub-agent role
│   │   │   ├── evidence.md                   ← Evidence sub-agent role
│   │   │   └── coordinator.md                ← Parent agent orchestration
│   │   │
│   │   └── adapters/
│   │       └── LegacyAPIAdapter.js           ← Backward compatibility layer
│   │
│   ├── shivani/src/                          ← Infrastructure (unchanged)
│   │   ├── browser.js                        ← Browser pool (UndetectedBrowser)
│   │   ├── proxy-rotation.js                 ← Proxy management
│   │   └── ...
│   │
│   └── legacy/                               ← Current system (deprecated)
│       ├── SupervisorAgent.js                ← Old monolithic agent
│       ├── SeniorEngineerAgent.js            ← Old wrapper
│       └── [other old files]
│
├── src/app/api/
│   └── jobs/
│       └── route.ts                          ← API endpoint (uses adapter)
│
├── tests/
│   ├── unit/
│   │   ├── agents/
│   │   │   ├── QAParentAgent.test.js
│   │   │   ├── DiscoverySubAgent.test.js
│   │   │   ├── DetectionSubAgent.test.js
│   │   │   ├── TestingSubAgent.test.js
│   │   │   ├── BypassSubAgent.test.js
│   │   │   └── EvidenceSubAgent.test.js
│   │   │
│   │   ├── tools/
│   │   │   ├── discovery/
│   │   │   │   ├── SitemapParserTool.test.js
│   │   │   │   ├── RSSParserTool.test.js
│   │   │   │   └── WebCrawlerTool.test.js
│   │   │   ├── detection/
│   │   │   ├── testing/
│   │   │   ├── bypass/
│   │   │   └── evidence/
│   │   │
│   │   ├── memory/
│   │   │   ├── SessionMemory.test.js
│   │   │   ├── PersistentMemory.test.js
│   │   │   └── MemoryService.test.js
│   │   │
│   │   └── adapters/
│   │       └── LegacyAPIAdapter.test.js
│   │
│   ├── integration/
│   │   ├── phases/
│   │   │   ├── discovery.integration.test.js
│   │   │   ├── detection.integration.test.js
│   │   │   ├── testing.integration.test.js
│   │   │   ├── bypass.integration.test.js
│   │   │   └── evidence.integration.test.js
│   │   │
│   │   ├── orchestration/
│   │   │   ├── parent-agent-flow.test.js
│   │   │   ├── sub-agent-invocation.test.js
│   │   │   └── result-synthesis.test.js
│   │   │
│   │   └── end-to-end/
│   │       ├── simple-domain.e2e.test.js
│   │       ├── waf-domain.e2e.test.js
│   │       └── no-players.e2e.test.js
│   │
│   ├── fixtures/
│   │   ├── domains/
│   │   │   ├── simple-domain.json
│   │   │   ├── waf-domain.json
│   │   │   └── no-players-domain.json
│   │   │
│   │   ├── responses/
│   │   │   ├── detection-results.json
│   │   │   ├── testing-results.json
│   │   │   └── ...
│   │   │
│   │   └── mocks/
│   │       ├── MockBrowser.js
│   │       ├── MockProxy.js
│   │       ├── MockS3.js
│   │       └── MockSupabase.js
│   │
│   └── setup.js                              ← Test setup (mocks, config)
│
├── .claude/
│   ├── INDEX.md                              ← Documentation index
│   ├── AGNO_EXECUTIVE_SUMMARY.md             ← For decision makers
│   ├── AGNO_ARCHITECTURE_BLUEPRINT.md        ← For architects
│   ├── AGNO_IMPLEMENTATION_ROADMAP.md        ← For engineers
│   ├── AGNO_AGENT_DESIGNS.md                 ← Agent specifications ✓
│   ├── AGNO_TOOL_SCHEMAS.md                  ← Tool specifications ✓
│   ├── AGNO_ORCHESTRATION_ALGORITHM.md       ← Orchestration logic ✓
│   ├── AGNO_MEMORY_DESIGN.md                 ← Memory architecture ✓
│   ├── AGNO_REPO_STRUCTURE.md                ← This file ✓
│   ├── AGNO_SYSTEM_PROMPTS.md                ← System prompt definitions
│   ├── AGNO_FINAL_ARCHITECTURE.md            ← Unified design (integration output)
│   └── AGNO_IMPLEMENTATION_CHECKLIST.md      ← File-by-file TODO list
│
├── package.json
├── tsconfig.json
├── jest.config.js
├── .gitignore
└── README.md

```

---

## File Naming Conventions

### Agents
- `[Name]SubAgent.js` for sub-agents (e.g., `DiscoverySubAgent.js`)
- `[Name]Agent.js` for parent/orchestrator agents (e.g., `QAParentAgent.js`)
- Base: `AgnoAgent.js`, `AgnoSubAgent.js`

### Tools
- `[Name]Tool.js` for individual tools (e.g., `SitemapParserTool.js`)
- Organized in subdirectories by phase: `discovery/`, `detection/`, `testing/`, `bypass/`, `evidence/`

### Memory
- `[Name]Memory.js` for memory classes (e.g., `SessionMemory.js`)
- `[Name]Store.js` for storage backends (e.g., `SessionMemoryStore.js`)

### Prompts
- Lowercase `.md` files (e.g., `system.md`, `discovery.md`)
- Stored in `prompts/` directory

### Tests
- Mirror source structure in `tests/`
- Suffix with `.test.js` for unit tests
- Suffix with `.integration.test.js` for integration tests
- Suffix with `.e2e.test.js` for end-to-end tests

### Adapters
- `[LegacyName]Adapter.js` for backward-compatibility layers (e.g., `LegacyAPIAdapter.js`)

---

## Module Exports Pattern

### Base Classes

```javascript
// agents/core/base/AgnoAgent.js
export class AgnoAgent {
  async execute(input) { }
  async think(input) { }
  getMetadata() { }
}

// agents/core/base/index.js
export * from './AgnoAgent.js';
export * from './AgnoSubAgent.js';
export * from './AgnoTool.js';
export * from './AgnoMemory.js';
export * from './AgnoRegistry.js';
```

### Agents

```javascript
// agents/core/agents/QAParentAgent.js
export class QAParentAgent extends AgnoAgent {
  // Implementation
}

// agents/core/agents/index.js
export { QAParentAgent } from './QAParentAgent.js';
export { DiscoverySubAgent } from './DiscoverySubAgent.js';
// ... etc
```

### Tools

```javascript
// agents/core/tools/discovery/SitemapParserTool.js
export class SitemapParserTool extends AgnoTool {
  // Implementation
}

// agents/core/tools/index.js
export * from './discovery/SitemapParserTool.js';
export * from './discovery/RSSParserTool.js';
// ... etc (all 24 tools)
```

### Memory

```javascript
// agents/core/memory/MemoryService.js
export class MemoryService {
  constructor(sessionStore, persistentStore) {
    this.sessionMemory = sessionStore;
    this.persistentMemory = persistentStore;
  }
}

// agents/core/memory/index.js
export { SessionMemory } from './SessionMemory.js';
export { PersistentMemory } from './PersistentMemory.js';
export { MemoryService } from './MemoryService.js';
```

### Main Entry Point

```javascript
// agents/core/index.js
import { QAParentAgent } from './agents/QAParentAgent.js';
import * as tools from './tools/index.js';
import * as memory from './memory/index.js';
import { AgnoRegistry } from './base/AgnoRegistry.js';

export async function createAgnoSystem(config) {
  // Initialize registry
  const registry = new AgnoRegistry();
  registry.registerTools(tools);
  registry.registerAgents({
    QAParentAgent,
    DiscoverySubAgent,
    DetectionSubAgent,
    TestingSubAgent,
    BypassSubAgent,
    EvidenceSubAgent
  });

  // Initialize memory
  const memoryService = new memory.MemoryService(
    new memory.SessionMemoryStore(),
    new memory.PersistentMemory(config.supabaseClient)
  );

  // Create parent agent
  const parentAgent = new QAParentAgent({
    registry,
    memory: memoryService,
    browser: config.browser,
    proxy: config.proxy,
    s3: config.s3,
    logger: config.logger
  });

  return {
    agent: parentAgent,
    registry,
    memory: memoryService
  };
}

export * from './base/index.js';
export * from './agents/index.js';
export * from './tools/index.js';
export * from './memory/index.js';
export * from './adapters/index.js';
```

---

## Backward Compatibility: Adapter Layer

```javascript
// agents/core/adapters/LegacyAPIAdapter.js
export class LegacyAPIAdapter {
  constructor(agnoSystem) {
    this.agnoSystem = agnoSystem;
  }

  async executeJob(jobInput) {
    // Convert old format to new format
    const agnoInput = {
      jobId: jobInput.id,
      domain: new URL(jobInput.url).hostname,
      targetUrl: jobInput.url,
      depth: jobInput.depth || 2,
      options: jobInput.options || {}
    };

    // Execute new system
    const result = await this.agnoSystem.agent.execute(agnoInput);

    // Convert result back to old format
    return {
      id: jobInput.id,
      status: result.status,
      data: this.convertResults(result.data),
      metrics: result.metrics
    };
  }

  convertResults(newResult) {
    // Map new structure to old structure
    return {
      articles: newResult.details.articles,
      detections: newResult.details.detections,
      tests: newResult.details.tests,
      bypasses: newResult.details.bypasses,
      evidence: newResult.details.evidence,
      summary: newResult.summary
    };
  }
}
```

### API Route with Adapter

```typescript
// src/app/api/jobs/route.ts
import { createAgnoSystem } from '@/agents/core';
import { LegacyAPIAdapter } from '@/agents/core/adapters/LegacyAPIAdapter';

let agnoSystem;
let adapter;

export async function POST(request: Request) {
  // Initialize on first request
  if (!agnoSystem) {
    agnoSystem = await createAgnoSystem({
      supabaseClient: getSupabaseClient(),
      browser: getBrowserPool(),
      proxy: getProxyManager(),
      s3: getS3Client(),
      logger: getLogger()
    });

    adapter = new LegacyAPIAdapter(agnoSystem);
  }

  const jobInput = await request.json();

  try {
    const result = await adapter.executeJob(jobInput);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Import Patterns

### Internal imports
```javascript
// In agents/core/agents/QAParentAgent.js
import { AgnoAgent } from '../base/index.js';
import * as subAgents from './index.js';
import { SubAgentInvoker } from '../tools/SubAgentInvoker.js';
import { MemoryService } from '../memory/index.js';
```

### External imports
```javascript
// In src/app/api/jobs/route.ts
import { createAgnoSystem, LegacyAPIAdapter } from '@/agents/core';
```

### Test imports
```javascript
// In tests/unit/agents/QAParentAgent.test.js
import { QAParentAgent } from '@/agents/core/agents';
import { MockBrowser } from '@/tests/fixtures/mocks';
import { createMockMemory } from '@/tests/setup';
```

---

## File Size Guidelines

| File Type | Target Size |
|-----------|-------------|
| Agent implementation | 200-400 lines |
| Tool implementation | 100-200 lines |
| Tool test | 150-250 lines |
| Memory class | 150-250 lines |
| Integration test | 200-300 lines |
| Documentation | 500-2000 lines |

**Goal**: Files are readable, focused, and testable.

---

## CI/CD Integration

### Build
```bash
# All files in agents/core must:
# - Pass linting
# - Pass type checking (if TypeScript)
# - Have 80%+ test coverage
# - Have JSDoc comments

npm run lint:agno
npm run test:agno
npm run coverage:agno
```

### Deployment
```bash
# Build artifacts:
# - agents/core/ → bundled as single module
# - tests/ → run during CI
# - .claude/ → documentation (not deployed)
```

---

## Migration Path

### Phase 1: Setup (Week 1)
```
✓ Create base classes (AgnoAgent, AgnoSubAgent, AgnoTool)
✓ Create memory layer (SessionMemory, PersistentMemory)
✓ Create agents/ and tools/ directories
✓ Setup test framework
```

### Phase 2: Implement (Week 2-3)
```
✓ Implement 5 sub-agents
✓ Implement 24 tools
✓ Write unit & integration tests
```

### Phase 3: Orchestration (Week 3-4)
```
✓ Implement QAParentAgent
✓ Implement SubAgentInvoker
✓ Test orchestration flow
✓ Create LegacyAPIAdapter
```

### Phase 4: Integration (Week 4-5)
```
✓ Update API route to use adapter
✓ Run E2E tests with real domains
✓ Monitor performance
✓ Optimize if needed
```

---

## Summary

This repository structure provides:
- ✅ Clear separation of concerns (agents, tools, memory)
- ✅ Modular, testable code organization
- ✅ Scalable directory structure (easy to add new tools)
- ✅ Backward compatibility via adapter layer
- ✅ Comprehensive test mirrors
- ✅ Versioned documentation
- ✅ Production-ready file organization

The structure supports:
- **Parallel development** (different teams work on different phases)
- **Incremental testing** (test each component in isolation)
- **Easy debugging** (code is organized logically)
- **Future extensions** (easy to add new agents, tools, or phases)

