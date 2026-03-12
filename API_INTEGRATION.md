# HTTP API Integration Documentation

## Overview

The HTTP API layer enables external clients (dashboards, CLI tools, schedulers) to submit jobs to agents and retrieve results without directly using the Shivani CLI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client/Dashboard                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│             Next.js API Routes (/api/*)                     │
│  ├─ /api/health         (health check)                      │
│  ├─ /api/agents         (list agents)                       │
│  ├─ /api/jobs           (POST: submit, GET: list)           │
│  └─ /api/jobs/[id]      (GET: job status)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Agent Registry + Job Queue (In-Memory MVP)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           Agent Interface (pluggable agents)                │
│  ├─ AgentShivani (player QA)                                │
│  ├─ [Future] AgentPerformance (load testing)                │
│  └─ [Future] AgentSecurity (vulnerability scanning)         │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Route Structure

**File: `src/app/api/health/route.ts`**
- Simple health check for monitoring
- No dependencies on agent system

**File: `src/app/api/agents/route.ts`**
- GET: List all registered agents
- Calls `bootstrapAgents()` and returns metadata

**File: `src/app/api/jobs/route.ts`**
- POST: Submit new job (async, fire-and-forget)
- GET: List recent jobs (MVP: last 20)
- Maintains in-memory `jobRegistry` Map

**File: `src/app/api/jobs/[id]/route.ts`**
- GET: Retrieve job status and report
- Imports `jobRegistry` from parent route

### Job Execution Flow

1. **Submit** (POST /api/jobs)
   - Validate input (agentId, type, target, config)
   - Retrieve agent from registry
   - Create job descriptor with callbacks
   - Register job as "queued"
   - **Kick off async execution** (fire-and-forget)
   - Return immediately with jobId (HTTP 202)

2. **Execute** (async, in background)
   - Update status to "running"
   - Call `agent.runJob(job)` with event callbacks
   - Callbacks update jobRegistry in real-time
   - When complete, update status to "completed" or "failed"
   - Store full report in jobRegistry

3. **Query** (GET /api/jobs/:id)
   - Retrieve from jobRegistry
   - Return current status and report (if ready)

## Current Limitations (MVP)

| Aspect | Current | Future |
|--------|---------|--------|
| **Job Queue** | In-memory Map | Redis/BullMQ |
| **Concurrency** | Sequential (first-come-first-serve) | Worker pool with configurable threads |
| **Persistence** | Lost on restart | S3 + optional DB index |
| **Reports** | Held in memory | S3 with signed URLs |
| **Screenshots** | No storage yet | S3 with thumbnail generation |
| **Webhooks** | None | Job completion callbacks |
| **Auth** | None | JWT/API keys |
| **Rate Limiting** | None | Token bucket or sliding window |

## Running the API

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Navigate to
# http://localhost:3000/api/health
# http://localhost:3000/api/agents
```

## Testing the API

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-03-12T12:00:00.000Z",
  "version": "1.0.0"
}
```

### 2. List Agents

```bash
curl http://localhost:3000/api/agents
```

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "agent-shivani",
      "name": "Shivani QA Agent",
      "version": "1.0.0",
      "capabilities": [
        "detectInstareadPlayer",
        "testAudioPlayer",
        "captureScreenshots",
        "bypassChallenges"
      ]
    }
  ],
  "count": 1
}
```

### 3. Submit Job (URL)

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://thehill.com/news/latest"
  }'
```

**Response (HTTP 202):**
```json
{
  "success": true,
  "jobId": "job-1705000000000-abc123",
  "status": "queued"
}
```

### 4. Submit Job (Domain)

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "domain",
    "target": "https://thehill.com",
    "config": {
      "maxArticles": 5
    }
  }'
```

### 5. List Recent Jobs

```bash
curl http://localhost:3000/api/jobs
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job-1705000000000-abc123",
      "agentId": "agent-shivani",
      "type": "url",
      "target": "https://thehill.com/news/article-1",
      "status": "completed",
      "createdAt": "2026-03-12T12:00:00.000Z",
      "completedAt": "2026-03-12T12:05:00.000Z",
      "report": { ... full report object ... }
    }
  ],
  "count": 1
}
```

### 6. Get Job Status

```bash
curl http://localhost:3000/api/jobs/job-1705000000000-abc123
```

**Response:**
```json
{
  "success": true,
  "job": {
    "jobId": "job-1705000000000-abc123",
    "status": "running",
    "createdAt": "2026-03-12T12:00:00.000Z",
    "lastUpdate": "2026-03-12T12:00:05.000Z"
  }
}
```

## Integration with Dashboard

The dashboard will:

1. Call `GET /api/agents` on startup to discover available agents
2. Call `POST /api/jobs` to submit test runs
3. Poll `GET /api/jobs/:id` to check status
4. When complete, retrieve the report and display results
5. Extract S3 URLs from report.steps[].screenshot (after S3 migration)

## Next Steps

1. **Implement S3 Storage** (`implement-s3-storage`)
   - Update job handler to save reports to S3
   - Save screenshots to S3 instead of local filesystem
   - Return S3 paths/URLs in job response

2. **Create Report Normalizer** (`normalize-reports`)
   - Adapter to transform existing report format into dashboard schema
   - Handle both Shivani-specific and generic report fields

3. **Build Dashboard** (`scaffold-dashboard`)
   - Next.js React components for jobs list and details
   - Real-time job polling
   - Screenshot viewer from S3
   - Filter and search UI

4. **Production Hardening**
   - Redis/BullMQ for persistent job queue
   - Database for job history indexing
   - Authentication and authorization
   - Rate limiting and concurrency controls
   - Webhook callbacks for job completion

## Code Organization

```
QA-Agents/
├── agents/
│   ├── core/
│   │   ├── Agent.js              (base class)
│   │   ├── AgentRegistry.js       (in-memory registry)
│   │   ├── bootstrap.js           (initialization)
│   │   └── AGENT_INTERFACE.md     (documentation)
│   │
│   └── shivani/
│       └── src/
│           ├── AgentShivani.js    (agent implementation)
│           ├── index.js           (CLI entry point - uses Agent)
│           ├── detect.js
│           ├── test-player.js
│           └── ... (other modules)
│
└── src/
    └── app/
        └── api/
            ├── health/
            │   └── route.ts        (health check)
            ├── agents/
            │   └── route.ts        (list agents)
            ├── jobs/
            │   ├── route.ts        (submit, list jobs)
            │   ├── [id]/
            │   │   └── route.ts    (job status)
            │   └── README.md
            └── README.md
```

## Files Created/Modified

**New Files:**
- `agents/core/Agent.js` - Base agent interface
- `agents/core/AgentRegistry.js` - Agent discovery
- `agents/core/bootstrap.js` - System initialization
- `agents/core/test-agent-interface.js` - Interface verification tests
- `agents/core/AGENT_INTERFACE.md` - Agent abstraction docs
- `agents/shivani/src/AgentShivani.js` - Shivani agent implementation
- `src/app/api/health/route.ts` - Health endpoint
- `src/app/api/agents/route.ts` - Agent discovery endpoint
- `src/app/api/jobs/route.ts` - Job submission & listing
- `src/app/api/jobs/[id]/route.ts` - Job status endpoint
- `src/app/api/README.md` - API documentation

**Modified Files:**
- `agents/shivani/src/index.js` - Now uses AgentShivani class
- `tsconfig.json` - Added @agents/* path alias
