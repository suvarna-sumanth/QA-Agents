# QA-Agents Documentation Index

**Complete reference for the QA-Agents autonomous testing platform.**

Your question: "Are these [dashboard sections] in sync? I'm not even understanding if it's working or not."

**Short Answer**: Yes, they're all synced. See [SYSTEM_SYNC_EXPLAINED.md](./SYSTEM_SYNC_EXPLAINED.md) for detailed explanation.

---

## 📚 Documentation Files

### 0. [STATUS_REPORT.md](./STATUS_REPORT.md) ⭐ **START HERE**
**What**: Current system status and what needs your attention
- What's working (all job execution!)
- What's broken (thehill.com HTTP 403)
- Why proxy rotation alone doesn't help
- What you need to decide and do next
- 3 concrete options with effort/impact

**Read this when**: You want a quick overview of current state

---

### 1. [NEXT_STEPS_IMPLEMENTATION.md](./NEXT_STEPS_IMPLEMENTATION.md) 🆕 **ACTIONABLE**
**What**: Concrete implementation options to fix remaining failures
- Why proxy rotation alone doesn't work (HTTP-level blocking)
- 3 implementation approaches with effort estimates
- Step-by-step implementation guides
- Testing checklists for each option
- File-by-file breakdown of changes needed

**Read this when**: Ready to implement fixes for thehill.com / thebrakereport.com failures

---

### 2. [AUDIT_ISSUES_AND_SOLUTIONS.md](./AUDIT_ISSUES_AND_SOLUTIONS.md)
**What**: Complete audit of all issues faced and solutions implemented
- 7 major issues: ESM/CJS bundling, play button, screenshots, domains, proxy blocking, HTTP errors
- Root cause analysis for each issue
- Detailed solutions with code examples
- Impact assessment and deployment status
- Remaining known issues and recommendations

**Read this when**: Understanding what went wrong, how it was fixed, and what's still pending

---

### 3. [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
**What**: High-level system design
- Component overview (API, Agent, Memory, Browser, Dashboard)
- Data flow from job submission to completion
- Technologies used (Next.js, LangGraph, Supabase, S3, Playwright)
- Status codes & meanings

**Read this when**: Understanding how the system works

---

### 4. [SKILLS_REFERENCE.md](./SKILLS_REFERENCE.md)
**What**: Complete skill documentation
- What each of the 7 testing skills do
- How they work & what they output
- Skill execution flow
- AgentState structure
- How to add new skills
- Debugging tips

**Read this when**: Understanding what agents actually test

---

### 5. [SYSTEM_SYNC_EXPLAINED.md](./SYSTEM_SYNC_EXPLAINED.md)
**What**: Dashboard synchronization & verification
- Why top panel shows different data than bottom
- How "[Engineer] Planning" + "Skill Registry" are the same job
- Data flow showing how 3 views stay in sync
- How to verify everything is working
- What Deep Swarm Matrix shows

**Read this when**: Confused about dashboard showing different things

---

### 6. [DASHBOARD_TELEMETRY.md](./DASHBOARD_TELEMETRY.md)
**What**: Dashboard UI complete guide
- Mission Control panel explained
- Swarm Specialist metrics (Senior Engineer, Discovery, Detection, Functional)
- Deep Swarm Matrix breakdown
- Mission History table format
- How to know if it's working (✅ vs ❌)
- Common scenarios & fixes
- Launching test jobs

**Read this when**: Using the dashboard UI

---

### 7. [API_REFERENCE.md](./API_REFERENCE.md)
**What**: Complete API documentation
- POST /api/jobs (submit test)
- GET /api/jobs (list jobs)
- GET /api/jobs/[id] (job details)
- GET /api/reports/[jobId] (full results)
- GET /api/agents (skill registry)
- GET /api/agents/telemetry (metrics)
- All parameters, responses, error codes
- Example workflows & commands

**Read this when**: Integrating with the API programmatically

---

## 🚀 Quick Start

### Access the System
- **Dashboard**: http://100.54.233.117:9002/qa-dashboard
- **API**: http://100.54.233.117:9002/api
- **SSH**: `ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117`

### Submit Your First Job
```bash
curl -X POST http://100.54.233.117:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"domain","target":"thehill.com"}'
```

Response:
```json
{"success": true, "jobId": "job-1773776138124-19q1j2l", "status": "queued"}
```

### Watch It Execute
1. Go to dashboard: http://100.54.233.117:9002/qa-dashboard
2. Click "LAUNCH JOB" tab
3. See job appear in "MISSION IN PROGRESS"
4. Watch live logs in top panel
5. See results in bottom "MISSION HISTORY" table

### Check Results
```bash
curl http://100.54.233.117:9002/api/jobs | jq '.jobs[-1]'
```

---

## 🎯 Common Questions Answered

### Q: Are the three dashboard panels synced?
**A**: Yes! All three show the same job from different angles:
- **Top panel** = Live agent logs
- **Bottom panel** = Job database record
- **Right panel** = Event system status

See [SYSTEM_SYNC_EXPLAINED.md](./SYSTEM_SYNC_EXPLAINED.md)

### Q: What does "[Engineer]" mean in the logs?
**A**: The Planner node is starting. It's the "Senior Engineer specialist" analyzing the target and creating the test plan. See [SKILLS_REFERENCE.md](./SKILLS_REFERENCE.md)

