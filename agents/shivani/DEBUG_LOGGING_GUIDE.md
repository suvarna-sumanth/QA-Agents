# Debug Logging Guide - Bypass Issues

## Enhanced Logging Added

Both `src/detect.js` and `src/test-player.js` now include detailed logging to help diagnose why articles are being skipped.

## What to Look For in Logs

### Detection Phase (`src/detect.js`)

```
[Detect] Checking: https://thehill.com/article/
[Detect] Loading page...
[Detect] Challenge detected! Attempting active bypass...
[Detect] ✓ Challenge bypassed, waiting for content to load...
[Detect] Waiting for player JS to render...
[Detect] FOUND player at https://thehill.com/article/
```

### Testing Phase (`src/test-player.js`)

```
[Test] Loading page: https://thehill.com/article/
[Test] Challenge detected! Attempting active bypass...
[Test] ✓ Challenge bypassed, waiting for content to load...
[Test] Waiting for player JS to render...
✓ Page Load (5000ms)
```

## Common Scenarios

### Scenario 1: Challenge Detected and Bypassed ✅

```log
[Detect] Challenge detected! Attempting active bypass...
[Detect] ✓ Challenge bypassed, waiting for content to load...
[Detect] No challenge detected, proceeding...
[Detect] FOUND player at https://thehill.com/article/
```

**Status:** Working correctly

---

### Scenario 2: Challenge Detected but Bypass Timed Out ⚠️

```log
[Detect] Challenge detected! Attempting active bypass...
[Detect] ⚠️  Challenge bypass completed (may have timed out), waiting for page...
[Detect] Still waiting for content... (1.5s)
[Detect] Still waiting for content... (3s)
[Detect] FOUND player at https://thehill.com/article/
```

**Status:** Bypass timed out but page eventually loaded

**Action:** Increase hold duration (see Fix 1 below)

---

### Scenario 3: Challenge Not Detected Initially ℹ️

```log
[Detect] No challenge detected, proceeding...
[Detect] Waiting for player JS to render...
[Detect] FOUND player at https://thehill.com/article/
```

**Status:** Working correctly (no challenge or already resolved)

---

### Scenario 4: Player Not Found (PROBLEM)

```log
[Detect] Challenge detected! Attempting active bypass...
[Detect] ✓ Challenge bypassed, waiting for content to load...
[Detect] Waiting for player JS to render...
[Detect] No player at https://thehill.com/article/
```

**Status:** Challenge was bypassed but player still not found

**Possible Causes:**
1. Player takes longer to render (increase wait time)
2. Bypass wasn't fully effective (challenge may have reset)
3. Article doesn't actually have a player

---

## Fixes

### Fix 1: Increase Hold Duration

If you see "Challenge bypass completed (may have timed out)", increase the hold duration:

**File:** `src/bypass.js`, line 186

```javascript
// Before
for (let i = 0; i < 12; i++) {

// After
for (let i = 0; i < 15; i++) {  // Increased from 12 to 15 seconds
```

### Fix 2: Increase Wait After Bypass

If challenge is bypassed but player still not found:

**File:** `src/detect.js`, line 46

```javascript
// Before
await page.waitForTimeout(4000);

// After
await page.waitForTimeout(6000);  // Increased from 4 to 6 seconds
```

### Fix 3: Increase Final JS Render Wait

If still not finding player after all waits:

**File:** `src/detect.js`, line 59

```javascript
// Before
await page.waitForTimeout(6000);

// After
await page.waitForTimeout(10000);  // Increased from 6 to 10 seconds
```

---

## Logging Output Examples

### Run Single URL with Logging

```bash
cd /home/sumanth/Projects/QA-Agents/agents/shivani
node src/test-bypass.js "https://thehill.com/homenews/administration/5779432-us-military-iran-school-strike/"
```

**Expected Output:**
```
🧪 Testing bypass for: https://thehill.com/homenews/administration/5779432-us-military-iran-school-strike/

[Test] Loading page...
[Test] Challenge detected! Attempting active bypass...
[Bypass] Challenge detected: "perimeterx-press-hold"
[Bypass] Found #px-captcha, pressing at (640, 350)
[Bypass] Mouse down, holding...
[Bypass] Mouse released after 12s hold
[Bypass] Successfully bypassed "perimeterx-press-hold"
[Test] ✓ Challenge bypassed successfully
[Test] Player detected: ✅ YES
[Test] Screenshot saved: /tmp/bypass-test-XXXXX.png
```

