---
name: Agno Sub-Agent Invocation Guide
description: Step-by-step instructions for invoking each sub-agent
type: reference
---

# Agno Build: Sub-Agent Invocation Guide

**Purpose**: Execute the 4-5 week implementation using specialized Claude sub-agents

---

## Quick Start (All-In-One)

**Fastest way to start**: Invoke the BUILD ORCHESTRATOR to manage everything

```bash
# Single command to orchestrate entire 4-5 week implementation
claude-code --task "Execute Agno build orchestration plan" \
  --reference ".claude/AGNO_BUILD_ORCHESTRATION.md" \
  --reference ".claude/AGNO_SUBAGENT_ASSIGNMENTS.md"
```

The BUILD ORCHESTRATOR will:
1. ✅ Read all reference documents
2. ✅ Invoke Phase 1 Builder (Week 1)
3. ✅ Verify Phase 1 gate
4. ✅ Invoke Phase 2A + 2B in parallel (Week 2)
5. ✅ Verify Phase 2 gate
6. ✅ Invoke Phase 3 Builder (Week 3)
7. ✅ Verify Phase 3 gate
8. ✅ Invoke Phase 4 Builder (Week 4)
9. ✅ Verify Phase 4 gate
10. ✅ Report completion status
11. ✅ Prepare for deployment

**Estimated time**: 12-15 hours of autonomous execution

---

## Phase-by-Phase Invocation

### Phase 1: Foundations (Week 1)

```bash
# Invoke Phase 1 Builder
claude-code --task "Implement Agno Week 1 foundations" \
  --instructions "
    Reference: .claude/AGNO_BUILD_ORCHESTRATION.md (PHASE 1 BUILDER section)

    Tasks:
    1. Create agents/core/base/ (5 files: AgnoAgent, AgnoSubAgent, AgnoTool, AgnoMemory, AgnoRegistry)
    2. Create agents/core/memory/ (3 files: SessionMemory, PersistentMemory, MemoryService)
    3. Setup tests/setup.js with mocks (MockBrowser, MockProxy, MockS3, MockSupabase)
    4. Create jest.config.js with 80% coverage threshold
    5. Create agents/core/index.js exporting all classes
    6. Write unit tests (80%+ coverage)
    7. Run npm run test:unit
    8. Generate coverage report
    9. Report completion status (PASS/FAIL on Phase 1 quality gate)

    Quality Gate:
    - [ ] 10 files created (5 base + 3 memory + 2 config/index)
    - [ ] 80%+ test coverage
    - [ ] All tests passing
    - [ ] No circular dependencies
    - [ ] Code review ready

    Report: Include coverage report and any blockers
  "
```

**Expected Completion**: ~2-4 hours
**Deliverable**: 10 files + test suite

---

### Phase 2A: Sub-Agents (Week 2, Part 1)

```bash
# Invoke Phase 2A Builder (in parallel with Phase 2B)
claude-code --task "Implement Agno Week 2 sub-agents" \
  --instructions "
    Reference: .claude/AGNO_BUILD_ORCHESTRATION.md (PHASE 2 BUILDER - Task Split A)
    Prerequisite: Phase 1 completed and gate passed

    Tasks:
    1. Create agents/core/agents/DiscoverySubAgent.js (~150 lines)
    2. Create agents/core/agents/DetectionSubAgent.js (~120 lines)
    3. Create agents/core/agents/TestingSubAgent.js (~140 lines)
    4. Create agents/core/agents/BypassSubAgent.js (~140 lines)
    5. Create agents/core/agents/EvidenceSubAgent.js (~120 lines)
    6. Create agents/core/agents/index.js
    7. Write unit tests for each agent (80%+ coverage)
    8. Verify no breaking changes to Phase 1
    9. Run npm run test:unit agents/core/agents
    10. Generate coverage report
    11. Report completion status

    Quality Gate:
    - [ ] 6 files created (5 agents + index)
    - [ ] 6 test files created
    - [ ] 80%+ test coverage
    - [ ] All tests passing
    - [ ] Each agent extends AgnoSubAgent
    - [ ] Input/output schema validation working
    - [ ] Code review ready

    Report: Include coverage report, test results, and any blockers
  "
```

**Expected Completion**: ~2-3 hours
**Deliverable**: 6 agent files + 6 test files

---

### Phase 2B: Tools (Week 2, Part 2)

