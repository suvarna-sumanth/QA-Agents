---
name: Agno Build Sub-Agent Assignments
description: Quick reference for assigning implementation tasks to specialized sub-agents
type: reference
---

# Agno Build Sub-Agent Assignments

**Purpose**: Parallelize the 4-5 week implementation by assigning specialized sub-agents to each phase

---

## Sub-Agent Model

Instead of one team implementing everything sequentially, use **4 specialized sub-agents** working in parallel:

```
BUILD ORCHESTRATOR (Parent)
├─ PHASE 1 BUILDER (Week 1)
├─ PHASE 2 BUILDER (Week 2)
├─ PHASE 3 BUILDER (Week 3)
└─ PHASE 4 BUILDER (Week 4)
```

Each builder is a **specialized Claude agent** that focuses on one week's work.

---

## How to Invoke Each Sub-Agent

### PHASE 1 BUILDER
**Task**: Build base classes, memory layer, test infrastructure

```bash
# Invoke sub-agent
claude-code --agent phase1-builder --task "Implement Week 1 foundations"

# What it will do:
# 1. Create agents/core/base/*.js (5 files)
# 2. Create agents/core/memory/*.js (3 files)
# 3. Setup tests/setup.js and jest.config.js
# 4. Run tests to validate
# 5. Report coverage and blockers
```

