/**
 * Undetected Chrome Browser Launcher
 *
 * Two strategies based on bot protection type:
 * - rebrowser-playwright: patches CDP Runtime.enable leak for PerimeterX/HUMAN bypass
 * - regular playwright: preserves Runtime.enable for Cloudflare verification JS
 *
 * Both use manual Chrome spawn + CDP connect with persistent profile.
 */
import { chromium as rebrowserChromium } from 'rebrowser-playwright';
import { chromium as regularChromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import net from 'net';
import fs from 'fs';
import { INSTAREAD_USER_AGENT } from './config.js';

// Cache protection type per domain
const domainProtectionCache = new Map();

// Browser pool: stores browser + chromeProcess + userDataDir for full cleanup
const browserPool = {
  perimeterx: null, // { browser, chromeProcess, userDataDir }
  cloudflare: null,
};

const browserStats = {
  launches: 0,
  reuses: 0,
  cleanups: 0,
};

// Track last browser usage for idle timeout
let lastBrowserUseTime = {
  perimeterx: Date.now(),
  cloudflare: Date.now(),
};

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Detect what bot protection a domain uses via HTTP headers.
 * Returns 'perimeterx' | 'cloudflare' | 'unknown'
 */
export async function detectProtection(url) {
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const domain = new URL(url).hostname;
    if (domainProtectionCache.has(domain)) return domainProtectionCache.get(domain);

    // Phase 1: Try HEAD with redirect following to see final headers
    let resp = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': INSTAREAD_USER_AGENT },
    }).catch(() => null);

    // If HEAD fails (some sites block it), try a GET with range backoff
    if (!resp || !resp.ok) {
      resp = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 
          'User-Agent': INSTAREAD_USER_AGENT,
          'Range': 'bytes=0-1024' // Small fetch for headers/intro
        },
      }).catch(() => null);
    }

    if (!resp) return 'unknown';

    const server = resp.headers.get('server')?.toLowerCase() || '';
    const allHeaders = [...resp.headers.entries()].map(([k]) => k.toLowerCase());
    const links = resp.headers.get('link')?.toLowerCase() || '';
    
    let hasCloudflare = server.includes('cloudflare') || allHeaders.some(h => h.startsWith('cf-'));
    let hasPerimeterX = allHeaders.some(h => h.includes('px-')) || resp.status === 403;
    
    // TownNews/BLOX CMS detection via headers/links
    let hasTownNews = allHeaders.some(h => h.includes('townnews')) || 
                      links.includes('townnews') ||
                      links.includes('tncms') ||
                      links.includes('bloximages');

    // Phase 2: If headers are inconclusive, do a lightweight GET to check for TownNews signals in body
    if (!hasCloudflare && !hasPerimeterX && !hasTownNews) {
      try {
        const bodyResp = await fetch(url, { 
          method: 'GET', 
          headers: { 'User-Agent': INSTAREAD_USER_AGENT },
          redirect: 'follow'
        });
        const text = await bodyResp.text();
        const lowText = text.toLowerCase();
        if (
          lowText.includes('townnews') || 
          lowText.includes('tncms') || 
          lowText.includes('blox cms') ||
          lowText.includes('client_captcha') ||
          lowText.includes('challenges.cloudflare.com')
        ) {
          if (lowText.includes('townnews') || lowText.includes('tncms')) hasTownNews = true;
          if (lowText.includes('challenges.cloudflare.com')) hasCloudflare = true;
        }
      } catch (e) {
        // Ignore fetch errors in detection
      }
    }

    let protection = 'unknown';
    if (hasCloudflare) protection = 'cloudflare';
    else if (hasPerimeterX) protection = 'perimeterx';
    else if (hasTownNews) protection = 'townnews';

    domainProtectionCache.set(domain, protection);
    console.log(`[Browser] ${domain} protection: ${protection} (Final URL: ${resp.url})`);
    return protection;
  } catch (err) {
    console.warn(`[Browser] Detection error for ${url}:`, err.message);
    return 'unknown';
  }
}