```bash
# Invoke Phase 2B Builder (in parallel with Phase 2A)
# Note: Can start simultaneously with Phase 2A
claude-code --task "Implement Agno Week 2 tools" \
  --instructions "
    Reference: .claude/AGNO_BUILD_ORCHESTRATION.md (PHASE 2 BUILDER - Task Split B)
    Prerequisite: Phase 1 completed and gate passed

    Tasks:
    1. Create agents/core/tools/discovery/ (3 tools):
       - SitemapParserTool.js
       - RSSParserTool.js
       - WebCrawlerTool.js

    2. Create agents/core/tools/detection/ (6 tools):
       - DOMScannerTool.js
       - HTML5PlayerDetectorTool.js
       - HLSPlayerDetectorTool.js
       - YouTubeDetectorTool.js
       - VimeoDetectorTool.js
       - CustomPlayerDetectorTool.js

    3. Create agents/core/tools/testing/ (6 tools):
       - PlayButtonClickerTool.js
       - AudioDetectorTool.js
       - ControlTesterTool.js
       - ProgressDetectorTool.js
       - ErrorListenerTool.js
       - ScreenshotCapturerTool.js

    4. Create agents/core/tools/bypass/ (6 tools):
       - CloudflareBypassTool.js
       - PerimeterXBypassTool.js
       - ProxyRotationTool.js
       - UserAgentRotationTool.js
       - CookieManagementTool.js
       - RetryWithBackoffTool.js

    5. Create agents/core/tools/evidence/ (3 tools):
       - ScreenshotUploaderTool.js
       - ManifestCreatorTool.js
       - LogAggregatorTool.js

    6. Create agents/core/tools/ToolRegistry.js
    7. Create agents/core/tools/SubAgentInvoker.js
    8. Create agents/core/tools/index.js

    9. Write unit tests for each tool (75%+ coverage)
    10. Write integration tests (5+ integration tests)
    11. Run npm run test:unit agents/core/tools
    12. Generate coverage report
    13. Report completion status

    Quality Gate:
    - [ ] 26 files created (24 tools + registry + invoker)
    - [ ] 24+ test files created
    - [ ] 75%+ average test coverage
    - [ ] All tests passing
    - [ ] Each tool extends AgnoTool
    - [ ] JSON schemas defined for all tools
    - [ ] Error handling documented
    - [ ] No tool > 200 lines
    - [ ] Code review ready

    Report: Include coverage report, test results, and any blockers
  "
```

**Expected Completion**: ~3-4 hours
**Deliverable**: 26 tool files + 24+ test files

---

### Phase 2 Merge (End of Week 2)

After both Phase 2A and 2B complete:

```bash
# Orchestrator will:
# 1. Merge phase2a/sub-agents → agno-migration
# 2. Merge phase2b/tools → agno-migration
# 3. Run combined tests: npm run test:unit agents/core/
# 4. Verify no conflicts
# 5. Verify Phase 2 quality gate (combined coverage ≥ 75%)
# 6. Report status
```

---

### Phase 3: Orchestration (Week 3)

```bash
# Invoke Phase 3 Builder
claude-code --task "Implement Agno Week 3 orchestration" \
  --instructions "
    Reference: .claude/AGNO_BUILD_ORCHESTRATION.md (PHASE 3 BUILDER)
    Prerequisite: Phase 2 completed and gate passed

    Tasks:
    1. Create agents/core/agents/QAParentAgent.js (~500 lines)
       - 5-phase execution flow
       - Sub-agent invocation
       - Result synthesis
       - Error handling
       - Memory management

    2. Create agents/core/prompts/ (7 files):
       - system.md
       - coordinator.md (parent agent)
       - discovery.md
       - detection.md
       - testing.md
       - bypass.md
       - evidence.md

    3. Create agents/core/prompts/PromptLoader.js

    4. Create orchestration tests:
       - tests/integration/orchestration/sub-agent-invocation.test.js
       - tests/integration/orchestration/parent-agent-flow.test.js
       - tests/integration/orchestration/result-synthesis.test.js

    5. Create E2E tests:
       - tests/e2e/simple-domain.e2e.test.js
       - tests/e2e/waf-domain.e2e.test.js
       - tests/e2e/no-players.e2e.test.js

    6. Run npm run test:unit agents/core/agents/QAParentAgent
    7. Run npm run test:integration agents/core
    8. Run npm run test:e2e
    9. Generate coverage report
    10. Profile performance (target < 8 min)
    11. Report completion status

    Quality Gate:
    - [ ] 11 files created (1 parent + 7 prompts + 3 loaders)
    - [ ] 10+ test files created
    - [ ] 80%+ test coverage
    - [ ] All tests passing
    - [ ] E2E tests passing on mock domains
    - [ ] Performance ≤ 10 min
    - [ ] No performance regression vs Phase 2
    - [ ] Code review ready

    Report: Include coverage report, performance metrics, test results, blockers
  "
```

