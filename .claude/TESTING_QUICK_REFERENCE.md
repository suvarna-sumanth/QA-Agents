---
name: Testing Quick Reference Card
description: Quick commands and checklist for WAF site testing
type: reference
date: 2026-03-18
---

# Quick Reference: Testing Commands

## Pre-Testing Setup

```bash
# Clone and setup
git clone <repo> qa-agents-local
cd qa-agents-local
npm install

# Verify environment
node --version  # Should be 18+
npm --version   # Should be 8+
ls agents/core/agents/QAParentAgent.js  # Should exist

# Create directories
mkdir -p logs screenshots logs/{thehill,thebrakereport}
```

## Day 1: Unit Tests

```bash
# Run all tests
npm test

# Check coverage
npm run coverage

# Expected: 85.8%+ coverage, all tests passing
```

## Day 2: TheHill.com Testing

### Discovery Phase
```bash
# Run discovery test
npm test -- tests/e2e/discovery-thehill.test.js

# Check results
tail -f logs/discovery-thehill.log

# Expected output
echo "Expected: 10+ articles discovered in <30 seconds"
```

### Detection Phase
```bash
# Run detection test
npm test -- tests/e2e/detection-thehill.test.js

# Check results
tail -f logs/detection-thehill.log

# View screenshots
ls -la screenshots/thehill-detection/

# Expected: Players detected (or empty array if none)
```

### Testing Phase
```bash
# Run testing phase
npm test -- tests/e2e/testing-thehill.test.js

# Check results
tail -f logs/testing-thehill.log

# View screenshots
ls -la screenshots/thehill-testing/

# Expected: Playability status returned
```

## Day 3: TheBrakeReport.com Full Pipeline

### Full Job Execution
```bash
# Run complete pipeline
npm test -- tests/e2e/comprehensive-thebrakereport.test.js

# Monitor in real-time
tail -f logs/full-pipeline.log

# Check metrics endpoint
curl http://localhost:3000/api/metrics/full-job

# Expected: 5-phase execution, <10 minutes
```

### Verify PerimeterX Bypass
```bash
# Check bypass logs
tail -f logs/bypass-thebrakereport.log

# Expected: "wafDetected": "perimeterx", "success": true
```

## Troubleshooting Commands

### Check if Page Loads
```bash
# Using curl
curl -I https://thehill.com
curl -I https://thebrakereport.com

# Expected: HTTP 200 (or 403 if Cloudflare challenge)
```

### View Browser Console
```bash
# In test, enable verbose logging
DEBUG=* npm test -- tests/e2e/detection-thehill.test.js

# Check browser.log
cat logs/browser-thehill.log
```

### Test Proxy Rotation
```bash
# Verify proxy is set
echo $PROXY_LIST

# Test proxy connection
curl -x <proxy-url> https://thehill.com

# Expected: 200 OK or 403 (Cloudflare)
```

### Increase Timeout
```javascript
// In test file
jest.setTimeout(60000); // 60 seconds instead of 30
```

### Debug Player Detection
```bash
# Run detection with verbose logging
NODE_DEBUG=* npm test -- tests/e2e/detection-thehill.test.js

# Check what elements were found
grep -i "player" logs/detection-thehill.log
```

## Testing Checklist

### ✓ Day 1: Setup & Unit Tests
```
☐ Environment setup (Node.js 18+, npm)
☐ Dependencies installed
☐ All Phase 1-4 files exist
☐ Log and screenshot directories created
☐ Unit tests running
☐ Coverage ≥85.8%
☐ No test failures
```

### ✓ Day 2: TheHill.com
```
☐ Discovery: 10+ articles found
☐ Discovery time: <30 seconds
☐ Cloudflare challenge resolved (no 403)
☐ Detection: Players found/empty array
☐ Detection time: <30 seconds per article
☐ Testing: Playability determined
☐ Testing time: <45 seconds per player
☐ Screenshots captured
☐ No timeout errors
```

### ✓ Day 3: TheBrakeReport.com
```
☐ PerimeterX challenge detected
☐ Bypass successful (success=true)
☐ Discovery: Articles found
☐ Detection: Players found
☐ Testing: Playability verified
☐ Full pipeline time: <10 minutes
☐ Evidence collected
☐ All logs present
☐ Screenshots quality acceptable
```

### ✓ Final: Go/No-Go Decision
```
☐ All unit tests passing
☐ Both sites tested successfully
☐ No critical errors
☐ Performance targets met
☐ Logging comprehensive
☐ Ready for staging deployment
```

