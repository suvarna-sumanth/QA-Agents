# Report Normalization & Dashboard Schema

## Overview

The report normalizer converts raw agent reports into a consistent, dashboard-friendly format that:

- Standardizes timestamps and durations
- Adds computed fields (pass rates, status labels)
- Normalizes nested step structures
- Provides filtering and aggregation utilities

## Architecture

```
Raw Report (from agent.runJob())
         ↓
Report Normalizer (reportNormalizer.ts)
         ↓
Normalized Report (ready for dashboard)
         ↓
Report Adapter (reportAdapter.ts)
         ↓
API Response (formatted for frontend)
```

## Schema Transformations

### Input: RawReport (from Agent)

```typescript
{
  jobId: string;
  agentId: string;
  type: 'domain' | 'url';
  target: string;
  timestamp: ISO8601;
  overallStatus: 'pass' | 'partial' | 'fail' | 'error' | 'skip';
  summary: {
    passed: number;
    partial: number;
    failed: number;
    skipped: number;
    total: number;
  };
  steps: [
    {
      name: string;
      status: 'pass' | 'fail' | 'skip' | 'partial';
      message: string;
      duration: milliseconds;
      screenshot?: string;
      nestedSteps?: Step[];
    }
  ];
  metadata?: any;
  duration?: milliseconds;
}
```

### Output: NormalizedReport

```typescript
{
  // Identifiers
  jobId: string;
  agentId: string;

  // Execution info
  type: 'domain' | 'url';
  target: string;
  timestamp: ISO8601;
  startedAt: ISO8601;
  completedAt: ISO8601;

  // Status with display info
  overallStatus: 'pass' | 'partial' | 'fail' | 'error' | 'skip';
  statusLabel: 'Passed' | 'Partial' | 'Failed' | 'Error' | 'Skipped';
  statusColor: 'green' | 'yellow' | 'red' | 'gray';

  // Metrics
  duration: milliseconds;
  durationSeconds: number;
  durationLabel: '2s' | '1m 30s'; // Human-readable

  // Results summary with computed passRate
  summary: {
    passed: number;
    partial: number;
    failed: number;
    skipped: number;
    total: number;
    passRate: 0-100; // NEW: computed percentage
  };

  // Normalized steps
  steps: NormalizedStep[];

  // Metadata
  agentName: string;
  agentVersion: string;
  capabilities: string[];
  metadata: Record<string, any>;
}
```

### Step Normalization

Each step gets:
- Unique ID for React keys
- Computed duration label
- Status color mapping
- Normalized nested steps

## API Endpoints

### GET /api/reports/normalized

Get all completed reports in normalized format.

**Query Parameters:**
- `agent=<agentId>` - Filter by agent
- `status=<status>` - Filter by status (pass, fail, partial, skip, error)
- `limit=<n>` - Limit results (default 50, max 100)

**Example:**
```bash
GET /api/reports/normalized?agent=agent-shivani&status=fail&limit=10
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "totalCount": 25,
  "limit": 10,
  "reports": [
    {
      "jobId": "job-001",
      "agentId": "agent-shivani",
      "target": "https://example.com/article-1",
      "type": "url",
      "timestamp": "2026-03-12T12:00:00Z",
      "overallStatus": "pass",
      "statusLabel": "Passed",
      "durationLabel": "1m 30s",
      "summary": {
        "passed": 10,
        "partial": 1,
        "failed": 0,
        "skipped": 0,
        "total": 11,
        "passRate": 90.9
      }
    }
  ]
}
```

### GET /api/reports/[jobId]

Get a specific normalized report with full details including all steps.

**Example:**
```bash
GET /api/reports/job-001
```

**Response:**
```json
{
  "success": true,
  "report": {
    "jobId": "job-001",
    "agentId": "agent-shivani",
    "type": "url",
    "target": "https://example.com/article-1",
    "timestamp": "2026-03-12T12:00:00Z",
    "overallStatus": "pass",
    "statusLabel": "Passed",
    "statusColor": "green",
    "duration": 90000,
    "durationSeconds": 90,
    "durationLabel": "1m 30s",
    "summary": {
      "passed": 10,
      "partial": 0,
      "failed": 0,
      "skipped": 1,
      "total": 11,
      "passRate": 90.9
    },
    "steps": [
      {
        "id": "step-0",
        "name": "Page Load",
        "status": "pass",
        "message": "Page loaded successfully",
        "duration": 2500,
        "durationMs": 2500,
        "screenshotUrl": "s3://bucket/job-001/step-0.png"
      },
      {
        "id": "step-1",
        "name": "Player Detection",
        "status": "pass",
        "message": "Player detected",
        "duration": 1500,
        "durationMs": 1500,
        "screenshotUrl": "s3://bucket/job-001/step-1.png",
        "nestedSteps": [
          {
            "id": "step-1-0",
            "name": "DOM query",
            "status": "pass",
            "message": "Found player element",
            "duration": 100,
            "durationMs": 100
          }
        ]
      }
    ],
    "agentName": "Shivani QA Agent",
    "agentVersion": "1.0.0",
    "capabilities": [
      "detectInstareadPlayer",
      "testAudioPlayer",
      "captureScreenshots",
      "bypassChallenges"
    ]
  }
}
```

