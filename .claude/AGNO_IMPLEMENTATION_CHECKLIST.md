---
name: Agno Implementation Checklist
description: File-by-file implementation tasks for all 4-5 weeks
type: reference
---

# Agno Implementation Checklist

**Status**: Complete Task List
**Last Updated**: March 18, 2026
**Scope**: File-by-file implementation checklist for 4-5 week migration

---

## Week 1: Foundations (Base Classes & Memory)

### Phase 1.1: Base Classes (agents/core/base/)

- [ ] **AgnoAgent.js** (~100 lines)
  - [ ] Base class for parent agents
  - [ ] Methods: execute(), think(), dispatch()
  - [ ] Properties: config, logger, registry
  - [ ] Tests: unit tests

- [ ] **AgnoSubAgent.js** (~80 lines)
  - [ ] Base class for sub-agents
  - [ ] Methods: execute(), validate(), getSchema()
  - [ ] Properties: tools, logger, config
  - [ ] Tests: unit tests

- [ ] **AgnoTool.js** (~100 lines)
  - [ ] Base class for all tools
  - [ ] Methods: execute(), validate(), toDefinition()
  - [ ] Lifecycle hooks: onBefore(), onAfter(), onError()
  - [ ] Tests: unit tests

- [ ] **AgnoMemory.js** (~50 lines)
  - [ ] Abstract memory interface
  - [ ] Methods: load(), save(), clear()
  - [ ] Properties: schema definitions

- [ ] **AgnoRegistry.js** (~80 lines)
  - [ ] Tool/agent registration system
  - [ ] Methods: register(), get(), getAll()
  - [ ] Runtime tool/agent lookup
  - [ ] Tests: unit tests

- [ ] **index.js** (~20 lines)
  - [ ] Export all base classes

### Phase 1.2: Memory Layer (agents/core/memory/)

- [ ] **SessionMemory.js** (~150 lines)
  - [ ] Session memory data structure
  - [ ] Methods: create(), update(), get(), clear()
  - [ ] Lifecycle: from job start to end
  - [ ] Tests: unit tests

- [ ] **SessionMemoryStore.js** (~80 lines)
  - [ ] In-memory storage for sessions
  - [ ] Map-based implementation
  - [ ] Methods: store(), retrieve(), delete()

- [ ] **PersistentMemory.js** (~200 lines)
  - [ ] Domain-scoped Supabase persistence
  - [ ] Methods: load(), update(), getAll()
  - [ ] EMA calculations for metrics
  - [ ] Recommendation generation
  - [ ] Tests: integration tests with mock Supabase

- [ ] **MemoryService.js** (~100 lines)
  - [ ] Facade for session + persistent memory
  - [ ] Methods: createSession(), loadProfile(), updateProfile()
  - [ ] Coordinates both layers
  - [ ] Tests: unit tests

- [ ] **index.js** (~20 lines)
  - [ ] Export all memory classes

### Phase 1.3: Infrastructure Setup

- [ ] **jest.config.js**
  - [ ] Test configuration
  - [ ] Coverage thresholds (80%+)
  - [ ] Module resolution

- [ ] **tests/setup.js**
  - [ ] Mock implementations
  - [ ] Mock browser pool
  - [ ] Mock proxy manager
  - [ ] Mock S3 client
  - [ ] Mock Supabase client

