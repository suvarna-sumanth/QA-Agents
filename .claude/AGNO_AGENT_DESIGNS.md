---
name: Agno Agent Design Specifications
description: Complete design for all 6 agents (1 parent + 5 sub-agents)
type: reference
---

# Agno Agent Design Specifications

**Status**: Complete
**Last Updated**: March 18, 2026
**Scope**: Full agent architecture with interfaces, schemas, and communication patterns

---

## Agent Hierarchy

```
QAParentAgent (orchestrator, LLM-powered decision making)
├─ DiscoverySubAgent (deterministic: find URLs)
├─ DetectionSubAgent (deterministic: locate players)
├─ TestingSubAgent (deterministic: test playback)
├─ BypassSubAgent (deterministic: handle WAF)
└─ EvidenceSubAgent (deterministic: collect artifacts)
```

---

## Parent Agent: QAParentAgent

### Responsibility
Orchestrate all sub-agents, make decisions about flow, synthesize final results.

### Interface

```javascript
class QAParentAgent extends AgnoAgent {
  constructor(config) {
    // config: { model, tools, memory, browser, proxy, s3 }
  }

  async execute(jobInput) {
    // Input: { jobId, domain, targetUrl, depth, options }
    // Process:
    //   1. Load site profile from persistent memory
    //   2. Create session memory
    //   3. Dispatch discovery phase
    //   4. Dispatch detection/testing/bypass (parallel based on results)
    //   5. Dispatch evidence aggregation
    //   6. Synthesize final report
    // Output: { jobId, status, articles, results, evidence, metrics }
  }

  async dispatchDiscovery(sessionMem) {
    // Invoke DiscoverySubAgent with session context
  }

  async dispatchDetection(articles, sessionMem) {
    // Parallel: For each article, invoke DetectionSubAgent
  }

  async dispatchTesting(detectionResults, sessionMem) {
    // Parallel: For each detected player, invoke TestingSubAgent
  }

  async dispatchBypass(failedTests, sessionMem) {
    // Conditional parallel: If failures detected, invoke BypassSubAgent
  }

  async dispatchEvidence(allResults, sessionMem) {
    // Invoke EvidenceSubAgent with aggregated results
  }

  async synthesizeResults(allPhaseResults) {
    // Combine all results into final report
    // Update persistent memory with learnings
    // Clear session memory
  }
}
```

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "jobId": { "type": "string", "description": "Unique job identifier" },
    "domain": { "type": "string", "description": "Target domain" },
    "targetUrl": { "type": "string", "description": "Starting URL" },
    "depth": { "type": "number", "default": 2, "description": "Crawl depth" },
    "options": {
      "type": "object",
      "properties": {
        "parallel": { "type": "boolean", "default": true },
        "timeout": { "type": "number", "default": 600000 },
        "maxRetries": { "type": "number", "default": 3 }
      }
    }
  },
  "required": ["jobId", "domain", "targetUrl"]
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "jobId": { "type": "string" },
    "status": { "enum": ["success", "partial", "failed"] },
    "articles": { "type": "array", "items": { "type": "object" } },
    "detectionResults": { "type": "array" },
    "testingResults": { "type": "array" },
    "bypassResults": { "type": "array" },
    "evidenceResult": { "type": "object" },
    "metrics": {
      "type": "object",
      "properties": {
        "totalTime": { "type": "number" },
        "phaseTimes": { "type": "object" },
        "successRate": { "type": "number" }
      }
    },
    "errors": { "type": "array" }
  }
}
```

### Key Methods

**execute(jobInput)**
- Main entry point
- Orchestrates all phases
- Handles errors and retry logic
- Returns final result

**dispatchSubAgent(agentType, input)**
- Invokes sub-agent with tool
- Waits for completion
- Validates output schema
- Merges into session memory

**synthesizeResults(phases)**
- Combines all phase outputs
- Validates consistency
- Creates final report
- Updates persistent memory

---

## Sub-Agent Pattern: AgnoSubAgent

### Base Class

```javascript
class AgnoSubAgent {
  constructor(config) {
    this.tools = [];
    this.memory = null;
    this.logger = config.logger;
  }

  async execute(input) {
    // Validate input
    this.validate(input);

    // Execute tools deterministically
    const result = await this.run(input);

    // Validate output
    this.validateOutput(result);

    return result;
  }

