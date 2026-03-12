# Project Structure - QA Agent Platform

## Overview

Clean, focused project structure for the QA Agent Platform with agent abstraction, REST API, and professional dashboard.

```
QA-Agents/
├── agents/                        Agent System (Source)
│   ├── core/                      Agent Framework
│   │   ├── Agent.js              Base interface
│   │   ├── AgentRegistry.js       Agent discovery
│   │   ├── bootstrap.js           System initialization
│   │   ├── test-agent-interface.js Tests
│   │   └── AGENT_INTERFACE.md    Documentation
│   │
│   └── shivani/                   Shivani QA Agent
│       ├── src/
│       │   ├── AgentShivani.js    Agent implementation
│       │   ├── index.js           CLI entry point
│       │   ├── detect.js          Player detection
│       │   ├── test-player.js     QA tests
│       │   ├── bypass.js          Challenge bypass
│       │   ├── browser.js         Browser launcher
│       │   ├── config.js          Configuration
│       │   └── discover.js        Article discovery
│       │
│       ├── reports/               Generated reports (local storage - temp)
│       ├── screenshots/           Generated screenshots (local storage - temp)
│       ├── package.json
│       └── README.md
│
├── src/                            Next.js Application
│   ├── app/
│   │   ├── api/                   REST API Routes
│   │   │   ├── agents/           Agent discovery
│   │   │   ├── health/           Health check
│   │   │   ├── jobs/             Job management
│   │   │   └── reports/          Report queries
│   │   │
│   │   ├── qa-dashboard/         QA Dashboard UI
│   │   │   ├── layout.tsx        Navigation & layout
│   │   │   ├── page.tsx          Overview & metrics
│   │   │   ├── jobs/page.tsx     Job submission
│   │   │   └── runs/[jobId]/     Run details
│   │   │
│   │   ├── layout.tsx            Root layout
│   │   ├── page.tsx              Home (redirect)
│   │   └── globals.css           Global styles
│   │
│   └── lib/                       Shared Utilities
│       ├── storage.ts            S3 storage service
│       ├── s3Client.ts           AWS SDK config
│       ├── reportNormalizer.ts   Report schema
│       └── reportAdapter.ts      API adaptation
│
├── Documentation Files
│   ├── README.md                 Project overview
│   ├── IMPLEMENTATION_SUMMARY.md Completed milestones
│   ├── CLEANUP_SUMMARY.md        Files removed
│   ├── PROJECT_STRUCTURE.md      This file
│   ├── AGENT_INTERFACE.md        Agent framework
│   ├── API_INTEGRATION.md        HTTP API docs
│   ├── REPORT_NORMALIZATION.md   Report schema
│   ├── QA_DASHBOARD.md           Dashboard guide
│   ├── S3_MIGRATION_PLAN.md      Cloud storage plan
│   ├── API_INTEGRATION.md        API documentation
│   └── agent-transcripts/        Chat history
│
├── Configuration Files
│   ├── package.json              Dependencies
│   ├── tsconfig.json             TypeScript config
│   ├── next.config.js            Next.js config
│   └── .env.local                Environment (gitignored)
│
└── .git/                          Git repository

```

## Key Directories Explained

### `agents/` - Agent System (Automation)

The core automation layer with reusable agent framework.

