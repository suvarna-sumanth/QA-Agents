#!/bin/bash

# Test script to verify Cloudflare bypass implementations
# Tests each layer of the bypass strategy

set -e

DOMAIN="${1:-https://thebrakereport.com}"
COLORS_ENABLED=true

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo "=================================="
echo "Cloudflare Bypass Test Suite"
echo "=================================="
echo "Domain: $DOMAIN"
echo ""

# Test 1: Check for curl-impersonate
log_info "Test 1: Checking for curl-impersonate..."
if command -v curl-impersonate &> /dev/null; then
    log_success "curl-impersonate is installed"
    CURL_IMPERSONATE_AVAILABLE=true
else
    log_warn "curl-impersonate not found - HTTP-level bypass will be limited"
    CURL_IMPERSONATE_AVAILABLE=false
fi
echo ""

# Test 2: Try HTTP-level bypass with curl-impersonate
if [ "$CURL_IMPERSONATE_AVAILABLE" = true ]; then
    log_info "Test 2: Attempting HTTP-level bypass with curl-impersonate..."
    
    if curl-impersonate chrome101 \
        -L \
        -i \
        -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
        -H "Accept-Language: en-US,en;q=0.9" \
        -H "Accept-Encoding: gzip, deflate" \
        -H "DNT: 1" \
        --timeout 30 \
        "$DOMAIN" 2>/dev/null | grep -q "cf_clearance"; then
        log_success "Got cf_clearance cookie with curl-impersonate!"
    else
        log_warn "No cf_clearance cookie or challenge may not exist"
    fi
    echo ""
fi

# Test 3: Check if Node.js is available
log_info "Test 3: Checking Node.js setup..."
if command -v node &> /dev/null; then
    log_success "Node.js is installed"
    node --version
else
    log_error "Node.js not found"
    exit 1
fi
echo ""

# Test 4: Check if required npm packages are installed
log_info "Test 4: Checking npm packages..."
cd "$(dirname "$0")/agents/shivani"

REQUIRED_PACKAGES=("playwright" "rebrowser-playwright")
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if npm list "$pkg" &> /dev/null || grep -q "$pkg" package.json; then
        log_success "$pkg is available"
    else
        log_error "$pkg not found"
    fi
done
echo ""

# Test 5: Run actual discovery test
log_info "Test 5: Running discovery test with QA-Agents..."
log_warn "This may take 2-5 minutes..."
echo ""

cd "$(dirname "$0")"
timeout 300 npm run dev > /tmp/qa-agents-test.log 2>&1 &
DEV_PID=$!

# Wait for dev server to start
sleep 3

# Submit a job
log_info "Submitting discovery job to API..."
RESPONSE=$(curl -s -X POST http://localhost:9003/api/jobs \
  -H "Content-Type: application/json" \
  -d "{\"mission\": {\"site\": \"$DOMAIN\", \"articleUrls\": [\"$DOMAIN\"]}}")

echo "Response: $RESPONSE"

# Check response
if echo "$RESPONSE" | grep -q "jobId"; then
    log_success "Job submitted successfully"
    JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
    log_info "Job ID: $JOB_ID"
    
    # Wait a bit and check logs
    sleep 10
    if grep -q "Challenge resolved\|cf_clearance\|Extracted.*links" /tmp/qa-agents-test.log; then
        log_success "Found successful bypass indicators in logs"
        grep "Challenge resolved\|cf_clearance\|Extracted.*links" /tmp/qa-agents-test.log | head -5
    else
        log_warn "No success indicators found yet - may still be processing"
    fi
else
    log_error "Failed to submit job"
    echo "$RESPONSE"
fi

# Cleanup
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true

echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
if [ "$CURL_IMPERSONATE_AVAILABLE" = true ]; then
    echo "✓ curl-impersonate available - HTTP-level bypass enabled"
else
    echo "⚠ curl-impersonate not available - consider installing for better Cloudflare support"
fi
echo ""
echo "For full logs, check: /tmp/qa-agents-test.log"
echo ""
echo "Documentation:"
echo "  - CLOUDFLARE_SOLUTION_SUMMARY.md - Complete solution architecture"
echo "  - CLOUDFLARE_REALITY_CHECK.md - Technical limitations and context"
echo "  - CLOUDFLARE_BYPASS_IMPROVEMENTS.md - Original improvements"
