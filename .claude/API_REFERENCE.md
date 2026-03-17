# API Reference

All endpoints are available at `http://100.54.233.117:9002/api/`

---

## Jobs API

### POST /api/jobs
**Submit a new testing job**

**Request**:
```json
{
  "agentId": "cognitive-supervisor",
  "type": "domain",
  "target": "https://thehill.com",
  "config": {
    "maxArticles": 3
  }
}
```

**Parameters**:
| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `agentId` | string | No | "cognitive-supervisor" | Agent to execute job |
| `type` | string | Yes | - | "domain" or "url" |
| `target` | string | Yes | - | URL or domain to test |
| `config.maxArticles` | number | No | 5 | Max articles to discover |

**Response**:
```json
{
  "success": true,
  "jobId": "job-1773776138124-19q1j2l",
  "status": "queued"
}
```

**Status Code**: 202 (Accepted)

---

### GET /api/jobs
**List recent jobs**

**Query Parameters**: None

**Response**:
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job-1773776138124-19q1j2l",
      "agentId": "cognitive-supervisor",
      "type": "domain",
      "target": "https://thehill.com",
      "status": "completed",
      "createdAt": "2026-03-17T19:35:38.124Z",
      "lastUpdate": "2026-03-17T19:45:12.456Z",
      "completedAt": "2026-03-17T19:45:12.456Z",
      "report": { /* full LangGraph state */ }
    }
  ],
  "count": 20
}
```

**Status Codes**:
- `200` - Success
- `500` - Database error

---

### GET /api/jobs/[id]
**Get specific job details**

**Path Parameters**:
| Param | Type | Notes |
|-------|------|-------|
| `id` | string | Job ID from POST response |

**Response**:
```json
{
  "success": true,
  "job": {
    "jobId": "job-1773776138124-19q1j2l",
    "status": "completed",
    "report": {
      "url": "https://thehill.com",
      "articles": [
        {
          "url": "https://thehill.com/article/1",
          "player_detected": true,
          "can_play_video": false
        }
      ],
      "results": {
        "playable_count": 0,
        "total_tested": 3,
        "has_cloudflare": false,
        "has_perimeterx": true
      },
      "finalStatus": "partial"
    }
  }
}
```

---

### GET /api/jobs/status
**Get status of all active jobs (simple)**

**Response**:
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job-1773776138124-19q1j2l",
      "status": "running",
      "currentStep": "Checking player detection...",
      "createdAt": "2026-03-17T19:35:38Z"
    }
  ]
}
```

---

## Reports API

### GET /api/reports/[jobId]
**Get full test report for a job**

**Response**:
```json
{
  "success": true,
  "report": {
    "jobId": "job-1773776138124-19q1j2l",
    "domain": "thehill.com",
    "testDate": "2026-03-17T19:35:38Z",
    "articles": [
      {
        "url": "https://thehill.com/article/path",
        "discovered_via": "sitemap",
        "player_detected": true,
        "player_type": "hls.js",
        "can_play": true,
        "has_cloudflare": false,
        "has_perimeterx": true,
        "screenshot_url": "https://qa-agents-reports-prod.s3.amazonaws.com/...",
        "error": null
      }
    ],
    "summary": {
      "total_articles": 3,
      "articles_with_player": 2,
      "playable_articles": 1,
      "accuracy": 33.33,
      "status": "partial"
    }
  }
}
```

---

### GET /api/reports/summary
**Get aggregated statistics across all jobs**

**Response**:
```json
{
  "success": true,
  "summary": {
    "total_jobs": 20,
    "completed": 15,
    "failed": 3,
    "partial": 2,
    "avg_accuracy": 67.5,
    "domains_tested": [
      {
        "domain": "thehill.com",
        "test_count": 5,
        "success_rate": 40
      }
    ]
  }
}
```

---

### GET /api/reports/normalized
**Get all reports in standardized format**

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | number | 50 | Max reports to return |
| `offset` | number | 0 | Pagination offset |

**Response**:
```json
{
  "success": true,
  "reports": [
    {
      "jobId": "...",
      "domain": "thehill.com",
      "status": "pass|fail|partial",
      "playable_count": 2,
      "total_tested": 3
    }
  ],
  "total": 20
}
```

---

## Agents API

### GET /api/agents
**List available agents and skills**

