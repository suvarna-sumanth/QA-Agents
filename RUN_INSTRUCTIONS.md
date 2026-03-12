# How to Run QA Agents Platform

## Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
cd /home/sumanth/Projects/QA-Agents
npm install
```

### Step 2: Start Development Server

```bash
npm run dev
```

You should see:
```
> next dev --turbopack -p 9002

  ▲ Next.js 15.5.9
  - Local:        http://localhost:3000
```

### Step 3: Open Dashboard

Visit in your browser:
```
http://localhost:3000/qa-dashboard
```

### Step 4: Submit Your First Job

1. Click **"Submit Job"** button
2. Select Agent: **"Shivani QA Agent"**
3. Job Type: **"URL"**
4. Target: **`https://example.com/article`**
5. Click **"Submit"**

### Step 5: View Results

Watch the job execute and view results in the dashboard!

---

## Complete Setup (Detailed)

### Prerequisites

- **Node.js** 18+ installed
- **npm** or yarn
- **AWS credentials** configured (already done ✓)
- **`.env` file** with variables (already configured ✓)

### Installation

```bash
# Navigate to project directory
cd /home/sumanth/Projects/QA-Agents

# Install all dependencies
npm install

# Verify installation
npm --version
node --version
```

### Running the Application

#### Development Mode (with hot reload)

```bash
npm run dev
```

Access: http://localhost:3000

Features:
- Hot module reloading
- Detailed error messages
- Debug logging

#### Production Build

```bash
npm run build
npm start
```

#### Type Checking

```bash
npm run typecheck
```

#### Linting

```bash
npm run lint
```

---

## Accessing the Dashboard

### Main Pages

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/qa-dashboard` | Overview with metrics & recent runs |
| `http://localhost:3000/qa-dashboard/jobs` | Submit new job |
| `http://localhost:3000/qa-dashboard/runs/{jobId}` | View job details & results |

### What You'll See

**Overview Page:**
- Total runs count
- Success rate percentage
- Average run duration
- Recent runs table
- Quick job submission link

**Job Submission Page:**
- Agent selection dropdown
- Job type selector (URL or Domain)
- Target input field
- Configuration options
- Submit button

**Run Details Page:**
- Job summary & metadata
- Step-by-step test results
- Inline screenshots
- Pass/fail status badges
- Expandable nested steps

---

## Running Tests

### Test Agent Interface

```bash
cd /home/sumanth/Projects/QA-Agents
node agents/core/test-agent-interface.js
```

Expected output:
```
✅ All abstraction tests passed!

Agent system is ready for:
  - HTTP API integration (runJob via REST)
  - Queue/scheduler integration (runJob via queue)
  - Multi-agent orchestration
  - Dashboard metrics and monitoring
```

### Test Shivani Agent (CLI)

```bash
cd agents/shivani

# Test single URL
node src/index.js --url https://thehill.com/news/latest

# Test domain (discover articles)
node src/index.js --domain https://thehill.com --max-articles 5
```

---

## API Endpoints

You can also interact with the platform via REST API:

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-03-12T...",
  "version": "1.0.0"
}
```

### List Agents

```bash
curl http://localhost:3000/api/agents
```

### Submit Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://example.com/article"
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "job-1705000000000-abc123",
  "status": "queued"
}
```

### Check Job Status

```bash
curl http://localhost:3000/api/jobs/job-1705000000000-abc123
```

### Get Reports

```bash
# Summary
curl http://localhost:3000/api/reports/summary

# Recent reports
curl http://localhost:3000/api/reports/normalized

# Specific report
curl http://localhost:3000/api/reports/job-1705000000000-abc123
```

---

## File Structure Reference

```
/home/sumanth/Projects/QA-Agents/
├── .env                          # Environment variables
├── .env.local                    # Local overrides (gitignored)
├── .env.example                  # Template
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
│
├── src/
│   ├── app/
│   │   ├── api/                 # REST API routes
│   │   │   ├── health/
│   │   │   ├── agents/
│   │   │   ├── jobs/
│   │   │   └── reports/
│   │   │
│   │   ├── qa-dashboard/        # Web UI
│   │   │   ├── page.tsx         # Overview
│   │   │   ├── jobs/page.tsx    # Job submission
│   │   │   ├── runs/[jobId]/    # Job details
│   │   │   └── layout.tsx       # Navigation
│   │   │
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Home (redirects)
│   │   └── globals.css
│   │
│   └── lib/
│       ├── storage.ts           # S3 storage
│       ├── s3Client.ts          # AWS SDK config
│       ├── reportNormalizer.ts  # Report schema
│       └── reportAdapter.ts     # API utilities
│
├── agents/
│   ├── core/
│   │   ├── Agent.js             # Base interface
│   │   ├── AgentRegistry.js     # Agent discovery
│   │   ├── bootstrap.js         # Initialization
│   │   └── test-agent-interface.js
│   │
│   └── shivani/
│       ├── src/
│       │   ├── index.js         # CLI entry
│       │   ├── AgentShivani.js  # Agent impl
│       │   ├── detect.js        # Player detection
│       │   ├── test-player.js   # QA tests
│       │   ├── bypass.js        # Bypass logic
│       │   ├── browser.js       # Browser launcher
│       │   └── ...
│       │
│       ├── package.json
│       ├── reports/             # Generated (local)
│       └── screenshots/         # Generated (local)
│
└── Documentation/
    ├── README.md
    ├── GETTING_STARTED.md
    ├── AWS_QUICK_START.md
    ├── AWS_SETUP_GUIDE.md
    ├── PROJECT_STRUCTURE.md
    ├── RUN_INSTRUCTIONS.md       # This file
    └── ...
```

