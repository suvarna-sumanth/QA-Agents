# S3 Migration Plan: From Filesystem to Cloud Storage

## Executive Summary

This document outlines the migration strategy from local filesystem storage (reports and screenshots) to Amazon S3, enabling:
- **Scalability**: No local disk constraints
- **Durability**: Replicated storage with automatic backups
- **Accessibility**: Remote access to artifacts
- **Cost efficiency**: Pay-per-use pricing
- **Integration**: Dashboard can serve signed URLs directly

## Current State

### Filesystem Storage

**Reports:**
- Location: `agents/shivani/reports/`
- Format: JSON files
- Naming: `report_${timestamp}.json`
- Retention: Indefinite (manual cleanup)

**Screenshots:**
- Location: `agents/shivani/screenshots/`
- Format: PNG images
- Naming: `shivani_${urlSlug}_${timestamp}.png`
- Retention: Indefinite (manual cleanup)

**Issue:** Files are lost on container restart, not accessible remotely, and accumulate disk space.

## Target Architecture

```
┌─────────────────────────────────────────┐
│     Agent Shivani (src/)                │
├─────────────────────────────────────────┤
│  test-player.js                         │
│  detect.js                              │
│  AgentShivani.js (calls storage)        │
└──────────────┬──────────────────────────┘
               │
               │ Calls
               ▼
┌─────────────────────────────────────────┐
│     Storage Module (new)                │
├─────────────────────────────────────────┤
│  save Report(agentId, jobId, json)      │
│  save Screenshot(agentId, jobId, path)  │
│  get Report(s3Key)                      │
│  get SignedUrl(s3Key, duration)         │
└──────────────┬──────────────────────────┘
               │
               │ AWS SDK v3
               ▼
┌─────────────────────────────────────────┐
│     Amazon S3                           │
├─────────────────────────────────────────┤
│  /qa-agents/shivani/{jobId}/report.json │
│  /qa-agents/shivani/{jobId}/screenshots │
│  ├─ step-0.png                          │
│  ├─ step-1.png                          │
│  └─ ...                                 │
└─────────────────────────────────────────┘
```

## S3 Bucket Structure

### Bucket Configuration

**Name:** `qa-agents-reports-<env>` (e.g., `qa-agents-reports-prod`)
**Region:** us-east-1 (configurable via env)
**Versioning:** Enabled (optional)
**Server-Side Encryption:** AES-256 (automatic)
**Public Access:** Block all (private)
**Lifecycle:** Delete after 90 days (configurable)

### Key Structure

```
s3://qa-agents-reports-prod/
├── shivani/
│   └── {agentId}/
│       └── {jobId}/
│           ├── report.json
│           └── screenshots/
│               ├── step-0.png
│               ├── step-1.png
│               └── ...
│
└── [future-agent]/
    └── ...
```

**Examples:**
```
s3://qa-agents-reports-prod/shivani/agent-shivani/job-1705000000000-abc123/report.json
s3://qa-agents-reports-prod/shivani/agent-shivani/job-1705000000000-abc123/screenshots/step-0.png
s3://qa-agents-reports-prod/shivani/agent-shivani/job-1705000000000-abc123/screenshots/step-1.png
```

## Migration Phases

### Phase 1: Preparation (Immediate)

**Goal:** Set up infrastructure and storage module without changing agent behavior.

**Tasks:**

1. **Create S3 bucket**
   ```bash
   # Using AWS CLI or Console
   aws s3 mb s3://qa-agents-reports-prod --region us-east-1
   aws s3api put-bucket-lifecycle-configuration \
     --bucket qa-agents-reports-prod \
     --lifecycle-configuration file://lifecycle.json
   ```

2. **Create IAM role/user** (if not using EC2 IAM role)
   ```bash
   # Policy: S3 full access to qa-agents-reports-*
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::qa-agents-reports-*/*"
       }
     ]
   }
   ```

3. **Set environment variables**
   ```bash
   # .env.local or CI/CD secrets
   S3_BUCKET=qa-agents-reports-prod
   S3_REGION=us-east-1
   S3_PREFIX=shivani/
   
   # Optional: AWS credentials (use IAM role when on AWS)
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

### Phase 2: Storage Module Implementation

**Goal:** Create a reusable storage abstraction for S3.

**Files to Create:**
- `src/lib/storage.ts` - Main storage module
- `src/lib/s3Client.ts` - AWS SDK v3 configuration
- `src/lib/storage.test.ts` - Unit tests

**Storage Module API:**

```typescript
// Save report to S3
await storage.saveReport(agentId, jobId, reportJson);
// Returns: { key: 's3://...', url: 'https://...' }

