---
name: Agno QA-Agents Phase 4 Deployment Guide
description: Complete guide for deploying the new Agno system to production
type: deployment
---

# Agno QA-Agents Phase 4: Deployment Guide

**Version**: 1.0
**Last Updated**: March 18, 2026
**Status**: Ready for Production Deployment

---

## Executive Summary

This guide covers the deployment of Phase 4 (Integration & API) of the Agno QA-Agents system. Phase 4 integrates the orchestration layer (Phases 1-3) with the existing API through the LegacyAPIAdapter, adding monitoring and observability while maintaining 100% backward compatibility.

**Key Metrics**:
- ✅ Zero breaking changes
- ✅ 80%+ test coverage
- ✅ Performance: ≤10 minutes per job
- ✅ Backward compatible API
- ✅ Monitoring and metrics in place

---

## Pre-Deployment Checklist

### Code Quality Gate
- [ ] All unit tests passing (npm run test:unit)
- [ ] All integration tests passing (npm run test:integration)
- [ ] Code coverage ≥80% (npm run coverage)
- [ ] No linting errors (npm run lint)
- [ ] No circular dependencies
- [ ] All TypeScript compilation succeeds

### Functional Gate
- [ ] LegacyAPIAdapter implemented and tested
- [ ] Metrics tracking operational
- [ ] Logger structured logging operational
- [ ] API route updated with adapter integration
- [ ] Backward compatibility verified with old API format
- [ ] New agent system functional with new API format

### Performance Gate
- [ ] Single job execution ≤10 minutes
- [ ] Average execution time ≤8 minutes
- [ ] Memory usage stable (<100MB per job)
- [ ] No performance regressions
- [ ] Parallel phases executing correctly

### Security Gate
- [ ] No hardcoded secrets in code
- [ ] API error messages don't expose internals
- [ ] Input validation in place
- [ ] S3 uploads use secure credentials
- [ ] Database connections use secure credentials

### Documentation Gate
- [ ] API documentation updated
- [ ] Deployment guide complete
- [ ] Rollback procedure documented
- [ ] Monitoring guide complete

---

## Pre-Deployment Environment Setup

### 1. Staging Environment

Create a staging environment that mirrors production:

```bash
# 1. Clone production database (if using Supabase)
# Use Supabase backup/restore feature

# 2. Copy environment variables to staging
cp .env.production .env.staging

# 3. Update staging-specific values
# SUPABASE_URL=<staging-db-url>
# SUPABASE_KEY=<staging-db-key>
# S3_BUCKET=<staging-bucket>
# LOG_LEVEL=debug (for staging)

# 4. Deploy to staging
npm run deploy:staging

# 5. Verify staging environment
npm run test:staging
npm run health-check:staging
```

### 2. Pre-Deployment Tests

Run full test suite against staging:

```bash
# Unit tests
npm run test:unit

# Integration tests (against staging)
npm run test:integration -- --env=staging

# Performance benchmarks
npm run test:perf -- --env=staging

# Smoke tests (basic functionality)
npm run test:smoke -- --env=staging
```

### 3. Monitoring Setup

Configure monitoring before deployment:

```bash
# Setup CloudWatch/Datadog metrics
npm run setup:monitoring

# Configure alerting thresholds
# - Error rate > 5%
# - P95 latency > 30s
# - Execution time > 15 minutes
# - Memory usage > 500MB

# Setup log aggregation
# - Direct logs to CloudWatch/Datadog
# - Setup filters for critical errors
# - Create dashboards

# Setup uptime monitoring
# - Health check endpoint: GET /api/health
# - Check frequency: every 60 seconds
# - Alert on 3 consecutive failures
```

---

## Deployment Procedure

### Phase 1: Canary Deployment (5% Traffic)

Canary deployment minimizes risk by rolling out to a small percentage of users first.

```bash
# 1. Merge Phase 4 code to main branch
git checkout main
git merge phase4/integration --no-ff

# 2. Tag release
git tag -a v4.0.0 -m "Phase 4: Integration & API"

# 3. Deploy canary (5% traffic)
npm run deploy:canary -- --percentage=5

# 4. Monitor for 30 minutes
# - Check error rates
# - Check response times
# - Check logs for errors
# - Monitor Metrics class usage

# 5. If stable, increase to 25%
npm run deploy:canary -- --percentage=25

# 6. If stable, increase to 50%
npm run deploy:canary -- --percentage=50

# 7. If stable, promote to full deployment
npm run deploy:production
```

### Phase 2: Full Production Deployment

Once canary is stable:

```bash
# 1. Final pre-flight checks
npm run health-check:production

# 2. Deploy to all production instances
npm run deploy:production -- --instances=all

# 3. Verify all instances are healthy
# Check each instance health endpoint
for instance in $(npm run list:instances); do
  curl https://$instance/api/health
done

# 4. Monitor closely for first 2 hours
# - Error rate should be <1%
# - P95 latency should be <30s
# - Execution time should be <10min
```

### Phase 3: Post-Deployment Validation

Validate deployment success:

