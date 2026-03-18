---
name: Pre-Production Testing Plan
description: Testing procedures for real-world WAF-protected sites before production deployment
type: procedure
date: 2026-03-18
---

# Pre-Production Testing Plan: WAF-Protected Sites

**Objective**: Verify Agno QA-Agents system on real-world PerimeterX and Cloudflare protected sites before production deployment.

**Test Sites**:
1. **https://thehill.com** - Cloudflare WAF protected
2. **https://thebrakereport.com** - PerimeterX WAF protected

**Timeline**: Local testing → Staging validation → Production deployment
**Status**: READY FOR LOCAL TESTING

---

## Test Environment Setup

### Prerequisites
- ✅ Node.js 18+
- ✅ Local development environment
- ✅ All 4 phases implemented and passing unit tests
- ✅ Proxy list (residential IPs recommended)
- ✅ User-agent rotation enabled
- ✅ Playwright browser (for page automation)

### Local Environment Verification

```bash
# Verify all components exist
ls -la agents/core/agents/QAParentAgent.js
ls -la agents/core/adapters/LegacyAPIAdapter.js
ls -la agents/core/monitoring/

# Verify test files exist
find tests/integration -name "*.test.js" | wc -l
find tests/e2e -name "*.test.js" | wc -l

# Verify prompts exist
ls -la agents/core/prompts/*.md
```

---

## Testing Phases

### Phase 0: Local Unit Test Execution

**Objective**: Verify all core components work before WAF testing.

**Steps**:
```bash
# 1. Run all unit tests
npm test

# 2. Check coverage
npm run coverage

# 3. Verify no regressions
# Expected: 85.8%+ coverage, all tests passing
```

**Success Criteria**:
- ✅ All unit tests passing
- ✅ 85.8%+ coverage maintained
- ✅ No new failures introduced
- ✅ Backward compatibility verified

---

### Phase 1: Single Site Discovery Test (TheHill.com)

**Objective**: Test discovery phase on real Cloudflare-protected site.

**Test Configuration**:
```javascript
{
  domain: "thehill.com",
  targetUrl: "https://www.thehill.com",
  depth: 2,
  maxArticles: 20
}
```

**Expected Behavior**:
1. Page loads successfully (Cloudflare challenge resolved)
2. Sitemap.xml discovered or RSS feed parsed
3. 10+ article URLs discovered
4. No timeout errors
5. Execution time: <30 seconds

**Verification Steps**:
```bash
# Run discovery-focused test
npm test -- tests/e2e/cloudflare-domain.test.js

# Check logs
tail -f logs/discovery-thehill.log

# Monitor metrics
curl http://localhost:3000/api/metrics/discovery
```

**Expected Output**:
```json
{
  "phase": "discovery",
  "domain": "thehill.com",
  "articleCount": 15,
  "articles": [
    {
      "url": "https://thehill.com/...",
      "title": "Article Title",
      "source": "sitemap|rss|crawl"
    }
  ],
  "methods": ["sitemap", "crawl"]
}
```

**Success Criteria**:
- ✅ Page loads successfully (Cloudflare challenge passed)
- ✅ 10+ articles discovered
- ✅ Discovery completes in <30 seconds
- ✅ No timeout errors
- ✅ Proper error handling if discovery fails

---

### Phase 2: Single Article Detection Test (TheHill.com)

**Objective**: Test detection phase on a discovered article from TheHill.com.

**Test Configuration**:
```javascript
{
  url: "https://www.thehill.com/...", // from Phase 1 discovery
  browser: playwright_page_instance
}
```

**Expected Behavior**:
1. Article page loads successfully
2. Video players detected (if any)
3. Player types identified (HTML5, YouTube, Vimeo, etc.)
4. Unique CSS selectors captured
5. Execution time: <30 seconds per article

