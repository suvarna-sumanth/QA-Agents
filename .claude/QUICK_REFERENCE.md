# QA-Agents Quick Reference Guide

## What Issues Were Fixed?

| # | Issue | Status | How to Find Details |
|---|-------|--------|---------------------|
| 1 | Jobs failed with ESM/CJS error | ✅ FIXED | See "ESM/CJS Module Bundling" in AUDIT |
| 2 | Play button detection weak | ✅ IMPROVED | See "Play Button Click Detection" in AUDIT |
| 3 | Screenshots not grouped by URL | ✅ FIXED | See "Article Screenshots Grouping" in AUDIT |
| 4 | thehill.com domain not detected | ⚠️ PARTIAL | See "Domain Not Working" in AUDIT |
| 5 | Play button failing on protected sites | ⚠️ WAF BLOCKED | See "Protected Sites Failure" in AUDIT |
| 6 | Proxy IPs getting blocked | ⚠️ MITIGATED | See "Proxy IP Blocking" in AUDIT |
| 7 | HTTP errors killing jobs | ✅ FIXED | See "HTTP Error Handling" in AUDIT |

## What's Currently Working?

✅ Job execution (all non-WAF-blocked sites)
✅ Article discovery via sitemap
✅ Player detection on accessible pages
✅ Screenshot capture with URL grouping
✅ Proxy zone rotation
✅ Graceful error handling
✅ Dashboard telemetry
✅ PM2 deployment

## What's Still Broken?

⚠️ **thehill.com article access** - HTTP 403 from PerimeterX on all BrightData zones
⚠️ **Premium protected sites** - Any site using aggressive HTTP-level WAF

## How to Work Around It?

1. **Test with Cloudflare sites** instead of PerimeterX sites
2. **Use thebrakereport.com** as reference (Cloudflare, more reliable)
3. **Avoid premium sites** until curl-impersonate is implemented

## Key Code Changes Made

### 1. Module Loading Fix
**File**: `src/app/api/jobs/route.ts`
**Pattern**: `await import(/* webpackIgnore: true */ runtimePath)`
**Why**: Prevents Webpack from bundling ESM files into CJS context

### 2. Audio State Detection
**File**: `agents/core/skills/TestPlayerSkill.js`
**Check**: `paused === false && readyState >= 1 && ended === false`
**Why**: More robust than just checking `currentTime > 0`

### 3. Screenshot Grouping
**File**: `agents/core/skills/TestPlayerSkill.js`
**Field**: Every step now has `articleUrl: url`
**Why**: Dashboard can group by explicit URL field

### 4. Proxy Rotation
**File**: `agents/shivani/src/proxy-rotation.js`
**Method**: Cycles through `residential_proxy1-4` zones
**Why**: Different zones might have better reputation

### 5. HTTP Error Handling
**File**: `agents/core/skills/DetectPlayerSkill.js` & `TestPlayerSkill.js`
**Strategy**: Try `load` instead of `domcontentloaded` on 403
**Why**: Graceful degradation instead of failing completely

## How to Debug Issues

### Check if system is running
```bash
ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117
pm2 list
pm2 logs qa-agents --lines 50
```

### Test a job manually
```bash
curl -X POST http://100.54.233.117:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"domain","target":"https://example.com"}'
```

### Check dashboard
Open: http://100.54.233.117:9002/qa-dashboard

### Review audit document
See: `.claude/AUDIT_ISSUES_AND_SOLUTIONS.md` for all details

## What Commits Should I Know?

- `b660900` - Fixed ESM/CJS bundling
- `9ee27af` - Improved audio detection
- `2f23a0f` - Added articleUrl field
- `e69a416` - Enhanced domain detection
- `bca26cd` - Implemented proxy rotation
- `63bc4b3` - Made HTTP handling lenient

## When Should I Implement curl-impersonate?

**When**: You need thehill.com or other PerimeterX-protected sites working
**Impact**: Would allow HTTP-level WAF bypass
**Effort**: Medium (separate library integration)
**Blocker**: Currently, proxy zone rotation can't solve HTTP 403 blocking

## Quick Checklist for New Tests

- [ ] Use Cloudflare or unprotected sites initially
- [ ] Watch logs for WAF detection messages
- [ ] Check dashboard for completion
- [ ] Verify proxy rotation in logs: `[ProxyRotation] Using zone`
- [ ] Check for audio state in player tests
- [ ] Ensure articleUrl appears in report

---

**Last Updated**: March 18, 2026
**Status**: 🟡 Production Ready (with WAF limitations)