// Save screenshot to S3
await storage.saveScreenshot(agentId, jobId, filePath, stepNumber);
// Returns: { key: 's3://...', url: 'https://...' }

// Retrieve report from S3
const report = await storage.getReport(agentId, jobId);

// Get signed URL for dashboard
const url = await storage.getSignedUrl(s3Key, expirationSeconds);

// List reports for agent
const reports = await storage.listReports(agentId, limit);
```

### Phase 3: AgentShivani Integration

**Goal:** Update AgentShivani to use storage module instead of filesystem.

**Changes in `test-player.js`:**
1. Replace filesystem writes with `storage.saveReport()`
2. Replace screenshot file writes with `storage.saveScreenshot()`
3. Update report.steps[].screenshot to S3 path/URL

**Changes in `AgentShivani.js`:**
1. After `agent.runJob()` completes, call `storage.saveReport()`
2. In callbacks, when screenshots are captured, call `storage.saveScreenshot()`

### Phase 4: API Integration

**Goal:** Update API routes to use normalized storage paths.

**Changes in `/api/jobs/route.ts`:**
1. After job completes, ensure report is in S3
2. Return S3 keys/URLs in job response

**Changes in `/api/reports/[jobId]/route.ts`:**
1. Retrieve report from S3 instead of memory
2. Generate signed URLs for screenshots

### Phase 5: Dashboard Integration

**Goal:** Dashboard displays images and data from S3.

**Changes in dashboard components:**
1. Update screenshot img src to use signed URLs
2. Display S3 storage information
3. No local file system access needed

### Phase 6: Cleanup & Rollback

**Goal:** Remove local filesystem storage, establish rollback procedure.

**Cleanup:**
1. Archive existing reports/screenshots
2. Delete local filesystem storage directories
3. Update .gitignore to exclude screenshot dirs

**Rollback Procedure:**
1. Keep local filesystem writes as fallback
2. Log all S3 errors for monitoring
3. Document manual restore procedure if needed

## Implementation Details

### Storage Module (`src/lib/storage.ts`)

```typescript
interface StorageConfig {
  bucket: string;
  region: string;
  prefix: string;
}

class StorageService {
  // Core methods
  async saveReport(agentId, jobId, json): Promise<{ key: string; url: string }>;
  async saveScreenshot(agentId, jobId, filePath, stepNum): Promise<{ key: string; url: string }>;
  async getReport(agentId, jobId): Promise<any>;
  async getSignedUrl(s3Key, expirationSeconds): Promise<string>;
  async listReports(agentId, limit, pageToken): Promise<Report[]>;
  
  // Helper methods
  private getReportKey(agentId, jobId): string;
  private getScreenshotKey(agentId, jobId, stepNum): string;
  private uploadToS3(key, data, contentType): Promise<void>;
  private downloadFromS3(key): Promise<any>;
}

// Singleton export
export const storage = new StorageService();
```

### AWS SDK v3 Configuration

Uses `@aws-sdk/client-s3` for slim bundle size:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

## Environment Variables

```bash
# S3 Configuration
S3_BUCKET=qa-agents-reports-prod
S3_REGION=us-east-1
S3_PREFIX=shivani/
S3_SIGNED_URL_EXPIRATION=3600  # 1 hour

# AWS Credentials (use IAM role when possible)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Optional: LocalStack for local development
LOCALSTACK_ENDPOINT=http://localhost:4566
```

## Testing Strategy

### Unit Tests

```typescript
// Test saveReport
// Test saveScreenshot
// Test getReport
// Test getSignedUrl
// Test listReports
// Test error handling
```

### Integration Tests

```bash
# With LocalStack (local S3 emulation)
docker-compose up localstack
npm run test:integration

# With real AWS (use IAM test role)
AWS_REGION=us-east-1 npm run test:integration:aws
```

### End-to-End Testing

```bash
# Submit job via API
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-shivani", "type": "url", "target": "https://..."}'

# Verify report in S3
aws s3 ls s3://qa-agents-reports-prod/shivani/agent-shivani/job-*/report.json

