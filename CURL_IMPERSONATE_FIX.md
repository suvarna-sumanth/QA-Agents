# curl-impersonate Installation Issue - FIXED

## Problem Found

When testing the curl-impersonate installation with Cloudflare-protected sites, the exit code was:
```
[Cloudflare-HTTP] curl-impersonate failed (code 2)
```

## Root Cause

The issue was in the command arguments passed to curl-impersonate. The code was using:
```bash
--timeout 30
```

But curl-impersonate (the patched version of curl) doesn't support the `--timeout` option. It only supports:
- `--connect-timeout` (timeout for connection establishment)
- `--max-time` (maximum time for entire operation)

## Solution Applied

Updated `/home/sumanth/Projects/QA-Agents/agents/shivani/src/cloudflare-http.js`:

**Before:**
```javascript
'--timeout', '30',
```

**After:**
```javascript
'--connect-timeout', '10',
'--max-time', '30',
```

### Additional Improvement

Also added better error logging to show stderr output when curl fails:

```javascript
if (code !== 0) {
  if (errors) {
    console.log(`[Cloudflare-HTTP] curl-impersonate failed (code ${code}): ${errors.substring(0, 200)}`);
  } else {
    console.log(`[Cloudflare-HTTP] curl-impersonate failed (code ${code})`);
  }
}
```

## Testing Results

✓ **Binary works correctly** with proper timeout flags
✓ **Exit code 0** on successful requests
✓ **Proper HTTP responses** received from Cloudflare-protected sites

Example successful output:
```
HTTP/2 403
cache-control: private, max-age=0
cf-mitigated: challenge
server: cloudflare
```

The HTTP bypass returns Cloudflare's challenge page (403), which is expected for aggressive sites that require JavaScript execution. The browser fallback then takes over.

## Installation Status

✓ curl-impersonate v0.6.1 installed to `/home/sumanth/Projects/QA-Agents/bin/`
✓ All wrapper scripts (curl_chrome*, curl_ff*, curl_edge*) present
✓ Main binary (curl-impersonate-chrome) present and working
✓ Code integration fixed and verified
✓ No linter errors

## Next Steps

The system is now ready to use:

1. Start dev server: `npm run dev`
2. Test with Cloudflare site: `curl -X POST http://localhost:8080/api/discover ...`
3. Monitor logs for: `[Cloudflare-HTTP] Using local curl-impersonate from project bin`

## Expected Behavior

For Cloudflare Turnstile-protected sites:

1. **HTTP-level bypass attempt** (2-5 seconds)
   - Uses curl-impersonate with correct timeout flags
   - May get 403/challenge response
   - Logs success or falls back gracefully

2. **Browser-level bypass** (15-30 seconds)
   - Uses Playwright with stealth techniques
   - Simulates user interaction
   - Higher success rate for aggressive sites

3. **Content extraction** (final fallback)
   - Extracts available content even if full bypass fails
   - Better than no results

---

**Status**: ✓ FIXED and VERIFIED  
**Installation Date**: March 13, 2026  
**Fix Date**: March 13, 2026