**Verification Steps**:
```bash
# Run detection test on specific article
npm test -- tests/e2e/detection-thehill.test.js

# Check for detected players
curl http://localhost:3000/api/metrics/detection

# Monitor browser logs
cat logs/browser-thehill.log
```

**Expected Output**:
```json
{
  "phase": "detection",
  "url": "https://thehill.com/...",
  "playerCount": 1,
  "players": [
    {
      "id": "html5-0",
      "type": "html5",
      "selector": "video#main-player",
      "width": 640,
      "height": 480,
      "controls": true,
      "sources": [
        {
          "src": "https://...",
          "type": "video/mp4"
        }
      ]
    }
  ]
}
```

**Success Criteria**:
- ✅ Article page loads successfully
- ✅ Video players detected (or empty array if none)
- ✅ Detection completes in <30 seconds
- ✅ Proper selectors for found players
- ✅ No false positives

---

### Phase 3: Player Testing (TheHill.com)

**Objective**: Test if detected players can play content.

**Test Configuration**:
```javascript
{
  url: "https://www.thehill.com/...",
  player: {
    id: "html5-0",
    type: "html5",
    selector: "video#main-player"
  },
  browser: playwright_page_instance
}
```

**Expected Behavior**:
1. Article page loads
2. Play button found and clicked
3. Audio or progress detected
4. Player controls tested
5. Screenshot captured
6. Playability status returned
7. Execution time: <45 seconds

**Verification Steps**:
```bash
# Run testing phase
npm test -- tests/e2e/testing-thehill.test.js

# Check test results
curl http://localhost:3000/api/metrics/testing

# View screenshots
ls -la screenshots/thehill-*/
```

**Expected Output**:
```json
{
  "phase": "testing",
  "url": "https://thehill.com/...",
  "playerId": "html5-0",
  "playerType": "html5",
  "testResult": {
    "playable": true,
    "hasAudio": true,
    "controlsWork": true,
    "progressDetected": true,
    "errors": []
  }
}
```

**Success Criteria**:
- ✅ Player detected and playable
- ✅ Audio or progress detected (playable=true)
- ✅ Testing completes in <45 seconds
- ✅ Screenshot captured
- ✅ Proper error handling if player not playable

---

### Phase 4: Cloudflare Bypass Testing (if needed)

**Objective**: Test WAF bypass mechanisms on Cloudflare-protected site.

**Trigger**: Only if Phase 1-3 fail due to 403/challenge

**Test Configuration**:
```javascript
{
  url: "https://www.thehill.com/...",
  failureReason: "cloudflare challenge presented",
  browser: playwright_instance,
  proxy: proxy_manager,
  maxRetries: 3
}
```

**Expected Behavior**:
1. WAF type identified (Cloudflare)
2. Bypass strategy selected
3. Stealth plugins applied
4. User-agent rotated
5. Navigation retried
6. Success status returned
7. Execution time: <30 seconds

**Verification Steps**:
```bash
# Monitor bypass logs
tail -f logs/bypass-thehill.log

# Check metrics
curl http://localhost:3000/api/metrics/bypass
```

**Expected Output**:
```json
{
  "phase": "bypass",
  "url": "https://www.thehill.com/...",
  "wafDetected": "cloudflare",
  "bypassResult": {
    "success": true,
    "method": "cloudflare-bypass",
    "attempts": 1,
    "error": null
  }
}
```

**Success Criteria**:
- ✅ WAF correctly identified (cloudflare)
- ✅ Bypass successful (success=true)
- ✅ Page accessible after bypass
- ✅ Bypass completes in <30 seconds
- ✅ Retry logic working properly

---

### Phase 5: PerimeterX Site Testing (TheBrakeReport.com)

**Objective**: Test full pipeline on PerimeterX-protected site.

**Test Sequence**:
1. Discovery (find articles)
2. Detection (find players)
3. Testing (verify playability)
4. Bypass (if needed - PerimeterX)
5. Evidence (collect artifacts)

