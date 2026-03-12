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
          await page.waitForTimeout(500);
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log('[CF-Bypass] ✓ Clicked on challenge iframe');
        }
        
        await page.waitForTimeout(1000);
      }
    } catch (err) {
      console.log('[CF-Bypass] Could not interact with iframe, continuing...');
    }

    // Step 3: Try body click and keyboard interaction
    try {
      await page.click('body');
      await page.waitForTimeout(500);
    } catch (err) {
      // Continue
    }

    // Step 3b: Try keyboard interaction
    try {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    } catch (err) {
      // Continue
    }

    // Step 4: Wait a bit for page to navigate/process
    await page.waitForTimeout(2000);

    // Step 5: Wait for challenge auto-resolution with better polling
    console.log('[CF-Bypass] ⏳ Waiting for challenge auto-resolution...');
    
    const maxWaitSeconds = Math.min(Math.ceil(maxWaitMs / 1000), 60);
    for (let i = 0; i < maxWaitSeconds; i++) {
      try {
        const currentTitle = await page.title().catch(() => 'error');
        const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '').catch(() => '');
        
        if (currentTitle !== 'error' && 
            !currentTitle.includes('Just a moment') && 
            !currentTitle.includes('Challenge') &&
            !bodyText.includes('checking your browser') &&
            !bodyText.includes('enable javascript')) {
          
          if (i > 0) {
            console.log(`[CF-Bypass] ✓ Challenge resolved after ${i}s`);
          }
          return true;
        }

        // Log progress every 5 seconds
        if (i % 5 === 0 && i > 0) {
          console.log(`[CF-Bypass] ⏳ Still waiting... (${i}s)`);
        }

      } catch (err) {
        // Execution context destroyed = page is navigating/reloading (good sign!)
        if (err.message.includes('Execution context was destroyed') || 
            err.message.includes('navigation')) {
          console.log('[CF-Bypass] 🔄 Page navigating/reloading (context destroyed), waiting for stabilization...');
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

      await page.waitForTimeout(1000);
    }

    console.log(`[CF-Bypass] ⚠️ Challenge timeout after ${maxWaitSeconds}s`);
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
