---
name: Agno Implementation Roadmap & Code Structure
description: Concrete implementation steps and file organization for multi-agent system
type: project
---

# Agno Multi-Agent Implementation Roadmap

**Total Duration**: 4-5 weeks
**Risk Level**: Low (adapter layer maintains backward compatibility)
**Complexity**: Moderate (parallel sub-agents, but each has single responsibility)

---

## Phase Breakdown & Deliverables

### Phase 1: Agent Foundations (Days 1-3)

**Goal**: Build base classes and infrastructure

**Files to Create**:

1. `agents/core/base/AgnoAgent.js`
   - Base class for parent agents
   - Methods: think(), dispatch(), synthesize()
   - Memory access interface

2. `agents/core/base/AgnoSubAgent.js`
   - Base class for sub-agents
   - Methods: execute(), getSchema(), validate()
   - Result reporting

3. `agents/core/base/AgnoMemory.js`
   - Session memory (job-scoped)
   - Persistent memory (domain-scoped)
   - Query interface

4. `agents/core/tools/SubAgentInvoker.js`
   - Framework for invoking sub-agents as tools
   - Result aggregation

**Tests**:
- Unit: Each base class in isolation
- Integration: Agent + Memory

**Completion Gate**: 4 base classes + tests pass

---

### Phase 2: Sub-Agents (Days 4-10)

**Goal**: Implement 5 specialized sub-agents

#### 2.1 Discovery Sub-Agent
**File**: `agents/core/agents/DiscoverySubAgent.js`

**Responsibility**: Find article URLs

**Execute Flow**:
```
Input: { domain, maxArticles, siteProfile }
  ↓
1. Try sitemap (if URL known)
2. Try RSS feed (if URL known)
3. Fallback to crawl
  ↓
Output: { articles: [...], method, success }
```

**Code Structure**:
```javascript
export class DiscoverySubAgent extends AgnoSubAgent {
  async execute(input) {
    // 1. Validate input
    this.validate(input);

    // 2. Get methods from site profile
    const methods = this.getDiscoveryMethods(input.siteProfile);

    // 3. Try each method
    for (const method of methods) {
      const result = await this.tryMethod(method, input);
      if (result.success) return result;
    }

    // 4. Fallback
    return await this.crawlDomain(input.domain, input.maxArticles);
  }

  async tryMethod(method, input) {
    switch (method) {
      case 'sitemap': return this.fetchSitemap(input.domain);
      case 'rss': return this.parseRSSFeed(input.domain);
      default: return { success: false };
    }
  }
}
```

**Output Schema**:
```json
{
  "method": "sitemap|rss|crawl",
  "articles": [
    { "url": "string", "title": "string|null", "date": "ISO|null" }
  ],
  "success": "boolean",
  "error": "string|null"
}
```

---

#### 2.2 Detection Sub-Agent
**File**: `agents/core/agents/DetectionSubAgent.js`

**Responsibility**: Locate video players on URLs

**Execute Flow**:
```
Input: { urls: [URL], siteProfile }
  ↓
For each URL (parallel):
  1. Navigate page
  2. Detect player (HTML5, HLS, custom)
  3. Screenshot
  4. Return player info
  ↓
Output: { results: [...] }
```

**Code Structure**:
```javascript
export class DetectionSubAgent extends AgnoSubAgent {
  async execute(input) {
    const { urls, siteProfile } = input;

    // Parallel detection across URLs
    const results = await Promise.all(
      urls.map(url => this.detectOnUrl(url, siteProfile))
    );

    return {
      results: results.map(r => ({ url: r.url, ...r })),
      totalChecked: urls.length,
      foundCount: results.filter(r => r.playerFound).length
    };
  }

  async detectOnUrl(url, siteProfile) {
    let browser;
    try {
      browser = await getBrowserContext();
      const page = await browser.newPage();
      await page.goto(url);

      // Detect player type
      const players = await this.scanForPlayers(page);
      const screenshot = await page.screenshot();

      return {
        url,
        playerFound: players.length > 0,
        playerTypes: players,
        screenshot: await uploadToS3(screenshot)
      };
    } catch (e) {
      return { url, playerFound: false, error: e.message };
    } finally {
      if (browser) await browser.close();
    }
  }

  async scanForPlayers(page) {
    return [
      ...(await this.scanHTML5(page)),
      ...(await this.scanHLS(page)),
      ...(await this.scanCustom(page))
    ];
  }
}
```

