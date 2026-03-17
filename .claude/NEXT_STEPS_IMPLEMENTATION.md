---
name: Implementation Roadmap for Remaining Issues
description: Specific, actionable next steps to resolve thehill.com and thebrakereport.com failures
type: project
---

# Next Steps: Fixing thehill.com and thebrakereport.com

**Status**: Both domains are currently failing due to HTTP-level WAF blocking.
**Date**: March 18, 2026
**Context**: Proxy rotation infrastructure is in place but insufficient.

---

## Current Situation

### What's Working ✅
- Module loading (ESM/CJS fixed)
- Agent skill execution
- Audio detection improvements
- Screenshot grouping by URL
- HTTP error handling (graceful degradation)
- Proxy rotation system (infrastructure in place)

### What's Broken ❌
1. **thehill.com**: PerimeterX HTTP 403 on all BrightData zones
2. **thebrakereport.com**: Cloudflare challenge not fully bypassed

### Why Proxy Rotation Alone Doesn't Work
```
User Request → BrightData Proxy → PerimeterX Server
PerimeterX checks: "Is this BrightData IP flagged?"
Response: HTTP 403 Forbidden (before page renders)
Browser receives: Error page (not article content)
Result: No player element to test
```

All 4 proxy zones (residential_proxy1-4) appear flagged in PerimeterX's database.

---

## Option 1: Use Alternative Test Domain (Immediate Fix)

**Best for**: Validation that system works, quick wins
**Effort**: 1 hour
**Impact**: Unblocks testing without thehill.com

### Implementation
1. Choose a Cloudflare-protected news site instead
2. Update test configuration
3. Verify all skills work

### Alternative Domains to Test
- **thebrakereport.com** (Cloudflare, mostly working)
- **foxnews.com** (Cloudflare)
- **cnbc.com** (Cloudflare)
- **bbc.com** (Simple WAF)
- Local news sites using Cloudflare

### Code Change Required
```typescript
// In test configuration or dashboard
const TEST_DOMAINS = [
  { url: 'https://thebrakereport.com', protection: 'cloudflare', status: 'working' },
  // { url: 'https://thehill.com', protection: 'perimeterx', status: 'blocked-http' },
];
```

**Pros**: Immediate validation
**Cons**: Doesn't solve thehill.com testing requirement

---

## Option 2: Implement curl-impersonate (Medium Effort)

**Best for**: Full PerimeterX bypass capability
**Effort**: 2-3 days
**Impact**: Enable testing ANY HTTP-protected site

### What is curl-impersonate?
- HTTP client that perfectly spoof Chrome at byte-level
- Bypasses PerimeterX, Cloudflare, most WAF at HTTP layer
- Works by replicating exact TLS/HTTP fingerprints

### Implementation Steps

#### Step 1: Install curl-impersonate
```bash
# On EC2
sudo apt-get install curl-impersonate

# Or compile from source
git clone https://github.com/yifeikong/curl_cf_bypass
cd curl_cf_bypass && make
```

#### Step 2: Create Pre-fetch Worker
```javascript
// agents/shivani/src/curl-impersonate-fetcher.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function fetchWithCurlImpersonate(url, options = {}) {
  // Use curl-impersonate to fetch page at HTTP level
  // This bypasses PerimeterX 403 before browser sees it

  const curlCmd = [
    'curl_impersonate',
    'chrome112', // Spoof Chrome 112
    '-b', 'cookies.txt',
    '-c', 'cookies.txt',
    '-H', '"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit..."',
    `"${url}"`,
  ].join(' ');

  try {
    const { stdout } = await execAsync(curlCmd);
    return {
      success: true,
      html: stdout,
      cookies: await readCookies('cookies.txt'),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchArticlesWithCurlImpersonate(domain) {
  // Pre-fetch articles using curl-impersonate
  // Load fetched HTML into browser context
  // Avoids HTTP 403 at browser level

  const html = await fetchWithCurlImpersonate(`https://${domain}/`);
  if (!html.success) {
    console.log(`[curl-impersonate] Failed to fetch ${domain}`);
    return [];
  }

  // Parse HTML and extract article URLs
  const parser = new DOMParser();
  const doc = parser.parseFromString(html.html, 'text/html');
  const articles = Array.from(doc.querySelectorAll('a[href*="/article"]'))
    .map(a => a.href)
    .filter(h => h.startsWith('http'));

  return articles;
}
```

#### Step 3: Integrate into DiscoverArticlesSkill
```javascript
// agents/core/skills/DiscoverArticlesSkill.js
import { fetchArticlesWithCurlImpersonate } from '../../shivani/src/curl-impersonate-fetcher.js';