**Response**:
```json
{
  "success": true,
  "agents": [
    {
      "id": "cognitive-supervisor",
      "name": "Cognitive Supervisor",
      "type": "LangGraph State Machine",
      "skills": [
        "discover_articles",
        "detect_player",
        "test_player",
        "bypass_cloudflare",
        "bypass_perimeterx",
        "dismiss_popups",
        "take_screenshot"
      ]
    }
  ]
}
```

---

### GET /api/agents/telemetry
**Get real-time telemetry data (for dashboard)**

**Response**:
```json
{
  "success": true,
  "telemetry": {
    "active_jobs": 1,
    "queued_jobs": 0,
    "specialists": {
      "senior_engineer": 12,
      "discovery": 5,
      "detection": 8,
      "functional": 10
    },
    "swarm_status": "nominal",
    "anomaly_density": 0.02,
    "nodes": {
      "orchestrator": { "status": "idle", "payloads": 3 },
      "discovery": { "status": "idle", "payloads": 2 },
      "detection": { "status": "idle", "payloads": 2 },
      "functional": { "status": "idle", "payloads": 0 }
    }
  }
}
```

---

## Health & Internal APIs

### GET /api/health
**System health check**

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-18T01:07:38Z",
  "uptime": 3600,
  "supabase": "connected",
  "s3": "connected"
}
```

---

### GET /api/screenshots
**List all captured screenshots**

**Query Parameters**:
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `jobId` | string | - | Filter by job |
| `limit` | number | 50 | Max results |

**Response**:
```json
{
  "success": true,
  "screenshots": [
    {
      "filename": "job-xxx_article-1_step-detect.png",
      "jobId": "job-xxx",
      "url": "https://qa-agents-reports-prod.s3.amazonaws.com/...",
      "timestamp": "2026-03-17T19:35:50Z"
    }
  ],
  "count": 5
}
```

---

### GET /api/screenshots/local/[filename]
**Download screenshot from local storage**

**Response**: Image file (PNG)

---

### GET /api/internal/cloudflare-discovery
**Internal: Test Cloudflare detection**

Used by dashboard to test domain protection detection.

**Query Parameters**:
| Param | Type | Required |
|-------|------|----------|
| `domain` | string | Yes |

**Response**:
```json
{
  "has_cloudflare": false,
  "has_challenge": false,
  "cf_clearance": false
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Missing target URL/Domain"
}
```

**Common Error Codes**:

| Status | Error | Fix |
|--------|-------|-----|
| 400 | Missing target URL | Add `target` param |
| 400 | Invalid type | Use "domain" or "url" |
| 404 | Job not found | Check jobId spelling |
| 500 | Internal error | Check PM2 logs |
| 500 | Supabase connection failed | EC2 network issue |

---

## Rate Limits

No hard rate limits, but:
- Max 10 concurrent jobs
- Job timeout: 10 minutes
- Screenshot size: max 5MB each

---

## Example Workflows

### Workflow 1: Submit job and check results

```bash
# 1. Submit job
JOB=$(curl -s -X POST http://100.54.233.117:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"domain","target":"thehill.com"}' \
  | jq -r '.jobId')

echo "Job ID: $JOB"

# 2. Wait for completion (poll every 5 seconds)
while true; do
  STATUS=$(curl -s http://100.54.233.117:9002/api/jobs/$JOB | jq -r '.job.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 5
done

# 3. Get results
curl -s http://100.54.233.117:9002/api/reports/$JOB | jq '.report'
```

### Workflow 2: Get all completed jobs

```bash
curl -s http://100.54.233.117:9002/api/jobs \
  | jq '.jobs[] | select(.status == "completed")'
```

### Workflow 3: Export test data to CSV

```bash
curl -s http://100.54.233.117:9002/api/reports/normalized \
  | jq -r '.reports[] | [.jobId, .domain, .status, .playable_count, .total_tested] | @csv'
```

---

## WebSocket Events (Dashboard)

The dashboard listens to real-time events via event stream:

**Available Events**:
- `job:queued` - Job submitted
- `job:started` - Execution began
- `job:progress` - Specialist updated
- `job:completed` - Test finished
- `job:failed` - Error occurred
- `telemetry:update` - Metrics changed

These are published to the mission control registry in real-time.
