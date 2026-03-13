# Article Discovery Improvements for eatthis.com

## Problem
The `eatthis.com` job was discovering 0 articles even though:
- ✅ Swarm was using single browser (maxParallel=1)
- ✅ Browser pooling was working
- ❌ Article discovery returned 0 URLs

## Root Causes Identified
1. **Strict link filtering**: The homepage crawl was filtering links too aggressively with `pathname !== '/'` check
2. **Poor link count logging**: No visibility into how many links were actually extracted
3. **Generic LLM prompt**: The LLM wasn't optimized for food/lifestyle sites like eatthis.com

## Changes Made

### 1. Enhanced Homepage Crawl (`discover.js` - `discoverFromHomepage` function)
```javascript
- Changed page load: waitUntil: 'networkidle' (instead of 'domcontentloaded')
  → Ensures more content is loaded before extracting links
  
- Improved link extraction:
  - Removed overly strict hostname matching
  - Filter by pathname only AFTER extracting all links
  - Better error handling with try-catch per link
  - Added detailed logging: total links extracted vs. filtered

- Better wait times: 3000ms (instead of 2000ms) for page render
```

### 2. Improved LLM Prompt for Article Identification
```javascript
Enhanced system prompt to:
- Explicitly include food/lifestyle article indicators
- Better patterns for identifying article URLs (dates, slugs, depths)
- Clearer exclusion patterns for utility pages
- More robust JSON response handling
```

## Expected Improvements

### Before
```
[Discovery] Found 0 links (or very few)
[Discovery] LLM identified 0 articles
[Swarm][Discovery] Discovered 0 URLs to test
```

### After
```
[Discovery] Extracted 45 total links, 38 after filtering
[Discovery] Sending 38 links to LLM for article identification...
[Discovery] ✅ LLM identified 8 articles from 38 links
[Swarm][Discovery] Discovered 8 URLs to test
```

## How to Verify

1. Restart `npm run dev`
2. Visit http://localhost:9002/qa-dashboard
3. Submit a new job with domain: `https://eatthis.com`
4. Check the logs for:
   - `[Discovery] Extracted X total links` - should be > 0
   - `[Discovery] LLM identified X articles` - should be > 0
   - Browser should **only launch once** for the domain
   - Articles should be processed sequentially using the **same pooled browser**

## Behavior You Should See

✅ **Single browser**: One browser launch for eatthis.com discovery
✅ **Better link extraction**: Now sees all internal links on homepage
✅ **LLM-powered filtering**: Intelligent article identification even for challenging sites
✅ **Sequential processing**: Single browser reused for all articles