/**
 * Launch the right browser for a URL's protection type.
 * 
 * CRITICAL FIX: Cloudflare REQUIRES regular playwright (not rebrowser).
 * Cloudflare's JavaScript needs the unpatched CDP Runtime.enable to verify
 * the browser is real. Rebrowser patches this leak, breaking Cloudflare's verification.
 * 
 * For Cloudflare: Use simple playwright.launch() with headless mode
 * For PerimeterX: Use rebrowser-playwright with CDP leak patching
 */
export async function launchForUrl(url) {
  const protection = await detectProtection(url);
  
  if (protection === 'cloudflare' || protection === 'townnews') {
    // CLOUDFLARE & TOWNNEWS: Use simple playwright.launch() - avoids CDP patching issues
    // These sites often expect a real Chrome and might detect/be suspicious of rebrowser
    return launchCloudflareSimple();
  } else {
    // PERIMETERX: Use rebrowser with CDP leak patching
    const poolKey = protection === 'perimeterx' ? 'perimeterx' : 'perimeterx';
    return launchUndetectedBrowser({ useRebrowser: true, poolKey });
  }
}

/**
 * Simple Cloudflare browser launcher.
 * Uses Playwright's built-in chromium.launch() (same as test-cloudflare-articles.js) so
 * Cloudflare serves the normal Turnstile challenge with iframe; the spawn+CDP approach
 * can trigger a different challenge with no iframe in DOM.
 */
async function launchCloudflareSimple() {
  const poolKey = 'cloudflare';
  if (browserPool[poolKey]) {
    try {
      const poolEntry = browserPool[poolKey];
      await poolEntry.browser.version();
      const idleTime = Date.now() - lastBrowserUseTime[poolKey];
      if (idleTime <= IDLE_TIMEOUT_MS) {
        lastBrowserUseTime[poolKey] = Date.now();
        browserStats.reuses++;
        console.log(`[Browser] Reusing pooled ${poolKey} (Playwright) browser`);
        return {
          browser: poolEntry.browser,
          cleanup: async () => {},
          reused: true,
        };
      }
      await poolEntry.browser.close().catch(() => {});
      browserPool[poolKey] = null;
    } catch (err) {
      browserPool[poolKey] = null;
    }
  }

  console.log(`[Browser] Launching new ${poolKey} browser instance (Playwright)...`);
  browserStats.launches++;
  const launchOpts = {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  };
  let browser;
  try {
    browser = await regularChromium.launch({ ...launchOpts, channel: 'chrome' });
  } catch (err) {
    console.log(`[Browser] System Chrome not found (${err?.message}), using bundled Chromium`);
    browser = await regularChromium.launch(launchOpts);
  }
  browserPool[poolKey] = { browser, chromeProcess: null, userDataDir: null };
  lastBrowserUseTime[poolKey] = Date.now();
  console.log(`[Browser] New ${poolKey} browser added to pool for future reuse`);

  return {
    browser,
    cleanup: async () => { /* pooled, no-op */ },
    reused: false,
  };
}

/**
 * Find a free port for Chrome's remote debugging.
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/**
 * Kill a Chrome process tree and clean up its profile directory.
 * Uses pkill to kill all child processes (GPU, renderer, network, etc.).
 */