### Q: What's the Deep Swarm Matrix showing?
**A**: Real-time telemetry of the 4 orchestrator nodes (Planner, Discovery, Detection, Functional) and their payload counts. See [DASHBOARD_TELEMETRY.md](./DASHBOARD_TELEMETRY.md)

### Q: How do I know it's working?
**A**: Watch for:
- ✅ Top panel updates every 1-2 seconds
- ✅ Specialist percentages increase
- ✅ Bottom panel shows completed jobs
- ✅ Swarm Integrity shows "NOMINAL"

See [DASHBOARD_TELEMETRY.md#how-to-know-if-its-working](./DASHBOARD_TELEMETRY.md)

### Q: What if nothing is updating?
**A**: Check:
1. `pm2 logs qa-agents` on EC2
2. `curl http://100.54.233.117:9002/api/health`
3. Reload dashboard browser tab
4. Click "INITIALIZE ADVANCED MATRIX"

---

## 🔧 System Architecture Summary

```
Dashboard UI
    ↓
API Routes (POST /jobs, GET /jobs)
    ↓
SupervisorAgent (LangGraph state machine)
    ├─ Planner Node (plan tests)
    ├─ Execute Node (run skills)
    ├─ Expand Node (check progress)
    └─ Evaluate Node (finalize results)
    ↓
Skill Registry (7 testing skills)
    ├─ DiscoverArticlesSkill
    ├─ DetectPlayerSkill
    ├─ TestPlayerSkill
    ├─ BypassCloudflareSkill
    ├─ BypassPerimeterXSkill
    ├─ DismissPopupsSkill
    └─ TakeScreenshotSkill
    ↓
Browser Automation (Playwright + UndetectedBrowser)
    ↓
Storage (Supabase + AWS S3)
```

---

## 📊 Job Status Values

| Status | Meaning |
|--------|---------|
| `queued` | Waiting to run |
| `running` | Currently executing |
| `completed` | Finished (check report) |
| `failed` | Error occurred |
| `partial` | Some tests blocked by WAF |

## 🎯 Mission Final Status Values

| Status | Meaning |
|--------|---------|
| `pass` | All players working perfectly |
| `fail` | No players found |
| `partial` | Some players found but tests incomplete |

---

## 🔍 File Locations (EC2)

```
/home/ec2-user/QA-Agents/
├── .next/ (built Next.js)
├── agents/ (agent code)
├── src/ (source code)
└── ecosystem.config.cjs (PM2 config)

/home/ec2-user/logs/
├── qa-agents-out.log (stdout)
└── qa-agents-error.log (stderr)
```

---

## 🛠️ Admin Commands

```bash
# SSH into EC2
ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117

# View live logs
pm2 logs qa-agents --lines 100

# Restart service
pm2 restart qa-agents

# Check status
pm2 list

# View PM2 logs
pm2 logs

# Stop service
pm2 stop qa-agents

# Start service
pm2 start qa-agents
```

---

## 📝 Recent Changes (Mar 18, 2026)

✅ **Fixed ESM/CJS Module Loading**
- Error: `SyntaxError: Cannot use import statement outside a module`
- Solution: Implemented webpackIgnore in src/app/api/jobs/route.ts
- Commit: `b660900`
- Result: Jobs now execute successfully

✅ **Created Comprehensive Documentation**
- SYSTEM_ARCHITECTURE.md
- SKILLS_REFERENCE.md
- SYSTEM_SYNC_EXPLAINED.md
- DASHBOARD_TELEMETRY.md
- API_REFERENCE.md

---

## ✨ What's Working Now

- ✅ Job submission via API & dashboard
- ✅ Agent skill execution (all 7 skills)
- ✅ Real-time dashboard updates
- ✅ Screenshot capture & S3 upload
- ✅ Supabase test history storage
- ✅ SSL certificate handling for thehill.com
- ✅ WAF detection (Cloudflare, PerimeterX)
- ✅ Browser pool management
- ✅ Proxy rotation (BrightData)

---

## 📖 Reading Order

**START HERE**:
1. **Current status?** → [STATUS_REPORT.md](./STATUS_REPORT.md) ⭐ **READ THIS FIRST**
2. **Need to fix something?** → [NEXT_STEPS_IMPLEMENTATION.md](./NEXT_STEPS_IMPLEMENTATION.md)

Then:
3. **Using dashboard?** → [DASHBOARD_TELEMETRY.md](./DASHBOARD_TELEMETRY.md)
4. **Understanding agents?** → [SKILLS_REFERENCE.md](./SKILLS_REFERENCE.md)
5. **Calling API?** → [API_REFERENCE.md](./API_REFERENCE.md)
6. **Deep dive?** → [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

---

## 🆘 Troubleshooting

### "No updates in dashboard"
→ Check: `pm2 logs qa-agents | tail -50`

### "Job fails immediately"
→ Check: `curl http://100.54.233.117:9002/api/health`

### "Event pool shows error"
→ Fix: Click "INITIALIZE ADVANCED MATRIX" or submit new job

### "High latency (> 5s)"
→ Check: EC2 instance CPU/memory

---

**Last Updated**: Mar 18, 2026, 1:30 AM
**Status**: 🟢 Production Ready
