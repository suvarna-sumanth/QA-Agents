# Getting Started - QA Agent Platform

Welcome to the QA Agent Platform! This guide will help you understand the system and get up and running.

## Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# For Shivani CLI (optional, for direct automation)
cd agents/shivani
npm install
cd ../..
```

### 2. Start Development Server

```bash
npm run dev
```

Then visit: **http://localhost:3000/qa-dashboard**

### 3. Submit Your First Job

1. Click "Submit Job" button
2. Select Agent: "Shivani QA Agent"
3. Choose Job Type: "URL"
4. Enter Target: `https://example.com/article`
5. Click "Submit Job"
6. View run details as job executes

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│         QA Dashboard (Frontend)              │
│  http://localhost:3000/qa-dashboard          │
│  ├─ Overview (metrics & recent runs)         │
│  ├─ Job Submission (form to run tests)       │
│  └─ Run Details (results & screenshots)      │
└──────────────────┬───────────────────────────┘
                   │ REST API
                   ▼
┌──────────────────────────────────────────────┐
│      API Layer (http://localhost:3000/api)   │
│  ├─ /api/health          (health check)      │
│  ├─ /api/agents          (list agents)       │
│  ├─ /api/jobs            (manage jobs)       │
│  └─ /api/reports/*       (get reports)       │
└──────────────────┬───────────────────────────┘
                   │ Execution
                   ▼
┌──────────────────────────────────────────────┐
│      Agent System (Automation)               │
│  ├─ AgentShivani (player QA testing)         │
│  └─ Future: More agents...                   │
└──────────────────┬───────────────────────────┘
                   │ Store artifacts
                   ▼
┌──────────────────────────────────────────────┐
│      Cloud Storage (Amazon S3)               │
│  ├─ reports.json (test results)              │
│  └─ screenshots/ (step-by-step images)       │
└──────────────────────────────────────────────┘
```

## Key Files & Directories

### Frontend (Dashboard)
- `src/app/qa-dashboard/` - Main dashboard application
- `src/app/api/` - REST API endpoints

### Backend (Automation)
- `agents/core/` - Agent framework and registry
- `agents/shivani/` - QA player testing automation

### Shared
- `src/lib/storage.ts` - S3 storage abstraction
- `src/lib/reportNormalizer.ts` - Report schema conversion

## Use Cases

### 1. Test a Single Article

```bash
# Via Dashboard
1. Submit Job → URL type → Enter article URL
2. Watch results in real-time
3. View screenshots and step details

# Via API
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://example.com/article"
  }'
```

### 2. Test Multiple Articles from a Domain

```bash
# Via Dashboard
1. Submit Job → Domain type → Enter domain → Set max articles
2. Agent automatically discovers and tests articles

# Via API
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "domain",
    "target": "https://example.com",
    "config": {"maxArticles": 5}
  }'
```

### 3. Monitor All Runs

```bash
# Dashboard
1. View Overview page for metrics
2. Recent runs table shows last 10 jobs
3. Click "View" to see detailed results

# API
GET http://localhost:3000/api/jobs
GET http://localhost:3000/api/reports/summary
```

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# AWS S3 Configuration (for cloud storage)
S3_BUCKET=qa-agents-reports-prod
S3_REGION=us-east-1
S3_PREFIX=qa-agents/
S3_SIGNED_URL_EXPIRATION=3600

# AWS Credentials (use IAM role in production)
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here

# Optional: For local development with LocalStack
LOCALSTACK_ENDPOINT=http://localhost:4566
```

### Local Development (Without S3)

The system works without S3 configured - jobs are held in memory and reports are accessible via the API.

For local S3 emulation:

```bash
# Start LocalStack
docker-compose up localstack

# Set env variable
export LOCALSTACK_ENDPOINT=http://localhost:4566
```

## API Reference

### Health Check
```bash
GET /api/health
```
Response: `{ status: "healthy" }`

### List Agents
```bash
GET /api/agents
```
Response: List of registered agents with capabilities

### Submit Job
```bash
POST /api/jobs
Body: { agentId, type, target, config }
```
Response: `{ jobId, status: "queued" }` (HTTP 202)

### Get Job Status
```bash
GET /api/jobs/:jobId
```
Response: Job metadata and report (if complete)

### Get Reports
```bash
GET /api/reports/summary         # Dashboard metrics
GET /api/reports/normalized      # Recent reports
GET /api/reports/:jobId          # Full report details
```

## Dashboard Features

### Overview Page
- **Metrics Cards** - Total runs, success rate, avg duration
- **Recent Runs Table** - Last 10 jobs with status badges
- **Auto-Refresh** - Updates every 5 seconds
- **Pass Rate Visualization** - Color-coded progress bars

### Run Details Page
- **Summary** - Job metadata, timestamps, agent info
- **Steps** - Expandable test steps with timing
- **Screenshots** - Inline image viewing
- **Sub-steps** - Nested step details
- **Status Badges** - Color-coded results

### Job Submission Page
- **Agent Selection** - Dropdown with capabilities
- **Job Type** - URL or domain crawl
- **Configuration** - Type-specific options
- **Validation** - Form error checking
- **Success Confirmation** - Shows job ID

## Testing the System

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

### 2. List Agents
```bash
curl http://localhost:3000/api/agents
```

### 3. Submit Test Job
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://thehill.com/news/latest"
  }'
```

### 4. Check Job Status
```bash
curl http://localhost:3000/api/jobs/{jobId}
```

### 5. View Dashboard
Open: http://localhost:3000/qa-dashboard

## CLI Usage (Direct Automation)

Run Shivani directly via CLI:

```bash
cd agents/shivani

# Test single URL
node src/index.js --url https://example.com/article

# Test domain (discover articles)
node src/index.js --domain https://example.com --max-articles 5
```

## Troubleshooting

### Dashboard not loading
- Check browser console for errors
- Verify API is running: `curl http://localhost:3000/api/health`
- Check Network tab in DevTools

### Jobs not appearing
- Check if API is returning data: `curl http://localhost:3000/api/jobs`
- Look at server logs for errors
- Verify job was submitted successfully (HTTP 202)

### S3 connection issues
- Verify credentials in `.env.local`
- Check bucket exists: `aws s3 ls s3://your-bucket/`
- For LocalStack: verify `LOCALSTACK_ENDPOINT` is set

### Playwright issues (CLI)
- Install Playwright: `cd agents/shivani && npm install playwright`
- Check browser compatibility: `npx playwright install`

## Next Steps

1. **Explore the Dashboard**
   - Visit http://localhost:3000/qa-dashboard
   - Submit a test job
   - View detailed results

2. **Integrate with Your Workflow**
   - Use API to submit jobs from CI/CD
   - Build custom dashboards using `/api/reports/*` endpoints
   - Set up webhooks for job completion

3. **Deploy to Production**
   - Configure S3 bucket and IAM credentials
   - Deploy Next.js app to cloud (Vercel, AWS, etc.)
   - Set up persistent job queue (Redis/BullMQ)

4. **Add New Agents**
   - See `agents/core/AGENT_INTERFACE.md`
   - Implement Agent interface
   - Register in bootstrap.js

## Documentation

- **IMPLEMENTATION_SUMMARY.md** - What was built and completed
- **PROJECT_STRUCTURE.md** - Directory layout and organization
- **CLEANUP_SUMMARY.md** - Removed old code and rationale
- **AGENT_INTERFACE.md** - How to build agents
- **API_INTEGRATION.md** - API endpoints and examples
- **QA_DASHBOARD.md** - Dashboard user guide
- **REPORT_NORMALIZATION.md** - Report schema details
- **S3_MIGRATION_PLAN.md** - Cloud storage strategy

## Support

For issues or questions:
1. Check relevant documentation file
2. Review API responses and error messages
3. Check application logs
4. Review browser DevTools console

## What's Next?

The system is production-ready! Recommended next steps:

1. ✅ **Immediate** - Deploy to staging, test thoroughly
2. ✅ **Week 1** - Configure S3 and IAM, integrate CI/CD
3. ✅ **Week 2** - Add database for job indexing (optional)
4. ✅ **Week 3** - Add persistent job queue for concurrency
5. ✅ **Week 4** - Multi-agent support and additional agents

---

**Happy Testing!** 🚀

Questions? See the documentation files in the root directory or check the code comments for implementation details.