**Reference Document**: [AGNO_BUILD_ORCHESTRATION.md](#phase-1-builder-foundations)

**Expected Output**:
- ✅ 10 files created
- ✅ 80%+ test coverage
- ✅ All tests passing
- ✅ Phase 1 quality gate: PASS

**Time to Execute**: ~2-4 hours (autonomous)

---

### PHASE 2 BUILDER (Split A): Sub-Agents
**Task**: Implement all 5 sub-agents

```bash
# Invoke sub-agent
claude-code --agent phase2a-builder --task "Implement all 5 sub-agents"

# What it will do:
# 1. Create DiscoverySubAgent.js
# 2. Create DetectionSubAgent.js
# 3. Create TestingSubAgent.js
# 4. Create BypassSubAgent.js
# 5. Create EvidenceSubAgent.js
# 6. Create agents/index.js
# 7. Write unit tests (80%+ coverage)
# 8. Run tests
# 9. Report coverage
```

**Reference Document**: [AGNO_BUILD_ORCHESTRATION.md](#task-split-a-sub-agents)

**Expected Output**:
- ✅ 6 files created (5 agents + index.js)
- ✅ 6 test files created
- ✅ 80%+ test coverage
- ✅ All tests passing
- ✅ Code review checklist ready

**Time to Execute**: ~2-3 hours (autonomous)

---

### PHASE 2 BUILDER (Split B): Tools
**Task**: Implement all 24 tools

```bash
# Invoke sub-agent
claude-code --agent phase2b-builder --task "Implement all 24 tools"

# What it will do:
# 1. Create discovery/ tools (3 files)
# 2. Create detection/ tools (6 files)
# 3. Create testing/ tools (6 files)
# 4. Create bypass/ tools (6 files)
# 5. Create evidence/ tools (3 files)
# 6. Create ToolRegistry.js
# 7. Create SubAgentInvoker.js
# 8. Create tools/index.js
# 9. Write unit tests (75%+ coverage)
# 10. Run tests
# 11. Report coverage
```

**Reference Document**: [AGNO_BUILD_ORCHESTRATION.md](#task-split-b-tools)

**Expected Output**:
- ✅ 26 files created (24 tools + registry + invoker)
- ✅ 24+ test files created
- ✅ 75%+ average test coverage
- ✅ All tests passing
- ✅ Code review checklist ready

**Time to Execute**: ~3-4 hours (autonomous)

---

### PHASE 2 BUILDER: Combined Execution
**Note**: Split A and B can run in **PARALLEL** (different agents, same week)

```bash
# Run both in parallel
claude-code --agent phase2a-builder --task "Implement all 5 sub-agents" &
claude-code --agent phase2b-builder --task "Implement all 24 tools" &

# Wait for both to complete, then:
# - Merge both branches
# - Run combined tests
# - Verify no conflicts
```

**Phase 2 Quality Gate**:
- ✅ All 32 files created
- ✅ Agent coverage ≥ 80%
- ✅ Tool coverage ≥ 75%
- ✅ All tests passing
- ✅ No circular dependencies
- ✅ Code review approved

**Time to Execute**: ~3-4 hours (parallel execution)

---

### PHASE 3 BUILDER
**Task**: Implement parent agent, prompts, orchestration tests

```bash
# Invoke sub-agent
claude-code --agent phase3-builder --task "Implement Week 3 orchestration"

# What it will do:
# 1. Create QAParentAgent.js
# 2. Create all 7 system prompts
# 3. Create PromptLoader.js
# 4. Create orchestration integration tests
# 5. Create E2E tests
# 6. Run all tests
# 7. Report coverage and blockers
```

**Reference Document**: [AGNO_BUILD_ORCHESTRATION.md](#phase-3-builder-orchestration)

**Expected Output**:
- ✅ 11 files created
- ✅ 10+ test files created
- ✅ 80%+ test coverage
- ✅ All tests passing
- ✅ E2E tests passing
- ✅ No performance regressions
- ✅ Code review checklist ready

**Time to Execute**: ~2-3 hours (autonomous)

---

### PHASE 4 BUILDER
**Task**: Implement adapter, integration, deployment

```bash
# Invoke sub-agent
claude-code --agent phase4-builder --task "Implement Week 4 integration and deployment"

# What it will do:
# 1. Create LegacyAPIAdapter.js
# 2. Update API route
# 3. Create monitoring classes
# 4. Optimize performance
# 5. Create integration tests
# 6. Create deployment documentation
# 7. Setup staging environment
# 8. Run all tests
# 9. Verify backward compatibility
# 10. Report final status
```

**Reference Document**: [AGNO_BUILD_ORCHESTRATION.md](#phase-4-builder-integration--deployment)

**Expected Output**:
- ✅ 10 files created
- ✅ 7+ test files created
- ✅ 80%+ test coverage
- ✅ All tests passing
- ✅ Backward compatibility verified
- ✅ Performance ≤ 10 min
- ✅ Staging environment ready
- ✅ Deployment guide complete
- ✅ Production readiness: 100%

**Time to Execute**: ~3-4 hours (autonomous)

---

## BUILD ORCHESTRATOR
**Task**: Coordinate all phase builders, validate gates, manage dependencies

```bash
# Invoke orchestrator
claude-code --agent build-orchestrator --task "Orchestrate 4-5 week Agno implementation"

# What it will do:
# 1. Verify Phase 1 gate (wait for PHASE 1 BUILDER)
# 2. Trigger Phase 2 (parallel: PHASE 2A + PHASE 2B)
# 3. Verify Phase 2 gate (wait for both)
# 4. Trigger Phase 3 (PHASE 3 BUILDER)
# 5. Verify Phase 3 gate
# 6. Trigger Phase 4 (PHASE 4 BUILDER)
# 7. Verify Phase 4 gate
# 8. Generate final status report
# 9. Prepare for deployment
```

**Responsibilities**:
- ✅ Track progress across all phases
- ✅ Verify test coverage at each gate
- ✅ Manage branch/merge strategy
- ✅ Coordinate dependency resolution
- ✅ Report status (daily standup, weekly summary)
- ✅ Escalate blockers to human team

**Reports Generated**:
- Weekly status report
- Phase gate assessment
- Risk update
- Coverage metrics
- Blocker escalation

---

## Execution Timeline

```
Week 1 (Mon-Fri)
  Monday:   PHASE 1 BUILDER starts → creates base classes + memory
  Friday:   PHASE 1 verification + gate assessment

Week 2 (Mon-Fri)
  Monday:   PHASE 2A + PHASE 2B start (parallel)
  Thursday: Both agents converge → merge branches
  Friday:   PHASE 2 verification + gate assessment

Week 3 (Mon-Fri)
  Monday:   PHASE 3 BUILDER starts → parent + prompts + tests
  Thursday: Orchestration validation
  Friday:   PHASE 3 verification + gate assessment

Week 4 (Mon-Fri)
  Monday:   PHASE 4 BUILDER starts → adapter + deployment
  Thursday: Integration testing + performance validation
  Friday:   PHASE 4 verification + gate assessment

Week 5 (Mon-Tue)
  Staging deploy + canary testing
  Production deployment (go-live)
```

---

## Communication Protocol

### Daily (Standup):
- BUILD ORCHESTRATOR reports blockers
- Any sub-agent escalates issues
- Team sync on critical path items

### Weekly (Status Report):
- Phase progress against target
- Gate assessment (PASS/FAIL)
- Coverage metrics
- Risk updates
- Resource needs

### Quality Gates:
- **Phase 1 Gate**: 80%+ coverage, all tests pass
- **Phase 2 Gate**: 75%+ coverage (tools), 80%+ (agents), no conflicts
- **Phase 3 Gate**: 80%+ coverage, E2E passing, no perf regression
- **Phase 4 Gate**: 80%+ coverage, backward compat verified, staging ready

---

## Invoking Sub-Agents (Detailed)

### Option 1: Use Claude Code CLI
```bash
# Phase 1 (Week 1 - sequential)
claude-code --agent phase1-builder --task "Build Week 1 foundations"

# Phase 2 (Week 2 - parallel)
claude-code --agent phase2a-builder --task "Build all 5 sub-agents" &
claude-code --agent phase2b-builder --task "Build all 24 tools" &

# Phase 3 (Week 3 - sequential)
claude-code --agent phase3-builder --task "Build Week 3 orchestration"

# Phase 4 (Week 4 - sequential)
claude-code --agent phase4-builder --task "Build Week 4 integration"
```

### Option 2: Use Build Orchestrator (Recommended)
```bash
# Orchestrator handles all 4 phases autonomously
claude-code --agent build-orchestrator --task "Execute full 4-5 week implementation"

# What you provide:
# - Reference documents (already in .claude/)
# - Team size (1-2 engineers per phase)
# - Any blocking issues
# - Leadership approval

# What orchestrator delivers:
# - Weekly status reports
# - Phase completions
# - Deployment ready checklist
# - Production handoff documentation
```

### Option 3: Use Agent SDK (Programmatic)
```javascript
const { AgentSDK } = require('@anthropic-ai/agent-sdk');

async function buildAgno() {
  const orchestrator = new AgentSDK.Agent({
    name: 'build-orchestrator',
    systemPrompt: 'Orchestrate 4-5 week Agno implementation...',
    tools: [
      new GitManagementTool(),
      new TestRunnerTool(),
      new CoverageTool(),
      new StatusReporterTool()
    ]
  });

  // Run full orchestration
  const result = await orchestrator.execute({
    task: 'Execute full 4-5 week implementation',
    context: AGNO_BUILD_ORCHESTRATION_PLAN
  });

  return result;
}

await buildAgno();
```

---

## Success Indicators

### Week 1 Success:
- ✅ 10 files created (base + memory)
- ✅ Phase 1 quality gate: PASS
- ✅ Ready for Phase 2

### Week 2 Success:
- ✅ 32 files created (5 agents + 24 tools)
- ✅ Phase 2 quality gate: PASS
- ✅ Ready for Phase 3

### Week 3 Success:
- ✅ 11 files created (parent + prompts)
- ✅ Phase 3 quality gate: PASS
- ✅ Ready for Phase 4

### Week 4 Success:
- ✅ 10 files created (adapter + monitoring)
- ✅ Phase 4 quality gate: PASS
- ✅ Ready for production deployment

### Final Success:
- ✅ 63 implementation files
- ✅ 57 test files
- ✅ 80%+ test coverage
- ✅ All tests passing
- ✅ Performance ≤ 10 min
- ✅ Backward compatible
- ✅ Staging validated
- ✅ Production ready

---

## Estimated Time & Cost

### Human Effort:
- Week 1: 1 engineer × 40 hours = 40 hours
- Week 2: 2 engineers × 40 hours = 80 hours (parallel)
- Week 3: 1 engineer × 40 hours = 40 hours
- Week 4: 2 engineers × 40 hours = 80 hours
- **Total**: ~240 hours (6 engineer-weeks)

### Sub-Agent Execution Time:
- Phase 1: ~2-4 hours (autonomous)
- Phase 2: ~3-4 hours (parallel)
- Phase 3: ~2-3 hours (autonomous)
- Phase 4: ~3-4 hours (autonomous)
- **Total**: ~12-15 hours of actual sub-agent execution

### Speedup:
- Sequential (human-only): ~8-10 weeks
- Parallel (with sub-agents): **4-5 weeks**
- **Time saved**: ~3-5 weeks

---

## Summary

This sub-agent model enables:
- ✅ **Parallel execution** (Phase 2A + 2B run simultaneously)
- ✅ **Faster delivery** (4-5 weeks vs 8-10 weeks)
- ✅ **Risk mitigation** (quality gates at each phase)
- ✅ **Clear accountability** (each sub-agent owns one phase)
- ✅ **Autonomous execution** (sub-agents work independently)
- ✅ **Human oversight** (orchestrator reports + gates)
- ✅ **Zero breaking changes** (adapter pattern)

**Status**: Ready to assign. Start Phase 1 immediately.