**Output Schema**:
```json
{
  "results": [
    {
      "url": "string",
      "playerFound": "boolean",
      "playerTypes": ["html5|hls|custom"],
      "playButtonLocation": { "x": "number", "y": "number" },
      "screenshot": "s3://string|null",
      "error": "string|null"
    }
  ],
  "totalChecked": "number",
  "foundCount": "number"
}
```

---

#### 2.3 Testing Sub-Agent
**File**: `agents/core/agents/TestingSubAgent.js`

**Responsibility**: Test video playback on detected players

**Execute Flow**:
```
Input: { urls: [URL], detectionInfo }
  ↓
For each URL with player (parallel):
  1. Navigate page
  2. Dismiss popups
  3. Click play
  4. Test audio (wait + verify)
  5. Test controls
  6. Screenshots
  ↓
Output: { results: [...] }
```

**Similar structure to Detection**, but:
- More states (before play, playing, after play)
- Tests each control (play, pause, seek, volume)
- Collects multi-step screenshots

---

#### 2.4 Bypass Sub-Agent
**File**: `agents/core/agents/BypassSubAgent.js`

**Responsibility**: Handle WAF blocking on failed tests

**Execute Flow**:
```
Input: { failedUrls, siteProfile, strategies }
  ↓
For each failed URL:
  1. Detect WAF signature
  2. Look up bypass strategy
  3. Attempt bypass (proxy, headers, etc.)
  4. Re-test if bypass worked
  ↓
Output: { results: [...] }
```

**Key Logic**:
- Detects WAF type from HTTP headers, signatures
- Consults persistent memory for known strategies
- Tries rotation, stealth headers, alternative proxies
- Updates memory with success/failure

---

#### 2.5 Evidence Sub-Agent
**File**: `agents/core/agents/EvidenceSubAgent.js`

**Responsibility**: Organize and store results as evidence

**Execute Flow**:
```
Input: { detectionResults, testingResults, bypassResults }
  ↓
1. Group all screenshots by URL
2. Label with phase
3. Organize into manifest
4. Ensure all in S3
5. Return organized collection
↓
Output: { manifest, s3Keys: [...] }
```

**Simple aggregator** - collects results from other agents

---

### Phase 3: Parent Agent (Days 11-16)

**Goal**: Build orchestrator that coordinates sub-agents

**File**: `agents/core/agents/QAParentAgent.js`

**Core Algorithm** (from ARCHITECTURE_BLUEPRINT):

