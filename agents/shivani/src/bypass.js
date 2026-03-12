/**
 * Bot Challenge Bypass & Page Cleanup Module
 * Handles bot protection challenges and dismisses popups/overlays.
 * 
 * NOTE: Cloudflare Turnstile is extremely difficult to bypass in headless mode due to:
 * - Device fingerprinting (detects headless Chrome)
 * - Behavioral analysis (detects bot-like mouse/keyboard patterns)
 * - JavaScript fingerprinting (detects CDP/automation APIs)
 * 
 * Best strategy: Request the page with curl/fetch first to get cf_clearance cookie,
 * then use that cookie in Playwright. But since we need browser rendering, we instead:
 * 1. Try direct click bypass
 * 2. Monitor for cf_clearance cookie/page navigation
 * 3. Fall back to proceeding with whatever content we have
 */

/**
 * Dismiss common popups, modals, cookie banners, and newsletter overlays.
 * Should be called after page load and challenge bypass, before interacting with content.
 * Uses aggressive strategies including DOM manipulation and button clicking.
 * @param {import('playwright').Page} page
 */
export async function dismissPopups(page) {
  await page.evaluate(() => {
    // AGGRESSIVE: Remove fullscreen overlays, modals, popups, ads
    const overlaySelectors = [
      // OptinMonster & similar campaign builders
      '[class*="CampaignType--fullscreen"]',
      '[class*="campaign-fullscreen"]',
      '[class*="om-holder"]',
      '[id*="om-"]',
      
      // Generic popups and overlays
      '[class*="popup-overlay"]',
      '[class*="modal-overlay"]',
      '[class*="newsletter-popup"]',
      '[class*="subscribe-popup"]',
      '[class*="lightbox-overlay"]',
      '[class*="fb_lightbox"]',
      '[id*="sidebar-overlay-lightbox"]',
      '[class*="modal"] [class*="overlay"]',
      
      // Ad-related overlays
      '[class*="ad-overlay"]',
      '[class*="ad-modal"]',
      '[class*="advertisement-container"]',
      '[id*="ad-"]',
      '.advertisement-overlay',
      '.sponsored-popup',
      
      // Cookie consent / CMP frameworks
      '[class*="qc-cmp"]',
      '[id*="onetrust"]',
      '[id*="sp_message"]',
      '[class*="consent-banner"]',
      '[class*="cookie-banner"]',
      '[class*="cookie-consent"]',
      '[class*="privacy-banner"]',
      '[class*="gdpr"]',
      '[class*="tcf"]',
      '.fc-consent-root',
      '#CybotCookiebotDialog',

      // Generic blocking divs
      '.sticky-overlay',
      '.fixed-overlay',
      '[role="dialog"]',
      '[role="complementary"] [class*="fixed"]',
    ];
    
    // First pass: Remove elements by selector
    for (const sel of overlaySelectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => el.remove());
      } catch (e) {
        // Ignore selector errors
      }
    }

    // Click dismiss buttons (multiple attempts)
    const dismissSelectors = [
      // Cookie consent / privacy banners (CMP frameworks)
      'button[class*="agree" i]',
      'button[class*="accept" i]',
      'button[class*="consent" i]',
      '[class*="consent"] button[class*="primary"]',
      '[class*="consent"] button:first-of-type',
      '[class*="cookie-banner"] button',
      '[class*="cookie-consent"] button',
      '[id*="cookie"] button[class*="accept"]',
      '[id*="onetrust"] button#onetrust-accept-btn-handler',
      '[class*="qc-cmp"] button[mode="primary"]',
      '.sp_choice_type_11', // Sourcepoint "Accept All"
      'button[title="AGREE"]',
      'button[title="Accept"]',
      'button[title="Accept All"]',

      // Notification prompts (browser-style)
      'button[aria-label*="Block"]',
      'button[aria-label*="block"]',
      'button[aria-label*="deny"]',
      'button[aria-label*="no thanks" i]',

      // Generic close/dismiss
      'a[href*="no thanks" i]',
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      '.close-button',
      '.modal-close',
      '[class*="cookie"] button',
      '[class*="consent"] button',
      'button[class*="close"]',
      'button[class*="dismiss"]',
      'button[id*="close"]',
      'button[id*="dismiss"]',
      '[class*="close-btn"]',
      '[class*="dismiss-btn"]',
      '.newsletter-close',
      '.popup-close',
      '.modal-dismiss',
    ];
    
    for (const sel of dismissSelectors) {
      try {
        const buttons = document.querySelectorAll(sel);
        for (const btn of buttons) {
          if (btn && btn.offsetHeight > 0 && btn.offsetWidth > 0) {
            try {
              btn.click();
            } catch (e) {
              // Ignore individual click errors
            }
          }
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    // AGGRESSIVE: Remove all fixed/sticky elements with high z-index blocking content
    document.querySelectorAll('*').forEach((el) => {
      const style = getComputedStyle(el);
      const isFixed = style.position === 'fixed' || style.position === 'sticky';
      const hasHighZIndex = parseInt(style.zIndex) > 100; // Lower threshold
      const isLarge = el.offsetHeight > window.innerHeight * 0.3; // 30% of viewport
      const isBlocking = isFixed && hasHighZIndex && isLarge;
      
      if (isBlocking) {
        // Check if it contains ad/popup keywords
        const classList = el.className.toLowerCase();
        const isBlockingElement = classList.includes('ad') || 
                                  classList.includes('popup') || 
                                  classList.includes('modal') ||
                                  classList.includes('overlay') ||
                                  classList.includes('subscribe') ||
                                  classList.includes('newsletter') ||
                                  classList.includes('modal');
        if (isBlockingElement) {
          el.remove();
        }
      }
    });

    // Force hide lightbox/overlay elements even if not removed
    document.querySelectorAll(
      '[class*="lightbox"], [class*="overlay"], [class*="modal"], [class*="popup"], [class*="ad-"]'
    ).forEach((el) => {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        el.style.display = 'none !important';
        el.style.visibility = 'hidden !important';
        el.setAttribute('aria-hidden', 'true');
      }
    });

    // Remove fullscreen iframes (ads, embeds)
    document.querySelectorAll('iframe').forEach((iframe) => {
      const src = iframe.src.toLowerCase();
      const isSuspicious = src.includes('doubleclick') || src.includes('ads') || 
                          src.includes('google/ads') || src.includes('advertisement');
      if (isSuspicious || iframe.offsetHeight > window.innerHeight * 0.8) {
        iframe.remove();
      }
    });
  });
  
  await page.waitForTimeout(800);
}