### GET /api/reports/summary

Get dashboard-level summary metrics across all reports.

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalRuns": 42,
    "successRate": 85,
    "avgRunTime": "1m 20s",
    "recentRuns": [
      {
        "jobId": "job-042",
        "target": "example.com",
        "status": "Passed",
        "timestamp": "3/12/2026, 12:05 PM"
      }
    ]
  }
}
```

## Utility Functions

### normalizeReport(rawReport)

Convert a single raw report to normalized format.

```typescript
import { normalizeReport } from '@/lib/reportNormalizer';

const normalized = normalizeReport(rawReport);
```

### normalizeReports(rawReports)

Batch normalize multiple reports.

```typescript
import { normalizeReports } from '@/lib/reportNormalizer';

const normalized = normalizeReports([report1, report2, ...]);
```

### groupReportsByAgent(reports)

Group normalized reports by agent ID.

```typescript
import { groupReportsByAgent } from '@/lib/reportNormalizer';

const byAgent = groupReportsByAgent(reports);
// { 'agent-shivani': [...], 'agent-perf': [...] }
```

### filterReportsByStatus(reports, status)

Filter reports by overall status.

```typescript
import { filterReportsByStatus } from '@/lib/reportNormalizer';

const failedReports = filterReportsByStatus(reports, 'fail');
```

### analyzeStepPerformance(reports)

Extract step-level metrics across all reports.

```typescript
import { analyzeStepPerformance } from '@/lib/reportAdapter';

const stepAnalysis = analyzeStepPerformance(reports);
// [
//   {
//     stepName: 'Page Load',
//     passRate: 95,
//     totalRuns: 42,
//     passedRuns: 40,
//     failedRuns: 2,
//     avgDuration: 2345
//   }
// ]
```

## Frontend Integration

### React Example: Reports List

```typescript
import { adaptJobsToNormalizedReports } from '@/lib/reportAdapter';

export function ReportsList({ jobs }) {
  const reports = adaptJobsToNormalizedReports(jobs);

  return (
    <table>
      <thead>
        <tr>
          <th>Target</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Pass Rate</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => (
          <tr key={report.jobId}>
            <td>{new URL(report.target).hostname}</td>
            <td>
              <span style={{ color: report.statusColor }}>
                {report.statusLabel}
              </span>
            </td>
            <td>{report.durationLabel}</td>
            <td>{Math.round(report.summary.passRate)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### React Example: Report Details

```typescript
export function ReportDetails({ report }) {
  return (
    <div>
      <h1>{new URL(report.target).hostname}</h1>
      <p>Status: {report.statusLabel}</p>
      <p>Duration: {report.durationLabel}</p>
      <p>Pass Rate: {Math.round(report.summary.passRate)}%</p>

      <h2>Steps</h2>
      {report.steps.map((step) => (
        <div key={step.id}>
          <strong>{step.name}</strong>
          <span style={{ color: getStatusColor(step.status) }}>
            {step.status}
          </span>
          <p>{step.message}</p>
          {step.screenshotUrl && (
            <img src={step.screenshotUrl} alt={step.name} />
          )}
        </div>
      ))}
    </div>
  );
}
```

## Status Color Mapping

- `pass` → Green (`#22c55e`)
- `partial` → Yellow (`#eab308`)
- `fail` → Red (`#ef4444`)
- `error` → Red (`#dc2626`)
- `skip` → Gray (`#6b7280`)

## Next Steps

1. **Dashboard Components** (`scaffold-dashboard`)
   - Build React components using normalized reports
   - Implement filters and sorting
   - Display charts for trends

2. **S3 Integration** (`implement-s3-storage`)
   - Store screenshots in S3
   - Return signed URLs in normalized reports
   - Add thumbnail generation

3. **Database** (future)
   - Index reports in SQLite/Postgres
   - Query by filters more efficiently
   - Archive old reports