```bash
# 1. Run smoke tests against production
npm run test:smoke -- --env=production

# 2. Test backward compatibility with old API
curl -X POST https://api.example.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-job-123",
    "url": "https://example.com",
    "depth": 2,
    "options": {}
  }'

# 3. Test new API format
curl -X POST https://api.example.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "qa-parent",
    "type": "domain",
    "target": "https://example.com",
    "config": {}
  }'

# 4. Verify metrics are collected
# Check Metrics dashboard for job tracking

# 5. Verify logging is working
# Check logs for structured entries with jobId, phase

# 6. Run performance benchmark
npm run test:perf -- --env=production
```

---

## Monitoring During Deployment

### Key Metrics to Monitor

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Error Rate | <1% | >2% | >5% |
| P95 Latency | <30s | >45s | >60s |
| Execution Time | <8min | >10min | >15min |
| Memory Usage | <100MB | >200MB | >500MB |
| API Availability | 99.9% | 99% | <99% |
| Failed Deployments | 0 | N/A | Any |

### Monitoring Dashboards

Create dashboards to track:

1. **Overview Dashboard**
   - Total jobs executed
   - Success rate
   - Average execution time
   - Error rate

2. **Phase Dashboard**
   - Time spent per phase
   - Success rate per phase
   - Items processed per phase

3. **Error Dashboard**
   - Top error types
   - Error trends
   - Error distribution by phase

4. **Performance Dashboard**
   - Execution time distribution
   - Memory usage trends
   - Throughput (jobs/minute)

### Log Monitoring

Setup log filters:

```
# Critical errors
filter: level=ERROR AND jobId=*

# Slow jobs
filter: executionTime > 600000

# Adapter errors
filter: adapter=LegacyAPIAdapter AND level=ERROR

# Phase failures
filter: phase=* AND status=failed
```

---

## Rollback Procedure

### Immediate Rollback (If Critical Issues Found)

If critical issues are discovered within the first hour:

```bash
# 1. Stop accepting new jobs
npm run maintenance:on

# 2. Trigger immediate rollback
npm run deploy:rollback -- --version=v3.2.0

# 3. Verify previous version is running
npm run health-check:production

# 4. Investigate issue
# - Collect logs and metrics
# - Review changes
# - Identify root cause

# 5. Communicate with team
# - Post-mortem meeting
# - Update status page
```

### Gradual Rollback (If Issues Persist After 1 Hour)

```bash
# 1. Reduce canary to previous stable version
npm run deploy:canary -- --version=v3.2.0 --percentage=50

# 2. Monitor for stability
# If stable, proceed with rollback
npm run deploy:production -- --version=v3.2.0

# 3. If unstable, investigate further
# Determine if issue is in old version or integration
```

### Full Rollback Verification

After rolling back:

```bash
# 1. Verify all instances running old version
npm run list:versions

# 2. Run smoke tests
npm run test:smoke -- --env=production

# 3. Clear metrics from failed deployment
npm run metrics:clear

# 4. Monitor for 1 hour to ensure stability
# Check error rates, latency, etc.

# 5. Document lessons learned
# Create incident post-mortem
```

---

## Post-Deployment Monitoring

### First 24 Hours

Monitor closely for any issues:

- Every 15 minutes: Check error rates and latency
- Every hour: Review logs for errors
- Every 4 hours: Check job execution metrics
- Once per day: Review performance trends

### Ongoing Monitoring

After first 24 hours, establish normal operations:

- Daily: Review metrics dashboard
- Weekly: Review top errors
- Weekly: Performance trend analysis
- Monthly: Capacity planning review

### Key Questions to Answer

1. **Error Rate**: Is error rate < 1%?
2. **Performance**: Is execution time < 10 minutes?
3. **Compatibility**: Are old API calls still working?
4. **Metrics**: Are metrics being collected?
5. **Logging**: Are structured logs being created?

---

## Known Issues and Workarounds

### Issue 1: High Memory Usage on Long Crawls

**Symptom**: Memory usage exceeds 500MB on deep crawls

**Workaround**:
```javascript
// Reduce max articles in options
const job = {
  id: 'job-123',
  url: 'https://example.com',
  depth: 2,
  options: { maxArticles: 10 } // Limit articles
};
```

### Issue 2: Slow Phase Execution with Many Players

**Symptom**: Testing phase takes >20 minutes with many players

**Workaround**:
```javascript
// Add timeout option to limit testing time
const job = {
  id: 'job-123',
  url: 'https://example.com',
  depth: 1,
  options: { testTimeout: 30000 } // 30s per player
};
```

### Issue 3: S3 Upload Failures

**Symptom**: Evidence collection fails due to S3 issues

**Workaround**:
```bash
# Check S3 credentials
export AWS_ACCESS_KEY_ID=<key>
export AWS_SECRET_ACCESS_KEY=<secret>

# Verify S3 bucket is accessible
aws s3 ls s3://bucket-name/
```

---

## Communication Plan

### During Deployment

