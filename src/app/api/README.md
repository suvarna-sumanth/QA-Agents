# QA Agent API

Minimal HTTP API for submitting jobs, querying agent capabilities, and retrieving results.

## Endpoints

### Health Check

```
GET /api/health
```

Check if the API service is running.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-03-12T...",
  "version": "1.0.0"
}
```

### List Agents

```
GET /api/agents
```

List all registered agents and their capabilities.

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

### Submit Job

```
POST /api/jobs
```

Submit a new job to be executed by an agent.

**Request Body:**
```json
{
  "agentId": "agent-shivani",
  "type": "url",
  "target": "https://example.com/article",
  "config": {
    "maxArticles": 10
  }
}
```

**Parameters:**
- `agentId` (string, required): ID of the agent to run
- `type` (string, required): Job type - "domain" or "url"
- `target` (string, required): Domain or URL to test
- `config` (object, optional): Agent-specific configuration

**Response (202 Accepted):**
```json
{
  "success": true,
  "jobId": "job-1705000000000-abc123",
  "status": "queued"
}
```

### List Jobs

```
GET /api/jobs
```

List recent jobs (last 20).

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job-1705000000000-abc123",
      "agentId": "agent-shivani",
      "type": "url",
      "target": "https://example.com/article",
      "status": "completed",
      "createdAt": "2026-03-12T...",
      "completedAt": "2026-03-12T...",
      "report": {
        "jobId": "job-1705000000000-abc123",
        "agentId": "agent-shivani",
        "type": "url",
        "target": "https://example.com/article",
        "timestamp": "2026-03-12T...",
        "overallStatus": "pass",
        "summary": {
          "passed": 10,
          "partial": 0,
          "failed": 0,
          "skipped": 0,
          "total": 10
        },
        "steps": [
          {
            "name": "Page Load",
            "status": "pass",
            "message": "Page loaded successfully",
            "duration": 1500
          }
        ],
        "metadata": {},
        "duration": 15000
      }
    }
  ],
  "count": 1
}
```

### Get Job Status/Report

```
GET /api/jobs/:jobId
```

Retrieve the status and (if completed) report for a specific job.

**Response:**
```json
{
  "success": true,
  "job": {
    "jobId": "job-1705000000000-abc123",
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://example.com/article",
    "status": "completed",
    "createdAt": "2026-03-12T...",
    "completedAt": "2026-03-12T...",
    "report": { ... }
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common error codes:**
- `400` - Bad request (missing/invalid parameters)
- `404` - Resource not found (agent or job not found)
- `500` - Server error

## Job States

Jobs transition through the following states:

1. **queued** - Job has been submitted and is waiting to run
2. **running** - Agent is currently processing the job
3. **completed** - Job finished successfully (check `report.overallStatus` for pass/fail)
4. **failed** - Job encountered an error and could not complete

## Usage Examples

### Test a single URL

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://example.com/article"
  }'

# Response:
# {"success":true,"jobId":"job-1705000000000-abc123","status":"queued"}
```

### Test a domain with custom config

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-shivani",
    "type": "domain",
    "target": "https://example.com",
    "config": {"maxArticles": 5}
  }'
```

### Check job status

```bash
curl http://localhost:3000/api/jobs/job-1705000000000-abc123

# Response:
# {"success":true,"job":{...}}
```

### Get all agents

```bash
curl http://localhost:3000/api/agents

# Response:
# {"success":true,"agents":[...],"count":1}
```

## Implementation Notes

### MVP Job Queue

Currently, the API uses an in-memory job registry. Jobs are executed directly in the request handler with async fire-and-forget.

**Limitations:**
- Jobs are lost on server restart
- No proper queueing/concurrency control
- Single-threaded execution

**Future improvements:**
- Redis-based queue (BullMQ)
- Proper job persistence
- Worker pool for concurrent execution
- Webhook callbacks when jobs complete

### Storage

Job reports are currently held in memory. See the `implement-s3-storage` todo for cloud persistence.

## Architecture

```
Client
  |
  v
Next.js API Routes (/api/*)
  |
  +---> Agent Registry (lists agents)
  |
  +---> Job Registry (in-memory, MVP)
  |       |
  |       v
  +---> Agent.runJob() (executes synchronously)
        |
        v
      Report (in memory, S3 in future)
```

## Next: S3 Storage Integration

When implementing `implement-s3-storage`:

1. Create a `storage.js` module with S3 client
2. Modify job handler to call `storage.saveReport()` and `storage.saveScreenshot()`
3. Return S3 URLs/keys in job response
4. Create `normalize-reports` adapter for dashboard consumption