**Expected Completion**: ~2-3 hours
**Deliverable**: 11 files + 10+ test files

---

### Phase 4: Integration & Deployment (Week 4-5)

```bash
# Invoke Phase 4 Builder
claude-code --task "Implement Agno Week 4 integration and deployment" \
  --instructions "
    Reference: .claude/AGNO_BUILD_ORCHESTRATION.md (PHASE 4 BUILDER)
    Prerequisite: Phase 3 completed and gate passed

    Tasks:
    1. Create agents/core/adapters/LegacyAPIAdapter.js
       - Wrap parent agent for backward compatibility
       - Convert old job format → new format
       - Convert new results → old format

    2. Update src/app/api/jobs/route.ts
       - Import LegacyAPIAdapter
       - Initialize agnoSystem
       - Keep response format unchanged

    3. Create agents/core/monitoring/Metrics.js
    4. Create agents/core/monitoring/Logger.js

    5. Create integration tests:
       - tests/integration/api/backward-compatibility.test.js
       - tests/integration/system/full-job-execution.test.js
       - tests/integration/system/performance.test.js

    6. Performance optimization:
       - Profile all phases
       - Target ≤ 10 min execution
       - Optimize memory usage
       - Verify no memory leaks

    7. Create documentation:
       - DEPLOYMENT_GUIDE.md
       - AGNO_DEBUGGING_GUIDE.md
       - Update README.md

    8. Setup staging environment

    9. Run full test suite: npm run test:all
    10. Generate final coverage report
    11. Verify backward compatibility
    12. Report completion status

    Quality Gate:
    - [ ] 10 files created (adapter + monitoring + docs)
    - [ ] 7+ test files created
    - [ ] 80%+ overall test coverage
    - [ ] All tests passing
    - [ ] API backward compatible (verified by tests)
    - [ ] Performance ≤ 10 min
    - [ ] Staging environment ready
    - [ ] Deployment guide complete
    - [ ] Rollback procedure documented
    - [ ] Code review ready

    Report: Include final coverage, performance metrics, staging status, deployment readiness
  "
```

**Expected Completion**: ~3-4 hours
**Deliverable**: 10 files + 7+ test files + deployment docs

---

## Master Orchestrator (Recommended)

Instead of invoking each phase separately, you can invoke a **master orchestrator** that handles everything:

```bash
# Single command: orchestrate entire implementation
claude-code --task "Orchestrate complete Agno implementation (4-5 weeks)" \
  --instructions "
    You are the BUILD ORCHESTRATOR. Your job is to coordinate all 4 phases
    of the Agno migration implementation.

    Reference documents:
    - .claude/AGNO_BUILD_ORCHESTRATION.md
    - .claude/AGNO_SUBAGENT_ASSIGNMENTS.md
    - .claude/AGNO_IMPLEMENTATION_CHECKLIST.md

    Execution Plan:

    WEEK 1: PHASE 1 BUILDER
    - Invoke Phase 1 Builder with Week 1 foundations task
    - Wait for Phase 1 Builder to complete
    - Verify Phase 1 quality gate (coverage ≥ 80%)
    - If PASS: proceed to Week 2
    - If FAIL: report blockers and wait for resolution

    WEEK 2: PHASE 2A + 2B (PARALLEL)
    - Invoke Phase 2A Builder (sub-agents) and Phase 2B Builder (tools) in parallel
    - Monitor both builders
    - When both complete: merge branches
    - Verify Phase 2 quality gate (coverage ≥ 75%)
    - If PASS: proceed to Week 3
    - If FAIL: report blockers and coordinate fixes

    WEEK 3: PHASE 3 BUILDER
    - Invoke Phase 3 Builder (orchestration + prompts)
    - Wait for Phase 3 Builder to complete
    - Verify Phase 3 quality gate (coverage ≥ 80%, E2E passing)
    - If PASS: proceed to Week 4
    - If FAIL: report blockers and wait for resolution

    WEEK 4: PHASE 4 BUILDER
    - Invoke Phase 4 Builder (integration + deployment)
    - Wait for Phase 4 Builder to complete
    - Verify Phase 4 quality gate (coverage ≥ 80%, backward compat verified)
    - If PASS: prepare for deployment
    - If FAIL: report blockers and coordinate fixes

    WEEK 5: DEPLOYMENT
    - Prepare staging environment
    - Deploy to staging for canary testing
    - Monitor metrics
    - Prepare for production deployment

    Reporting:
    - Daily: Check blockers from running builders
    - Weekly: Generate status report with phase progress
    - On completion: Generate final status and deployment readiness report

    Success Criteria:
    ✅ All 4 phases complete quality gates
    ✅ 80%+ test coverage
    ✅ All tests passing
    ✅ Performance ≤ 10 min
    ✅ Backward compatibility verified
    ✅ Staging environment ready
    ✅ Deployment documentation complete
  "
```