  validate(input) {
    // Validate against schema
  }

  validateOutput(result) {
    // Validate result matches output schema
  }

  getSchema() {
    return {
      input: this.inputSchema,
      output: this.outputSchema
    };
  }
}
```

---

## Discovery Sub-Agent: DiscoverySubAgent

### Responsibility
Find all article URLs on domain using discovery methods.

### Design

```javascript
class DiscoverySubAgent extends AgnoSubAgent {
  constructor(config) {
    super(config);
    this.tools = [
      new SitemapParserTool(),
      new RSSParserTool(),
      new WebCrawlerTool()
    ];
  }

  async execute(input) {
    const { domain, depth, targetUrl } = input;

    const articles = [];

    // Try sitemap first
    const sitemapArticles = await this.tools[0].execute({
      domain,
      maxArticles: 100
    });
    articles.push(...sitemapArticles);

    // Try RSS
    const rssArticles = await this.tools[1].execute({
      domain,
      maxFeed: 50
    });
    articles.push(...rssArticles);

    // Crawl if needed
    if (articles.length < 10) {
      const crawlArticles = await this.tools[2].execute({
        startUrl: targetUrl,
        depth,
        maxPages: 100
      });
      articles.push(...crawlArticles);
    }

    // Deduplicate and validate
    const unique = this.deduplicateUrls(articles);

    return {
      phase: 'discovery',
      domain,
      articleCount: unique.length,
      articles: unique,
      methods: this.getMethodsUsed(sitemapArticles, rssArticles, unique)
    };
  }

  deduplicateUrls(articles) {
    const seen = new Set();
    return articles.filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }

  getMethodsUsed(sitemap, rss, all) {
    const methods = [];
    if (sitemap.length > 0) methods.push('sitemap');
    if (rss.length > 0) methods.push('rss');
    if (all.length > (sitemap.length + rss.length)) methods.push('crawl');
    return methods;
  }
}
```

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "domain": { "type": "string" },
    "targetUrl": { "type": "string" },
    "depth": { "type": "number", "default": 2 },
    "maxArticles": { "type": "number", "default": 100 }
  },
  "required": ["domain", "targetUrl"]
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "phase": { "enum": ["discovery"] },
    "domain": { "type": "string" },
    "articleCount": { "type": "number" },
    "articles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "title": { "type": "string" },
          "source": { "enum": ["sitemap", "rss", "crawl"] }
        },
        "required": ["url"]
      }
    },
    "methods": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["phase", "domain", "articles"]
}
```

---

## Detection Sub-Agent: DetectionSubAgent

### Responsibility
For a given article URL, detect all video players present.

### Design

```javascript
class DetectionSubAgent extends AgnoSubAgent {
  constructor(config) {
    super(config);
    this.tools = [
      new DOMScannerTool(),
      new HTML5PlayerDetectorTool(),
      new HLSPlayerDetectorTool(),
      new YouTubeDetectorTool(),
      new VimeoDetectorTool(),
      new CustomPlayerDetectorTool()
    ];
  }

  async execute(input) {
    const { url, browser } = input;

    const page = await browser.newPage();
    let players = [];

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Detect HTML5 players
      players.push(...await this.tools[1].execute({ page }));

      // Detect HLS players
      players.push(...await this.tools[2].execute({ page }));

      // Detect YouTube embeds
      players.push(...await this.tools[3].execute({ page }));

      // Detect Vimeo embeds
      players.push(...await this.tools[4].execute({ page }));

      // Detect custom players
      players.push(...await this.tools[5].execute({ page }));

    } finally {
      await page.close();
    }

    return {
      phase: 'detection',
      url,
      playerCount: players.length,
      players: players,
      timestamp: Date.now()
    };
  }
}
```

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "browser": { "type": "object", "description": "Browser instance reference" }
  },
  "required": ["url", "browser"]
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "phase": { "enum": ["detection"] },
    "url": { "type": "string" },
    "playerCount": { "type": "number" },
    "players": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["html5", "hls", "youtube", "vimeo", "custom"] },
          "selector": { "type": "string" },
          "sources": { "type": "array" }
        },
        "required": ["id", "type", "selector"]
      }
    }
  },
  "required": ["phase", "url", "players"]
}
```

---

## Testing Sub-Agent: TestingSubAgent

### Responsibility
Test if a detected player can play video content.

### Design

```javascript
class TestingSubAgent extends AgnoSubAgent {
  constructor(config) {
    super(config);
    this.tools = [
      new PlayButtonClickerTool(),
      new AudioDetectorTool(),
      new ControlTesterTool(),
      new ProgressDetectorTool(),
      new ErrorListenerTool(),
      new ScreenshotCapturerTool()
    ];
  }

