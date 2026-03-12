/**
 * Bypass Challenge Test Script
 * Tests Cloudflare/PerimeterX challenge detection and bypass on a specific URL
 */
import { launchUndetectedBrowser } from './browser.js';
import { bypassChallenge, dismissPopups } from './bypass.js';

async function testBypass(url) {
  console.log(`\n🧪 Testing bypass for: ${url}\n`);

  const { browser, cleanup } = await launchUndetectedBrowser();
  const context = browser.contexts()[0];
  const page = await context.newPage();

  try {
    console.log('[Test] Loading page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const beforeTitle = await page.title();
    console.log(`[Test] Initial title: "${beforeTitle}"`);

    const hasChallenge = await page.evaluate(() => {
      const bodyText = document.body?.innerText?.toLowerCase() || '';
      return bodyText.includes('press & hold') || 
             bodyText.includes('just a moment') ||
             bodyText.includes('before we continue') ||
             document.querySelector('#px-captcha') !== null;
    });

    if (!hasChallenge) {
      console.log('[Test] ✅ No challenge detected, page loaded normally');
    } else {
      console.log('[Test] ⚠️  Challenge detected! Attempting bypass...');
      const bypassed = await bypassChallenge(page, 3);
      if (bypassed) {
        console.log('[Test] ✅ Challenge bypassed successfully');
      } else {
        console.log('[Test] ❌ Challenge bypass failed or timed out');
      }
      await page.waitForTimeout(2000);
    }

    const afterTitle = await page.title();
    console.log(`[Test] Final title: "${afterTitle}"`);

    const playerDetected = await page.evaluate(() => {
      return !!document.querySelector('instaread-player');
    });

    console.log(`[Test] Player detected: ${playerDetected ? '✅ YES' : '❌ NO'}`);

    // Take screenshot
    const screenshotPath = '/tmp/bypass-test-' + Date.now() + '.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[Test] Screenshot saved: ${screenshotPath}`);

  } catch (err) {
    console.error(`[Test] Error: ${err.message}`);
  } finally {
    await cleanup();
  }
}

// Test URL from the screenshot showing Press & Hold challenge
const testUrl = process.argv[2] || 'https://thehill.com/homenews/media/5778523-iran-team-world-cup-2026/';
await testBypass(testUrl);
