---
name: Agno Multi-Agent Architecture Blueprint
description: Parent-Agent coordinating Sub-Agents pattern for QA-Agents
type: project
---

# QA-Agents → Agno Multi-Agent Architecture

**Core Pattern**: Parent Agent coordinating parallel Sub-Agents
**Date**: March 18, 2026
**Objective**: Transform monolithic agent into collaborative multi-agent system

---

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│ API / Job Dispatcher                                         │
│ POST /api/jobs → { jobId, target, config }                 │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ QA PARENT AGENT (Supervisor)                                 │
│                                                              │
│ Role: Orchestrate sub-agents, combine results              │
│ LLM: Claude (decides strategy, routing)                    │
│ Tools: Invoke sub-agents (not direct browser tools)        │
│                                                              │
│ Process:                                                     │
│ 1. Analyze target domain                                    │
│ 2. Load site profile from memory                           │
│ 3. Create parallel task assignments for sub-agents         │
│ 4. Wait for all sub-agents to complete                     │
│ 5. Synthesize & combine results                            │
│ 6. Generate final report                                   │
└────────────────┬─────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────┬──────────────┐
    │            │            │            │              │
    ▼            ▼            ▼            ▼              ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│ DISC   │ │ DETECT │ │ TEST   │ │ BYPASS │ │ EVIDENCE │
│ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ │ Agent    │
│ (Sub)  │ │ (Sub)  │ │ (Sub)  │ │ (Sub)  │ │ (Sub)    │
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘
    │          │          │          │           │
    └──────────┴──────────┴──────────┴───────────┘
          (Each sub-agent has own tools)
          │
          ├─ Browser access
          ├─ Skill execution
          └─ Result storage
          │
    ┌─────▼──────────────────────────────┐
    │ Shared Services                    │
    ├─────────────────────────────────────┤
    │ • Memory (Session + Persistent)    │
    │ • Browser Pool & Proxy Rotation    │
    │ • S3 Storage                       │
    │ • Supabase Database                │
    └──────────────────────────────────────┘
```

---

## Agent Roles & Communication

### Parent Agent (QA Supervisor)
**Responsibility**: Orchestrate, combine results, make strategic decisions

**Inputs**:
- Target domain/URL
- Site profile from memory
- Job configuration

**Process**:
1. **Plan**: Determine which sub-agents to invoke in parallel
2. **Dispatch**: Send task instructions to each sub-agent
3. **Wait**: Collect results from all sub-agents (concurrent)
4. **Synthesize**: Combine results into coherent report
5. **Decide**: Determine pass/partial/fail status
6. **Store**: Save results to persistent memory

**Outputs**:
- Final test report
- Updated site profile
- Screenshot collection

**Tools**: Sub-agent invocation (not direct browser tools)

---

### Sub-Agents (5 Specialists)

#### 1. Discovery Agent (Sub)
**Autonomy**: High (makes own decisions about discovery method)
**Input**: Domain, site profile, max articles
**Output**: List of discovered article URLs
**Tools**:
- fetch_sitemap
- parse_rss_feed
- crawl_homepage

**Behavior**:
```
1. Try sitemap (fastest)
   └─ If found: return articles
2. Try RSS feed (medium)
   └─ If found: return articles
3. Try crawling (fallback)
   └─ Return whatever found
```

**Result Type**: `DiscoveryResult`
```json
{
  "method": "sitemap|rss|crawl",
  "articles": [
    { "url": "...", "title": "...", "date": "..." }
  ],
  "count": 5,
  "success": true
}
```

---

#### 2. Detection Agent (Sub)
**Autonomy**: Medium (checks multiple player types)
**Input**: Article URLs, site profile
**Output**: Player detection results per URL
**Tools**:
- detect_html5_video
- detect_hls_stream
- detect_custom_player
- locate_play_button

**Behavior**:
```
For each URL:
  1. Navigate to page
  2. Check for video element
  3. Check for HLS manifest
  4. Check for custom player framework
  5. Store player info + screenshot
```

**Result Type**: `DetectionResult`
```json
{
  "url": "...",
  "playerFound": true,
  "playerType": "html5|hls|custom",
  "playButtonLocation": { "x": 100, "y": 200 },
  "canAutoplay": false,
  "screenshot": "s3://..."
}
```

---

#### 3. Testing Agent (Sub)
**Autonomy**: Medium (adapts to player type)
**Input**: URLs with player detection, detection results
**Output**: Playback test results
**Tools**:
- click_play_button
- test_audio_playback
- test_playback_controls
- measure_playback_latency

**Behavior**:
```
For each URL with detected player:
  1. Dismiss any popups
  2. Click play button
  3. Wait for playback to start
  4. Test audio stream active
  5. Test volume control
  6. Test seek/rewind
  7. Capture screenshots