function killChromeAndCleanup(chromeProcess, userDataDir) {
  if (!chromeProcess) return;
  const pid = chromeProcess.pid;
  // Kill entire process tree: parent + all children
  try { spawn('pkill', ['-KILL', '-P', String(pid)], { stdio: 'ignore' }); } catch {}
  try { chromeProcess.kill('SIGKILL'); } catch {}
  // Clean up profile directory after a brief delay
  setTimeout(() => {
    try {
      if (userDataDir && fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    } catch {}
  }, 2000);
}

/**
 * Get or create a pooled browser instance.
 * Reuses browser contexts to reduce startup overhead.
 * @param {Object} options
 * @param {boolean} options.useRebrowser - Use rebrowser-playwright for PerimeterX bypass
 * @param {boolean} options.reusable - Allow session reuse in the pool (default: true)
 * Returns { browser, cleanup, reused }
 */
export async function launchUndetectedBrowser({ useRebrowser = true, reusable = true, poolKey: explicitPoolKey } = {}) {
  const poolKey = explicitPoolKey || (useRebrowser ? 'perimeterx' : 'cloudflare');

  // Try to reuse existing browser from pool if enabled
  if (reusable && browserPool[poolKey]) {
    try {
      const poolEntry = browserPool[poolKey];
      const lastUseTime = lastBrowserUseTime[poolKey];
      const idleTime = Date.now() - lastUseTime;

      // Check if browser is idle too long
      if (idleTime > IDLE_TIMEOUT_MS) {
        console.log(`[Browser] Pooled ${poolKey} browser idle for ${Math.round(idleTime / 1000)}s, relaunching...`);
        await poolEntry.browser.close().catch(() => {});
        killChromeAndCleanup(poolEntry.chromeProcess, poolEntry.userDataDir);
        browserPool[poolKey] = null;
      } else {
        // Browser still fresh, reuse it
        await poolEntry.browser.version();
        console.log(`[Browser] Reusing pooled ${poolKey} browser instance (idle ${Math.round(idleTime / 1000)}s)`);
        lastBrowserUseTime[poolKey] = Date.now();
        browserStats.reuses++;

        return {
          browser: poolEntry.browser,
          cleanup: async () => {
            // No-op for pooled instances, keep browser alive for reuse
          },
          reused: true,
        };
      }
    } catch (err) {
      console.log(`[Browser] Pooled ${poolKey} browser stale, launching new instance...`);
      // Kill stale process
      const stale = browserPool[poolKey];
      if (stale?.chromeProcess) killChromeAndCleanup(stale.chromeProcess, stale.userDataDir);
      browserPool[poolKey] = null;
    }
  }

  // Launch new browser
  console.log(`[Browser] Launching new ${poolKey} browser instance...`);
  browserStats.launches++;

  const port = await findFreePort();
  const profileId = Math.random().toString(36).substring(2, 10);
  const userDataDir = path.resolve(process.cwd(), 'agents/shivani', `.chrome-profile-${profileId}`);

  const chromeProcess = spawn('google-chrome', [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--no-sandbox',
    '--disable-infobars',
    '--disable-blink-features=AutomationControlled',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,800',
    `--user-agent=${INSTAREAD_USER_AGENT}`,
    // Disable dev-shm which can cause issues in some environments
    '--disable-dev-shm-usage',
    // Disable GPU to avoid rendering issues
    '--disable-gpu',
    // Keep process separation for stability
    '--disable-web-resources',
    // Cloudflare specific: disable features that reveal headless
    '--disable-features=TranslateUI,IsolateOrigins,site-per-process',
    'about:blank',
  ], {
    stdio: 'ignore',
    detached: false,
  });

  const chromiumAPI = useRebrowser ? rebrowserChromium : regularChromium;

  for (let i = 0; i < 120; i++) {
    try {
      const browser = await chromiumAPI.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 2000 });

      const context = browser.contexts()[0];
      if (context) {
        await applyStealthScripts(context);
      }

      // Store in pool if reusable — including chromeProcess and userDataDir for cleanup
      if (reusable) {
        browserPool[poolKey] = { browser, chromeProcess, userDataDir };
        lastBrowserUseTime[poolKey] = Date.now();
        console.log(`[Browser] New ${poolKey} browser added to pool for future reuse`);
      }

      const cleanup = async () => {
        if (!reusable) {
          try { await browser.close(); } catch {}
          killChromeAndCleanup(chromeProcess, userDataDir);
          browserStats.cleanups++;
          console.log(`[Browser] Closed non-pooled ${poolKey} browser instance`);
        }
      };

      return { browser, cleanup, reused: false };
    } catch (err) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  chromeProcess.kill();
  throw new Error('Failed to connect to Chrome after 60s');
}

/**
 * Get browser pool statistics for monitoring.
 */
export function getBrowserStats() {
  return { ...browserStats };
}

/**
 * Gracefully close all pooled browsers, kill Chrome processes, clean up profiles.
 * Call this after job completion or during shutdown.
 */