export class DiscoverArticlesSkill extends Skill {
  async execute(input, context) {
    const { domain } = input;

    // Try curl-impersonate first for PerimeterX sites
    if (domain.includes('thehill.com')) {
      const articles = await fetchArticlesWithCurlImpersonate(domain);
      if (articles.length > 0) {
        console.log(`[curl-impersonate] Fetched ${articles.length} articles from ${domain}`);
        return { articles, method: 'curl-impersonate' };
      }
    }

    // Fall back to browser automation for other sites
    const { browser, browserContext } = await launchForUrl(domain);
    // ... rest of browser-based discovery
  }
}
```

#### Step 4: Test
```bash
# SSH to EC2
ssh -i ~/.ssh/Website-Monitor.pem ec2-user@100.54.233.117

# Test curl-impersonate directly
curl_impersonate chrome112 https://thehill.com/homenews/ap/ | grep -i "player\|audio"

# If that works, the integration will work too
pm2 restart qa-agents
curl -X POST http://localhost:9002/api/jobs \
  -d '{"type":"domain","target":"https://thehill.com"}'
```

**Pros**: Solves HTTP-level WAF blocking permanently
**Cons**: External dependency, adds complexity

---

## Option 3: Use Datacenter Proxies (Lower Priority)

**Best for**: Redundancy if BrightData residential IPs remain flagged
**Effort**: 1 day
**Impact**: Alternative IP source if needed

### Implementation Sketch
```javascript
// agents/shivani/src/proxy-selection.js
export function selectProxyByZone(zone) {
  if (zone === 'brightdata-residential') {
    return getBrightDataResidentialProxy();
  } else if (zone === 'brightdata-datacenter') {
    return getBrightDataDatacenterProxy();
  } else if (zone === 'oxylabs-datacenter') {
    return getOxylabsDatacenterProxy();
  }
}
```

**Pros**: Quick fallback
**Cons**: Additional costs, still may not bypass PerimeterX

---

## Recommendation

### Immediate (Today)
1. ✅ Verify proxy rotation system is actively being used (check logs)
2. ✅ Document current limitations clearly
3. ✅ Test with thebrakereport.com to confirm Cloudflare path works

### Short-term (This Week)
1. **Implement curl-impersonate** for PerimeterX sites
2. Add integration test for thehill.com
3. Document in quick reference

### Medium-term (Next Sprint)
1. Add datacenter proxy option as fallback
2. Monitor PerimeterX IP reputation
3. Consider reaching out to thehill.com for direct API access

---

## Testing Checklist

After implementing any of these options:

- [ ] Submit thebrakereport.com job
  ```bash
  curl -X POST http://100.54.233.117:9002/api/jobs \
    -d '{"type":"domain","target":"https://thebrakereport.com","config":{"maxArticles":3}}'
  ```

- [ ] Check dashboard for "PASS" status
- [ ] Verify screenshots grouped by URL
- [ ] Check logs for proxy rotation messages
- [ ] Verify audio playback detection working

- [ ] (If curl-impersonate): Submit thehill.com job
  ```bash
  curl -X POST http://100.54.233.117:9002/api/jobs \
    -d '{"type":"domain","target":"https://thehill.com","config":{"maxArticles":3}}'
  ```

---

## Files That Need Changes

| File | Option 1 | Option 2 | Option 3 |
|------|----------|----------|----------|
| `agents/core/skills/DiscoverArticlesSkill.js` | No | ✅ Add curl-impersonate fallback | ✅ Add proxy selection |
| `agents/shivani/src/curl-impersonate-fetcher.js` | No | ✅ Create new | No |
| `agents/shivani/src/proxy-selection.js` | No | No | ✅ Create new |
| `.env.production` | No | ✅ Add CURL_IMPERSONATE_PATH | ✅ Add proxy creds |
| Test configuration | ✅ Update domains | No | No |

---

**Last Updated**: Mar 18, 2026
**Status**: Ready for user selection of approach