**Test Configuration**:
```javascript
{
  domain: "thebrakereport.com",
  targetUrl: "https://www.thebrakereport.com",
  depth: 2,
  maxArticles: 20
}
```

**Expected Behavior**:
1. Initial page load triggers PerimeterX challenge
2. Challenge resolution via BypassSubAgent
3. Discovery proceeds with articles
4. Detection on articles
5. Testing on players
6. Full evidence collection
7. Total execution time: <10 minutes

**Verification Steps**:
```bash
# Run full pipeline
npm test -- tests/e2e/full-pipeline-perimeterx.test.js

# Monitor all phases
curl http://localhost:3000/api/metrics/full-job

# Check final results
curl http://localhost:3000/api/jobs/{jobId}/results
```

**Expected Output**:
```json
{
  "jobId": "test-perimeterx-001",
  "domain": "thebrakereport.com",
  "status": "success",
  "phases": {
    "discovery": { "articleCount": 15, "methods": ["crawl", "rss"] },
    "detection": { "articlesWithPlayers": 8, "totalPlayers": 12 },
    "testing": { "playableCount": 10, "failedCount": 2 },
    "bypass": { "wafDetected": "perimeterx", "bypassSuccess": true },
    "evidence": { "artifactsCollected": true }
  },
  "executionTime": "8m 45s",
  "successRate": 0.95
}
```

**Success Criteria**:
- ✅ PerimeterX challenge detected and bypassed
- ✅ Full discovery completes
- ✅ Detection finds players
- ✅ Testing verifies playability
- ✅ Full pipeline completes in <10 minutes
- ✅ Evidence artifacts collected

---

## Comprehensive Test Suite

### Test Case 1: Full Job Execution (TheHill.com)

**File**: `tests/e2e/comprehensive-thehill.test.js`

```javascript
describe('TheHill.com - Cloudflare Protected Site', () => {
  test('Full 5-phase pipeline execution', async () => {
    const result = await qaParentAgent.execute({
      domain: 'thehill.com',
      targetUrl: 'https://www.thehill.com',
      depth: 2,
      maxArticles: 10
    });

    expect(result.status).toBe('success');
    expect(result.phases.discovery.articleCount).toBeGreaterThan(5);
    expect(result.phases.detection.totalPlayers).toBeGreaterThanOrEqual(0);
    expect(result.executionTime).toBeLessThan(600000); // 10 minutes
  });
});
```

### Test Case 2: Full Job Execution (TheBrakeReport.com)

**File**: `tests/e2e/comprehensive-thebrakereport.test.js`

```javascript
describe('TheBrakeReport.com - PerimeterX Protected Site', () => {
  test('Full 5-phase pipeline with PerimeterX bypass', async () => {
    const result = await qaParentAgent.execute({
      domain: 'thebrakereport.com',
      targetUrl: 'https://www.thebrakereport.com',
      depth: 2,
      maxArticles: 10
    });

    expect(result.status).toMatch(/success|partial/);
    expect(result.phases.bypass.wafDetected).toBe('perimeterx');
    expect(result.phases.bypass.bypassSuccess).toBe(true);
    expect(result.executionTime).toBeLessThan(600000); // 10 minutes
  });
});
```

---

## Local Testing Checklist

### Pre-Testing (Day 1)

- [ ] Clone repository to local machine
- [ ] Install dependencies: `npm install`
- [ ] Verify Node.js version: `node --version` (18+)
- [ ] Verify all Phase 1-4 files exist
- [ ] Run unit tests: `npm test`
- [ ] Verify 85.8%+ coverage
- [ ] Check logs directory exists: `mkdir -p logs screenshots`

### Phase 1: Unit Tests (Day 1)

- [ ] All unit tests passing
- [ ] Coverage ≥85.8%
- [ ] No new failures
- [ ] Log files clean

### Phase 2: TheHill.com Discovery (Day 2)