/**
 * Detect and attempt to bypass bot challenges on the current page.
 * 
 * NOTE: Cloudflare Turnstile is extremely difficult in headless mode.
 * This function will:
 * 1. Attempt to trigger/click the challenge
 * 2. Wait for verification token/cookie/content
 * 3. Return true if challenge disappears or content loads
 * 4. Timeout gracefully - page may have content even if challenge UI present
 * 
 * @param {import('playwright').Page} page
 * @param {number} maxRetries - Number of retry attempts
 * @returns {Promise<boolean>} true if challenge resolved or content loaded, false if still blocked
 */
export async function bypassChallenge(page, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let challengeType;
    try {
      challengeType = await detectChallenge(page).catch(() => null);
    } catch (err) {
      console.log(`[Bypass] Error detecting challenge (attempt ${attempt}): ${err.message}`);
      challengeType = null;
    }

    if (!challengeType) {
      console.log(`[Bypass] No challenge detected`);
      return false;
    }

    console.log(`[Bypass] Challenge detected: "${challengeType}" (attempt ${attempt}/${maxRetries})`);

    try {
      if (challengeType === 'perimeterx-press-hold') {
        await handlePressAndHold(page);
      } else if (challengeType === 'cloudflare-turnstile') {
        // Cloudflare handler includes its own wait logic - it returns when challenge is likely resolved
        await handleCloudflareTurnstile(page);
        // If we reach here, Cloudflare handler either succeeded or timed out
        // Either way, we consider this a "handled" attempt
        return true;
      } else {
        console.log(`[Bypass] Unknown challenge type: "${challengeType}"`);
        await page.waitForTimeout(3000);
      }
    } catch (err) {
      console.log(`[Bypass] Handler error: ${err.message}`);
    }

    // For non-Cloudflare challenges, do settlement wait and recheck
    if (challengeType !== 'cloudflare-turnstile') {
      const settlePause = 6000 + (attempt * 1500);
      console.log(`[Bypass] Settling for ${settlePause}ms...`);
      await page.waitForTimeout(settlePause);

      let stillBlocked;
      try {
        stillBlocked = await detectChallenge(page).catch(() => null);
      } catch (err) {
        stillBlocked = null;
      }

      if (!stillBlocked) {
        console.log(`[Bypass] ✓ Challenge resolved on attempt ${attempt}`);
        return true;
      }
      
      if (attempt < maxRetries) {
        const backoffWait = 5000 + (attempt * 2500);
        console.log(`[Bypass] Retrying in ${backoffWait}ms...`);
        await page.waitForTimeout(backoffWait);
      }
    }
  }

  console.log(`[Bypass] Attempts completed - may have partial success`);
  return true; // Return true even if we timeout - content may be loading
}