```javascript
export class QAParentAgent extends AgnoAgent {
  constructor(subAgents, memory) {
    super();
    this.discovery = subAgents.discovery;
    this.detection = subAgents.detection;
    this.testing = subAgents.testing;
    this.bypass = subAgents.bypass;
    this.evidence = subAgents.evidence;
    this.memory = memory;
  }

  async executeQAMission(jobId, target, config) {
    // Initialize session
    const session = this.memory.createSession(jobId, target);

    try {
      // Phase 1: DISCOVERY
      const discoveryResult = await this.discovery.execute({
        domain: new URL(target).hostname,
        maxArticles: config.maxArticles || 3,
        siteProfile: await this.memory.getSiteProfile(target)
      });

      if (!discoveryResult.success) {
        return { status: 'fail', reason: 'No articles discovered' };
      }

      session.set('articles', discoveryResult.articles);

      // Phase 2: DETECTION (Parallel)
      const detectionResult = await this.detection.execute({
        urls: discoveryResult.articles.map(a => a.url),
        siteProfile: await this.memory.getSiteProfile(target)
      });

      session.set('detectionResults', detectionResult.results);

      const playersFound = detectionResult.results.filter(r => r.playerFound);
      if (playersFound.length === 0) {
        return { status: 'partial', reason: 'No players detected' };
      }

      // Phase 3: TESTING (Parallel)
      const testingResult = await this.testing.execute({
        urls: playersFound.map(r => r.url),
        detectionInfo: playersFound
      });

      session.set('testingResults', testingResult.results);

      const failedTests = testingResult.results.filter(r => r.testsFailed > 0);

      // Phase 4: BYPASS (Conditional, Parallel)
      let bypassResult = null;
      if (failedTests.length > 0) {
        bypassResult = await this.bypass.execute({
          failedUrls: failedTests,
          siteProfile: await this.memory.getSiteProfile(target),
          strategies: await this.memory.getBypassStrategies(target)
        });

        session.set('bypassResults', bypassResult.results);

        // Merge bypass results back
        for (const bypass of bypassResult.results) {
          if (bypass.bypassSuccessful && bypass.newTestResults) {
            const idx = testingResult.results.findIndex(r => r.url === bypass.url);
            if (idx >= 0) testingResult.results[idx] = bypass.newTestResults;
          }
        }
      }

      // Phase 5: EVIDENCE (Aggregate)
      const evidenceResult = await this.evidence.execute({
        detectionResults: detectionResult.results,
        testingResults: testingResult.results,
        bypassResults: bypassResult?.results || []
      });

      session.set('evidenceResult', evidenceResult);

      // SYNTHESIZE
      const report = this.synthesizeReport({
        articles: discoveryResult.articles,
        detection: detectionResult.results,
        testing: testingResult.results,
        bypass: bypassResult?.results || [],
        evidence: evidenceResult
      });

      // DETERMINE STATUS
      const passCount = testingResult.results.filter(r => r.testsPassed >= 2).length;
      const failCount = testingResult.results.filter(r => r.testsFailed > 0).length;

      report.overallStatus = failCount === 0 ? 'pass' : (passCount > 0 ? 'partial' : 'fail');

      // STORE
      await this.memory.saveSiteProfile(target, this.updateSiteProfile(
        await this.memory.getSiteProfile(target),
        { detection: detectionResult, testing: testingResult, bypass: bypassResult }
      ));

      await this.memory.saveTestResult(jobId, report);

      return report;

    } finally {
      session.cleanup();
    }
  }

  synthesizeReport(data) {
    // Combine all results into single coherent report
    return {
      timestamp: new Date().toISOString(),
      articles: data.articles,
      detection: {
        checked: data.detection.length,
        found: data.detection.filter(d => d.playerFound).length
      },
      testing: {
        tested: data.testing.length,
        passed: data.testing.filter(t => t.testsPassed >= 2).length,
        failed: data.testing.filter(t => t.testsFailed > 0).length
      },
      bypass: data.bypass.length > 0 ? {
        attempted: data.bypass.length,
        successful: data.bypass.filter(b => b.bypassSuccessful).length
      } : null,
      evidence: data.evidence
    };
  }

  updateSiteProfile(existingProfile, results) {
    return {
      ...existingProfile,
      lastTested: new Date().toISOString(),
      playerFrequency: this.analyzePlayerFrequency(results.detection),
      wafSignatures: this.extractWAFSignatures(results.bypass),
      testSuccess: this.computeSuccessRate(results.testing)
    };
  }
}
```

**Tests**:
- Mock sub-agents, verify orchestration logic
- Test phase sequencing
- Test result synthesis
- Test error handling

---

### Phase 4: Memory Integration (Days 17-18)

**Files to Create/Update**:

1. `agents/core/memory/SessionMemory.js`
   - Per-job context storage
   - Auto-cleanup on job end

2. `agents/core/memory/PersistentMemory.js`
   - Site profiles
   - WAF bypass strategies
   - Success rates

3. Update `agents/core/memory/MemoryService.js`
   - Coordinate both layers
   - Query interface

**Implementation**:
```javascript
// SessionMemory
export class SessionMemory {
  constructor(jobId) {
    this.jobId = jobId;
    this.data = new Map();
  }

  set(key, value) {
    this.data.set(key, value);
  }

  get(key) {
    return this.data.get(key);
  }

  cleanup() {
    this.data.clear();
  }
}

// PersistentMemory
export class PersistentMemory {
  async getSiteProfile(domain) {
    return await supabase
      .from('site_profiles')
      .select('*')
      .eq('domain', domain)
      .single();
  }

  async saveSiteProfile(domain, profile) {
    return await supabase
      .from('site_profiles')
      .upsert({ domain, ...profile });
  }

  async getBypassStrategies(domain) {
    return await supabase
      .from('waf_strategies')
      .select('*')
      .eq('domain', domain);
  }

  async saveWAFBypass(domain, strategy) {
    return await supabase
      .from('waf_strategies')
      .insert({ domain, ...strategy });
  }
}
```

---

### Phase 5: API Integration (Days 19-21)

**File to Update**: `src/app/api/jobs/route.ts`

**Change**:
```typescript
// OLD
const { supervisor } = getCognitiveSystem();
const result = await supervisor.run(jobId, target, ...);

// NEW
const { parentAgent } = getCognitiveSystem();
const result = await parentAgent.executeQAMission(jobId, target, config);
```

