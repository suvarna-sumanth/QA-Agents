# TheHill.com Automation - Fix Implementation Guide

## Problem Summary
Agent automation fails at the **Player Detection** step for thehill.com due to `net::ERR_CERT_AUTHORITY_INVALID` errors during page navigation via Playwright.

**Root Cause:** Browser context reuse without consistent `ignoreHTTPSErrors` setting.

---

## Fix Strategy

### Primary Issue
When the browser is reused (pooled), the existing context is retrieved without ensuring it has `ignoreHTTPSErrors: true`. Since this property cannot be changed after context creation, SSL validation errors occur.

### Solution
Always create a fresh context with proper HTTPS error handling enabled, even when reusing a browser instance.

---

## Code Changes Required

### Change 1: Update `agents/shivani/src/browser.js`

#### Location: Lines 72-87

**Current Code:**
```javascript
// PRE-WARM AUTH: Set credentials on the first context
if (process.env.RESIDENTIAL_PROXY) {
  const proxyUrl = new URL(process.env.RESIDENTIAL_PROXY);
  const context = browser.contexts()[0] || await browser.newContext({
    ignoreHTTPSErrors: true
  });
  console.log(`[Browser] Pre-setting proxy auth for ${proxyUrl.username}`);
  await context.setHTTPCredentials({
    username: proxyUrl.username,
    password: proxyUrl.password
  });
}

browserPool[poolKey] = browser;
return { browser, cleanup: async () => {}, reused: false };
```

**Fixed Code:**
```javascript
// PRE-WARM AUTH: Set credentials on the first context
// ALWAYS ensure we have a context with HTTPS error handling
let browserContext;
if (process.env.RESIDENTIAL_PROXY) {
  const proxyUrl = new URL(process.env.RESIDENTIAL_PROXY);
  // Always create fresh context to ensure ignoreHTTPSErrors is set
  browserContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: INSTAREAD_USER_AGENT,
  });
  console.log(`[Browser] Pre-setting proxy auth for ${proxyUrl.username}`);
  await browserContext.setHTTPCredentials({
    username: proxyUrl.username,
    password: proxyUrl.password
  });
} else {
  // Create default context if no proxy
  browserContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: INSTAREAD_USER_AGENT,
  });
}

browserPool[poolKey] = browser;
return { browser, browserContext, cleanup: async () => {}, reused: false };
```

**Changes:**
1. Return `browserContext` from the function
2. Always create a new context when launching, regardless of proxy
3. Ensure `ignoreHTTPSErrors: true` is always set
4. Pass `userAgent` at context creation time

---

### Change 2: Update `agents/core/skills/DetectPlayerSkill.js`

#### Location: Lines 56-87

**Current Code:**
```javascript
let browser, cleanup;

if (context && context.sharedBrowser) {
  browser = context.sharedBrowser.browser;
  cleanup = async () => {};
} else {
  ({ browser, cleanup } = await launchForUrl(urls[0]));
}

// ...

let browserContext, page;
if (isCloudflare || isTownNews) {
  browserContext = await browser.newContext({
    userAgent: INSTAREAD_USER_AGENT,
    ignoreHTTPSErrors: true
  });
  await applyStealthScripts(browserContext);
} else {
  browserContext = browser.contexts()[0] || await browser.newContext({
    userAgent: INSTAREAD_USER_AGENT,
    ignoreHTTPSErrors: true
  });
}
```

**Fixed Code:**
```javascript
let browser, browserContext, cleanup;

if (context && context.sharedBrowser) {
  browser = context.sharedBrowser.browser;
  browserContext = context.sharedBrowser.browserContext;
  cleanup = async () => {};
} else {
  ({ browser, browserContext, cleanup } = await launchForUrl(urls[0]));
}

// Ensure we have a fresh context with HTTPS error handling
// for PerimeterX and other protected sites
if (isCloudflare || isTownNews) {
  // Close existing context if present, create fresh one
  if (browserContext) {
    try {
      await browserContext.close();
    } catch (e) {
      // Context may already be closed
    }
  }
  browserContext = await browser.newContext({
    userAgent: INSTAREAD_USER_AGENT,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 }
  });
  await applyStealthScripts(browserContext);
} else {
  // For PerimeterX (thehill.com), always use passed context or create fresh
  if (!browserContext) {
    browserContext = await browser.newContext({
      userAgent: INSTAREAD_USER_AGENT,
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
  }
}
```

**Changes:**
1. Extract `browserContext` from the launch return object
2. Always ensure we have a fresh context with `ignoreHTTPSErrors: true`
3. Don't reuse pooled contexts that may lack proper settings
4. Explicitly close old contexts before creating new ones

---

### Change 3: Add Retry Logic for Certificate Errors

#### Location: Lines 115-120 in DetectPlayerSkill.js

**Current Code:**
```javascript
try {
  console.log(`[DetectPlayerSkill] Loading page...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