**T-0**: Pre-deployment announcement
```
We're deploying Phase 4 of the Agno system today.
This update adds monitoring and maintains full backward compatibility.
Expected duration: 15 minutes
Impact: No downtime expected
```

**T+5 minutes**: Deployment in progress
```
Deployment is in progress. Monitoring all systems.
```

**T+15 minutes**: Deployment complete
```
Deployment complete. All systems operational.
Monitoring for stability.
```

### If Rollback Needed

```
We've identified an issue with the new deployment and are rolling back
to the previous version. Service will be restored within 5 minutes.
We apologize for any inconvenience.
```

---

## Validation Scripts

### Health Check

```bash
#!/bin/bash
echo "Running health checks..."

# Check API endpoint
curl -X GET https://api.example.com/api/health
if [ $? -ne 0 ]; then
  echo "ERROR: API health check failed"
  exit 1
fi

# Check database connection
curl -X GET https://api.example.com/api/db-health
if [ $? -ne 0 ]; then
  echo "ERROR: Database health check failed"
  exit 1
fi

echo "All health checks passed"
```

### Backward Compatibility Check

```bash
#!/bin/bash
echo "Testing backward compatibility..."

# Test old API format
OLD_RESPONSE=$(curl -s -X POST https://api.example.com/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "url": "https://example.com",
    "depth": 1,
    "options": {}
  }')

echo "Old API Response: $OLD_RESPONSE"

# Check response contains expected fields
if echo "$OLD_RESPONSE" | grep -q '"jobId"'; then
  echo "✓ Backward compatibility confirmed"
else
  echo "✗ Backward compatibility check failed"
  exit 1
fi
```

---

## Troubleshooting

### Deployment Fails During npm install

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Retry deployment
npm run deploy:canary
```

### Metrics Not Being Collected

```javascript
// Check if Metrics class is being instantiated
import { Metrics } from './agents/core/monitoring/Metrics.js';
const m = new Metrics();
console.log('Metrics initialized:', m.getAggregates());
```

### Logging Not Showing Structured Format

```javascript
// Check Logger is being used correctly
import { Logger } from './agents/core/monitoring/Logger.js';
const logger = new Logger({ name: 'test', level: 'info' });
logger.info('Test message', { jobId: 'test-123' });
// Should output with timestamp, level, logger name, message, and context
```

### Old API Format Not Working

```bash
# Check LegacyAPIAdapter is exported
grep "LegacyAPIAdapter" agents/core/index.js

# Check API route is importing adapter
grep "LegacyAPIAdapter" src/app/api/jobs/route.ts

# Test with curl
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"id":"test","url":"https://example.com","depth":2,"options":{}}'
```

---

## Success Criteria

Deployment is considered successful if:

✅ All tests passing
✅ Error rate < 1%
✅ P95 latency < 30 seconds
✅ Execution time < 10 minutes
✅ Memory usage stable
✅ Backward compatibility verified
✅ Metrics being collected
✅ Logs are structured
✅ No critical alerts
✅ All monitoring dashboards healthy

---

## Post-Deployment Activities

### Day 1
- [ ] Monitor all metrics closely
- [ ] Review logs for errors
- [ ] Verify backward compatibility
- [ ] Check performance metrics

### Day 7
- [ ] Review weekly error trends
- [ ] Analyze performance data
- [ ] Check for memory leaks
- [ ] Document any issues found

### Week 4 (End of Phase)
- [ ] Generate deployment report
- [ ] Conduct post-mortem (if issues)
- [ ] Update documentation
- [ ] Plan Phase 5 optimizations

---

## Contacts and Escalation

**On-Call Engineer**: [Team contact info]
**Engineering Lead**: [Lead contact info]
**DevOps Lead**: [DevOps contact info]
**CTO/Technical Lead**: [CTO contact info]

**Escalation Path**:
1. Alert on-call engineer
2. Engage engineering lead if issue persists >10 minutes
3. Engage DevOps lead for infrastructure issues
4. Engage CTO if deployment must be rolled back

---

## Appendix

### A. Environment Variables

```bash
# Monitoring
LOG_LEVEL=info
METRICS_RETENTION_MS=3600000

# Database
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# S3
AWS_REGION=us-east-1
AWS_BUCKET=qa-agents-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# API
API_PORT=3000
API_TIMEOUT=600000
```

### B. Quick Reference

| Action | Command |
|--------|---------|
| Deploy canary | `npm run deploy:canary -- --percentage=5` |
| Deploy production | `npm run deploy:production` |
| Rollback | `npm run deploy:rollback -- --version=v3.2.0` |
| Health check | `npm run health-check:production` |
| View logs | `npm run logs:production` |
| Check metrics | `npm run metrics:view` |

### C. Additional Resources

- AGNO_FINAL_ARCHITECTURE.md - System design
- PHASE_4_COMPLETION_REPORT.md - What was built
- API_REFERENCE.md - API documentation
- DEPLOYMENT_CHECKLIST.md - Pre-deployment checklist

---

**Status**: ✅ Ready for Production Deployment
**Last Updated**: March 18, 2026
**Next Phase**: Phase 5 (Optimization & Polish)