---

## Environment Variables Check

Before running, verify your environment is set up:

```bash
# Check .env exists
cat .env | grep -E "^S3_|^AWS_|^NODE_"

# Verify AWS credentials
aws sts get-caller-identity

# Test S3 bucket access
aws s3 ls s3://qa-agents-reports-prod/
```

---

## Troubleshooting

### Issue: "Port 3000 already in use"

```bash
# Use different port
npm run dev -- -p 3001

# Or kill existing process
lsof -i :3000
kill -9 <PID>
```

### Issue: "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "AWS credentials not found"

```bash
# Verify .env.local has credentials
cat .env.local | grep AWS_

# Or set environment variables
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
npm run dev
```

### Issue: "S3 bucket not found"

```bash
# Verify bucket exists
aws s3 ls | grep qa-agents-reports-prod

# Check bucket in correct region
aws s3api get-bucket-location --bucket qa-agents-reports-prod
```

### Issue: "Dashboard not loading"

1. Check browser console (F12 → Console)
2. Check server logs (npm run dev output)
3. Verify API is working:
   ```bash
   curl http://localhost:3000/api/health
   ```

### Issue: "Job not appearing in S3"

1. Check if job completed:
   ```bash
   curl http://localhost:3000/api/jobs/{jobId}
   ```

2. Check S3 bucket:
   ```bash
   aws s3 ls s3://qa-agents-reports-prod/qa-agents/ --recursive
   ```

3. Check application logs for errors

---

## Development Workflow

### 1. Start Dev Server

```bash
npm run dev
```

### 2. Make Changes

Edit files in `src/` or `agents/`

### 3. Hot Reload

Changes automatically reload in browser

### 4. View Results

Open http://localhost:3000/qa-dashboard

### 5. Commit Changes

```bash
git add .
git commit -m "Your message"
git push
```

---

## Running Shivani Agent Directly

If you want to run the Shivani CLI automation without the dashboard:

### Test Single URL

```bash
cd agents/shivani
node src/index.js --url https://thehill.com/news/latest
```

Expected output:
```
🤖 Agent Shivani starting...

[Mode] Single URL: https://thehill.com/news/latest

── Phase 1: Player Detection ──
  ✓ PLAYER FOUND  https://thehill.com/news/latest

── Phase 2: Player QA Testing ──
  Testing: https://thehill.com/news/latest
  ✓ Page Load (2500ms)
  ✓ Player Detection (1500ms)
  ...
  Result: PASS | Passed: 15/15 | Failed: 0 | Skipped: 0
```

### Test Multiple Articles from Domain

```bash
cd agents/shivani
node src/index.js --domain https://thehill.com --max-articles 5
```

### View Generated Reports

Reports are stored in S3 but also logged locally:

```bash
# Check S3
aws s3 ls s3://qa-agents-reports-prod/qa-agents/agent-shivani/

# Check dashboard
http://localhost:3000/qa-dashboard
```

---

## Performance Tips

### Development

- First load: ~10 seconds
- Hot reload: ~2 seconds
- API response: <100ms

### Production

```bash
npm run build
npm start

# Then optimize with:
# - CDN for static files
# - Caching strategy
# - Database indexing
# - Load balancing
```

---

## Next Steps

1. ✅ Install: `npm install`
2. ✅ Run: `npm run dev`
3. ✅ Open: http://localhost:3000/qa-dashboard
4. ✅ Test: Submit a job
5. ✅ Verify: Check S3 for results

## Documentation

- **Quick Start**: `AWS_QUICK_START.md`
- **Platform Guide**: `GETTING_STARTED.md`
- **Structure**: `PROJECT_STRUCTURE.md`
- **S3 Setup**: `AWS_SETUP_GUIDE.md`
- **Environment**: `ENV_SETUP.md`

---

**Ready to go? Start with: `npm install && npm run dev` 🚀**