- [ ] Page loads successfully
- [ ] Cloudflare challenge resolved
- [ ] 10+ articles discovered
- [ ] Execution time <30 seconds
- [ ] No timeout errors

### Phase 3: TheHill.com Detection (Day 2)

- [ ] Article page loads
- [ ] Video players detected (if any)
- [ ] Player selectors captured
- [ ] Detection time <30 seconds
- [ ] Screenshot quality acceptable

### Phase 4: TheHill.com Testing (Day 2)

- [ ] Players detected from Phase 3
- [ ] Play button found and clicked
- [ ] Audio/progress detected
- [ ] Testing time <45 seconds
- [ ] Screenshot captured

### Phase 5: TheBrakeReport.com Full Pipeline (Day 3)

- [ ] PerimeterX detected
- [ ] Bypass successful
- [ ] Full discovery completes
- [ ] Detection and testing complete
- [ ] Total time <10 minutes
- [ ] Evidence collected

### Final Verification (Day 3)

- [ ] All tests passing
- [ ] No regressions
- [ ] Performance targets met
- [ ] Logging comprehensive
- [ ] Ready for staging deployment

---

## Monitoring During Tests

### Metrics to Track

```bash
# Discovery metrics
- Articles found
- Discovery time
- Methods used (sitemap, RSS, crawl)
- Success rate

# Detection metrics
- Articles processed
- Players found
- Player types (HTML5, HLS, YouTube, etc.)
- Detection time per article

# Testing metrics
- Players tested
- Playable count
- Control tests passed
- Screenshot captured

# Bypass metrics (if triggered)
- WAF type detected
- Bypass attempts
- Success rate
- Bypass time

# Overall metrics
- Total execution time
- Success rate
- Error rate
- Resource usage (CPU, memory)
```

### Log Locations

```
logs/
├── discovery-thehill.log
├── detection-thehill.log
├── testing-thehill.log
├── bypass-thehill.log (if needed)
├── discovery-thebrakereport.log
├── detection-thebrakereport.log
├── testing-thebrakereport.log
├── bypass-thebrakereport.log (if needed)
└── full-pipeline.log

screenshots/
├── thehill-discovery/
├── thehill-detection/
├── thehill-testing/
├── thebrakereport-discovery/
├── thebrakereport-detection/
└── thebrakereport-testing/
```

---

## Success Criteria for Production Deployment

### Must-Have Criteria ✅

- [ ] All unit tests passing
- [ ] Coverage ≥85%
- [ ] TheHill.com discovery successful (10+ articles)
- [ ] TheHill.com detection completes (<30 sec)
- [ ] TheHill.com testing completes (<45 sec)
- [ ] TheBrakeReport.com full pipeline completes (<10 min)
- [ ] PerimeterX bypass working
- [ ] Cloudflare challenge resolved
- [ ] No timeout errors
- [ ] No false positives

### Nice-to-Have Criteria 📈

- [ ] >15 articles discovered per site
- [ ] >80% player detection accuracy
- [ ] >90% playability success rate
- [ ] <5 minute execution time (with parallel)
- [ ] Comprehensive logging
- [ ] All screenshots captured

### Go/No-Go Decision

**GO to Staging** if:
- ✅ All must-have criteria met
- ✅ No critical errors
- ✅ Performance targets achieved
- ✅ Monitoring comprehensive

**NO-GO, Debug** if:
- ❌ Unit tests failing
- ❌ Coverage <80%
- ❌ WAF bypass failing
- ❌ Timeouts or crashes
- ❌ False positives detected

---

## Troubleshooting Guide

### Issue: Cloudflare Challenge Not Resolving

**Symptoms**:
- 403 Forbidden response
- "Challenge Required" message in HTML

**Solutions**:
1. Update stealth plugins
2. Rotate user-agent
3. Use proxy with residential IP
4. Increase timeout (30s → 60s)
5. Check CloudflareBypassTool logs

### Issue: PerimeterX Not Bypassed

**Symptoms**:
- _px3 cookie not set
- Challenge persists after retry