```

**Result Type**: `TestingResult`
```json
{
  "url": "...",
  "testsPassed": 4,
  "testsFailed": 1,
  "playerState": "playing|paused|error",
  "audioDetected": true,
  "controlsWorking": true,
  "latency": 2345,
  "screenshots": ["s3://...", "s3://..."]
}
```

---

#### 4. Bypass Agent (Sub)
**Autonomy**: High (decides bypass strategy)
**Input**: URLs that failed, WAF signatures from memory
**Output**: Bypass attempt results
**Tools**:
- bypass_cloudflare
- bypass_perimeter_x
- rotate_proxy
- add_stealth_headers

**Behavior**:
```
For each failed URL:
  1. Detect WAF signature
  2. Look up bypass strategy from memory
  3. Attempt bypass (proxy, headers, etc.)
  4. Retry failed tests
  5. Store new strategy if successful
```

**Result Type**: `BypassResult`
```json
{
  "url": "...",
  "wafDetected": "perimeter-x",
  "bypassAttempted": true,
  "bypassSuccessful": true,
  "strategyUsed": "proxy-rotation",
  "newTestResults": { /* TestingResult */ }
}
```

---

#### 5. Evidence Agent (Sub)
**Autonomy**: Low (stores results as provided)
**Input**: Test results, detection results, bypass results
**Output**: Organized screenshot collection
**Tools**:
- take_screenshot
- upload_to_s3
- organize_by_url
- compress_and_index

**Behavior**:
```
For all provided results:
  1. Group screenshots by URL
  2. Label with test phase
  3. Upload to S3
  4. Create index/manifest
  5. Return S3 URLs + manifest
```

**Result Type**: `EvidenceResult`
```json
{
  "screenshots": [
    {
      "url": "article-url",
      "phase": "detection|testing|bypass",
      "s3Key": "s3://bucket/...",
      "timestamp": "2026-03-18T10:00:00Z"
    }
  ],
  "manifest": "s3://bucket/.../manifest.json"
}
```

---

## Parent Agent Algorithm

### Pseudocode

```
FUNCTION executeQAMission(jobId, target, config):

  // 1. INITIALIZE
  sessionMemory = createSessionMemory(jobId)
  domain = extractDomain(target)
  siteProfile = loadSiteProfile(domain)
  maxArticles = config.maxArticles || 3

  // 2. DISPATCH (Phase 1: Discovery)
  discoveryResult = AWAIT discoveryAgent.execute({
    domain: domain,
    siteProfile: siteProfile,
    maxArticles: maxArticles
  })

  IF discoveryResult.success == false:
    RETURN { status: "fail", reason: "no articles found" }

  articles = discoveryResult.articles
  sessionMemory.set("articles", articles)

  // 3. DISPATCH (Phase 2: Detection - Parallel)
  detectionResults = AWAIT PARALLEL detectionAgent.execute({
    urls: articles,
    siteProfile: siteProfile
  })

  urlsWithPlayers = filter(detectionResults, r => r.playerFound)
  sessionMemory.set("detectionResults", detectionResults)

  IF length(urlsWithPlayers) == 0:
    RETURN { status: "partial", reason: "no players found" }

  // 4. DISPATCH (Phase 3: Testing - Parallel)
  testingResults = AWAIT PARALLEL testingAgent.execute({
    urls: urlsWithPlayers,
    detectionInfo: detectionResults
  })

  sessionMemory.set("testingResults", testingResults)

  failedTests = filter(testingResults, r => r.testsPassed == 0)

  // 5. DISPATCH (Phase 4: Bypass - Conditional Parallel)
  IF length(failedTests) > 0:
    bypassResults = AWAIT PARALLEL bypassAgent.execute({
      failedUrls: failedTests,
      siteProfile: siteProfile,
      strategies: lookupBypassStrategies(domain)
    })

    sessionMemory.set("bypassResults", bypassResults)

    // Merge bypass results back into testing results
    FOR each bypassResult IN bypassResults:
      IF bypassResult.bypassSuccessful:
        testingResults[bypassResult.url] = bypassResult.newTestResults

  // 6. DISPATCH (Phase 5: Evidence - Parallel)
  evidenceResult = AWAIT evidenceAgent.execute({
    detectionResults: detectionResults,
    testingResults: testingResults,
    bypassResults: get(sessionMemory, "bypassResults", [])
  })

  sessionMemory.set("evidenceResult", evidenceResult)

  // 7. SYNTHESIZE RESULTS
  finalReport = synthesizeReport({
    articles: articles,
    detection: detectionResults,
    testing: testingResults,
    bypass: get(sessionMemory, "bypassResults", []),
    evidence: evidenceResult
  })

  // 8. DETERMINE STATUS
  passCount = count(testingResults, r => r.testsPassed >= 2)
  failCount = count(testingResults, r => r.testsFailed > 0)

  IF failCount == 0:
    status = "pass"
  ELSE IF passCount > 0:
    status = "partial"
  ELSE:
    status = "fail"

  finalReport.overallStatus = status

  // 9. STORE RESULTS
  saveSiteProfile(domain, {
    ...siteProfile,
    lastTested: now(),
    testResult: status,
    playerFrequency: analyzePlayerTypes(detectionResults),
    wafSignatures: extractWAFSignatures(bypassResults),
    discoverMethods: discoverResult.method
  })

  saveTestHistory(jobId, finalReport)

  // 10. RETURN
  RETURN finalReport
