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
      console.log(`[CF-Bypass] No challenge detected (title: "${title}")`);
      return true; // No challenge detected
    }

    console.log('[CF-Bypass] 🔧 Cloudflare challenge detected, attempting to solve...');

    // Step 1: Add stealth indicators to avoid detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    }).catch(() => {});

    // Step 1b: Wait a moment for the challenge iframe to load into the DOM
    console.log('[CF-Bypass] Waiting for challenge iframe to appear...');
    await page.waitForTimeout(2000);

    // Step 1c: Wait specifically for the Turnstile iframe to be injected by JavaScript
    console.log('[CF-Bypass] Waiting for Turnstile iframe to be created by JavaScript...');
    try {
      await page.waitForSelector('iframe[src*="turnstile"], iframe[src*="challenges.cloudflare.com"]', {
        timeout: 10000
      });
      console.log('[CF-Bypass] ✓ Turnstile iframe detected in DOM');
    } catch (err) {
      console.log('[CF-Bypass] ⚠️ Turnstile iframe did not appear within 10 seconds');
      // Continue anyway, it might appear later
    }

    // Debug: Log page structure to understand what we're dealing with
    const debugInfo = await page.evaluate(() => {
      return {
        title: document.title,
        bodyHTML: document.body?.innerHTML?.substring(0, 500) || 'no body',
        allScripts: document.querySelectorAll('script').length,
        allIframes: Array.from(document.querySelectorAll('iframe')).map(f => ({
          src: f.src,
          id: f.id,
          className: f.className,
          visible: f.offsetHeight > 0
        })),
        turnstileInput: !!document.querySelector('input[name="cf-turnstile"]'),
        hasCloudflareScript: Array.from(document.querySelectorAll('script')).some(s => s.src?.includes('challenges.cloudflare'))
      };
    }).catch(() => ({}));
    
    console.log(`[CF-Bypass] Page debug info:`, JSON.stringify(debugInfo, null, 2));

    // Step 2: Try to interact with the challenge iframe
    try {
      console.log('[CF-Bypass] Looking for Turnstile iframe to click...');
      
      // Try multiple approaches to find and click the iframe
      const iframeCount = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').count();
      console.log(`[CF-Bypass] Found ${iframeCount} Turnstile iframe(s)`);
      
      if (iframeCount > 0) {
        const challengeFrame = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').first();
        
        // Try to click directly on the iframe
        try {
          await challengeFrame.click({ timeout: 5000 });
          console.log('[CF-Bypass] ✓ Clicked Turnstile iframe directly');
        } catch (err1) {
          console.log('[CF-Bypass] Direct click failed, trying bounding box method...');
          
          // Try using bounding box and mouse click
          const box = await challengeFrame.boundingBox().catch(() => null);
          if (box) {
            // Move to center and click
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(500);
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            console.log('[CF-Bypass] ✓ Clicked iframe via bounding box');
          }
        }
        
        await page.waitForTimeout(1000);
      } else {
        console.log('[CF-Bypass] ⚠️ No Turnstile iframe found, trying alternate methods...');
        
        // Method 1: Try to find ANY iframe and interact with it
        const allIframes = await page.locator('iframe').count();
        console.log(`[CF-Bypass] Found ${allIframes} total iframe(s) on page`);
        
        // Method 2: Try clicking in the center of the viewport (where challenge usually appears)
        try {
          console.log('[CF-Bypass] Trying viewport center click...');
          const viewportSize = page.viewportSize();
          if (viewportSize) {
            await page.mouse.move(viewportSize.width / 2, viewportSize.height / 2);
            await page.waitForTimeout(300);
            await page.mouse.click(viewportSize.width / 2, viewportSize.height / 2);
            console.log('[CF-Bypass] ✓ Clicked viewport center');
          }
        } catch (err) {
          console.log('[CF-Bypass] Viewport center click failed');
        }
        
        // Method 3: Try body click
        try {
          console.log('[CF-Bypass] Trying body click...');
          await page.click('body');
          await page.waitForTimeout(300);
        } catch (err) {
          console.log('[CF-Bypass] Body click failed');
        }
      }
    } catch (err) {
      console.log(`[CF-Bypass] Error during iframe interaction: ${err.message}`);
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
      console.log('[CF-Bypass] Detected "Just a moment" title, checking for Turnstile iframe...');
      
      // Try to find the iframe - it might take a moment to appear
      // Use a longer timeout and check multiple times
      try {
        const iframe = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').first();
        // Check if it exists at all
        const count = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').count();
        
        if (count > 0) {
          console.log('[CF-Bypass] ✓ Found Turnstile iframe');
          return true;
        }
      } catch (err) {
        // Fall back to checking if the iframe exists in DOM at all
        const iframeExists = await page.evaluate(() => {
          return !!document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
        }).catch(() => false);
        
        if (iframeExists) {
          console.log('[CF-Bypass] ✓ Found Turnstile iframe in DOM');
          return true;
        }
      }
      
      console.log('[CF-Bypass] ⚠️ "Just a moment" detected but no Turnstile iframe found');
      return true; // Still return true since we have the challenge title
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Safe wrapper - only bypass if Cloudflare detected, leave PerimeterX alone
 * @param {Page} page - Playwright page object
 * @param {number} maxWaitMs - Maximum time to wait for resolution
 * @returns {Promise<boolean>} True if successful or not a Cloudflare challenge
 */
export async function bypassCloudflareIfNeeded(page, maxWaitMs = 60000) {
  const hasChallenge = await hasCloudflareChallenge(page);
  
  if (!hasChallenge) {
    return true; // Not a Cloudflare challenge, proceed
  }

  // It IS Cloudflare, solve it
  return await solveCloudflareChallenge(page, maxWaitMs);
}