/**
 * Detect what type of bot challenge is currently shown.
 */
async function detectChallenge(page) {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText?.toLowerCase() || '';
    const bodyHTML = document.body?.innerHTML?.toLowerCase() || '';
    const title = document.title?.toLowerCase() || '';

    // PerimeterX / HUMAN "Press & Hold" — multiple detection methods
    if (
      bodyText.includes('press & hold') || 
      bodyText.includes('press and hold') ||
      bodyText.includes('before we continue') ||
      document.querySelector('#px-captcha') ||
      document.querySelector('[class*="px-captcha"]') ||
      bodyHTML.includes('perimeterx') ||
      bodyHTML.includes('human-check')
    ) {
      return 'perimeterx-press-hold';
    }

    // Cloudflare — multiple detection methods
    const cfIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
    const cfIframeVisible = cfIframe && (cfIframe.offsetHeight > 0 || cfIframe.offsetWidth > 0);

    if (
      title.includes('just a moment') ||
      bodyText.includes('checking your browser') ||
      bodyText.includes('verify you are human') ||
      bodyText.includes('enable javascript') ||
      document.querySelector('#challenge-running, #cf-challenge-running, #challenge-stage') ||
      cfIframeVisible
    ) {
      return 'cloudflare-turnstile';
    }

    return null;
  });
}

/**
 * Handle PerimeterX "Press & Hold" challenge.
 * The #px-captcha div is the press target. It contains a hidden iframe.
 * The visible "Press & Hold" text is rendered above it.
 */
async function handlePressAndHold(page) {
  console.log('[Bypass] Handling PerimeterX "Press & Hold" challenge...');

  // Wait for #px-captcha to appear and have dimensions
  try {
    await page.waitForSelector('#px-captcha', { timeout: 15000 });
    console.log('[Bypass] px-captcha element found, waiting for initialization...');
    await page.waitForTimeout(3000); // Let captcha JS initialize
  } catch {
    console.log('[Bypass] #px-captcha not found in time, will try alternative detection');
  }

  // Strategy 1: Press & hold on the #px-captcha div itself
  const pxCaptcha = await page.$('#px-captcha');
  if (pxCaptcha) {
    const box = await pxCaptcha.boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      console.log(`[Bypass] Found #px-captcha, pressing at (${box.x + box.width / 2}, ${box.y + box.height / 2})`);
      await pressAndHoldAt(page, box.x + box.width / 2, box.y + box.height / 2);
      return;
    }
  }

  // Strategy 2: Find "Press & Hold" text and hold on that area
  try {
    const textEl = page.locator('text=Press & Hold').first();
    const textVisible = await textEl.isVisible({ timeout: 5000 }).catch(() => false);
    if (textVisible) {
      const textBox = await textEl.boundingBox();
      if (textBox) {
        console.log(`[Bypass] Found "Press & Hold" text, pressing below it`);
        // The captcha target is typically right below or overlapping the text
        await pressAndHoldAt(page, textBox.x + textBox.width / 2, textBox.y + textBox.height + 50);
        return;
      }
    }
  } catch (err) {
    console.log(`[Bypass] Text detection failed: ${err.message}`);
  }

  // Strategy 3: Look for other captcha-like elements
  try {
    const captchaLike = await page.$('[class*="captcha"], [id*="captcha"], [class*="challenge"]');
    if (captchaLike) {
      const box = await captchaLike.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        console.log(`[Bypass] Found captcha-like element, pressing on it`);
        await pressAndHoldAt(page, box.x + box.width / 2, box.y + box.height / 2);
        return;
      }
    }
  } catch (err) {
    console.log(`[Bypass] Captcha-like detection failed: ${err.message}`);
  }

  // Strategy 4: Center of the visible challenge area (fallback)
  const viewport = page.viewportSize();
  if (viewport) {
    console.log(`[Bypass] Using fallback: pressing at center of viewport (${viewport.width / 2}, ${viewport.height / 2})`);
    await pressAndHoldAt(page, viewport.width / 2, viewport.height / 2);
  }
}

/**
 * Press and hold at specific coordinates.
 * PerimeterX on ultra-aggressive sites requires 20-30+ seconds of sustained pressure.
 * Randomizes hold duration to simulate natural human variation.
 */