# Check dashboard displays screenshots
open http://localhost:3000/qa-dashboard/runs/{jobId}
```

## Cost Estimation

### AWS S3 Pricing (us-east-1)

**Storage:** $0.023 per GB/month
**Requests:** $0.0004 per 1,000 PUT/COPY/POST/LIST requests
**Data Transfer:** No charge for egress within AWS (CloudFront: $0.085 per GB)

**Estimations (100 jobs/day, 2 years):**
```
Storage:
- 100 jobs/day × 30 days = 3,000 jobs/month
- 10 reports (100 KB avg) = 1 GB/month
- 300 screenshots (50 KB avg) = 15 GB/month
- Monthly: 16 GB × $0.023 = $0.37
- Annual: $4.44

Requests:
- Saves: 3,000 reports × 12 + 90,000 screenshots × 12
- = 1,116,000 PUT requests/year
- Cost: $0.45/year

Total Annual: ~$5/year
```

## Optional: Database Index Layer

For high-volume scenarios (1000+ jobs/day), consider adding a database index:

### Schema

```sql
CREATE TABLE job_reports (
  id UUID PRIMARY KEY,
  job_id VARCHAR(255),
  agent_id VARCHAR(255),
  type VARCHAR(50),
  target VARCHAR(2048),
  status VARCHAR(50),
  timestamp TIMESTAMP,
  s3_key VARCHAR(2048),
  passed INT,
  failed INT,
  total INT,
  duration INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (job_id),
  INDEX (agent_id),
  INDEX (timestamp DESC),
  INDEX (status)
);
```

### Benefits

- Fast queries without S3 scan
- Full-text search on report content
- Analytics and aggregation
- Soft deletes with archive flag

### Trade-offs

- Additional infrastructure (SQLite, Postgres, or DynamoDB)
- Sync complexity between S3 and DB
- Eventual consistency model

**Recommendation:** Start without DB, add if performance becomes an issue.

## Rollback Procedure

If issues occur during or after migration:

1. **Immediate:** Enable local filesystem fallback
   ```typescript
   const useS3 = process.env.USE_S3 === 'true';
   if (useS3) {
     await storage.saveReport(...);
   } else {
     fs.writeFileSync(...);
   }
   ```

2. **Retrieve data:** If S3 keys are known, download reports
   ```bash
   aws s3 sync s3://qa-agents-reports-prod ./reports-backup/
   ```

3. **Restore:** Move reports back to local filesystem
4. **Monitor:** Check logs for errors before re-enabling S3

## Security Considerations

### Access Control

- **Bucket policy:** Block public access
- **IAM role:** Least privilege (S3 only)
- **KMS encryption:** Use server-side encryption (automatic)
- **VPC endpoint:** For private AWS access

### Data Protection

- **Signed URLs:** Expire after 1 hour
- **No direct URLs:** Always use signed URLs from API
- **Audit logging:** Enable CloudTrail for access tracking
- **Compliance:** S3 meets SOC2, HIPAA, PCI-DSS

### Environment Variables

- **Never commit credentials:** Use `.env.local` (gitignored)
- **Use IAM roles:** EC2/ECS/Lambda should use roles
- **CI/CD secrets:** GitHub/GitLab secret management

## Timeline

```
Week 1:  Phase 1 (Infrastructure) + Phase 2 (Storage module)
Week 2:  Phase 3 (AgentShivani integration) + Phase 4 (API)
Week 3:  Phase 5 (Dashboard) + Testing
Week 4:  Phase 6 (Cleanup & monitoring)
```

## Success Criteria

- [ ] S3 bucket created and configured
- [ ] Storage module fully tested
- [ ] AgentShivani saves reports to S3
- [ ] AgentShivani saves screenshots to S3
- [ ] API returns S3 URLs for screenshots
- [ ] Dashboard displays S3-hosted images
- [ ] No local filesystem writes
- [ ] Signed URLs work and expire correctly
- [ ] Error handling tested with S3 failures
- [ ] Monitoring and logs configured

## Monitoring & Alerts

### CloudWatch Metrics to Monitor

- S3 PutObject errors
- S3 GetObject latency
- Storage module exceptions
- Signed URL generation time

### Alarms

```yaml
- S3PutErrors > 5/minute
- S3Latency > 5000ms p99
- StorageModuleExceptions > 1/hour
- S3BucketSize > 100GB (warning)
```

## Next Steps

1. Create S3 bucket (AWS Console or Terraform)
2. Set up IAM permissions
3. Implement storage module with comprehensive tests
4. Integrate with AgentShivani
5. Update API routes
6. Test end-to-end
7. Deploy to staging
8. Monitor for 1 week
9. Deploy to production
10. Archive/delete local filesystem storage

See `IMPLEMENT_S3_STORAGE.md` for implementation details.