## Success Metrics

### TheHill.com Expected Results
```
Discovery:   ✓ 10-20 articles
             ✓ Time: 2-5 seconds
             ✓ Methods: sitemap, RSS, or crawl

Detection:   ✓ 5-10 articles with players
             ✓ Time: 30-60 seconds total
             ✓ Player types detected

Testing:     ✓ 80%+ playable
             ✓ Time: 45-90 seconds total
             ✓ Screenshots captured

Bypass:      N/A (Cloudflare auto-handled)

Overall:     ✓ Time: <5 minutes
             ✓ Success: 90%+
```

### TheBrakeReport.com Expected Results
```
Discovery:   ✓ 10-20 articles
             ✓ Time: 2-5 seconds

Detection:   ✓ 5-10 articles with players
             ✓ Time: 30-60 seconds total

Testing:     ✓ 80%+ playable
             ✓ Time: 45-90 seconds total

Bypass:      ✓ PerimeterX detected
             ✓ Bypass success: 1 attempt
             ✓ Time: 10-30 seconds

Overall:     ✓ Time: 8-10 minutes
             ✓ Success: 90%+
             ✓ Evidence collected
```

## If Tests Fail

### Discovery Fails
```bash
# Check page loads
curl https://thehill.com | head -100

# Check sitemap
curl https://thehill.com/sitemap.xml | head -20

# Enable verbose logging
DEBUG=discovery npm test -- tests/e2e/discovery-thehill.test.js
```

### Detection Fails
```bash
# Check if page loads in browser
npm test -- tests/e2e/detection-thehill.test.js --verbose

# Check for player selectors
grep -i "video\|iframe\|player" logs/detection-thehill.log
```

### Bypass Fails
```bash
# Check WAF type detection
grep "wafDetected" logs/bypass-thebrakereport.log

# Check bypass attempts
grep "bypassResult" logs/bypass-thebrakereport.log

# Try manual bypass with proxy
curl -x <proxy> https://thebrakereport.com
```

### Timeout
```bash
# Check what phase timed out
grep "timeout\|TIMEOUT" logs/full-pipeline.log

# Increase timeout in test
jest.setTimeout(120000); // 2 minutes

# Re-run test
npm test -- tests/e2e/comprehensive-thebrakereport.test.js
```

## Important Environment Variables

```bash
# Set before running tests
export PROXY_LIST="<proxy1>,<proxy2>,<proxy3>"
export DEBUG=qa-agents:*
export NODE_ENV=testing
export BROWSER_HEADLESS=true
export LOG_LEVEL=info
```

## Log Inspection Commands

```bash
# View real-time logs
tail -f logs/full-pipeline.log

# Search for errors
grep -i "error\|fail" logs/*.log

# Count log entries per phase
grep "Discovery:" logs/*.log | wc -l
grep "Detection:" logs/*.log | wc -l
grep "Testing:" logs/*.log | wc -l
grep "Bypass:" logs/*.log | wc -l

# Find slowest operations
grep "duration\|time" logs/*.log | sort -t: -k3 -rn | head -10

# Check for WAF detection
grep "cloudflare\|perimeterx" logs/*.log
```

## Metrics Collection

```bash
# If using metrics endpoint
curl http://localhost:3000/api/metrics/discovery
curl http://localhost:3000/api/metrics/detection
curl http://localhost:3000/api/metrics/testing
curl http://localhost:3000/api/metrics/bypass
curl http://localhost:3000/api/metrics/evidence
curl http://localhost:3000/api/metrics/full-job

# Parse metrics
curl http://localhost:3000/api/metrics/full-job | jq .
```

## Decision Tree

```
Are all unit tests passing?
  ├─ NO  → Debug and fix issues
  └─ YES → Continue

Is coverage ≥85%?
  ├─ NO  → Add missing tests
  └─ YES → Continue

Did TheHill.com testing succeed?
  ├─ NO  → Check Cloudflare bypass
  └─ YES → Continue

Did TheBrakeReport.com succeed?
  ├─ NO  → Check PerimeterX bypass
  └─ YES → Continue

Are all performance targets met?
  ├─ NO  → Profile and optimize
  └─ YES → Continue

Did evidence collection work?
  ├─ NO  → Check S3/artifact storage
  └─ YES → READY FOR STAGING

GO/NO-GO: If all YES → GO to staging deployment
```

---

**Use this for quick reference during testing. Full details in PRE_PRODUCTION_TESTING_PLAN.md**

**Status**: 🟢 **READY FOR TESTING**
