# Dashboard & Telemetry Guide

## What You're Looking At

The QA Dashboard (`http://100.54.233.117:9002/qa-dashboard`) is your **mission control center** for monitoring autonomous agent testing jobs.

---

## Mission Control Panel

### Top Section: SWARM SPECIALIST PULSE

Shows real-time engagement metrics for the current active mission:

#### Four Agent Specialists

1. **Senior Engineer** (12%)
   - Represents the **Planner Node** activity
   - Shows initial analysis & plan creation
   - Percentage: Completion of planning phase

2. **Discovery** (5%)
   - Represents **DiscoverArticlesSkill** execution
   - Percentage: (articles_found / max_articles) × 100
   - Example: 5% = found ~1-2 articles from sitemap

3. **Detection** (8%)
   - Represents **DetectPlayerSkill** execution
   - Percentage: (articles_with_player / articles_checked) × 100
   - Example: 8% = player found on 1-2 of 3 articles

4. **Functional** (10%)
   - Represents **TestPlayerSkill** execution
   - Percentage: (playable_articles / articles_with_player) × 100
   - Example: 10% = 1-2 articles can play video out of those with players

#### Live Activity Stream

Real-time log of execution steps:

```
7:35:43 PM  [Functional] Executing skill: test_player
7:35:43 PM  [Detection] Executing skill: detect_player
7:35:39 PM  [Discovery] Executing skill: discover_articles
7:35:38 PM  [Engineer] Planning execution for https://thehill.com
```

**How to Read**: Bottom log entry is oldest, top is newest. This is the **actual execution order** from the agent.

---

## Deep Swarm Matrix

The **Deep Swarm Matrix** section shows **system-wide telemetry** and **agent cluster health**.

### Status: "Initializing live telemetry for current mission"

This means the system is setting up real-time metrics streaming for the active job.

### Four Orchestrator Nodes (bottom section)

Each node shows:
- **Name**: Type of node (Orchestrator, Discovery, Detection, Functional)
- **Status**: IDLE or PROCESSING
- **Payloads Processed**: Count of items processed

Example:
```
ORCHESTRATOR NODE          DISCOVERY NODE
├─ Status: IDLE           ├─ Status: IDLE
└─ 0 Payloads Processed   └─ 0 Payloads Processed
```

**IDLE** = Waiting for data or job complete
**PROCESSING** = Currently running skill

### Swarm Integrity

Shows overall system health:

```
SWARM INTEGRITY
NOMINAL • Anomaly Density: 0.02%
```

**What it means**:
- `NOMINAL` = All systems working correctly
- `Anomaly Density: 0.02%` = 0.02% of operations had issues
- Green status = Good, Red status = Problems

---

## Mission Command Registry

Right panel showing **connected agents** and their **event subscriptions**:

```
[ES:SYSTEM] Connected to event pool. Run a job to see live agent logs.
```

When a job is running, you'll see:
```
[ES:SYSTEM] Connected to event pool. Run a job to see live agent logs.
[ES:SYSTEM] Connected to event pool. Run a job to see live agent logs.
[ES:SYSTEM] Connected to event pool. Run a job to see live agent logs.
```

This indicates **3 event listeners active** (for different job aspects).

### Initialize Advanced Matrix

The **blue button** in the right panel:
- Clicks to manually trigger telemetry initialization
- Useful if logs aren't updating
- Forces refresh of event stream

---

## Mission History

Bottom table showing **all completed & in-progress jobs**:

```
TARGET DOMAIN          INTELLIGENCE STATUS    ACCURACY    TIME    SPECIALISTS
─────────────────────────────────────────────────────────────────────────────
thehill.com            IN PROGRESS            0%          0s      [👁 👁 👁 👁]
DOMAIN EXECUTION       [progress bar]

thehill.com            FAILED                 100%        20s     [👁 👁 👁 👁]
URL EXECUTION
```

### Column Breakdown