### Run Full Domain with Logging

```bash
node src/index.js --domain https://thehill.com --max-articles 5
```

**Expected Output (with new logging):**
```
[Detect] Checking: https://thehill.com/article1/
[Detect] Loading page...
[Detect] Challenge detected! Attempting active bypass...
[Detect] ✓ Challenge bypassed, waiting for content to load...
[Detect] FOUND player at https://thehill.com/article1/

[Detect] Checking: https://thehill.com/article2/
[Detect] Loading page...
[Detect] No challenge detected, proceeding...
[Detect] No player at https://thehill.com/article2/
```

---

## Interpreting Bypass Logs

### Good Signs ✅
- `[Detect] Challenge detected!` - Challenge properly identified
- `✓ Challenge bypassed` - Bypass successful
- `[Detect] FOUND player` - Player detected after bypass
- Timestamps show ~12s between "Mouse down" and "Mouse released" (full hold)

### Warning Signs ⚠️
- `⚠️  Challenge bypass completed (may have timed out)` - Bypass took full time limit
- `Still waiting for content...` repeated multiple times - Page loading slowly
- `[Detect] No player` after successful bypass - Player not loading

### Error Signs ❌
- `Bypass error (continuing anyway)` - Exception during bypass but continuing
- No challenge detection message - Challenge may be new type not recognized
- Bypass logs appear but then player not found - Bypass may have been incomplete

---

## Performance Metrics in Logs

### Expected Timings

**Without Challenge:**
- Page load: 2-3 seconds
- Player JS render: 6 seconds
- Total: ~8-10 seconds
- Status: `[Detect] No challenge detected`

**With Challenge (Successful Bypass):**
- Page load: 2-3 seconds
- Challenge detection: <1 second
- Challenge bypass: 12-15 seconds (press & hold)
- Content load: 4-6 seconds
- Player JS render: 6 seconds
- Total: ~25-35 seconds
- Status: `✓ Challenge bypassed`

**With Challenge (Bypass Timeout):**
- Same as above but bypass reaches 3 retry limit
- Takes 12 seconds × 3 retries = 36+ seconds
- Status: `⚠️  Challenge bypass completed (may have timed out)`

---

## What Changed in Latest Update

### Enhanced Detection Logic

**Before:**
- Passive wait for challenges to auto-resolve
- No logging of detection process
- Articles would timeout and get skipped

**After:**
- Active detection of challenge indicators
- Logs each step of bypass process
- Better error handling and fallback
- Still tries to access page even if bypass times out

### New Log Messages

```
[Detect] Loading page...
[Detect] Challenge detected! Attempting active bypass...
[Detect] ✓ Challenge bypassed, waiting for content to load...
[Detect] ⚠️  Challenge bypass completed (may have timed out), waiting for page...
[Detect] Bypass exception (continuing): <error message>
[Detect] Waiting for player JS to render...
[Test] No challenge detected, proceeding...
```

---

## Troubleshooting Checklist

- [ ] Run `node src/test-bypass.js <url>` on a challenge URL
- [ ] Check logs for "Challenge detected!" message
- [ ] Verify bypass is being called (not skipped)
- [ ] Check if bypass completes successfully or times out
- [ ] If timeout, increase hold duration (Fix 1)
- [ ] If player not found, increase wait times (Fix 2/3)
- [ ] Run full domain test and compare log patterns
- [ ] If still failing, check if challenge type is recognized

---

## Support

If you see unexpected behavior:

1. **Note the log messages** - Copy the full log output
2. **Run test-bypass.js** - Test bypass on the specific URL
3. **Check timing** - Note how long each phase takes
4. **Compare with expected** - Reference "Expected Timings" above
5. **Apply appropriate fix** - Use Fix 1, 2, or 3 based on symptoms

---

**Last Updated:** March 12, 2026  
**Purpose:** Help diagnose why articles are being skipped  
**Status:** Enhanced logging now in production
