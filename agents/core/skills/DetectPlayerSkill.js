import { Skill } from './Skill.js';
import { INSTAREAD_USER_AGENT } from '../../shivani/src/config.js';
import { launchForUrl, detectProtection, applyStealthScripts } from '../../shivani/src/browser.js';
import { dismissPopups, bypassChallenge } from '../../shivani/src/bypass.js';
import { bypassCloudflareIfNeeded } from '../../shivani/src/cloudflare-browser-bypass.js';

export class DetectPlayerSkill extends Skill {
  constructor() {
    super(
      'detect_player',
      'Checks article pages for the <instaread-player/> tag using an undetected browser.',
      {
        type: 'object',
        properties: {
          urls: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of article URLs to check for the player.'
          }
        },
        required: ['urls']
      },
      {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                hasPlayer: { type: 'boolean' },
                playerSelector: { type: 'string', nullable: true },
                playerAttributes: { type: 'object', nullable: true },
                method: { type: 'string' }
              }
            }
          }
        }
      }
    );
  }

  async execute(input, context) {
    const { urls } = input;
    const results = [];

    if (!urls || urls.length === 0) {
      return { results };
    }

    const protection = await detectProtection(urls[0]);
    const isCloudflare = protection === 'cloudflare';
    const isTownNews = protection === 'townnews';

    let browser, cleanup;
    
    if (context && context.sharedBrowser) {
      browser = context.sharedBrowser.browser;
      cleanup = async () => {};
    } else {
      ({ browser, cleanup } = await launchForUrl(urls[0]));
    }

    const savedConsoleLog = console.log;

    try {
      console.log = function(...args) {
        const msg = args[0]?.toString() || '';
        if (!msg.includes('[rebrowser-patches][frames._context]')) {
          savedConsoleLog.apply(console, args);
        }
      };

      let browserContext, page;
      if (isCloudflare || isTownNews) {
        browserContext = await browser.newContext({
          userAgent: INSTAREAD_USER_AGENT
        });
        await applyStealthScripts(browserContext);
      } else {
        browserContext = browser.contexts()[0] || await browser.newContext({ userAgent: INSTAREAD_USER_AGENT });
      }

      // CHECK FOR SHARED PAGE FIRST
      const sharedPage = context?.sharedBrowser?.page;
      const isSharedPageReusable = sharedPage && !sharedPage.isClosed();

      for (const url of urls) {
        console.log(`[DetectPlayerSkill] Checking: ${url}`);
        
        if (isSharedPageReusable && urls.length === 1) {
          console.log(`[DetectPlayerSkill] Reusing shared page from context...`);
          page = sharedPage;
        } else {
          page = await browserContext.newPage();
        }

        if (isCloudflare) {
          await page.setViewportSize({ width: 1280, height: 720 });
        }

        try {
          console.log(`[DetectPlayerSkill] Loading page...`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(2000);

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
              console.log(`[DetectPlayerSkill] Page navigating (challenge auto-resolving), waiting...`);
              await page.waitForTimeout(5000);
              try {
                initialTitle = await page.title();
                hasInitialChallenge = initialTitle.toLowerCase().includes('just a moment');
              } catch (e) {
                console.log(`[DetectPlayerSkill] Page still settling, proceeding...`);
              }
            } else {
              throw ctxErr;
            }
          }

          if (hasInitialChallenge) {
            console.log(`[DetectPlayerSkill] Challenge detected! Attempting bypass...`);
            try {
              if (isCloudflare && initialTitle.toLowerCase().includes('just a moment')) {
                const solved = await bypassCloudflareIfNeeded(page, 90000);
                if (solved) {
                  console.log(`[DetectPlayerSkill] ✓ Cloudflare challenge bypassed!`);
                  await page.waitForTimeout(5000);
                } else {
                  console.log(`[DetectPlayerSkill] ⚠️ Cloudflare bypass timed out`);
                  await page.waitForTimeout(3000);
                }
              } else {
                const challenged = await bypassChallenge(page, 4).catch(err => {
                  console.log(`[DetectPlayerSkill] Bypass error (continuing anyway): ${err.message}`);
                  return false;
                });
                if (challenged) {
                  console.log(`[DetectPlayerSkill] ✓ Challenge handled! Waiting for content to load...`);
                  await page.waitForTimeout(5000);
                } else {
                  console.log(`[DetectPlayerSkill] ⚠️  Bypass completed (may have partially resolved), waiting for content...`);
                  await page.waitForTimeout(8000);
                }
              }
            } catch (err) {
              console.log(`[DetectPlayerSkill] Bypass exception (continuing): ${err.message}`);
              await page.waitForTimeout(8000);
            }
          } else {
            console.log(`[DetectPlayerSkill] No challenge detected, proceeding...`);
          }

          for (let i = 0; i < 8; i++) {
            await page.waitForTimeout(1000);
            const title = await page.title();
            if (!title.toLowerCase().includes('just a moment')) break;
            console.log(`[DetectPlayerSkill] Still waiting for content... (${(i + 1)}s)`);
          }

          console.log(`[DetectPlayerSkill] Waiting for player JS to render...`);
          await page.waitForTimeout(6000);

          await dismissPopups(page);

          const detection = await page.evaluate(() => {
            const player = document.querySelector('instaread-player');
            if (player) {
              const attrs = {};
              for (const attr of player.attributes) {
                attrs[attr.name] = attr.value;
              }
              return { found: true, selector: 'instaread-player', attributes: attrs };
            }

            for (const el of document.querySelectorAll('*')) {
              if (el.shadowRoot) {
                const sp = el.shadowRoot.querySelector('instaread-player');
                if (sp) {
                  const tag = (el.tagName && typeof el.tagName === 'string') ? el.tagName.toLowerCase() : 'element';
                  return {
                    found: true,
                    selector: `${tag} >> shadow >> instaread-player`,
                    attributes: {},
                  };
                }
              }
            }

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
            console.log(`[DetectPlayerSkill] FOUND player at ${url}`);
          } else {
            console.log(`[DetectPlayerSkill] No player at ${url}`);
          }

          results.push({
            url,
            hasPlayer: detection.found,
            playerSelector: detection.selector,
            playerAttributes: detection.attributes,
            method: 'browser',
          });
        } catch (err) {
          console.log(`[DetectPlayerSkill] Error on ${url}: ${err.message}`);
          results.push({
            url,
            hasPlayer: false,
            playerSelector: null,
            playerAttributes: null,
            method: 'browser-error',
          });
        } finally {
          try {
            // Only close if it's NOT the shared page
            if (page && page !== sharedPage && !page.isClosed?.()) {
              await page.close().catch(() => {});
            }
          } catch (closeErr) {}
        }
      }
    } finally {
      console.log = savedConsoleLog;
      await cleanup();
    }

    return { results, protection };
  }
}