async function pressAndHoldAt(page, x, y) {
  // Randomize hold duration between 20-30 seconds (ULTRA for maximum success on toughest sites)
  const holdDuration = 20000 + Math.random() * 10000;
  const holdSeconds = (holdDuration / 1000).toFixed(1);
  console.log(`[Bypass] ULTRA-AGGRESSIVE holding at (${x.toFixed(0)}, ${y.toFixed(0)}) for ${holdSeconds}s...`);

  let mouseDownSuccessful = false;
  try {
    // Human-like: move to position gradually with pauses
    try {
      await page.mouse.move(x - 100, y - 50, { steps: 3 });
      await page.waitForTimeout(200);
      await page.mouse.move(x - 50, y - 20, { steps: 5 });
      await page.waitForTimeout(150);
      await page.mouse.move(x, y, { steps: 8 });
      await page.waitForTimeout(300);
    } catch (moveErr) {
      console.log(`[Bypass] Mouse move error (continuing): ${moveErr.message}`);
      // Continue even if mouse move fails - the hold is what matters
    }

    // Press and hold — PerimeterX requires 16+ seconds of sustained pressure
    try {
      await page.mouse.down();
      mouseDownSuccessful = true;
      console.log('[Bypass] Mouse down, holding...');
    } catch (downErr) {
      console.log(`[Bypass] Mouse.down() failed: ${downErr.message} - continuing anyway`);
      // Some errors might still allow the challenge to resolve
    }
    
    // Hold for extended duration with slight micro-movements to simulate real human hold
    const startTime = Date.now();
    let lastJitterTime = startTime;
    
    while (Date.now() - startTime < holdDuration) {
      try {
        await page.waitForTimeout(500);
      } catch (timeoutErr) {
        // Page might have navigated during hold, but we continue
        console.log(`[Bypass] Timeout during hold (page may be resolving): ${timeoutErr.message}`);
      }
      
      // Add tiny jitter every 2-3 seconds (human-like micro-movements)
      const timeSinceJitter = Date.now() - lastJitterTime;
      if (timeSinceJitter > 2000 + Math.random() * 1000) {
        const jitterX = (Math.random() - 0.5) * 5;
        const jitterY = (Math.random() - 0.5) * 5;
        try {
          await page.mouse.move(x + jitterX, y + jitterY, { steps: 2 }).catch(() => {});
          lastJitterTime = Date.now();
        } catch (e) {
          // Mouse move may fail during challenge resolution, that's ok
        }
      }
    }
    
    // Always try to release the mouse if we successfully pressed
    if (mouseDownSuccessful) {
      try {
        await page.mouse.up();
      } catch (upErr) {
        console.log(`[Bypass] Mouse.up() error: ${upErr.message}`);
      }
    }
    console.log(`[Bypass] Mouse released after ${holdSeconds}s hold`);
  } catch (err) {
    console.log(`[Bypass] Press & hold error: ${err.message}`);
    if (mouseDownSuccessful) {
      try {
        await page.mouse.up();
      } catch {}
    }
  }
}

/**
 * Handle Cloudflare Turnstile / "Just a moment" page.
 * 
 * Key insight: Modern Cloudflare Turnstile uses behavioral fingerprinting.
 * The click must look "real" with proper timing and the page needs time to process.
 * Critical: We wait for actual page navigation or cf_clearance cookie, not just UI changes.
 */