  async execute(input) {
    const { url, player, browser } = input;

    const page = await browser.newPage();
    let testResult = {
      playable: false,
      hasAudio: false,
      controlsWork: false,
      progressDetected: false,
      errors: [],
      screenshots: []
    };

    try {
      await page.goto(url);

      // Click play
      await this.tools[0].execute({ page, playerSelector: player.selector });
      await page.waitForTimeout(2000);

      // Detect audio
      testResult.hasAudio = await this.tools[1].execute({ page });

      // Test controls
      testResult.controlsWork = await this.tools[2].execute({ page, playerSelector: player.selector });

      // Detect progress
      testResult.progressDetected = await this.tools[3].execute({ page, playerSelector: player.selector });

      // Capture screenshot
      const screenshot = await this.tools[5].execute({ page });
      testResult.screenshots.push(screenshot);

      // Determine playable
      testResult.playable = testResult.hasAudio || testResult.progressDetected;

    } catch (e) {
      testResult.errors.push(e.message);
    } finally {
      await page.close();
    }

    return {
      phase: 'testing',
      url,
      playerId: player.id,
      playerType: player.type,
      testResult,
      timestamp: Date.now()
    };
  }
}
```

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "player": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "selector": { "type": "string" }
      },
      "required": ["id", "type", "selector"]
    },
    "browser": { "type": "object" }
  },
  "required": ["url", "player", "browser"]
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "phase": { "enum": ["testing"] },
    "url": { "type": "string" },
    "playerId": { "type": "string" },
    "playerType": { "type": "string" },
    "testResult": {
      "type": "object",
      "properties": {
        "playable": { "type": "boolean" },
        "hasAudio": { "type": "boolean" },
        "controlsWork": { "type": "boolean" },
        "progressDetected": { "type": "boolean" },
        "errors": { "type": "array" }
      }
    },
    "timestamp": { "type": "number" }
  },
  "required": ["phase", "url", "playerId", "testResult"]
}
```

---

## Bypass Sub-Agent: BypassSubAgent

### Responsibility
Handle WAF obstacles when tests fail (Cloudflare, PerimeterX, etc.)

### Design

```javascript
class BypassSubAgent extends AgnoSubAgent {
  constructor(config) {
    super(config);
    this.tools = [
      new CloudflareBypassTool(),
      new PerimeterXBypassTool(),
      new ProxyRotationTool(),
      new UserAgentRotationTool(),
      new CookieManagementTool(),
      new RetryWithBackoffTool()
    ];
  }

  async execute(input) {
    const { url, failureReason, browser, proxy } = input;

    let retryResult = {
      success: false,
      method: null,
      attempts: 0,
      timestamp: Date.now()
    };

    // Identify WAF
    let wafType = this.identifyWAF(failureReason);

    try {
      if (wafType === 'cloudflare') {
        retryResult = await this.tools[0].execute({ url, browser });
      } else if (wafType === 'perimeterx') {
        retryResult = await this.tools[1].execute({ url, browser });
      } else {
        // Try generic bypass
        retryResult = await this.tools[3].execute({ browser });
        retryResult = await this.tools[2].execute({ proxy });
      }
    } catch (e) {
      retryResult.error = e.message;
    }

    return {
      phase: 'bypass',
      url,
      wafDetected: wafType,
      bypassResult: retryResult,
      timestamp: Date.now()
    };
  }

  identifyWAF(failureReason) {
    if (failureReason.includes('cloudflare')) return 'cloudflare';
    if (failureReason.includes('perimeterx')) return 'perimeterx';
    return 'unknown';
  }
}
```

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "failureReason": { "type": "string" },
    "browser": { "type": "object" },
    "proxy": { "type": "object" }
  },
  "required": ["url", "failureReason", "browser", "proxy"]
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "phase": { "enum": ["bypass"] },
    "url": { "type": "string" },
    "wafDetected": { "type": "string" },
    "bypassResult": {
      "type": "object",
      "properties": {
        "success": { "type": "boolean" },
        "method": { "type": "string" },
        "attempts": { "type": "number" },
        "error": { "type": "string" }
      }
    },
    "timestamp": { "type": "number" }
  },
  "required": ["phase", "url", "bypassResult"]
}
```

---

## Evidence Sub-Agent: EvidenceSubAgent

### Responsibility
Aggregate all results and collect evidence artifacts (screenshots, logs, manifests).

### Design

```javascript
class EvidenceSubAgent extends AgnoSubAgent {
  constructor(config) {
    super(config);
    this.tools = [
      new ScreenshotUploaderTool(),
      new ManifestCreatorTool(),
      new LogAggregatorTool()
    ];
  }

