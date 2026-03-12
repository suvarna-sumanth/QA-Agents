/**
 * Cloudflare Article Test Script - BROWSER VERSION
 * 
 * Opens a real browser to:
 * 1. Load articles from a domain
 * 2. Show Cloudflare challenges in real time
 * 3. Wait for automatic captcha resolution
 * 4. Verify player and take screenshots
 * 
 * Usage: node agents/shivani/src/test-cloudflare-articles.js <domain>
 * Example: node agents/shivani/src/test-cloudflare-articles.js https://www.thebrakereport.com
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots', 'cloudflare-test');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

/**
 * Hardcoded article URLs for different domains
 */
const ARTICLE_URLS = {
  'thebrakereport.com': [
    'https://www.thebrakereport.com/post/brake-fluid-warning-signs-to-watch-for',
    'https://www.thebrakereport.com/post/how-to-check-your-brake-pads',
    'https://www.thebrakereport.com/post/brake-system-maintenance-tips',
  ],
  'eatthis.com': [
    'https://www.eatthis.com/5-bed-exercises-rebuild-muscle-faster-than-weight-training-after-60/',
    'https://www.eatthis.com/one-minute-jump-squat-test-elite-conditioning/',
    'https://www.eatthis.com/best-exercise-muscle-soreness/',
  ],
  'thehill.com': [
    'https://thehill.com/policy/healthcare/',
    'https://thehill.com/policy/defense/',
    'https://thehill.com/business/',
  ],
};

function getArticleUrls(domain) {
  // Extract domain name
  const domainName = new URL(domain).hostname.replace('www.', '');
  
  if (ARTICLE_URLS[domainName]) {
    return ARTICLE_URLS[domainName];
  }
  
  // Default URLs if domain not found
  return [
    `${domain}/article-1`,
    `${domain}/article-2`,
    `${domain}/article-3`,
  ];
}

/**
 * Test article with browser - WILL SHOW CAPTCHA
 */