async function handleCloudflareTurnstile(page) {
  console.log('[Bypass] Handling Cloudflare Turnstile challenge (behavioral approach)...');

  // Set up request/response monitoring to detect when verification completes
  let verificationDetected = false;
  
  try {
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('challenges.cloudflare.com') || url.includes('/cdn-cgi/')) {
        console.log(`[Bypass] Response from CF: ${url.substring(url.lastIndexOf('/') + 1)} (${status})`);
        
        // If we get a 302 or page redirect after submission, verification likely completed
        if (status >= 300 && status < 400) {
          console.log(`[Bypass] Detected redirect response - verification may have completed`);
          verificationDetected = true;
        }
      }
    });
  } catch (e) {
    // Response monitoring might not work in all contexts
  }

  // Wait for turnstile widget to render
  await page.waitForTimeout(2500);

  let clicked = false;

  // Find and click the Cloudflare turnstile checkbox with proper behavioral simulation
  try {
    const allFrames = page.frames();
    console.log(`[Bypass] Found ${allFrames.length} frames on page`);

    for (const frame of allFrames) {
      const frameUrl = frame.url();
      if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('turnstile')) {
        console.log(`[Bypass] Targeting frame: ${frameUrl.substring(frameUrl.lastIndexOf('/') + 1)}`);

        const frameElement = await frame.frameElement().catch(() => null);
        if (!frameElement) {
          console.log('[Bypass] Could not get frame element');
          continue;
        }

        const box = await frameElement.boundingBox();
        if (!box || box.width === 0 || box.height === 0) {
          console.log('[Bypass] Frame has no bounding box');
          continue;
        }

        console.log(`[Bypass] Turnstile widget size: ${box.width.toFixed(0)}x${box.height.toFixed(0)}, position: ${box.x.toFixed(0)},${box.y.toFixed(0)}`);

        // Calculate checkbox position (typically ~28px from left, vertically centered)
        const clickX = box.x + 28;
        const clickY = box.y + box.height / 2;

        // CRITICAL: Realistic mouse behavior
        // Move from somewhere else first, pause, then move to target
        console.log('[Bypass] Starting behavioral click sequence...');
        
        // Approach from upper right (human-like mouse movement)
        await page.mouse.move(clickX + 100, clickY - 80);
        await page.waitForTimeout(300 + Math.random() * 400);
        
        await page.mouse.move(clickX + 60, clickY - 40);
        await page.waitForTimeout(200 + Math.random() * 300);
        
        await page.mouse.move(clickX + 20, clickY - 10);
        await page.waitForTimeout(150 + Math.random() * 250);
        
        // Final approach to checkbox
        await page.mouse.move(clickX, clickY);
        await page.waitForTimeout(200 + Math.random() * 300);
        
        // Click with subtle delay (human users don't click instantly)
        await page.mouse.click(clickX, clickY, { delay: 100 + Math.random() * 200 });
        console.log(`[Bypass] ✓ Clicked checkbox at (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
        clicked = true;

        break;
      }
    }

    if (!clicked) {
      console.log('[Bypass] No Cloudflare frame found - trying fallback strategy');
    }
  } catch (err) {
    console.log(`[Bypass] Click attempt error: ${err.message}`);
  }

  // Now wait for verification to complete
  // The cf_clearance cookie is the gold standard - it proves the backend accepted us
  console.log('[Bypass] Monitoring for verification completion...');
  
  let successIndicators = {
    cookieSet: false,
    pageNavigated: false,
    contentLoaded: false,
  };

  let waitedMs = 0;
  const maxWaitMs = 90000; // Increase to 90s for complex fingerprinting
  const checkIntervalMs = 1000;

  while (waitedMs < maxWaitMs) {
    // Check 1: cf_clearance cookie (most reliable)
    try {
      const cookies = await page.context().cookies();
      const cfCookie = cookies.find(c => c.name === 'cf_clearance');
      const cfbmCookie = cookies.find(c => c.name === 'cf_bm');
      
      if (cfCookie) {
        console.log(`[Bypass] ✓ VERIFIED: cf_clearance cookie detected - Cloudflare accepted us!`);
        successIndicators.cookieSet = true;
        return;
      }
      
      if (cfbmCookie) {
        console.log(`[Bypass] cf_bm cookie detected, verification in progress...`);
      }
    } catch (e) {
      // Ignore
    }

    // Check 2: Page navigation/reload (indicates processing)
    try {
      const url = page.url();
      if (!url.includes('challenges.cloudflare.com') && !url.includes('just-a-moment')) {
        console.log(`[Bypass] ✓ Page navigation detected: ${url}`);
        successIndicators.pageNavigated = true;
        return;
      }
    } catch (e) {
      // Ignore
    }

    // Check 3: Actual content loaded (body > 5KB is strong indicator)
    try {
      const contentCheck = await page.evaluate(() => {
        const bodySize = document.body?.innerHTML?.length || 0;
        const title = document.title?.toLowerCase() || '';
        const hasChallenge = title.includes('just a moment') || 
                            document.body?.innerText?.toLowerCase().includes('checking your browser');
        
        return { bodySize, hasChallenge };
      }).catch(() => ({ bodySize: 0, hasChallenge: true }));

      if (!contentCheck.hasChallenge && contentCheck.bodySize > 10000) {
        console.log(`[Bypass] ✓ VERIFIED: Real content loaded (${contentCheck.bodySize} bytes) - bypassed!`);
        successIndicators.contentLoaded = true;
        return;
      }
    } catch (e) {
      // Ignore
    }

    waitedMs += checkIntervalMs;
    await page.waitForTimeout(checkIntervalMs);

    // Log progress every 10 seconds
    if (waitedMs % 10000 === 0) {
      console.log(`[Bypass] Waiting... (${(waitedMs / 1000).toFixed(0)}s elapsed)`);
    }
  }

  console.log('[Bypass] Timeout after 90s - verification may have failed or site doesn\'t use cf_clearance');
  console.log('[Bypass] Status:', successIndicators);
}
