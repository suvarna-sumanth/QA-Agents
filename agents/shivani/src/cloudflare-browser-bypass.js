/**
 * Cloudflare Browser Bypass Module
 * 
 * Implements the proven Cloudflare Turnstile bypass technique from test-cloudflare-articles.js
 * Safely handles Cloudflare challenges without interfering with PerimeterX sites
 * 
 * Features:
 * - Detects only Cloudflare (not PerimeterX)
 * - Active challenge solving with mouse/keyboard interaction
 * - Stealth mode to avoid detection
 * - Proper navigation context handling
 * - Timeout with graceful fallback
 */

/**
 * Solve Cloudflare Turnstile challenge using proven browser technique
 * @param {Page} page - Playwright page object
 * @param {number} maxWaitMs - Maximum time to wait for resolution (default 60s)
 * @returns {Promise<boolean>} True if challenge was solved, false if timeout
 */
export async function solveCloudflareChallenge(page, maxWaitMs = 60000) {
  try {
    const title = await page.title().catch(() => '');
    
    // Only handle Cloudflare, not other challenges
    if (!title.includes('Just a moment')) {
      return true; // No challenge detected
    }

    console.log('[CF-Bypass] 🔧 Cloudflare challenge detected, attempting to solve...');

    // Step 1: Add stealth indicators to avoid detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    }).catch(() => {});

    // Step 2: Try to interact with the challenge iframe
    try {
      const challengeFrame = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').first();
      
      if (await challengeFrame.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('[CF-Bypass] Found Turnstile iframe, clicking...');
        
        // Get iframe bounds and click center
        const box = await challengeFrame.boundingBox().catch(() => null);
        if (box) {
          // Simulate human-like mouse movement
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(300);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log('[CF-Bypass] ✓ Clicked on challenge iframe');
        }
        
        await page.waitForTimeout(500);
      }
    } catch (err) {
      console.log('[CF-Bypass] Could not interact with iframe, continuing...');
    }

    // Step 3: Try body click and keyboard interaction
    try {
      await page.click('body').catch(() => {});
      await page.waitForTimeout(300);
      await page.keyboard.press('Space').catch(() => {});
      await page.waitForTimeout(500);
    } catch (err) {
      // Continue anyway
    }

    // Step 4: Wait for challenge auto-resolution
    console.log('[CF-Bypass] ⏳ Waiting for challenge auto-resolution...');
    
    const startTime = Date.now();
    let lastLogTime = startTime;
    const logInterval = 5000; // Log every 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const currentTitle = await page.title().catch(() => 'error');
        
        if (currentTitle !== 'error' && !currentTitle.includes('Just a moment')) {
          console.log(`[CF-Bypass] ✓ Challenge resolved after ${Date.now() - startTime}ms`);
          return true;
        }

        // Log progress every 5 seconds
        const now = Date.now();
        if (now - lastLogTime > logInterval) {
          console.log(`[CF-Bypass] ⏳ Still waiting... (${Math.round((now - startTime) / 1000)}s)`);
          lastLogTime = now;
        }
      } catch (err) {
        // Execution context destroyed = page is navigating/reloading
        if (err.message.includes('Execution context was destroyed') || 
            err.message.includes('navigation')) {
          console.log('[CF-Bypass] 🔄 Page navigating (context destroyed), waiting for stabilization...');
          await page.waitForTimeout(2000);
          
          // Check if we're past the challenge now
          try {
            const newTitle = await page.title();
            if (!newTitle.includes('Just a moment')) {
              console.log('[CF-Bypass] ✓ Challenge resolved via navigation');
              return true;
            }
          } catch (err2) {
            // Still loading
          }
        }
      }

      await page.waitForTimeout(500);
    }

    console.log('[CF-Bypass] ⚠️ Challenge timeout after ' + maxWaitMs + 'ms');
    return false;

  } catch (err) {
    console.log(`[CF-Bypass] Error during challenge solving: ${err.message}`);
    return false;
  }
}

/**
 * Check if page is facing a Cloudflare challenge (but not other challenges)
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if Cloudflare challenge is detected
 */
export async function hasCloudflareChallenge(page) {
  try {
    const title = await page.title().catch(() => '');
    
    // Only detect Cloudflare, NOT PerimeterX
    if (title.includes('Just a moment')) {
      // Double-check it's actually Cloudflare
      const iframeExists = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').first().isVisible({ timeout: 1000 }).catch(() => false);
      return iframeExists;
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Safe wrapper - only bypass if Cloudflare detected, leave PerimeterX alone
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if successful or not a Cloudflare challenge
 */
export async function bypassCloudflareIfNeeded(page) {
  const hasChallenge = await hasCloudflareChallenge(page);
  
  if (!hasChallenge) {
    return true; // Not a Cloudflare challenge, proceed
  }

  // It IS Cloudflare, solve it
  return await solveCloudflareChallenge(page);
}
