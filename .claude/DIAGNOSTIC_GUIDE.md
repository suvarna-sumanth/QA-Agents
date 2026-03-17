---
name: Quick Diagnostic Guide
description: How to quickly identify what's working and what's not
type: reference
---

# Quick Diagnostic: Is My System Working?

Use this guide to quickly check what's actually happening.

---

## Step 1: System Health (2 minutes)

```bash
# SSH to EC2
ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117

# Check if system is running
pm2 list
# Expected output: qa-agents | 0 | online | cluster

# Check for recent errors
pm2 logs qa-agents --lines 50 | grep -E "ERROR|✗|Failed"
# Expected: Very few errors (if any)

# Check API health
curl http://localhost:9002/api/health
# Expected: {"success": true, "status": "operational"}
```

---

## Step 2: Module Loading Test (1 minute)

**This was the critical issue. If this fails, nothing works.**

```bash
# Check if jobs execute without "Cannot use import statement" error
pm2 logs qa-agents --lines 100 | grep -E "SyntaxError|import statement"
# Expected output: NOTHING (no errors)

# If you see that error: ❌ Module loading is broken
# If you don't: ✅ Module loading is fixed
```

---

## Step 3: Job Submission Test (3 minutes)

```bash
# Submit a simple test job
curl -X POST http://localhost:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "domain",
    "target": "https://thebrakereport.com",
    "config": {"maxArticles": 2}
  }' | jq .

# Expected response:
# {
#   "success": true,
#   "jobId": "job-1234567890-abcde",
#   "status": "queued"
# }
```

---

## Step 4: Monitor Job Execution (5 minutes)

```bash
# Watch logs in real-time
pm2 logs qa-agents --tail

# Look for these patterns:

# ✅ GOOD SIGNS:
# [DetectPlayerSkill] Checking: https://thebrakereport.com/article/...
# [DetectPlayerSkill] Player detected!
# [TestPlayerSkill] Loading page at https://...
# [TestPlayerSkill] Play button detected
# [TestPlayerSkill] Audio is playing - PASS

# ⚠️ WARNING SIGNS:
# [DetectPlayerSkill] Navigation failed with error: ERR_HTTP_RESPONSE_CODE_FAILURE
# [DetectPlayerSkill] WAF/HTTP 403 detected
# This means the site is blocking the proxy

# ❌ ERROR SIGNS:
# SyntaxError: Cannot use import statement
# This means module loading is broken (shouldn't happen)
# ReferenceError, TypeError
# This means code error
```

---

## Step 5: Check Dashboard (2 minutes)

Open: http://100.54.233.117:9002/qa-dashboard

**Look for**:
- Top panel: Should show "[DetectPlayerSkill] Checking..." messages
- Bottom panel: Should show completed jobs with status
- Right panel: Should show job metrics updating

**Expected behavior**:
- Top panel updates every 1-2 seconds while job running
- Bottom panel shows "COMPLETED" when job finishes
- Right panel shows "Swarm Integrity: NOMINAL"

**If nothing updates**: Click "INITIALIZE ADVANCED MATRIX" button

---

## Diagnostic Matrix

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Cannot use import statement" error | Module loading broken | Check webpackIgnore in route.ts |
| Jobs submitted but nothing happens | API not connected to agent | Check pm2 logs |
| "WAF/HTTP 403" in logs | Proxy blocked by PerimeterX | Need curl-impersonate (Option B) |
| "Just a moment" challenge shown | Cloudflare challenge | Working as intended (auto-bypass) |
| Dashboard shows no updates | WebSocket not connected | Reload page, check browser console |
| Player not detected | Takes >10s to load | Increase wait time in DetectPlayerSkill |
| Audio test fails but page loads | Audio element not found | Site may use different player |
| Job times out (>2 min) | Browser hung | Check system resources, pm2 restart |

---

## Quick Tests

### Test 1: Module Loading Works
```bash
curl -X POST http://localhost:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"domain","target":"https://google.com"}' | jq .

# Check logs for:
# ✅ [API] Job ... completed
# ❌ SyntaxError: Cannot use import statement
```