- [ ] **tests/fixtures/domains/**
  - [ ] simple-domain.json
  - [ ] waf-domain.json
  - [ ] no-players-domain.json

- [ ] **tests/fixtures/mocks/**
  - [ ] MockBrowser.js
  - [ ] MockProxy.js
  - [ ] MockS3.js
  - [ ] MockSupabase.js

- [ ] **package.json updates**
  - [ ] Add test scripts
  - [ ] Add coverage script
  - [ ] Add linting script

---

## Week 2: Sub-Agents & Tools

### Phase 2.1: Discovery Sub-Agent & Tools

- [ ] **agents/core/agents/DiscoverySubAgent.js** (~150 lines)
  - [ ] Extends AgnoSubAgent
  - [ ] Input/output schema validation
  - [ ] Orchestrates discovery tools
  - [ ] Tests: unit + integration

- [ ] **agents/core/tools/discovery/SitemapParserTool.js** (~100 lines)
  - [ ] Extends AgnoTool
  - [ ] Fetches and parses sitemap.xml
  - [ ] Error handling for missing sitemaps
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/discovery/RSSParserTool.js** (~120 lines)
  - [ ] Extends AgnoTool
  - [ ] Discovers and parses RSS feeds
  - [ ] Tries common locations
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/discovery/WebCrawlerTool.js** (~150 lines)
  - [ ] Extends AgnoTool
  - [ ] Recursive crawling with depth limit
  - [ ] Article URL heuristics
  - [ ] Tests: unit tests

### Phase 2.2: Detection Sub-Agent & Tools

- [ ] **agents/core/agents/DetectionSubAgent.js** (~120 lines)
  - [ ] Extends AgnoSubAgent
  - [ ] Orchestrates detection tools
  - [ ] Parallel page navigation
  - [ ] Tests: unit + integration

- [ ] **agents/core/tools/detection/HTML5PlayerDetectorTool.js** (~80 lines)
  - [ ] Detects `<video>` tags
  - [ ] Extracts player metadata
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/detection/HLSPlayerDetectorTool.js** (~80 lines)
  - [ ] Detects m3u8 streams
  - [ ] Network monitoring
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/detection/YouTubeDetectorTool.js** (~60 lines)
  - [ ] Detects YouTube embeds
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/detection/VimeoDetectorTool.js** (~60 lines)
  - [ ] Detects Vimeo embeds
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/detection/CustomPlayerDetectorTool.js** (~80 lines)
  - [ ] Detects custom player frameworks
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/detection/DOMScannerTool.js** (~60 lines)
  - [ ] Generic DOM scanning utilities
  - [ ] Tests: unit tests

### Phase 2.3: Testing Sub-Agent & Tools

- [ ] **agents/core/agents/TestingSubAgent.js** (~140 lines)
  - [ ] Extends AgnoSubAgent
  - [ ] Orchestrates testing tools
  - [ ] Test result synthesis
  - [ ] Tests: unit + integration

- [ ] **agents/core/tools/testing/PlayButtonClickerTool.js** (~80 lines)
  - [ ] Finds and clicks play button
  - [ ] Tries multiple selectors
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/testing/AudioDetectorTool.js** (~60 lines)
  - [ ] Detects if audio is playing
  - [ ] Web Audio API integration
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/testing/ControlTesterTool.js** (~80 lines)
  - [ ] Tests player controls
  - [ ] Play/pause, seek, volume
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/testing/ProgressDetectorTool.js** (~60 lines)
  - [ ] Detects video progress
  - [ ] currentTime tracking
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/testing/ErrorListenerTool.js** (~50 lines)
  - [ ] Listens for player errors
  - [ ] Error categorization
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/testing/ScreenshotCapturerTool.js** (~60 lines)
  - [ ] Captures player screenshot
  - [ ] Base64 encoding
  - [ ] Tests: unit tests

### Phase 2.4: Bypass Sub-Agent & Tools

- [ ] **agents/core/agents/BypassSubAgent.js** (~140 lines)
  - [ ] Extends AgnoSubAgent
  - [ ] WAF detection logic
  - [ ] Strategy selection
  - [ ] Tests: unit + integration

- [ ] **agents/core/tools/bypass/CloudflareBypassTool.js** (~100 lines)
  - [ ] Cloudflare challenge handling
  - [ ] User-agent rotation
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/bypass/PerimeterXBypassTool.js** (~100 lines)
  - [ ] PerimeterX bypass logic
  - [ ] Cookie handling
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/bypass/ProxyRotationTool.js** (~70 lines)
  - [ ] Rotate proxy IP/zone
  - [ ] Integration with proxy manager
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/bypass/UserAgentRotationTool.js** (~50 lines)
  - [ ] Realistic user-agent rotation
  - [ ] Browser detection
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/bypass/CookieManagementTool.js** (~70 lines)
  - [ ] Clear/manage cookies
  - [ ] Preserve auth cookies
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/bypass/RetryWithBackoffTool.js** (~60 lines)
  - [ ] Exponential backoff retry
  - [ ] Tests: unit tests

### Phase 2.5: Evidence Sub-Agent & Tools

- [ ] **agents/core/agents/EvidenceSubAgent.js** (~120 lines)
  - [ ] Extends AgnoSubAgent
  - [ ] Orchestrates evidence collection
  - [ ] Tests: unit + integration

- [ ] **agents/core/tools/evidence/ScreenshotUploaderTool.js** (~80 lines)
  - [ ] Upload to S3
  - [ ] Retry logic
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/evidence/ManifestCreatorTool.js** (~70 lines)
  - [ ] Create result manifest
  - [ ] Include metadata
  - [ ] Tests: unit tests

- [ ] **agents/core/tools/evidence/LogAggregatorTool.js** (~60 lines)
  - [ ] Aggregate all logs
  - [ ] Structure by phase
  - [ ] Tests: unit tests

### Phase 2.6: Tool Index Files

- [ ] **agents/core/tools/index.js** (~50 lines)
  - [ ] Export all 24 tools
  - [ ] Registry setup

- [ ] **agents/core/agents/index.js** (~30 lines)
  - [ ] Export all 5 sub-agents

---

## Week 3: Parent Agent & Orchestration

### Phase 3.1: Parent Agent & Orchestration

- [ ] **agents/core/agents/QAParentAgent.js** (~500 lines)
  - [ ] Extends AgnoAgent
  - [ ] 5-phase execution
  - [ ] Sub-agent invocation
  - [ ] Error handling
  - [ ] Result synthesis
  - [ ] Memory management
  - [ ] Tests: unit tests (mocked sub-agents)

- [ ] **agents/core/tools/SubAgentInvoker.js** (~150 lines)
  - [ ] Invokes sub-agents
  - [ ] Schema validation
  - [ ] Error wrapping
  - [ ] Metrics recording
  - [ ] Tests: unit tests

### Phase 3.2: Orchestration Tests

- [ ] **tests/integration/orchestration/sub-agent-invocation.test.js** (~100 lines)
  - [ ] SubAgentInvoker tests
  - [ ] Schema validation tests
  - [ ] Error handling tests

- [ ] **tests/integration/orchestration/parent-agent-flow.test.js** (~200 lines)
  - [ ] 5-phase flow tests
  - [ ] Decision logic tests
  - [ ] Error recovery tests
  - [ ] Result synthesis tests

- [ ] **tests/integration/orchestration/result-synthesis.test.js** (~100 lines)
  - [ ] Result merging tests
  - [ ] Status determination tests
  - [ ] Metrics calculation tests

### Phase 3.3: End-to-End Tests

- [ ] **tests/end-to-end/simple-domain.e2e.test.js** (~150 lines)
  - [ ] Full job execution
  - [ ] Real sub-agent calls
  - [ ] Mock browser/proxy/S3
  - [ ] Assert final result

- [ ] **tests/end-to-end/waf-domain.e2e.test.js** (~150 lines)
  - [ ] Full job with WAF
  - [ ] Bypass phase execution
  - [ ] Retry logic

- [ ] **tests/end-to-end/no-players.e2e.test.js** (~100 lines)
  - [ ] No players case
  - [ ] Discovery → evidence
  - [ ] Edge case handling

---

## Week 4: Integration & API

### Phase 4.1: System Integration

- [ ] **agents/core/index.js** (~100 lines)
  - [ ] createAgnoSystem() factory
  - [ ] Registry initialization
  - [ ] Memory initialization
  - [ ] Tests: unit tests

- [ ] **agents/core/adapters/LegacyAPIAdapter.js** (~120 lines)
  - [ ] Wraps parent agent
  - [ ] Converts old format → new format
  - [ ] Converts new format → old format
  - [ ] Tests: unit tests

- [ ] **src/app/api/jobs/route.ts** (updated)
  - [ ] Update to use LegacyAPIAdapter
  - [ ] Initialize agnoSystem once
  - [ ] Keep response format unchanged
  - [ ] Tests: integration tests

### Phase 4.2: API & Backward Compatibility Tests

- [ ] **tests/integration/api/backward-compatibility.test.js** (~150 lines)
  - [ ] Old API format accepted
  - [ ] Old response format returned
  - [ ] Job results identical
  - [ ] No API breaking changes

- [ ] **tests/integration/api/edge-cases.test.js** (~100 lines)
  - [ ] Invalid input handling
  - [ ] Timeout scenarios
  - [ ] Error response format

### Phase 4.3: System-Level Tests

- [ ] **tests/integration/system/full-job-execution.test.js** (~200 lines)
  - [ ] Full job from API to result
  - [ ] All phases executed
  - [ ] Memory updated
  - [ ] Backward compatible

- [ ] **tests/integration/system/performance.test.js** (~100 lines)
  - [ ] Execution time ≤ 10 min
  - [ ] Memory usage stable
  - [ ] Parallel speedup validated

### Phase 4.4: Monitoring & Observability

- [ ] **agents/core/monitoring/Metrics.js** (~120 lines)
  - [ ] Phase execution tracking
  - [ ] Agent performance tracking
  - [ ] Tool performance tracking
  - [ ] Error rate tracking

- [ ] **agents/core/monitoring/Logger.js** (~80 lines)
  - [ ] Structured logging
  - [ ] Log levels
  - [ ] Correlation IDs
  - [ ] Integration with existing logger

---

## Week 5: Documentation & Polish

### Phase 5.1: Documentation

- [ ] **AGNO_IMPLEMENTATION_GUIDE.md** (in `.claude/`)
  - [ ] How to implement each phase
  - [ ] Code examples
  - [ ] Common pitfalls

- [ ] **AGNO_API_REFERENCE.md** (in `.claude/`)
  - [ ] API endpoint documentation
  - [ ] Request/response examples
  - [ ] Error codes

- [ ] **AGNO_DEBUGGING_GUIDE.md** (in `.claude/`)
  - [ ] How to debug issues
  - [ ] Common errors
  - [ ] Troubleshooting

- [ ] **AGNO_DEPLOYMENT_GUIDE.md** (in `.claude/`)
  - [ ] How to deploy
  - [ ] Environment setup
  - [ ] Rollback procedure

- [ ] **Code comments**
  - [ ] JSDoc on all public methods
  - [ ] Inline comments on complex logic
  - [ ] TODO markers removed

### Phase 5.2: Testing & Quality

- [ ] **Coverage analysis**
  - [ ] Achieve 80%+ coverage
  - [ ] Identify gaps
  - [ ] Add missing tests

- [ ] **Code review**
  - [ ] Peer review all code
  - [ ] Architecture review
  - [ ] Performance review

- [ ] **Linting & formatting**
  - [ ] Run eslint
  - [ ] Fix violations
  - [ ] Run prettier
  - [ ] Format code

### Phase 5.3: Edge Cases & Error Handling

- [ ] **Handle missing article titles** (discovery)
  - [ ] Return articles without titles
  - [ ] Tests

- [ ] **Handle duplicate URLs** (detection)
  - [ ] Deduplicate across results
  - [ ] Tests

- [ ] **Handle network timeouts** (testing)
  - [ ] Retry with backoff
  - [ ] Tests

- [ ] **Handle WAF changes** (bypass)
  - [ ] Detect new WAF types
  - [ ] Update persistent memory
  - [ ] Tests

- [ ] **Handle S3 failures** (evidence)
  - [ ] Retry logic
  - [ ] Partial uploads
  - [ ] Tests

### Phase 5.4: Performance Optimization

- [ ] **Profile sub-agents**
  - [ ] Identify bottlenecks
  - [ ] Optimize tool execution
  - [ ] Parallel efficiency

- [ ] **Optimize memory**
  - [ ] Session memory cleanup
  - [ ] Persistent memory queries
  - [ ] No memory leaks

- [ ] **Optimize browser pool**
  - [ ] Reuse pages efficiently
  - [ ] Close unused pages
  - [ ] Connection pooling

---

## Quality Gates by Phase

### Week 1 Completion Gate
- ✅ All base classes working
- ✅ Memory layer tested
- ✅ Test infrastructure in place
- ✅ Coverage: 80%+

### Week 2 Completion Gate
- ✅ All 5 sub-agents implemented
- ✅ All 24 tools implemented
- ✅ Unit tests for all components (80%+ coverage)
- ✅ Integration tests for each phase (50%+ passing)

### Week 3 Completion Gate
- ✅ Parent agent orchestration working
- ✅ 5-phase flow validated
- ✅ Error handling tested
- ✅ E2E tests passing (simple domain)

### Week 4 Completion Gate
- ✅ Backward compatibility verified
- ✅ API returns old format
- ✅ No breaking changes
- ✅ Performance ≤ 10 min
- ✅ All tests passing (80%+ coverage)

### Week 5 Completion Gate
- ✅ Documentation complete
- ✅ All edge cases handled
- ✅ No linting violations
- ✅ Performance optimized
- ✅ Ready for production deployment

---

## Test Coverage Targets

| Component | Coverage |
|-----------|----------|
| Base classes | 90%+ |
| Memory layer | 85%+ |
| Sub-agents | 80%+ |
| Tools | 75%+ |
| Parent agent | 80%+ |
| Adapter | 90%+ |
| **Overall** | **80%+** |

---

## File Count Summary

| Category | Count | Status |
|----------|-------|--------|
| Base classes | 5 | Week 1 |
| Memory classes | 4 | Week 1 |
| Test setup | 2 | Week 1 |
| Sub-agents | 5 | Week 2 |
| Tools | 24 | Week 2 |
| Tool tests | 24 | Week 2 |
| Orchestration | 3 | Week 3 |
| Orchestration tests | 3 | Week 3 |
| E2E tests | 3 | Week 3 |
| Adapter | 1 | Week 4 |
| API updates | 1 | Week 4 |
| Monitoring | 2 | Week 4 |
| Documentation | 4 | Week 5 |
| **Total** | **84 files** | **4-5 weeks** |

---

## Branch Strategy

```
main (current)
  ↓
agno-migration (main development branch)
  ├─ agno/week1-foundations (Week 1 work)
  ├─ agno/week2-agents-tools (Week 2 work)
  ├─ agno/week3-orchestration (Week 3 work)
  ├─ agno/week4-integration (Week 4 work)
  └─ agno/week5-polish (Week 5 work)

PR: agno-migration → main (once complete)
```

---

## Deployment Steps

1. **Pre-deployment**
   - [ ] All tests passing
   - [ ] Coverage ≥ 80%
   - [ ] Performance ≤ 10 min
   - [ ] Backward compatibility verified

2. **Canary Deploy**
   - [ ] Deploy to staging
   - [ ] Run E2E tests
   - [ ] Monitor metrics
   - [ ] 1 hour soak period

3. **Production Deploy**
   - [ ] Feature flag for adapter
   - [ ] 10% traffic to new system
   - [ ] Monitor success rate
   - [ ] Ramp to 100% over 1 hour

4. **Monitoring**
   - [ ] Dashboard metrics
   - [ ] Error rates
   - [ ] Performance (latency, CPU, memory)
   - [ ] User feedback

5. **Rollback Plan**
   - [ ] If success rate drops below 90%
   - [ ] Feature flag switches traffic back to old system
   - [ ] All data still persists
   - [ ] No data loss

---

## Summary

This checklist provides:
✅ Complete file-by-file breakdown
✅ Clear weekly phases
✅ Quality gates at each phase
✅ Test coverage targets
✅ Documentation requirements
✅ Deployment procedure

**Total Effort**: ~300-320 person-hours over 4-5 weeks
**Team**: 1-2 engineers can work in parallel
**Risk Level**: 🟢 **LOW** (phased, well-tested, backward compatible)