**Adapter Layer** (backward compat):
```javascript
// agents/core/adapters/LegacyAPI.js
export function createLegacySupervisor(parentAgent) {
  return {
    async run(jobId, url, sharedBrowser, onProgress, options) {
      return parentAgent.executeQAMission(jobId, url, options);
    }
  };
}
```

**API remains unchanged**, tests pass as-is

---

### Phase 6: Dashboard Update (Days 22-24)

**Changes**: Update telemetry websocket to report per-agent progress

**Current Flow**:
```
Dashboard ← WebSocket ← API ← Agent logs
```

**New Flow**:
```
Dashboard ← WebSocket ← AgentProgressTracker ← Parent Agent + Sub-Agents

Each sub-agent emits:
- "phase_start": { phase: "detection", agents: 5, urls: 20 }
- "agent_progress": { agent: "detection-3", progress: 60% }
- "phase_complete": { phase: "detection", success: 18/20 }
```

**New Dashboard Insights**:
- Per-agent progress bar
- Phase timeline
- Parallel execution visualization
- Sub-agent status indicators

---

## File Structure (Complete)

```
agents/
├── core/
│   ├── index.js (updated: export createAgnoSystem)
│   │
│   ├── base/
│   │   ├── AgnoAgent.js (new)
│   │   ├── AgnoSubAgent.js (new)
│   │   └── AgnoMemory.js (new)
│   │
│   ├── agents/
│   │   ├── QAParentAgent.js (new)
│   │   ├── DiscoverySubAgent.js (new)
│   │   ├── DetectionSubAgent.js (new)
│   │   ├── TestingSubAgent.js (new)
│   │   ├── BypassSubAgent.js (new)
│   │   └── EvidenceSubAgent.js (new)
│   │
│   ├── tools/
│   │   └── SubAgentInvoker.js (new)
│   │
│   ├── memory/
│   │   ├── SessionMemory.js (new)
│   │   ├── PersistentMemory.js (new)
│   │   ├── MemoryService.js (updated)
│   │   └── supabase-client.js (unchanged)
│   │
│   └── adapters/
│       └── LegacyAPI.js (new - backward compat)
│
├── shivani/
│   └── (unchanged)
│
└── graph/ + skills/ (keep for now, deprecate later)
```

---

## Testing Strategy

### Unit Tests (Per-Agent)
```
agents/core/__tests__/
├── DiscoverySubAgent.test.js
├── DetectionSubAgent.test.js
├── TestingSubAgent.test.js
├── BypassSubAgent.test.js
├── EvidenceSubAgent.test.js
└── QAParentAgent.test.js
```

### Integration Tests
```
agents/core/__tests__/
├── integration/
│   ├── ParentAgent.workflow.test.js
│   ├── Memory.integration.test.js
│   └── APIEndpoint.test.js
```

### Coverage Goals
- Unit: 80%+ per agent
- Integration: 70%+ workflows
- E2E: Existing test suite passes

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Sub-agent failures** | Graceful degradation; parent agent continues |
| **Memory bloat** | Session cleanup on job end |
| **Parallel race** | Queue phase transitions (sequential phases) |
| **Breaking API** | Adapter layer + backward compat tests |
| **Performance** | Benchmark each phase (target: ~8 min) |

---

## Success Metrics

**Code Quality**:
- [ ] All tests pass (unit + integration + E2E)
- [ ] 80%+ code coverage
- [ ] No breaking changes to API

**Performance**:
- [ ] Total execution time ≤ 10 minutes (target ~8)
- [ ] Parallel phases execute concurrently
- [ ] Memory usage stable (no leaks)

**Architecture**:
- [ ] 1 parent agent + 5 sub-agents operational
- [ ] Session + persistent memory working
- [ ] Dashboard shows per-agent progress
- [ ] New jobs 100% success rate (compatible domains)

---

## Timeline Summary

| Phase | Days | Deliverable |
|-------|------|-------------|
| 1. Foundations | 1-3 | Base classes + tests |
| 2. Sub-Agents | 4-10 | 5 agents fully tested |
| 3. Parent Agent | 11-16 | Orchestrator + algorithm |
| 4. Memory | 17-18 | Session + persistent layers |
| 5. API Integration | 19-21 | Backward-compat adapter |
| 6. Dashboard | 22-24 | Per-agent insights |
| **Buffer** | 25-28 | Bug fixes, optimization |
| **Total** | 28 days | ~4 weeks |

---

**Next Step**: Confirm timeline with team, begin Phase 1 on sprint start