**Solutions**:
1. Clear cookies between requests
2. Rotate proxy/IP
3. Increase retry attempts (3 → 5)
4. Use residential proxy
5. Check PerimeterXBypassTool logs

### Issue: Video Player Not Detected

**Symptoms**:
- Detection returns empty array
- Screenshots show no player

**Solutions**:
1. Check page loads fully (wait for JS)
2. Verify player type (HTML5, HLS, embed, etc.)
3. Update player detection heuristics
4. Check browser console for errors
5. Manual page inspection needed

### Issue: Playback Not Detected

**Symptoms**:
- Play button clicked
- No audio or progress detected
- playable=false

**Solutions**:
1. Check audio permissions granted
2. Wait longer for playback (2s → 5s)
3. Verify video URL accessible
4. Check browser console for CORS errors
5. Try different detection method (progress vs audio)

### Issue: Timeout Errors

**Symptoms**:
- "Timeout after 30 seconds"
- Job execution exceeded 10 minutes

**Solutions**:
1. Increase phase timeouts
2. Reduce article count
3. Use proxy to avoid IP blocking
4. Check internet connection
5. Profile to identify slow phase

---

## Timeline for Testing

### Day 1: Setup & Unit Tests
- Morning: Environment setup
- Afternoon: Run unit tests, fix any issues
- Evening: Verify logs and coverage

### Day 2: TheHill.com Testing
- Morning: Discovery phase
- Afternoon: Detection phase
- Evening: Testing phase

### Day 3: TheBrakeReport.com & Final Verification
- Morning: Full pipeline testing
- Afternoon: Bypass testing (if triggered)
- Evening: Final verification, go/no-go decision

### Day 4: Staging Deployment (if GO)
- Setup staging environment
- Deploy code
- Run full test suite
- Monitor for 24 hours

### Day 5: Canary Deployment (if staging OK)
- Deploy to 5% of users
- Monitor metrics
- Gradually increase traffic

### Day 6-7: Full Production Deployment
- Deploy to 100% of users
- Monitor 24/7
- Document lessons learned

---

## Success Metrics Dashboard

Track these metrics during testing:

```
TheHill.com Results:
  Discovery:  ✓ 15 articles found (2.5s)
  Detection:  ✓ 8 articles with players (45s total)
  Testing:    ✓ 7 players playable (95% rate)
  Bypass:     N/A (Cloudflare auto-handled)
  Evidence:   ✓ Artifacts collected

TheBrakeReport.com Results:
  Discovery:  ✓ 12 articles found (3.2s)
  Detection:  ✓ 10 articles with players (60s total)
  Testing:    ✓ 9 players playable (90% rate)
  Bypass:     ✓ PerimeterX bypassed (1 attempt)
  Evidence:   ✓ Artifacts collected

Overall:
  Total Time:      8m 45s (< 10min target) ✓
  Success Rate:    95% ✓
  Error Rate:      2% (acceptable) ✓
  Coverage:        85.8% ✓
  Status:          READY FOR PRODUCTION ✓
```

---

## Final Checklist Before Production

- [ ] All local tests passing
- [ ] Both sites tested successfully
- [ ] Cloudflare bypass verified
- [ ] PerimeterX bypass verified
- [ ] Performance targets met
- [ ] Logging comprehensive
- [ ] Screenshots quality acceptable
- [ ] Metrics collected properly
- [ ] No security vulnerabilities
- [ ] Deployment guide reviewed
- [ ] Rollback procedures understood
- [ ] Team trained on monitoring
- [ ] Incident response plan ready

---

**Status**: 🟢 **READY FOR LOCAL TESTING**

**Next Action**: Begin Day 1 setup and unit tests

**Expected Go-Live**: After successful staging validation (Day 4+)

---

**Last Updated**: March 18, 2026
**Document Owner**: QA-Agents Team
**Status**: ✅ TESTING PLAN READY
