# Testing V2 Bypass Improvements

## Quick Start

```bash
# 1. Ensure server is running
cd /home/sumanth/Projects/QA-Agents
npm run dev &

# 2. Wait for ready
sleep 3

# 3. Submit a test job against the-hill.com
curl -X POST http://localhost:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "domain",
    "target": "https://thehill.com",
    "maxArticles": 5
  }'

# 4. Monitor the logs
# Check for the improvements below
```

## What to Watch For in Logs

### ✅ Good Signs - V2 Working
```
[Browser] Launching new PerimeterX browser instance...
[Browser] Reusing pooled perimeterx browser instance        # Should see 4x reuse
[Bypass] Pressing and holding at (618, 416) for 18.3s...   # 16-22 second range
[Bypass] ✓ Successfully bypassed on attempt 1              # Shows attempt number
[Bypass] Challenge still present, waiting 5000ms before retry...  # 5s backoff
[Bypass] ✓ Successfully bypassed on attempt 2              # Second attempt succeeds
```

### ⚠️ Warning Signs - V2 Issues
```
[Bypass] ✗ Failed to bypass challenge after 4 attempts     # All 4 attempts failed
[rebrowser-patches][frames._context] cannot get world      # Session issues (but handled gracefully)
[Detect] Error on https://...: page.evaluate error         # Page problems
```

### What Changed vs V1

| Aspect | V1 | V2 | What to Check |
|--------|----|----|---------------|
| Hold duration | 15-20s | 16-22s | Look for 18-22s in logs |
| Max retries | 3 | 4 | See "attempt 1/4" in logs |
| Backoff wait | 2s, 3s, 4s | 5s, 7s, 9s | See "waiting 5000ms/7000ms/9000ms" |
| Error handling | Basic | Detailed | No crashes on protocol errors |
| Settlement wait | 3s | 4-5s | See longer waits after bypass |

## Expected Results

### Single URL Test
```bash
curl -X POST http://localhost:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "target": "https://thehill.com/policy/international/5779086-rahm-emmanuel-trump-iran-war-impact/"
  }'

# Expected: Player detection success within 25-35 seconds
```

### Multi-URL Batch Test (5 URLs)
```bash
curl -X POST http://localhost:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "domain",
    "target": "https://thehill.com",
    "maxArticles": 5
  }'

# Expected Results:
# - 1st browser launch + 1st bypass: ~25-35 seconds
# - URLs 2-5: ~5-10 seconds each (no bypass needed or quick bypass)
# - Total: ~45-75 seconds for 5 URLs
# - Success rate: 90-95% (was 80% in V1)
```

## Detailed Test Scenario

### Test 1: Fresh Job Against PerimeterX Site
```bash
# Expected timeline:
# 0-3s: Article discovery
# 3-35s: First article with challenge bypass (max 4 attempts)
# 35-45s: Remaining articles (reuse browser)
# 45-50s: Report generation
# Total: ~50-60 seconds
# Success: 90-95% of articles should have detected player

EXPECTED_LOGS:
[Discovery] Found 5 article URLs from sitemap
[Browser] Launching new PerimeterX browser instance...
[Bypass] Pressing and holding at (618, 416) for 17.2s...
[Bypass] ✓ Successfully bypassed on attempt 1
[Detect] FOUND player at https://...
[Detection] 4/5 articles have <instaread-player/>  # or 5/5 with V2
```

### Test 2: Monitor Browser Reuse
```bash
# Count launches vs reuses:
grep -c "Launching new" /tmp/qa-agents.log        # Should be 1
grep -c "Reusing pooled" /tmp/qa-agents.log       # Should be 4+

# Expected:
# Launches: 1
# Reuses: 4-5
# Reuse efficiency: 80-85% (was 0% in original)
```

### Test 3: Measure Bypass Success Rate
```bash
# Count successful bypasses:
grep "✓ Successfully bypassed" /tmp/qa-agents.log | wc -l
# Expected: 4-5 for 5 URLs with V2

# Count failed bypasses:
grep "✗ Failed to bypass" /tmp/qa-agents.log | wc -l
# Expected: 0-1 for 5 URLs with V2 (was 1 in V1)
```

### Test 4: Check Error Recovery
```bash
# Look for graceful error handling:
grep "Protocol error" /tmp/qa-agents.log           # Expected: Some errors present
grep "Successfully bypassed" /tmp/qa-agents.log    # Expected: Still succeeds despite errors
grep "Challenge still present" /tmp/qa-agents.log  # Expected: Shows retries working

# Key: Errors should NOT crash the system
```

## Performance Benchmarks

### Before V2
```
Test: 5 URLs from thehill.com
Browser startup:  12-20 seconds (5 launches × 3-5s each)
Challenge bypasses: 4/5 success (80%)
Total time: ~50-70 seconds
Errors: Some "session closed" crashes
```

### After V2 (Expected)
```
Test: 5 URLs from thehill.com
Browser startup: 3-5 seconds (1 launch + 4 reuses)
Challenge bypasses: 4-5/5 success (80-100%)
Total time: ~50-70 seconds (same, but more reliable)
Errors: Gracefully handled, no crashes
```

## Troubleshooting

### If Still Getting "Failed to bypass" After 4 Attempts
Try the conservative configuration:
```bash
# Edit agents/shivani/src/bypass.js
# Change line ~234:
const holdDuration = 18000 + Math.random() * 8000;  # Increase to 18-26s

# Change line ~84:
export async function bypassChallenge(page, maxRetries = 5) {  # Try 5 attempts
```

### If Tests Are Too Slow
Try the aggressive configuration:
```bash
# Edit agents/shivani/src/bypass.js
# Change line ~234:
const holdDuration = 14000 + Math.random() * 4000;  # Decrease to 14-18s

# Change line ~84:
export async function bypassChallenge(page, maxRetries = 3) {  # Back to 3 attempts
```

### If Protocol Errors Appear
This is normal - V2 gracefully handles them. Check:
1. Are bypasses still succeeding? ✓ Good - errors are handled
2. Is the system crashing? ✗ Bad - something's wrong

## Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|-----------------|
| Bypass success rate | >90% | Count successful bypasses / total URLs |
| Browser reuse rate | >80% | Reuses / (launches + reuses) |
| Protocol error impact | 0 crashes | System stability despite errors |
| Avg time per URL | <30s | Total time / number of URLs |
| Memory stability | Constant | Monitor with `top` during run |

## Quick Reference

### V2 Key Changes
- Hold duration: **16-22 seconds** (was 15-20s)
- Max retries: **4 attempts** (was 3)
- Backoff timing: **5s, 7s, 9s** (was 2s, 3s, 4s)
- Error recovery: **Granular** (was simple)
- Settlement wait: **4-5 seconds** (was 3s)

### Success Criteria
- ✅ 4+ articles detected out of 5 (80%+ success)
- ✅ Only 1 browser launched, 4+ reused (pooling working)
- ✅ No crashes despite protocol errors
- ✅ Total time < 75 seconds for 5 URLs

---

**Test Date**: 2026-03-12  
**Expected Improvement**: +10-15% bypass success rate  
**Status**: Ready to Test