export async function cleanupBrowserPool() {
  console.log('[Browser] Shutting down browser pool...');

  for (const [key, poolEntry] of Object.entries(browserPool)) {
    if (poolEntry) {
      try {
        await poolEntry.browser.close();
        console.log(`[Browser] Disconnected pooled ${key} browser`);
      } catch (err) {
        console.warn(`[Browser] Error closing ${key} browser:`, err.message);
      }
      // Always kill the Chrome process and clean up profile
      killChromeAndCleanup(poolEntry.chromeProcess, poolEntry.userDataDir);
      browserStats.cleanups++;
      console.log(`[Browser] Killed Chrome process for ${key} and cleaned profile`);
    }
  }

  browserPool.perimeterx = null;
  browserPool.cloudflare = null;
  console.log('[Browser] Browser pool cleanup complete');
}

/**
 * Apply full suite of stealth scripts to a browser context.
 * This is CRITICAL for bypassing advanced bot protection like Cloudflare and TownNews.
 */
export async function applyStealthScripts(context) {
  await context.addInitScript(() => {
    // --- Chrome runtime object (missing = automation detected) ---
    if (!window.chrome) {
      window.chrome = {
        runtime: {
          connect: function() {},
          sendMessage: function() {},
          onMessage: { addListener: function() {}, removeListener: function() {} },
          id: undefined,
        }
      };
    }

    // --- Permissions query (Notification permission reveals automation) ---
    const originalQuery = window.Permissions?.prototype?.query;
    if (originalQuery) {
      window.Permissions.prototype.query = function(params) {
        if (params?.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery.call(this, params);
      };
    }

    // --- Platform consistency ---
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    
    // --- Spoof plugins to look real ---
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      ]
    });

    // --- Prevent iframe contentWindow detection of automation ---
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function() {
      return originalAttachShadow.call(this, ...arguments);
    };

    // --- WebGL renderer (headless reveals "SwiftShader") ---
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return 'Google Inc. (Intel)';  // UNMASKED_VENDOR
      if (param === 37446) return 'ANGLE (Intel, Mesa Intel(R) UHD Graphics, OpenGL 4.6)';  // UNMASKED_RENDERER
      return getParameter.call(this, param);
    };
    const getParameter2 = WebGL2RenderingContext?.prototype?.getParameter;
    if (getParameter2) {
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Google Inc. (Intel)';
        if (param === 37446) return 'ANGLE (Intel, Mesa Intel(R) UHD Graphics, OpenGL 4.6)';
        return getParameter2.call(this, param);
      };
    }

    // --- Prevent stack trace CDP detection ---
    const origStackGetter = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
    if (origStackGetter?.get) {
      Object.defineProperty(Error.prototype, 'stack', {
        get: function() {
          const stack = origStackGetter.get.call(this);
          if (typeof stack === 'string') {
            return stack.replace(/cdp|devtools|playwright|puppeteer/gi, 'native');
          }
          return stack;
        },
      });
    }

    // --- Spoof webdriver detection ---
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    
    // --- Spoof languages ---
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
    
    // --- Fix screen properties ---
    Object.defineProperty(screen, 'availHeight', { get: () => 760 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1280 });
    Object.defineProperty(screen, 'height', { get: () => 800 });
    Object.defineProperty(screen, 'width', { get: () => 1280 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  });
}

/**
 * Close browser for a specific protection type (for job completion).
 * @param {string} protectionType - 'perimeterx' or 'cloudflare'
 */
export async function closeBrowserForType(protectionType) {
  const poolKey = protectionType === 'perimeterx' ? 'perimeterx' : 'cloudflare';
  const poolEntry = browserPool[poolKey];

  if (poolEntry) {
    try {
      await poolEntry.browser.close();
      console.log(`[Browser] Disconnected pooled ${poolKey} browser after job`);
    } catch (err) {
      console.warn(`[Browser] Error closing ${poolKey} browser:`, err.message);
    }
    killChromeAndCleanup(poolEntry.chromeProcess, poolEntry.userDataDir);
    browserPool[poolKey] = null;
    delete lastBrowserUseTime[poolKey];
    browserStats.cleanups++;
    console.log(`[Browser] Killed Chrome process for ${poolKey}`);
  }
}