| Column | Meaning |
|--------|---------|
| **Target Domain** | Website being tested + type (DOMAIN or URL) |
| **Intelligence Status** | IN PROGRESS / COMPLETED / FAILED |
| **Accuracy** | 0% = just started, 100% = all tests completed |
| **Deployment Time** | How long test took |
| **Specialists** | Avatar badges of agents involved |

### Reading the Indicators

- **DOMAIN EXECUTION** = Testing entire domain
- **URL EXECUTION** = Testing specific URL
- **[👁 👁 👁 👁]** = 4 specialists engaged

---

## How to Know If It's Working

### ✅ System is Working

```
✓ Mission Control shows active job
✓ Live Activity updates every few seconds
✓ Specialist percentages increase over time
✓ Mission History shows completed entries
✓ Swarm Integrity = NOMINAL
```

### ❌ System Might Have Issues

```
✗ No updates for > 30 seconds
✗ Specialist percentages stuck at same value
✗ "Swarm Integrity" shows ERROR or red status
✗ "Anomaly Density" > 5%
✗ ORCHESTRATOR NODE shows 0 Payloads despite job running
```

**If you see red flags**: Check PM2 logs on EC2
```bash
ssh -i /home/sumanth/.ssh/Website-Monitor.pem ec2-user@100.54.233.117
pm2 logs qa-agents --lines 100
```

---

## Launching a Test Job

### Via Dashboard

1. Click **LAUNCH JOB** button
2. Enter domain: `thehill.com`
3. Job submits, status becomes "MISSION IN PROGRESS"
4. Watch Live Activity stream for real-time logs
5. Specialist bars increase as phases complete

### Via API

```bash
curl -X POST http://100.54.233.117:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "cognitive-supervisor",
    "type": "domain",
    "target": "https://thehill.com"
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "job-1773776138124-19q1j2l",
  "status": "queued"
}
```

---

## Telemetry Data Points

The Deep Swarm Matrix collects these metrics:

| Metric | Collected From | Shows |
|--------|----------------|-------|
| Payloads Processed | Each node | Items executed by that specialist |
| Processing Time | Agent logs | How long each skill takes |
| Anomaly Density | Error tracking | % of operations with errors |
| Node Status | Job state | IDLE vs PROCESSING |
| Swarm Integrity | Overall health | NOMINAL vs ERROR |

---

## Syncing Across Views

You might see:

**Top Panel (Mission Control)**: Shows "Executing skill: test_player"
**Bottom Panel (Mission History)**: Shows same jobId with "IN PROGRESS"
**Right Panel (Registry)**: Shows "[ES:SYSTEM] Connected to event pool"

These are **all the same job**, displayed from different angles:
- **Top** = Live streaming logs
- **Bottom** = Historical record
- **Right** = Event system status

Think of it like a security office with:
- **Monitor wall** (top) = Live camera feed
- **Case file cabinet** (bottom) = Historical database
- **Radio system** (right) = Communication status

All three show the same incident but from different perspectives.

---

## Common Scenarios

### Scenario 1: Job Complete, Dashboard Shows IN PROGRESS

**Why**: Dashboard caches results. Reload page to refresh.

```bash
# Or check API directly
curl http://100.54.233.117:9002/api/jobs | jq '.jobs[-1]'
```

### Scenario 2: Live Activity Stuck

**Why**: Event listener might be stalled.

**Fix**: Click "INITIALIZE ADVANCED MATRIX" button or submit new job.

### Scenario 3: Specialist Percentages Low

**Why**: Normal! Depends on domain:
- Simple domains: Quick discovery, low %
- Protected domains: Long detection phase, high %

### Scenario 4: FAILED Status with 100% Accuracy

**Why**: Test completed but no playable videos found. Status shows:
- `FAILED` = No players detected
- `COMPLETED` = Player found
- `PARTIAL` = Some players blocked by WAF

---

## Next Steps

1. **Submit a job** to thehill.com via LAUNCH JOB
2. **Watch Mission Control** for live updates
3. **Check Mission History** for results
4. **Click MISSION INTEL** on a job to see detailed report

For API reference, see [API_REFERENCE.md](./API_REFERENCE.md)