- **core/** - Agent abstraction & registry
  - Base `Agent` class for all agents
  - `AgentRegistry` for discovery and capability matching
  - Bootstrap initialization

- **shivani/** - QA player testing automation
  - Existing Shivani implementation using new Agent interface
  - Browser automation with Playwright
  - Cloudflare/PerimeterX bypass
  - Player QA testing suite
  - CLI entry point

**Purpose:** Headless automation that can run in CI/CD or be called by the API

### `src/app/api/` - REST API Layer

Exposes agent functionality to clients via HTTP.

**Endpoints:**
- `GET /api/health` - Service health
- `GET /api/agents` - List agents
- `POST /api/jobs` - Submit job
- `GET /api/jobs/:id` - Job status
- `GET /api/reports/*` - Report queries

**Purpose:** Enable dashboard and external systems to interact with agents

### `src/app/qa-dashboard/` - Web UI

Professional dashboard for monitoring and submitting jobs.

**Pages:**
- `/qa-dashboard/` - Overview with metrics & recent runs
- `/qa-dashboard/jobs` - Job submission form
- `/qa-dashboard/runs/[jobId]` - Detailed run results

**Purpose:** Internal QA team interface for job management and analysis

### `src/lib/` - Shared Utilities

Reusable modules for API and dashboard.

- `storage.ts` - S3 abstraction for reports/screenshots
- `s3Client.ts` - AWS SDK v3 configuration
- `reportNormalizer.ts` - Convert reports to dashboard schema
- `reportAdapter.ts` - API response formatting & analysis

**Purpose:** Decouple business logic from UI/API layers

## Data Flow

```
┌─────────────────┐
│   QA Dashboard  │  (Next.js React UI)
└────────┬────────┘
         │ REST API calls
         ▼
┌─────────────────┐
│   API Routes    │  (Next.js /api/*)
│  - jobs         │
│  - reports      │
│  - agents       │
└────────┬────────┘
         │ Agent execution
         ▼
┌─────────────────┐
│  Agent System   │  (Node.js)
│ - AgentShivani  │
│ - Agent Registry│
└────────┬────────┘
         │ Save reports
         ▼
┌─────────────────┐
│  Amazon S3      │  (Cloud storage)
│ - reports.json  │
│ - screenshots   │
└─────────────────┘
```

## Dependency Map

### Frontend Dependencies
- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- Lucide React (icons)

### Backend Dependencies
- Node.js built-ins
- AWS SDK v3 (S3)
- Playwright (automation in agents/)
- dotenv (configuration)

### Development Dependencies
- TypeScript
- ESLint/Prettier

## File Stats

| Section | Files | Purpose |
|---------|-------|---------|
| API Routes | 7 | REST endpoints |
| Dashboard Pages | 4 | Web UI |
| Utilities | 4 | Shared modules |
| Agent Framework | 4 | Abstraction & registry |
| Automation | 8 | Shivani implementation |
| Docs | 8+ | Documentation |

**Total Active Files:** ~20 TypeScript files + config

## Environment Configuration

Required environment variables:

```bash
# AWS S3 (for cloud storage)
S3_BUCKET=qa-agents-reports-prod
S3_REGION=us-east-1
S3_PREFIX=qa-agents/
S3_SIGNED_URL_EXPIRATION=3600
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Optional: Local development
LOCALSTACK_ENDPOINT=http://localhost:4566  # For local S3 emulation
```

## Development Workflow

### 1. Start Development Server
```bash
npm run dev
# Navigate to http://localhost:3000/qa-dashboard
```

### 2. Run QA Tests (CLI)
```bash
cd agents/shivani
node src/index.js --domain https://example.com
```

### 3. Submit Job via API
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-shivani","type":"url","target":"https://example.com/article"}'
```

### 4. View Results in Dashboard
```
http://localhost:3000/qa-dashboard/runs/{jobId}
```

## Deployment Structure

### Development
- Local storage: `agents/shivani/reports/` and `screenshots/`
- In-memory job registry
- Single process

### Production
- S3 storage (reports + screenshots)
- Persistent job queue (Redis/BullMQ - recommended)
- Multiple worker processes
- Database index (optional)

## Future Expansion

### Adding a New Agent

1. Create `agents/new-agent/src/NewAgent.js`
2. Extend `Agent` class
3. Implement `runJob()` method
4. Register in `agents/core/bootstrap.js`

### Adding a New Dashboard Page

1. Create `src/app/qa-dashboard/new-feature/page.tsx`
2. Use `lib/reportAdapter.ts` utilities
3. Call API routes from `src/app/api/`

### Adding a New API Endpoint

1. Create `src/app/api/new-resource/route.ts`
2. Implement GET/POST handler
3. Use `lib/storage.ts` for data access

## Notes

- ✓ Removed 64+ unused files (ai/, firebase/, components/, old pages)
- ✓ Focused on single purpose: QA agent platform
- ✓ All code is active and maintained
- ✓ Clear separation of concerns
- ✓ Easy to extend with new agents and features

For detailed information, see:
- `IMPLEMENTATION_SUMMARY.md` - What was built
- `CLEANUP_SUMMARY.md` - What was removed
- Individual documentation files in root directory