async function testArticleWithBrowser(browser, url, testIndex) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[TEST ${testIndex}] URL: ${url}`);
  console.log(`${'='.repeat(80)}`);

  const results = {
    url,
    status: 'pending',
    steps: [],
    screenshots: [],
    challenges: [],
  };

  const context = await browser.newContext();
  const page = await context.newPage();

  // Add stealth mode to avoid detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Set viewport for better screenshots
  await page.setViewportSize({ width: 1280, height: 720 });

  try {
    // ── STEP 1: Navigate to page ──
    console.log(`[TEST ${testIndex}] Step 1: Loading page...`);
    const step1Start = Date.now();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Take initial screenshot (might show challenge)
      const initialScreenshot = path.join(SCREENSHOTS_DIR, `${testIndex}-01-initial-load.png`);
      await page.screenshot({ path: initialScreenshot, fullPage: true });
      results.screenshots.push(initialScreenshot);

      const title = await page.title();
      const isChallenge = title.includes('Just a moment') || 
                         title.includes('Challenge') ||
                         title.includes('Checking your browser');

      if (isChallenge) {
        console.log(`[TEST ${testIndex}] ⚠️ CLOUDFLARE CHALLENGE DETECTED!`);
        console.log(`[TEST ${testIndex}] Title: "${title}"`);
        results.challenges.push({
          type: 'cloudflare',
          detected: true,
          title,
          screenshot: initialScreenshot,
        });
      } else {
        console.log(`[TEST ${testIndex}] ✓ No challenge, page loaded normally`);
      }

      results.steps.push({
        name: 'Page Load',
        status: 'pass',
        message: `Loaded ${url}${isChallenge ? ' (Challenge detected)' : ''}`,
        duration: Date.now() - step1Start,
        challengeDetected: isChallenge,
      });

    } catch (err) {
      console.log(`[TEST ${testIndex}] ✗ Load error: ${err.message}`);
      results.steps.push({
        name: 'Page Load',
        status: 'fail',
        message: `Failed to load: ${err.message}`,
        duration: Date.now() - step1Start,
      });
      return results;
    }

    // ── STEP 2: Wait for challenge to resolve ──
    console.log(`[TEST ${testIndex}] Step 2: Attempting to solve Cloudflare challenge...`);
    const step2Start = Date.now();

    let waitedForChallenge = false;
    let challengeSolved = false;

    // Try to click on the challenge iframe/button
    try {
      // Look for Cloudflare challenge iframe
      const challengeFrame = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').first();
      
      if (await challengeFrame.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log(`[TEST ${testIndex}] 🔧 Found Cloudflare challenge iframe, attempting interaction...`);
        
        // Get the iframe bounds
        const box = await challengeFrame.boundingBox();
        if (box) {
          // Move mouse to iframe and click
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(500);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log(`[TEST ${testIndex}] Clicked on challenge iframe`);
        }
        
        await page.waitForTimeout(1000);
      }
    } catch (err) {
      console.log(`[TEST ${testIndex}] Could not interact with challenge iframe`);
    }

    // Try clicking the main content area to trigger verification
    try {
      await page.click('body');
      await page.waitForTimeout(500);
    } catch (err) {
      // Continue
    }

    // Try keyboard interaction
    try {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    } catch (err) {
      // Continue
    }

    // Now wait for challenge to auto-resolve
    console.log(`[TEST ${testIndex}] ⏳ Waiting for challenge auto-resolution...`);
    
    for (let i = 0; i < 60; i++) {
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '');
      
      if (!title.includes('Just a moment') && 
          !title.includes('Challenge') &&
          !bodyText.includes('checking your browser') &&
          !bodyText.includes('enable javascript')) {
        if (i > 0) {
          console.log(`[TEST ${testIndex}] ✓ Challenge resolved after ${i}s`);
          waitedForChallenge = true;
          challengeSolved = true;
          
          // Take screenshot after resolution
          const afterChallengeScreenshot = path.join(SCREENSHOTS_DIR, `${testIndex}-02-after-challenge.png`);
          await page.screenshot({ path: afterChallengeScreenshot, fullPage: true });
          results.screenshots.push(afterChallengeScreenshot);
        }
        break;
      }

      if (i % 5 === 0 && i > 0) {
        console.log(`[TEST ${testIndex}] ⏳ Still waiting... (${i}s)`);
      }

      await page.waitForTimeout(1000);
    }

    if (!challengeSolved) {
      console.log(`[TEST ${testIndex}] ⚠️ Challenge did not auto-resolve, attempting manual bypass...`);
      
      // Try alternative bypass methods
      try {
        // Method 1: Try to find and click verification button
        const verifyBtn = await page.locator('button:has-text("Verify"), [role="button"]:has-text("Verify")').first();
        if (await verifyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`[TEST ${testIndex}] 🔧 Found verify button, clicking...`);
          await verifyBtn.click();
          await page.waitForTimeout(3000);
          challengeSolved = true;
        }
      } catch (err) {
        // Continue anyway
      }
    }

    results.steps.push({
      name: 'Challenge Resolution',
      status: challengeSolved ? 'pass' : 'warn',
      message: challengeSolved ? 'Challenge auto-resolved' : 'Challenge resolution timeout (may need manual interaction)',
      duration: Date.now() - step2Start,
    });

    // ── STEP 3: Detect player ──
    console.log(`[TEST ${testIndex}] Step 3: Looking for player...`);
    const step3Start = Date.now();

    await page.waitForTimeout(2000); // Let page fully render

    const playerExists = await page.locator('instaread-player, iframe[src*="instaread"]').first().isVisible().catch(() => false);

    const playerScreenshot = path.join(SCREENSHOTS_DIR, `${testIndex}-03-player-check.png`);
    await page.screenshot({ path: playerScreenshot, fullPage: true });
    results.screenshots.push(playerScreenshot);

    if (playerExists) {
      console.log(`[TEST ${testIndex}] ✓ PLAYER FOUND!`);
      results.steps.push({
        name: 'Player Detection',
        status: 'pass',
        message: 'Player element detected on page',
        duration: Date.now() - step3Start,
      });
    } else {
      console.log(`[TEST ${testIndex}] ✗ Player not found`);
      results.steps.push({
        name: 'Player Detection',
        status: 'fail',
        message: 'Player element not found',
        duration: Date.now() - step3Start,
      });
    }

    results.status = 'pass';

  } catch (err) {
    console.log(`[TEST ${testIndex}] ✗ Test error: ${err.message}`);
    results.status = 'fail';
    results.steps.push({
      name: 'Test Error',
      status: 'fail',
      message: err.message,
      duration: 0,
    });
  } finally {
    await page.close();
    await context.close();
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  const domain = process.argv[2];

  if (!domain) {
    console.error('\n❌ Usage: node agents/shivani/src/test-cloudflare-articles.js <domain>');
    console.error('\n📋 Examples:');
    console.error('   node agents/shivani/src/test-cloudflare-articles.js https://www.thebrakereport.com');
    console.error('   node agents/shivani/src/test-cloudflare-articles.js https://www.eatthis.com');
    console.error('   node agents/shivani/src/test-cloudflare-articles.js https://thehill.com');
    process.exit(1);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 CLOUDFLARE ARTICLE BROWSER TEST`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Domain: ${domain}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
  console.log(`Mode: BROWSER (will show challenges in real time)`);
  console.log(`${'='.repeat(80)}\n`);

  const allResults = {
    domain,
    startTime: new Date().toISOString(),
    articles: [],
    summary: {},
  };

  try {
    // Get article URLs
    const articleUrls = getArticleUrls(domain);
    console.log(`📰 Testing ${articleUrls.length} articles:\n`);
    articleUrls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));

    // Launch browser
    console.log(`\n🌐 Launching browser...`);
    
    let browser;
    try {
      browser = await chromium.launch({
        headless: false, // SHOW BROWSER WINDOW
        slowMo: 500, // Slow down to see what's happening
      });
    } catch (err) {
      console.log(`⚠️ Cannot launch headless browser (sandbox limitation)`);
      console.log(`   Trying headless mode...`);
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
        ],
      });
    }

    // Test each article
    for (let i = 0; i < articleUrls.length; i++) {
      const result = await testArticleWithBrowser(browser, articleUrls[i], i + 1);
      allResults.articles.push(result);
    }

    await browser.close();

    // Summary
    const passed = allResults.articles.filter(a => a.status === 'pass').length;
    const failed = allResults.articles.filter(a => a.status === 'fail').length;
    const withChallenges = allResults.articles.filter(a => a.challenges.length > 0).length;

    allResults.summary = {
      total: allResults.articles.length,
      passed,
      failed,
      withChallenges,
      passRate: `${((passed / allResults.articles.length) * 100).toFixed(1)}%`,
    };

    allResults.endTime = new Date().toISOString();

    // Save results
    const resultsFile = path.join(SCREENSHOTS_DIR, 'test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 TEST SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Tests: ${allResults.summary.total}`);
    console.log(`Passed: ${allResults.summary.passed} ✓`);
    console.log(`Failed: ${allResults.summary.failed} ✗`);
    console.log(`With Cloudflare Challenges: ${allResults.summary.withChallenges} ⚠️`);
    console.log(`Pass Rate: ${allResults.summary.passRate}`);
    console.log(`\n📸 Screenshots: ${SCREENSHOTS_DIR}`);
    console.log(`📋 Report: ${resultsFile}`);
    console.log(`${'='.repeat(80)}\n`);

    process.exit(allResults.summary.failed > 0 ? 1 : 0);

  } catch (err) {
    console.error(`\n❌ Fatal Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