```

---

## Data Structures

### SessionMemory (Job Scoped)
```javascript
{
  jobId: "job-123",
  target: "https://thebrakereport.com",
  articles: [ /* from discovery */ ],
  detectionResults: [ /* from detection */ ],
  testingResults: [ /* from testing */ ],
  bypassResults: [ /* from bypass, if needed */ ],
  evidenceResult: { /* from evidence */ },
  startTime: 1710768000000,
  currentPhase: "testing" | "bypass" | "evidence"
}
```

### PersistentMemory (Site Scoped)
```javascript
{
  domain: "thebrakereport.com",
  lastTested: "2026-03-18T10:00:00Z",
  testResult: "pass" | "partial" | "fail",
  playerTypes: {
    "html5": 15,
    "hls": 3,
    "custom": 1
  },
  wafDetected: "cloudflare",
  wafBypassStrategies: [
    {
      signature: "cloudflare-challenge",
      method: "challenge-solving",
      successRate: 0.85
    }
  ],
  discoveryMethods: ["sitemap", "rss"],
  totalArticlesTested: 19,
  avgPlaybackLatency: 2100,
  recommendations: ["Enable RLS for HLS streams"]
}
```

---

## Sub-Agent Parallelism

### Sequential Phases (Required)
1. **Discovery** (must complete first, feeds articles to others)
2. **Detection** (parallel on articles)
3. **Testing** (parallel on detected players)
4. **Bypass** (parallel on failed tests, conditional)
5. **Evidence** (after all others, collects results)

### Concurrency Model
```
Phase 1: [Discovery] ▶
         (single agent, 1-2 min)

         ┌─ [Detection] ▶ ▶ ▶
Phase 2: ┤ 5 articles in parallel
         │ (each ~30s, total ~30-60s)

         ┌─ [Testing] ▶ ▶ ▶
Phase 3: ┤ 5 players in parallel
         │ (each ~1 min, total ~1 min)

         ┌─ [Bypass] ▶ ▶ ▶
Phase 4: ┤ failed URLs in parallel
         │ (conditional, 2-3 min)

Phase 5: [Evidence] ▶
         (aggregate results)

Total: ~8 minutes for typical job
```

---

## Parent Agent Tools (Sub-Agent Invocation)

```javascript
// Tools are sub-agent invocations, not direct skill calls

class InvokeDiscoverySubAgentTool extends Tool {
  name: "invoke_discovery_agent"
  description: "Invoke Discovery sub-agent to find article URLs"
  input: {
    domain: string,
    maxArticles: number,
    siteProfile?: object
  }
  output: DiscoveryResult
}

class InvokeDetectionSubAgentTool extends Tool {
  name: "invoke_detection_agent"
  description: "Invoke Detection sub-agent to locate players on URLs"
  input: {
    urls: string[],
    siteProfile?: object
  }
  output: DetectionResult[]
}

// ... similar for Testing, Bypass, Evidence
```

---

## Implementation Strategy

### Phase 1: Foundations
```
[ ] Create Agno Parent Agent base class
[ ] Create Agno Sub-Agent base class
[ ] Implement SessionMemory + PersistentMemory
[ ] Create tool invocation framework
```

### Phase 2: Sub-Agents
```
[ ] Discovery Sub-Agent (async to parallelize articles)
[ ] Detection Sub-Agent (handles multiple URLs)
[ ] Testing Sub-Agent (handles multiple players)
[ ] Bypass Sub-Agent (handles failed tests)
[ ] Evidence Sub-Agent (collects results)
```

### Phase 3: Parent Agent
```
[ ] QA Supervisor Parent Agent
[ ] Algorithm implementation (parallel dispatch + synthesis)
[ ] Result merging logic
[ ] Site profile updates
```

### Phase 4: Integration
```
[ ] Update API to use new architecture
[ ] Adapt dashboard for new result format
[ ] Test end-to-end
```

---

## Benefits of This Architecture

| Aspect | Benefit |
|--------|---------|
| **Parallelism** | 5 agents work in parallel; total time stays ~8 min |
| **Modularity** | Each sub-agent focused on single task |
| **Extensibility** | Add new sub-agents without changing parent |
| **Testability** | Each agent testable independently |
| **Observability** | Track progress per agent |
| **Resilience** | One agent failure doesn't block others |
| **Learning** | Persistent memory captures site patterns |
| **Adaptability** | Parent agent can adjust strategy based on results |

---

## Success Criteria

1. **Architecture**: Parent + 5 sub-agents implemented
2. **Performance**: Execution time ~8 minutes (acceptable range)
3. **Results**: Same test coverage as current system
4. **Quality**: Graceful handling of failures
5. **Testing**: 80%+ test coverage
6. **Documentation**: Clear prompts for each agent

---

**Next**: Review this architecture, confirm alignment, begin Phase 1 implementation.