### Test 2: Proxy Rotation Works
```bash
# Check logs for rotation messages
pm2 logs qa-agents --lines 100 | grep "ProxyRotation"

# Expected output:
# [ProxyRotation] Using zone: residential_proxy1
# [ProxyRotation] Using zone: residential_proxy2
# [ProxyRotation] Using zone: residential_proxy3
# (Zone cycling)
```

### Test 3: Browser Automation Works
```bash
# Check for browser launch
pm2 logs qa-agents --lines 100 | grep "Browser"

# Expected output:
# [Browser] Launching Undetected browser...
# [Browser] Using Chrome executable: ...
```

### Test 4: Screenshot Capture Works
```bash
# Check S3 sync logs
pm2 logs qa-agents --lines 50 | grep "S3"

# Expected output:
# [S3] Successfully synced all report artifacts for job-...
```

---

## Which Domain Should I Test?

| Domain | Protection | Expected | Notes |
|--------|-----------|----------|-------|
| thebrakereport.com | Cloudflare | ~70% success | Use this for testing |
| thehill.com | PerimeterX | 🔴 HTTP 403 | Blocked by WAF, needs curl-impersonate |
| foxnews.com | Cloudflare | ~70% success | Alternative for testing |
| google.com | None | ✅ Always works | Use for diagnostic testing |

**Recommendation**: Test with **thebrakereport.com** if you want real-world validation.

---

## Common Issues & Fixes

### Issue: No logs appearing in `pm2 logs`
**Fix**:
```bash
# Restart PM2 service
pm2 restart qa-agents
pm2 logs qa-agents --tail
```

### Issue: Module loading error (SyntaxError)
**Fix**:
```bash
# This should NOT happen if code is deployed correctly
# Check that src/app/api/jobs/route.ts has:
grep "webpackIgnore" src/app/api/jobs/route.ts
# Should show: /* webpackIgnore: true */

# If missing, rebuild and redeploy
npm run build
# Copy .next to EC2
rsync -av .next ec2-user@100.54.233.117:~/QA-Agents/
```

### Issue: "WAF/HTTP 403" consistently
**Fix**:
```bash
# This is expected for thehill.com
# Use thebrakereport.com instead for testing
# Or implement Option B (curl-impersonate) from NEXT_STEPS_IMPLEMENTATION.md
```

### Issue: Dashboard not updating
**Fix**:
```bash
# Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
# Or: Right-click → "Empty Cache and Hard Reload"
# Then reload the page
```

### Issue: Job takes >2 minutes
**Fix**:
```bash
# Check system resources
top
# If CPU/memory high, restart PM2:
pm2 restart qa-agents

# Check page load time is reasonable
pm2 logs qa-agents --lines 200 | grep "waitForTimeout\|goto"
```

---

## Healthy System Indicators

When everything is working, you should see:

**In logs**:
```
✅ [API] Job job-xxx submitted
✅ [DetectPlayerSkill] Checking: https://...
✅ [DetectPlayerSkill] Player detected!
✅ [TestPlayerSkill] Audio is playing - PASS
✅ [S3] Successfully synced all report artifacts
✅ Job completed with status: PASS
```

**In dashboard**:
```
✅ Top panel: Updates every 1-2 seconds
✅ Bottom panel: Shows "COMPLETED" status
✅ Right panel: "Swarm Integrity: NOMINAL"
✅ Specialist metrics: Increasing percentages
```

**API response**:
```json
{
  "success": true,
  "jobs": [
    {
      "jobId": "job-xxx",
      "status": "completed",
      "report": { ... }
    }
  ]
}
```

---

## Quick Fix Checklist

If something's broken, try these in order:

- [ ] Restart PM2: `pm2 restart qa-agents`
- [ ] Check logs: `pm2 logs qa-agents --lines 50`
- [ ] Reload dashboard: Ctrl+Shift+R
- [ ] Rebuild (if code changed): `npm run build`
- [ ] Redeploy: Copy `.next/` to EC2
- [ ] Restart PM2 again: `pm2 restart qa-agents`
- [ ] Submit test job: `curl -X POST http://localhost:9002/api/jobs ...`

---

**Last Updated**: Mar 18, 2026
**Status**: Use this guide to quickly diagnose system health