```

**Fixed Code:**
```javascript
try {
  console.log(`[DetectPlayerSkill] Loading page...`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (navErr) {
    // Handle certificate errors with retry
    if (navErr.message.includes('ERR_CERT_AUTHORITY_INVALID') ||
        navErr.message.includes('net::ERR_CERT')) {
      console.log(`[DetectPlayerSkill] Certificate error detected, creating fresh context and retrying...`);

      try {
        await page.close().catch(() => {});
        await browserContext.close().catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }

      // Create completely fresh context
      browserContext = await browser.newContext({
        userAgent: INSTAREAD_USER_AGENT,
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 720 }
      });

      page = await browserContext.newPage();
      console.log(`[DetectPlayerSkill] Retry: Loading page with fresh context...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } else {
      throw navErr;
    }
  }

  await page.waitForTimeout(2000);
```

**Changes:**
1. Wrap `page.goto()` in try-catch
2. Detect certificate-related errors specifically
3. Create completely fresh context on retry
4. Close old page and context before retrying
5. Continue with fresh page object

---

## Testing Instructions

### 1. Local Test
```bash
cd /home/sumanth/Projects/QA-Agents

# Run agent directly
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run test:agent -- --domain thehill.com

# Or via API
curl -X POST http://localhost:9002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "cognitive-supervisor",
    "type": "domain",
    "target": "https://thehill.com"
  }'
```

### 2. EC2 Deployment
```bash
# SSH into EC2
ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117

# Go to app directory
cd /home/ec2-user/QA-Agents

# Pull latest code
git pull origin main

# Restart service
sudo systemctl restart qa-agents

# Monitor logs
journalctl -u qa-agents -f --grep='thehill'
```

### 3. Validation Checks
```bash
# After restart, logs should show:
# [Browser] Launching Undetected browser (perimeterx)...
# [DetectPlayerSkill] Loading page...
# [DetectPlayerSkill] Waiting for player JS to render...
# (Should NOT show: ERR_CERT_AUTHORITY_INVALID)

# Check job status via dashboard
curl http://localhost:9002/api/jobs/status?jobId=<jobId>
```

---

## Expected Behavior After Fix

### Before Fix
```
[DetectPlayerSkill] Loading page...
[DetectPlayerSkill] Error on https://thehill.com/...:
  page.goto: net::ERR_CERT_AUTHORITY_INVALID
```

### After Fix
```
[DetectPlayerSkill] Loading page...
[DetectPlayerSkill] Waiting for player JS to render...
[DetectPlayerSkill] Waiting for content... (1s)
[DetectPlayerSkill] Detected player element: instaread-player
```

---

## Rollback Plan

If issues occur after deployment:

```bash
# SSH to EC2
ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117

# Revert to previous version
cd /home/ec2-user/QA-Agents
git revert HEAD

# Restart
sudo systemctl restart qa-agents
```

---

## Success Criteria

✅ **Fix is successful when:**
- [ ] No `ERR_CERT_AUTHORITY_INVALID` errors in logs for thehill.com
- [ ] `DetectPlayerSkill` completes without errors
- [ ] Player detection shows "hasPlayer: true" for article URLs
- [ ] Mission status for thehill.com shows "pass" instead of "partial"
- [ ] At least 3 consecutive successful runs without certificate errors

---

## Files Modified

1. `agents/shivani/src/browser.js` - Browser launch and context management
2. `agents/core/skills/DetectPlayerSkill.js` - Player detection with certificate error handling

## Files NOT Modified
- `agents/core/skills/DiscoverArticlesSkill.js` (working correctly)
- `agents/core/graph/SupervisorAgent.js` (orchestration is correct)
- Configuration files (`.env` settings are correct)

---

## Implementation Complexity

- **Scope:** Localized to 2 files
- **Risk Level:** Low (certificate handling is isolated)
- **Rollback Time:** < 2 minutes
- **Testing Time:** 5-10 minutes per run
- **Expected Fix Time:** 30 minutes total (code + deploy + test)

---

## Additional Notes

### Why This Happens
Playwright's `ignoreHTTPSErrors` must be set at context creation time. Once a context is created without this flag, it cannot be changed. The browser pooling strategy reuses browsers but was trying to reuse contexts, which could lack proper configuration.

### Why It Works For Other Sites
Sites without certificate issues (or using valid certs) don't trigger this error. PerimeterX-protected sites like thehill.com may be serving certificates that Playwright's bundled Chromium doesn't recognize as valid.

### Alternative Approaches (Not Recommended)
1. Use `--ignore-certificate-errors` Chrome flag - Less reliable
2. Disable TLS globally - Security risk, already done at Node.js level
3. Use proxy with certificate rotation - Adds complexity

**Recommended approach:** Always create fresh contexts with `ignoreHTTPSErrors: true`

---

**Implementation Guide Version:** 1.0
**Created:** 2026-03-17
**Target Deployment:** Immediate
