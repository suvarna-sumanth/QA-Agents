# QA-Agents System Architecture

## Overview

The QA-Agents system is a **cognitive AI agent framework** that autonomously tests websites for player detection, WAF bypass capabilities, and functionality. It's built on LangGraph with a multi-tier architecture.

## Core Components

### 1. **API Layer** (`src/app/api/`)
- **POST /api/jobs** - Submit new testing jobs
- **GET /api/jobs** - List recent jobs
- **GET /api/jobs/status** - Check job status
- **GET /api/reports/** - Retrieve test reports

### 2. **Agent System** (`agents/core/`)

#### SupervisorAgent (LangGraph)
The central orchestrator that manages the testing workflow using a state machine:

```
START → planner → execute → expand → evaluate → END
         ↑          ↓        ↑
         └──────────┴────────┘
```

**Nodes:**
- **planner** - Analyzes target & loads site profile, creates test plan
- **execute** - Runs registered skills in sequence
- **expand** - Decides if more steps needed based on current progress
- **evaluate** - Finalizes results and computes mission status

#### Skill Registry
Available testing skills:
1. **DiscoverArticlesSkill** - Finds testable URLs via sitemap/RSS
2. **DetectPlayerSkill** - Checks if video player exists on pages
3. **TestPlayerSkill** - Tests video player functionality
4. **BypassCloudflareSkill** - Handles Cloudflare protection
5. **BypassPerimeterXSkill** - Handles PerimeterX WAF
6. **DismissPopupsSkill** - Removes popups/modals
7. **TakeScreenshotSkill** - Captures evidence

### 3. **Memory System** (`agents/core/memory/`)
- **MemoryService** - Persistent storage of test results, site profiles
- **Supabase Integration** - Cloud database for historical data
- **Browser Pool** - Reusable Playwright browser contexts

### 4. **Browser Automation** (`agents/shivani/`)
- **UndetectedBrowser** - Stealth browser for WAF bypass
- **ProxyIntegration** - Residential proxies via BrightData
- **ContextPool** - Efficient browser resource management

### 5. **Dashboard** (`src/app/qa-dashboard/`)
Real-time mission control interface showing:
- Live activity stream
- Agent specialist progress (Senior Engineer, Discovery, Detection, Functional)
- Deep Swarm Matrix (telemetry)
- Mission history

## Data Flow

```
User Submits Job
    ↓
[API] POST /api/jobs → jobRegistry (local memory)
    ↓
[Agent] getCognitiveSystem() → Load index.js (ESM)
    ↓
[Supervisor] Creates AgentState
    ↓
[Planner] Load site profile from Supabase
    ↓
[Execute] Run skills in sequence
    ↓
[Expand] Check if more steps needed
    ↓
[Evaluate] Compute final status (pass/fail/partial)
    ↓
[Storage] uploadScreenshotsToS3() → Save artifacts
    ↓
[DB] Update test_history table
    ↓
Dashboard displays results in Mission History
```

## Key Technologies

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 + LangChain/LangGraph |
| **Agent Logic** | LangGraph State Machine |
| **Browser** | Playwright + UndetectedBrowser |
| **Database** | Supabase PostgreSQL |
| **Storage** | AWS S3 |
| **Proxy** | BrightData Residential |
| **Process** | PM2 (production) |

## Status Codes

Jobs report one of these statuses:

| Status | Meaning |
|--------|---------|
| `queued` | Waiting to start |
| `running` | In progress |
| `completed` | Finished (check report for pass/fail/partial) |
| `failed` | Error during execution |
| `partial` | WAF blocked some tests, partial results available |

## Environment

- **Production Host**: `100.54.233.117:9002`
- **Process Manager**: PM2 (ecosystem.config.cjs)
- **Logs**: `/home/ec2-user/logs/qa-agents-*.log`

## Recent Fix (Mar 18 2026)

**Issue**: ESM/CJS Module Loading Error
**Error**: `SyntaxError: Cannot use import statement outside a module`
**Solution**: Implemented webpackIgnore in route.ts to prevent Webpack from bundling agent files

```typescript
// src/app/api/jobs/route.ts
async function getCognitiveSystem() {
  const indexPath = path.resolve(process.cwd(), 'agents', 'core', 'index.js');
  const mod = await import(/* webpackIgnore: true */ indexPath);
  cachedCognitiveSystem = mod.createCognitiveSystem();
  return cachedCognitiveSystem;
}
```

This allows Node.js to load ESM modules at runtime while Webpack keeps them unbundled.