  async execute(input) {
    const { jobId, allResults, s3 } = input;

    let evidence = {
      jobId,
      s3Urls: {},
      manifest: null,
      aggregatedLogs: null,
      timestamp: Date.now()
    };

    // Upload all screenshots
    for (const result of allResults) {
      if (result.screenshots) {
        for (const screenshot of result.screenshots) {
          const s3Url = await this.tools[0].execute({
            jobId,
            screenshot,
            s3
          });
          evidence.s3Urls[result.url] = s3Url;
        }
      }
    }

    // Create manifest
    evidence.manifest = await this.tools[1].execute({
      jobId,
      results: allResults,
      s3Urls: evidence.s3Urls
    });

    // Aggregate logs
    evidence.aggregatedLogs = await this.tools[2].execute({
      jobId,
      results: allResults
    });

    return {
      phase: 'evidence',
      jobId,
      evidence,
      timestamp: Date.now()
    };
  }
}
```

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "jobId": { "type": "string" },
    "allResults": { "type": "array" },
    "s3": { "type": "object" }
  },
  "required": ["jobId", "allResults", "s3"]
}
```

### Output Schema

```json
{
  "type": "object",
  "properties": {
    "phase": { "enum": ["evidence"] },
    "jobId": { "type": "string" },
    "evidence": {
      "type": "object",
      "properties": {
        "s3Urls": { "type": "object" },
        "manifest": { "type": "object" },
        "aggregatedLogs": { "type": "array" }
      }
    },
    "timestamp": { "type": "number" }
  },
  "required": ["phase", "jobId", "evidence"]
}
```

---

## Agent Communication Patterns

### SubAgentInvoker Tool

```javascript
class SubAgentInvoker {
  async invoke(agentType, input) {
    // Validate input schema
    const schema = this.agents[agentType].getSchema();
    this.validateInput(input, schema.input);

    // Execute agent
    const result = await this.agents[agentType].execute(input);

    // Validate output
    this.validateOutput(result, schema.output);

    return result;
  }

  validateInput(input, schema) {
    // Use JSON Schema validator
    if (!ajv.validate(schema, input)) {
      throw new Error(`Input validation failed: ${ajv.errorsText()}`);
    }
  }

  validateOutput(output, schema) {
    // Use JSON Schema validator
    if (!ajv.validate(schema, output)) {
      throw new Error(`Output validation failed: ${ajv.errorsText()}`);
    }
  }
}
```

### Result Merging

```javascript
function mergeResults(phaseResults) {
  return {
    discovery: phaseResults.find(r => r.phase === 'discovery'),
    detections: phaseResults.filter(r => r.phase === 'detection'),
    tests: phaseResults.filter(r => r.phase === 'testing'),
    bypasses: phaseResults.filter(r => r.phase === 'bypass'),
    evidence: phaseResults.find(r => r.phase === 'evidence')
  };
}
```

---

## Error Handling per Agent

| Agent | Error Type | Strategy |
|-------|-----------|----------|
| Discovery | No articles found | Log warning, continue with 0 articles |
| Detection | Page timeout | Skip URL, log error, continue |
| Testing | Player not playable | Log as failed, move to next player |
| Bypass | WAF not bypassed | Log failure, parent decides retry |
| Evidence | S3 upload fails | Retry 3x, continue without S3 |

---

## Summary

This design provides:
- ✅ Clear 1 parent + 5 sub-agent structure
- ✅ Deterministic sub-agents (no LLM reasoning required)
- ✅ JSON schema validation for all I/O
- ✅ Explicit error handling per agent
- ✅ Modular, testable architecture
- ✅ Support for parallel execution
- ✅ Tool-based implementation (not LLM-based)

