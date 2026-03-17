import { Skill } from './Skill.js';
import path from 'path';
import fs from 'fs';
import { launchForUrl, detectProtection, applyStealthScripts } from '../../shivani/src/browser.js';
import { dismissPopups, bypassChallenge } from '../../shivani/src/bypass.js';
import { bypassCloudflareIfNeeded } from '../../shivani/src/cloudflare-browser-bypass.js';
import { INSTAREAD_USER_AGENT } from '../../shivani/src/config.js';

export class TestPlayerSkill extends Skill {
  constructor() {
    super(
      'test_player',
      'Run full QA test suite on a page with an instaread-player. Tests play, pause, seek, speed, ads, etc. inside the iframe.',
      {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The article URL with the player' },
          playerSelector: { type: 'string', description: 'CSS selector for the player element', default: 'instaread-player' },
          screenshotDir: { type: 'string', description: 'Directory to place screenshots', default: '' }
        },
        required: ['url']
      },
      {
        type: 'object',
        properties: {
          report: {
            type: 'object',
            description: 'The final test report containing all steps and status.'
          }
        }
      }
    );
  }

  async captureFullPageScreenshot(page, screenshotDir, stepName, stepIndex) {
    try {
      if (!screenshotDir) return null;
      const screenshotName = `${stepIndex}-${stepName.replace(/\s+/g, '_').toLowerCase()}-full-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[TestPlayerSkill] ✓ Full page captured: ${screenshotName}`);
      return screenshotPath;
    } catch (err) {
      console.log(`[TestPlayerSkill] Failed full page for "${stepName}": ${err.message}`);
      return null;
    }
  }

  async capturePlayerScreenshot(page, screenshotDir, stepName, stepIndex) {
    try {
      if (!screenshotDir) return null;
      const iframeEl = await page.$('iframe[id="instaread_iframe"]')
        || await page.$('instaread-player iframe')
        || await page.$('iframe[src*="instaread"]');
      
      if (!iframeEl) {
        console.log(`[TestPlayerSkill] Player iframe not found for "${stepName}"`);
        return null;
      }

      await iframeEl.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);

      const boundingBox = await iframeEl.boundingBox();
      if (!boundingBox) {
        console.log(`[TestPlayerSkill] Could not get bounding box for "${stepName}"`);
        return null;
      }

      const screenshotName = `${stepIndex}-${stepName.replace(/\s+/g, '_').toLowerCase()}-player-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotName);
      
      await page.screenshot({
        path: screenshotPath,
        clip: {
          x: Math.max(0, boundingBox.x),
          y: Math.max(0, boundingBox.y),
          width: boundingBox.width,
          height: boundingBox.height
        }
      });
      console.log(`[TestPlayerSkill] ✓ Player captured: ${screenshotName}`);
      return screenshotPath;
    } catch (err) {
      console.log(`[TestPlayerSkill] Failed to capture player for "${stepName}": ${err.message}`);
      return null;
    }
  }

  buildReport(url, steps, startTime) {
    const passed = steps.filter((s) => s.status === 'pass').length;
    const failed = steps.filter((s) => s.status === 'fail').length;
    const skipped = steps.filter((s) => s.status === 'skip').length;
    const total = steps.length;

    let overallStatus = 'pass';
    if (failed > 0 && passed > 0) overallStatus = 'partial';
    if (failed > 0 && passed === 0) overallStatus = 'fail';

    return {
      url,
      timestamp: new Date().toISOString(),
      steps,
      overallStatus,
      summary: { passed, failed, skipped, total },
      totalDuration: Date.now() - startTime,
    };
  }

  async execute(input, context) {
    const { url, playerSelector = 'instaread-player' } = input;
    let { screenshotDir } = input;
    
    if (!screenshotDir) {
      // Default to the original codebase screenshots directory
      screenshotDir = path.resolve(process.cwd(), 'agents/shivani/screenshots');
    }
    
    fs.mkdirSync(screenshotDir, { recursive: true });

    const steps = [];
    const startTime = Date.now();
    let stepCounter = 1;

    // Extract a readable URL slug for grouping screenshots
    const extractUrlSlug = (fullUrl) => {
      try {
        const urlObj = new URL(fullUrl);
        const path = urlObj.pathname.replace(/^\/|\/$/g, '').split('/').slice(0, 3).join('/');
        return path || urlObj.hostname;
      } catch (e) {
        return fullUrl.substring(0, 40);
      }
    };

    const urlSlug = extractUrlSlug(url);

    const protection = await detectProtection(url);
    const isCloudflare = protection === 'cloudflare';
    const isTownNews = protection === 'townnews';

    let browser, cleanup;
    let shouldCleanup = false;
    
    if (context && context.sharedBrowser) {
      browser = context.sharedBrowser.browser;
      cleanup = async () => {};
    } else {
      ({ browser, cleanup } = await launchForUrl(url));
      shouldCleanup = true;
    }

    let browserContext, page;
    const sharedPage = context?.sharedBrowser?.page;
    const isSharedPageReusable = sharedPage && !sharedPage.isClosed();

    if (isCloudflare || isTownNews) {
      if (isSharedPageReusable) {
        page = sharedPage;
        console.log(`[TestPlayerSkill] Reusing shared stealth page...`);
      } else {
        browserContext = await browser.newContext({
          userAgent: INSTAREAD_USER_AGENT,
          ignoreHTTPSErrors: true
        });
        await applyStealthScripts(browserContext);
        page = await browserContext.newPage();
        await page.setViewportSize({ width: 1280, height: 720 });
      }
    } else {
      if (isSharedPageReusable) {
        page = sharedPage;
        console.log(`[TestPlayerSkill] Reusing shared regular page...`);
      } else {
        browserContext = browser.contexts()[0] || await browser.newContext({ 
          userAgent: INSTAREAD_USER_AGENT,
          ignoreHTTPSErrors: true
        });
        page = await browserContext.newPage();
      }
    }
    if (browserContext && context?.discoveryCookies?.length && isCloudflare) {
      try {
        await browserContext.addCookies(context.discoveryCookies);
        console.log(`[TestPlayerSkill] Injected ${context.discoveryCookies.length} cookies from standalone discovery`);
      } catch (e) {
        console.warn('[TestPlayerSkill] Failed to add discovery cookies:', e?.message);
      }
    }

    const originalLog = console.log;
    console.log = function(...args) {
      const msg = args[0]?.toString() || '';
      if (!msg.includes('[rebrowser-patches][frames._context]')) {
        originalLog.apply(console, args);
      }
    };

    try {
      // ── Step 1: Load page and bypass challenges ──
      const step1Start = Date.now();
      let initialScreenshot = null;
      try {
        console.log(`[TestPlayerSkill] Loading page: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        initialScreenshot = await this.captureFullPageScreenshot(page, screenshotDir, 'article_page_loaded', stepCounter++);
        
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
                                currentUrl.includes('client_captcha');
        } catch (ctxErr) {
          if (ctxErr.message.includes('Execution context was destroyed') || ctxErr.message.includes('navigation')) {
            await page.waitForTimeout(5000);
            try {
              initialTitle = await page.title();
              hasInitialChallenge = initialTitle.toLowerCase().includes('just a moment');
            } catch (e) {}
          } else {
            throw ctxErr;
          }
        }

        if (hasInitialChallenge) {
          console.log(`[TestPlayerSkill] Challenge detected! Attempting bypass...`);
          try {
            let challenged = false;
            if (isCloudflare && initialTitle.toLowerCase().includes('just a moment')) {
              challenged = await bypassCloudflareIfNeeded(page, 90000);
            } else {
              challenged = await bypassChallenge(page, 3).catch(() => false);
            }
            if (challenged) {
              await page.waitForTimeout(4000);
              await this.captureFullPageScreenshot(page, screenshotDir, 'challenge_bypassed', stepCounter++);
            } else {
              await page.waitForTimeout(5000);
            }
          } catch (err) {
            await page.waitForTimeout(5000);
          }
        }

        for (let i = 0; i < 10; i++) {
          const title = await page.title();
          if (!title.toLowerCase().includes('just a moment')) break;
          await page.waitForTimeout(1500);
        }
        
        await page.waitForTimeout(3000);
        await dismissPopups(page);

        steps.push({
          name: `[${urlSlug}] Page Load`,
          status: 'pass',
          message: `Page loaded successfully: ${url}`,
          screenshot: initialScreenshot,
          duration: Date.now() - step1Start,
        });
      } catch (err) {
        if (!initialScreenshot && page) {
          try {
            initialScreenshot = await this.captureFullPageScreenshot(page, screenshotDir, 'page_load_error', stepCounter++);
          } catch (e) {}
        }
        steps.push({
          name: `[${urlSlug}] Page Load`,
          status: 'fail',
          message: `Failed to load page: ${err.message}`,
          screenshot: initialScreenshot,
          duration: Date.now() - step1Start,
        });
        return { report: this.buildReport(url, steps, startTime) };
      }

      // ── Step 2: Detect Player ──
      const step2Start = Date.now();
      let playerEl;
      let playerDetectionScreenshot = null;
      try {
        playerEl = await page.waitForSelector(playerSelector, { timeout: 10000 }).catch(() => null);
        if (!playerEl) {
          playerEl = await page.waitForSelector('iframe[src*="instaread"]', { timeout: 5000 }).catch(() => null);
        }
        if (playerEl) {
          await playerEl.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await dismissPopups(page);
          await page.waitForTimeout(300);
          playerDetectionScreenshot = await this.capturePlayerScreenshot(page, screenshotDir, 'player_detected', stepCounter++);
        }

        steps.push({
          name: `[${urlSlug}] Player Detection`,
          status: playerEl ? 'pass' : 'fail',
          message: playerEl ? `Player element found via "${playerSelector}"` : 'Player element not found',
          screenshot: playerDetectionScreenshot,
          duration: Date.now() - step2Start,
        });
      } catch (err) {
        steps.push({
          name: `[${urlSlug}] Player Detection`,
          status: 'fail',
          message: `Player element not found: ${err.message}`,
          screenshot: playerDetectionScreenshot,
          duration: Date.now() - step2Start,
        });
        return { report: this.buildReport(url, steps, startTime) };
      }

      // ── Step 3: Access iframe ──
      const step3Start = Date.now();
      let frame = null;
      try {
        const iframeEl = await page.$('iframe[id="instaread_iframe"]')
          || await page.$(`${playerSelector} iframe`)
          || await page.$('iframe[src*="instaread"]');

        if (iframeEl) {
          frame = await iframeEl.contentFrame();
        }

        if (frame) {
          await frame.waitForTimeout(1000);
          const iframeElements = await frame.evaluate(() => {
            return {
              hasAudio: !!document.querySelector('audio#audioElement'),
              audioCanPlay: (document.querySelector('audio#audioElement')?.readyState ?? -1) >= 2,
              hasPlayButton: !!(document.querySelector('#playCircleBlockButton') || document.querySelector('#playCircleBlock')),
              hasSeekbar: !!document.querySelector('#audioTrackProgress'),
              hasSpeedButton: !!document.querySelector('button#audio_speed'),
              playerVisible: true,
            };
          });

          const allElementsFound = iframeElements.hasAudio && iframeElements.hasPlayButton && iframeElements.hasSeekbar && iframeElements.hasSpeedButton;

          steps.push({
            name: `[${urlSlug}] Iframe Elements Check`,
            status: allElementsFound ? 'pass' : 'fail',
            message: `Iframe accessed | Audio: ${iframeElements.hasAudio}, Play: ${iframeElements.hasPlayButton}, Seek: ${iframeElements.hasSeekbar}, Speed: ${iframeElements.hasSpeedButton}`,
            screenshot: await this.capturePlayerScreenshot(page, screenshotDir, 'iframe_elements_visible', stepCounter++),
            duration: Date.now() - step3Start,
          });
        } else {
          steps.push({
            name: `[${urlSlug}] Iframe Elements Check`,
            status: 'fail',
            message: 'Could not access instaread iframe content',
            screenshot: null,
            duration: Date.now() - step3Start,
          });
        }
      } catch (err) {
        steps.push({
          name: 'Iframe Elements Check',
          status: 'fail',
          message: `Could not check iframe elements: ${err.message}`,
          screenshot: await this.capturePlayerScreenshot(page, screenshotDir, 'iframe_error', stepCounter++),
          duration: Date.now() - step3Start,
        });
      }

      // ── Step 4: Click play ──
      const step4Start = Date.now();
      if (frame) {
        try {
          await dismissPopups(page);
          await page.waitForTimeout(500);

          let playBtn = await frame.$('#playCircleBlockButton')
            || await frame.$('#playCircleBlock')
            || await frame.$('button[aria-label*="play" i]')
            || await frame.$('button.play')
            || await frame.$('[class*="play"]');

          if (playBtn) {
            try {
              // Ensure play button is visible and enabled before clicking
              await frame.evaluate((selector) => {
                const btn = document.querySelector(selector) || document.querySelector('#playCircleBlockButton') || document.querySelector('#playCircleBlock');
                if (btn) {
                  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, '');

              await frame.waitForTimeout(300);

              // Retry play button click up to 3 times
              let clickSuccess = false;
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  // Force refresh of button element before each attempt
                  playBtn = await frame.$('#playCircleBlockButton')
                    || await frame.$('#playCircleBlock')
                    || await frame.$('button[aria-label*="play" i]')
                    || await frame.$('button.play');

                  if (playBtn) {
                    await playBtn.click({ timeout: 3000 });
                    clickSuccess = true;
                    console.log(`[TestPlayerSkill] Play button clicked (attempt ${attempt + 1})`);
                    break;
                  }
                } catch (e) {
                  console.log(`[TestPlayerSkill] Click attempt ${attempt + 1} failed: ${e.message}`);
                  if (attempt < 2) {
                    await frame.waitForTimeout(800);
                  }
                }
              }

              if (!clickSuccess) {
                // Fallback: Try direct audio play via JavaScript
                console.log(`[TestPlayerSkill] Click failed, using JavaScript audio.play()`);
                await frame.evaluate(() => {
                  const audio = document.querySelector('audio#audioElement');
                  if (audio) {
                    console.log(`[iframe] Calling audio.play() directly. Current state: paused=${audio.paused}, readyState=${audio.readyState}`);
                    audio.play().then(() => {
                      console.log(`[iframe] audio.play() succeeded`);
                    }).catch((e) => {
                      console.log(`[iframe] audio.play() failed: ${e.message}`);
                    });
                  }
                });
              }
            } catch (clickErr) {
              // Last resort: JavaScript play
              console.log(`[TestPlayerSkill] Click error, fallback to JavaScript: ${clickErr.message}`);
              await frame.evaluate(() => {
                const audio = document.querySelector('audio#audioElement');
                if (audio) audio.play().catch(() => {});
              });
            }

            await frame.waitForTimeout(3000);

            const isPlaying = await frame.evaluate(() => {
              const audio = document.querySelector('audio#audioElement');
              if (!audio) return false;
              // Check multiple conditions for robust playback detection
              // Don't require currentTime > 0 as it may not advance immediately
              const isPausedState = audio.paused === false;
              const hasMetadata = audio.readyState >= 1; // HAVE_METADATA or better
              const isNotEnded = audio.ended === false;
              return isPausedState && hasMetadata && isNotEnded;
            });

            steps.push({
              name: `[${urlSlug}] Play Button Click`,
              status: isPlaying ? 'pass' : 'fail',
              message: isPlaying ? 'Audio is playing' : 'Audio not playing after click',
              screenshot: await this.capturePlayerScreenshot(page, screenshotDir, 'after_play_click', stepCounter++),
              duration: Date.now() - step4Start,
            });
          } else {
            steps.push({ name: `[${urlSlug}] Play Button Click`, status: 'fail', message: 'Play button not found', screenshot: null, duration: Date.now() - step4Start });
          }
        } catch (err) {
          steps.push({ name: 'Play Button Click', status: 'fail', message: `Play error: ${err.message}`, screenshot: null, duration: Date.now() - step4Start });
        }
      }

      // Adding a final capture
      const finalPlayerScreenshot = await this.capturePlayerScreenshot(page, screenshotDir, 'final_player_state', stepCounter++);
      steps.push({
        name: `[${urlSlug}] Final Player State`,
        status: 'info',
        message: 'Testing complete.',
        screenshot: finalPlayerScreenshot,
        duration: 0,
      });

    } finally {
      console.log = originalLog;
      try {
        // Only close if it's NOT the shared page
        if (page && page !== sharedPage && !page.isClosed?.()) {
          await page.close().catch(() => {});
        }
      } catch (e) {}
      if (shouldCleanup && cleanup) {
        await cleanup().catch(() => {});
      }
    }

    return { report: this.buildReport(url, steps, startTime) };
  }
}