---

## Running Tests During Implementation

### Unit Tests (per phase)
```bash
# Phase 1
npm run test:unit -- agents/core/base agents/core/memory

# Phase 2A
npm run test:unit -- agents/core/agents

# Phase 2B
npm run test:unit -- agents/core/tools

# Phase 3
npm run test:unit -- agents/core/agents/QAParentAgent
npm run test:integration -- agents/core

# Phase 4
npm run test:all
npm run coverage -- --threshold=80
```

### Coverage Reports
```bash
# Generate coverage report
npm run coverage -- --reporters=text --reporters=lcov

# View HTML report
open coverage/lcov-report/index.html
```

---

## Monitoring Progress

### Real-Time Monitoring
```bash
# Watch tests
npm run test:watch

# Monitor coverage
npm run coverage:watch

# Check linting
npm run lint:watch
```

### Phase Completion Checklist
```
Week 1 ✅
  ☐ Phase 1 files created
  ☐ Tests passing
  ☐ Coverage ≥ 80%
  ☐ Quality gate: PASS

Week 2 ✅
  ☐ Phase 2A files created
  ☐ Phase 2B files created
  ☐ Tests passing
  ☐ Coverage ≥ 75%
  ☐ Quality gate: PASS

Week 3 ✅
  ☐ Phase 3 files created
  ☐ Tests passing
  ☐ Coverage ≥ 80%
  ☐ E2E tests passing
  ☐ Quality gate: PASS

Week 4 ✅
  ☐ Phase 4 files created
  ☐ Tests passing
  ☐ Coverage ≥ 80%
  ☐ Backward compat verified
  ☐ Quality gate: PASS
  ☐ Staging ready
  ☐ Deployment docs ready
```

---

## Troubleshooting

### If Phase 1 Fails:
1. Check the error report from Phase 1 Builder
2. Review the specific failing test
3. Fix the issue in the base classes or memory layer
4. Re-run tests
5. Once fixed, proceed to Phase 2

### If Phase 2A/2B Conflict:
1. Check merge conflict report
2. Orchestrator will coordinate resolution
3. May need to manually resolve if conflict is in shared code
4. Re-run combined tests
5. Proceed when conflict resolved

### If Phase 3 E2E Tests Fail:
1. Check E2E test output
2. Verify Phase 2 code is still passing
3. Debug orchestration logic in QAParentAgent
4. Fix and re-run
5. Proceed when all E2E tests pass

### If Phase 4 Backward Compat Fails:
1. Check backward compatibility test output
2. Verify LegacyAPIAdapter is converting correctly
3. Compare old API format with new
4. Fix adapter mapping
5. Re-run compatibility tests
6. Proceed when all tests pass

---

## Success Metrics

| Phase | Files | Tests | Coverage | Time |
|-------|-------|-------|----------|------|
| 1 | 10 | 10 | ≥80% | 2-4 hrs |
| 2 | 32 | 30 | ≥75% | 3-4 hrs |
| 3 | 11 | 10 | ≥80% | 2-3 hrs |
| 4 | 10 | 7 | ≥80% | 3-4 hrs |
| **Total** | **63** | **57** | **≥80%** | **12-15 hrs** |

---

## Summary

**Three ways to invoke Agno build**:

1. **Master Orchestrator** (Recommended)
   - Single command orchestrates everything
   - Handles all 4 phases automatically
   - Reports weekly status
   - ~12-15 hours total execution

2. **Phase-by-Phase**
   - Invoke each phase individually
   - More control over timing
   - Manual gate verification
   - Useful if you have team constraints

3. **Manual** (Not recommended)
   - You implement everything yourself
   - No parallel execution
   - ~8-10 weeks total time
   - Higher risk of issues

**Recommended**: Use Master Orchestrator for fastest, most reliable execution.

**Status**: Ready to invoke. Assign tasks to sub-agents and begin implementation.

