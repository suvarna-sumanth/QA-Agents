/**
 * Player Detection Module
 * Checks article pages for the <instaread-player/> tag using browser rendering.
 *
 * The player is rendered client-side by JavaScript, so HTTP-only scanning
 * cannot detect it. All detection is done via undetected Chrome browser.
 */
import { launchUndetectedBrowser, launchForUrl, detectProtection, applyStealthScripts } from './browser.js';
import { dismissPopups, bypassChallenge } from './bypass.js';
import { bypassCloudflareIfNeeded } from './cloudflare-browser-bypass.js';
import { INSTAREAD_USER_AGENT } from './config.js';

/**
 * @typedef {Object} DetectionResult
 * @property {string} url
 * @property {boolean} hasPlayer
 * @property {string|null} playerSelector
 * @property {Object|null} playerAttributes
 * @property {string} method
 * @property {string|null} screenshot
 */

/**
 * Check a list of URLs for the <instaread-player/> tag.
 * Uses browser rendering (player is JS-rendered, not in raw HTML).
 * Takes a screenshot of the player element if found, or the article area if not.
 * @param {string[]} urls
 * @returns {Promise<DetectionResult[]>}
 */
export async function detectPlayer(urls, sharedBrowser = null) {
  const results = [];

  // Detect protection type from the first URL to choose the right browser
  const protection = urls.length > 0 ? await detectProtection(urls[0]) : 'unknown';
  const isCloudflare = protection === 'cloudflare';
  const isTownNews = protection === 'townnews';

  // Use shared browser if provided, otherwise launch the right one for this protection type
  let browser, cleanup;
  if (sharedBrowser) {
    browser = sharedBrowser.browser;
    cleanup = async () => {}; // Don't close shared browser
  } else {
    ({ browser, cleanup } = await launchForUrl(urls[0]));
  }

  // Save original console.log before any override (accessible in finally block)
  const savedConsoleLog = console.log;

  try {
    // Suppress rebrowser isolated world warnings (not critical for our use case)
    console.log = function(...args) {
      const msg = args[0]?.toString() || '';
      if (!msg.includes('[rebrowser-patches][frames._context]')) {
        savedConsoleLog.apply(console, args);
      }
    };

    let context, page;
    if (isCloudflare || isTownNews) {
      // CLOUDFLARE & TOWNNEWS: Fresh context with stealth applied BEFORE navigation
      context = await browser.newContext({
        userAgent: INSTAREAD_USER_AGENT,
        ignoreHTTPSErrors: true
      });
      await applyStealthScripts(context);
    } else {
      // PERIMETERX: Use default context with full stealth scripts
      context = browser.contexts()[0];
    }

    for (const url of urls) {
      console.log(`[Detect] Checking: ${url}`);
      page = await context.newPage();
      if (isCloudflare) {
        await page.setViewportSize({ width: 1280, height: 720 });
      }

      try {
        console.log(`[Detect] Loading page at ${url}`);

        // Try to navigate, with fallback for certificate errors
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (navErr) {
          const errStr = `${navErr.message}`;
          if (errStr.includes('net::ERR') || errStr.includes('Certificate')) {
            console.log(`[Detect] Certificate error, retrying with 'load' waitUntil...`);
            try {
              await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            } catch (retryErr) {
              console.log(`[Detect] Cert error persists, continuing anyway...`);
              // Continue with blank page
            }
          } else {
            throw navErr;
          }
        }

        await page.waitForTimeout(2000);

        // Check for challenge BEFORE bypass attempt
        // Wrap in try/catch — "Execution context was destroyed" means the page is navigating
        // (Cloudflare auto-resolving), which is a good sign
        let initialTitle = '';
        let bodyText = '';
        let hasInitialChallenge = false;
        try {
          initialTitle = await page.title();
          const currentUrl = page.url();
          bodyText = await page.evaluate(() => (document.body?.innerText?.toLowerCase() || ''));
          hasInitialChallenge = initialTitle.toLowerCase().includes('just a moment') ||
                                bodyText.includes('press & hold') ||
                                bodyText.includes('before we continue') ||
                                bodyText.includes('please wait while we attempt to load the requested page') ||
                                currentUrl.includes('client_captcha');
        } catch (ctxErr) {
          if (ctxErr.message.includes('Execution context was destroyed') || ctxErr.message.includes('navigation')) {
            console.log(`[Detect] Page navigating (challenge auto-resolving), waiting...`);
            await page.waitForTimeout(5000);
            // Re-check after navigation settles
            try {
              initialTitle = await page.title();
              hasInitialChallenge = initialTitle.toLowerCase().includes('just a moment');
            } catch (e) {
              // Still navigating, just continue
              console.log(`[Detect] Page still settling, proceeding...`);
            }
          } else {
            throw ctxErr;
          }
        }

        if (hasInitialChallenge) {
          console.log(`[Detect] Challenge detected! Attempting bypass...`);
          try {
            if (isCloudflare && initialTitle.toLowerCase().includes('just a moment')) {
              // Use the proven Cloudflare bypass module for standard Turnstile
              const solved = await bypassCloudflareIfNeeded(page, 90000);
              if (solved) {
                console.log(`[Detect] ✓ Cloudflare challenge bypassed!`);
                await page.waitForTimeout(5000);
              } else {
                console.log(`[Detect] ⚠️ Cloudflare bypass timed out`);
                await page.waitForTimeout(3000);
              }
            } else {
              // Use general bypass handler (PerimeterX, TownNews, etc.)
              const challenged = await bypassChallenge(page, 4).catch(err => {
                console.log(`[Detect] Bypass error (continuing anyway): ${err.message}`);
                return false;
              });
              if (challenged) {
                console.log(`[Detect] ✓ Challenge handled! Waiting for content to load...`);
                await page.waitForTimeout(5000);
              } else {
                console.log(`[Detect] ⚠️  Bypass completed (may have partially resolved), waiting for content...`);
                await page.waitForTimeout(8000);
              }
            }
          } catch (err) {
            console.log(`[Detect] Bypass exception (continuing): ${err.message}`);
            await page.waitForTimeout(8000);
          }
        } else {
          console.log(`[Detect] No challenge detected, proceeding...`);
        }

        // Wait for any remaining challenge to auto-resolve (with shorter intervals)
        for (let i = 0; i < 8; i++) {
          await page.waitForTimeout(1000);
          const title = await page.title();
          if (!title.toLowerCase().includes('just a moment')) break;
          console.log(`[Detect] Still waiting for content... (${(i + 1)}s)`);
        }

        // Wait for JS to render the player (it's a custom element loaded async)
        console.log(`[Detect] Waiting for player JS to render...`);
        await page.waitForTimeout(6000);

        // Dismiss any popups/overlays before detection and screenshots
        await dismissPopups(page);

        // Give the Instaread iframe / audio widget a bit more time to attach to the DOM
        try {
          await page.waitForSelector(
            'iframe#instaread_iframe, div.instaread-audio-player, instaread-player, [class*="instaread"], [id*="instaread"]',
            { timeout: 10000 }
          );
        } catch {
          // Soft timeout is fine – we still run detection logic below.
        }

        // Detect player in the rendered DOM
        const detection = await page.evaluate(() => {
          // Primary: <instaread-player> custom element
          const player = document.querySelector('instaread-player');
          if (player) {
            const attrs = {};
            for (const attr of player.attributes) {
              attrs[attr.name] = attr.value;
            }
            return { found: true, selector: 'instaread-player', attributes: attrs };
          }

          // Fallback: explicit Hill audio widget wrappers
          const hillAudio = document.querySelector('div.instaread-audio-player');
          if (hillAudio) {
            return {
              found: true,
              selector: 'div.instaread-audio-player',
              attributes: { class: hillAudio.className },
            };
          }

          const hillIframe = document.querySelector('iframe#instaread_iframe');
          if (hillIframe) {
            return {
              found: true,
              selector: '#instaread_iframe',
              attributes: { src: hillIframe.getAttribute('src') || null },
            };
          }

          // Fallback: Check for class-based markers
          const slot = document.querySelector('.instaread-player-slot, #instaread-player-container');
          if (slot) {
            return { found: true, selector: '.instaread-player-slot', attributes: { class: slot.className } };
          }

          // Shadow DOM check
          for (const el of document.querySelectorAll('*')) {
            if (el.shadowRoot) {
              const sp = el.shadowRoot.querySelector('instaread-player');
              if (sp) {
                return {
                  found: true,
                  selector: `${el.tagName.toLowerCase()} >> shadow >> instaread-player`,
                  attributes: {},
                };
              }
            }
          }

          // Fallback: class/id/data attributes
          const fallback = document.querySelector(
            '[class*="instaread"], [id*="instaread"], [data-player="instaread"]'
          );
          if (fallback) {
            return {
              found: true,
              selector: fallback.id ? `#${fallback.id}` : `[class*="instaread"]`,
              attributes: { fallbackDetection: true },
            };
          }

          // Fallback: instaread iframe
          const iframes = document.querySelectorAll('iframe[src*="instaread"]');
          if (iframes.length > 0) {
            return {
              found: true,
              selector: 'iframe[src*="instaread"]',
              attributes: { src: iframes[0].src },
            };
          }

          return { found: false, selector: null, attributes: null };
        });

        if (detection.found) {
          console.log(`[Detect] FOUND player at ${url}`);
        } else {
          console.log(`[Detect] No player at ${url}`);
        }

        let screenshot = null;
        try {
          const screenshotName = `detection_${Date.now()}.png`;
          const screenshotDir = path.resolve(process.cwd(), 'agents/shivani/screenshots');
          if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
          const screenshotPath = path.join(screenshotDir, screenshotName);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          screenshot = screenshotPath;
        } catch (e) {}

        results.push({
          url,
          hasPlayer: detection.found,
          playerSelector: detection.selector,
          playerAttributes: detection.attributes,
          method: 'browser',
          screenshot: screenshot
        });
      } catch (err) {
        console.log(`[Detect] Error on ${url}: ${err.message}`);
        
        let errorScreenshot = null;
        try {
          const screenshotName = `error_detect_${Date.now()}.png`;
          const screenshotDir = path.resolve(process.cwd(), 'agents/shivani/screenshots');
          if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
          const screenshotPath = path.join(screenshotDir, screenshotName);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          errorScreenshot = screenshotPath;
        } catch (e) {}

        results.push({
          url,
          hasPlayer: false,
          playerSelector: null,
          playerAttributes: null,
          method: 'browser-error',
          screenshot: errorScreenshot,
        });
      } finally {
        try {
          if (!page.isClosed?.()) {
            await page.close().catch(() => {});
          }
        } catch (closeErr) {
          // Ignore page close errors
        }
      }
    }
  } finally {
    // Restore console.log
    console.log = savedConsoleLog;
    await cleanup();
  }

  const found = results.filter((r) => r.hasPlayer);
  console.log(`\n[Detection] ${found.length}/${results.length} articles have <instaread-player/>`);
  return results;
}
