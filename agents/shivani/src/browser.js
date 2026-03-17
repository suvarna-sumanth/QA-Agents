/**
 * Undetected Chrome Browser Launcher (V3 - Standard Playwright Launch)
 * Using rebrowser-playwright launch for better proxy auth stability.
 */
// Static import removed to prevent Next.js build issues with browser-internal assets
// import { chromium as rebrowserChromium } from 'rebrowser-playwright';
import { INSTAREAD_USER_AGENT } from './config.js';
import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.NO_PROXY = '127.0.0.1,localhost';
process.env.no_proxy = '127.0.0.1,localhost';

const browserPool = {};
const browserStats = { launches: 0, reuses: 0 };

export async function detectProtection(url) {
  // Simple head check - real detection happens in skills
  return url.includes('thehill.com') ? 'perimeterx' : 'unknown';
}

export async function launchForUrl(url) {
  return launchUndetectedBrowser({ poolKey: url.includes('thehill.com') ? 'perimeterx' : 'default' });
}

export async function launchUndetectedBrowser(opts = {}) {
  const { chromium: rebrowserChromium } = await import('rebrowser-playwright');
  const poolKey = opts.poolKey || 'default';
  
  if (browserPool[poolKey]) {
    try {
      await browserPool[poolKey].version();
      browserStats.reuses++;
      return { browser: browserPool[poolKey], cleanup: async () => {}, reused: true };
    } catch (err) {
      delete browserPool[poolKey];
    }
  }

  console.log(`[Browser] Launching Undetected browser (${poolKey})...`);
  browserStats.launches++;

  const launchOpts = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ],
  };

  if (process.env.RESIDENTIAL_PROXY) {
    const proxyUrl = new URL(process.env.RESIDENTIAL_PROXY);
    launchOpts.proxy = {
      server: `http://${proxyUrl.host}`,
      username: proxyUrl.username,
      password: proxyUrl.password,
    };
  }

  // Use rebrowserChromium for automatic stealth patches
  const browser = await rebrowserChromium.launch({
    ...launchOpts,
    executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined,
  }).catch(async (err) => {
    console.warn(`[Browser] Chrome at /usr/bin/google-chrome failed: ${err.message}, falling back to bundled Chromium`);
    return await rebrowserChromium.launch(launchOpts);
  });

  // Create context with proper HTTPS error handling
  // Always create fresh context to guarantee ignoreHTTPSErrors is set
  let browserContext;
  if (process.env.RESIDENTIAL_PROXY) {
    const proxyUrl = new URL(process.env.RESIDENTIAL_PROXY);
    browserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      acceptInsecureCerts: true,
      userAgent: INSTAREAD_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });
    console.log(`[Browser] Pre-setting proxy auth for ${proxyUrl.username}`);
    await browserContext.setHTTPCredentials({
      username: proxyUrl.username,
      password: proxyUrl.password
    });
  } else {
    browserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      acceptInsecureCerts: true,
      userAgent: INSTAREAD_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });
  }

  browserPool[poolKey] = browser;
  return { browser, browserContext, cleanup: async () => {}, reused: false };
}

export async function cleanupBrowserPool() {
  for (const key in browserPool) {
    await browserPool[key].close().catch(() => {});
    delete browserPool[key];
  }
}

export async function applyStealthScripts(context) {
  // rebrowser-playwright handles much of this, but we keep it for extra safety
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}
