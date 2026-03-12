# curl-impersonate Quick Start

## Installation Complete ✓

curl-impersonate v0.6.1 has been installed locally to the project.

### Location
```
/home/sumanth/Projects/QA-Agents/bin/
```

### Available Commands
- `curl_chrome116` - Chrome 116 impersonation (recommended)
- `curl_chrome110`, `curl_chrome107`, `curl_chrome104`, `curl_chrome101`, `curl_chrome100` - Alternative versions
- `curl_ff117`, `curl_ff109`, etc. - Firefox versions
- `curl_edge101`, `curl_edge99` - Edge versions

## Quick Test

### Test 1: Verify Binary Works
```bash
cd /home/sumanth/Projects/QA-Agents
./bin/curl_chrome116 --version
```

### Test 2: Simple Cloudflare Test
```bash
./bin/curl_chrome116 -i https://example.com
```

### Test 3: With the QA-Agents API
```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:8080/api/discover \
  -H "Content-Type: application/json" \
  -d '{"url": "https://thebrakereport.com"}'
```

## How It's Used in Code

The `cloudflare-http.js` module automatically:
1. Finds the local `curl_chrome116` installation
2. Uses it to bypass Cloudflare at the HTTP level
3. Falls back to other Chrome versions if needed
4. Falls back to system curl if local not found

### Code Changes Made
- Updated `agents/shivani/src/cloudflare-http.js` to auto-detect local installation
- Code now checks `PROJECT_BIN_DIR` first before trying system PATH

## Expected Behavior

When testing a Cloudflare-protected site:

### Console Output Should Show:
```
[Cloudflare-HTTP] Using local curl-impersonate from project bin
[Cloudflare-HTTP] Attempting curl-impersonate for Cloudflare bypass...
[Cloudflare-HTTP] ✓ Got cf_clearance cookie!
```

### Success
- Cloudflare bypass completes in 2-5 seconds
- Articles are discovered
- No CAPTCHA required

### Fallback
- If HTTP bypass times out, browser automation takes over
- If browser bypass fails, content is extracted anyway

## Troubleshooting

### Binary Not Found
```bash
ls -la /home/sumanth/Projects/QA-Agents/bin/curl_chrome116
# Should show the file exists
```

### Binary Not Executable
```bash
chmod +x /home/sumanth/Projects/QA-Agents/bin/curl_chrome*
chmod +x /home/sumanth/Projects/QA-Agents/bin/curl-impersonate-chrome
```

### Verify Node Module Integration
```bash
cd /home/sumanth/Projects/QA-Agents/agents/shivani
node -e "import('./src/cloudflare-http.js').then(m => console.log('OK:', Object.keys(m)))"
```

## Next Steps

1. Start the dev server: `npm run dev`
2. Test with a Cloudflare-protected URL
3. Check the logs for HTTP bypass success messages
4. Monitor performance (should be much faster than browser-only bypass)

---

**Status**: Ready to use  
**Installed**: March 13, 2026  
**Integration**: Automatic (no code changes needed to use)
