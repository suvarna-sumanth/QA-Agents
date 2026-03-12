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

    const resp = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': INSTAREAD_USER_AGENT },
    });

    const server = resp.headers.get('server')?.toLowerCase() || '';
    const allHeaders = [...resp.headers.entries()].map(([k]) => k.toLowerCase());
    const hasCloudflare = server.includes('cloudflare') || allHeaders.some(h => h.startsWith('cf-'));
    const hasPerimeterX = allHeaders.some(h => h.includes('px-')) || resp.status === 403;

    let protection = 'unknown';
    if (hasCloudflare) protection = 'cloudflare';
    else if (hasPerimeterX) protection = 'perimeterx';

    domainProtectionCache.set(domain, protection);
    console.log(`[Browser] ${domain} protection: ${protection}`);
    return protection;
  } catch {
    return 'unknown';
  }
}

/**
 * Launch the right browser for a URL's protection type.
 * Both PerimeterX and Cloudflare now use rebrowser-playwright for CDP leak patching.
 * The original theory that CF needs regular playwright was wrong — CF detects
 * the unpatched CDP Runtime.enable leak, which is exactly what rebrowser fixes.
 */
export async function launchForUrl(url) {
  const protection = await detectProtection(url);
  // Use rebrowser-playwright for all protection types — its CDP patching
  // prevents the Runtime.enable leak that both CF and PX detect.
  // We pass the protection type as poolKey to ensure separate browser contexts
  // in the pool so they don't interfere with each other.
  const poolKey = (protection === 'cloudflare' || protection === 'perimeterx') ? protection : 'perimeterx';
  return launchUndetectedBrowser({ useRebrowser: true, poolKey });
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
  const userDataDir = path.resolve(import.meta.dirname, '..', `.chrome-profile-${profileId}`);

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
    } catch {
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
