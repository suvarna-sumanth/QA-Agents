/**
 * Undetected Chrome Browser Launcher (V3 - Standard Playwright Launch)
 * Using rebrowser-playwright launch for better proxy auth stability.
 * Supports proxy rotation to avoid WAF detection/blocking.
 */
// Static import removed to prevent Next.js build issues with browser-internal assets
// import { chromium as rebrowserChromium } from 'rebrowser-playwright';
import { INSTAREAD_USER_AGENT } from './config.js';
import { getRotatingProxyConfig } from './proxy-rotation.js';
import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.NO_PROXY = '127.0.0.1,localhost';
process.env.no_proxy = '127.0.0.1,localhost';

const browserPool = {};
const browserStats = { launches: 0, reuses: 0 };

export async function detectProtection(url) {
  // Simple head check - real detection happens in skills
  // Map known domains to their protection types
  if (url.includes('thehill.com')) return 'perimeterx';
  if (url.includes('thebrakereport.com')) return 'cloudflare';

  // For unknown domains, default to cloudflare as it's most common
  // Real detection happens in skills via runtime checks
  return 'cloudflare';
}

export async function launchForUrl(url) {
  // Launch appropriate stealth browser based on detected protection
  const protection = await detectProtection(url);
  const poolKey = protection === 'perimeterx' ? 'perimeterx' : 'cloudflare';
  return launchUndetectedBrowser({ poolKey });
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
      '--test-type', // Additional flag to bypass some cert checks
    ],
  };

  // Use rotating proxy to avoid WAF detection
  if (process.env.RESIDENTIAL_PROXY || process.env.BRIGHTDATA_CUSTOMER_ID) {
    try {
      launchOpts.proxy = getRotatingProxyConfig();
    } catch (err) {
      console.warn(`[Browser] Proxy rotation failed, falling back to static proxy: ${err.message}`);
      if (process.env.RESIDENTIAL_PROXY) {
        const proxyUrl = new URL(process.env.RESIDENTIAL_PROXY);
        launchOpts.proxy = {
          server: `http://${proxyUrl.host}`,
          username: proxyUrl.username,
          password: proxyUrl.password,
        };
      }
    }
  }

  // Use rebrowserChromium for automatic stealth patches
  // Prefer system Chrome which may have better SSL handling
  const chromeExePath = fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
  console.log(`[Browser] Using Chrome executable: ${chromeExePath || 'bundled Chromium'}`);

  const browser = await rebrowserChromium.launch({
    ...launchOpts,
    executablePath: chromeExePath,
  }).catch(async (err) => {
    console.warn(`[Browser] Launch failed: ${err.message}, falling back to bundled Chromium`);
    return await rebrowserChromium.launch(launchOpts);
  });

  // Create context with proper HTTPS error handling
  // Always create fresh context to guarantee ignoreHTTPSErrors is set
  let browserContext;
  if (process.env.RESIDENTIAL_PROXY || process.env.BRIGHTDATA_CUSTOMER_ID) {
    try {
      const proxyConfig = getRotatingProxyConfig();
      browserContext = await browser.newContext({
        ignoreHTTPSErrors: true,
        acceptInsecureCerts: true,
        userAgent: INSTAREAD_USER_AGENT,
        viewport: { width: 1280, height: 720 }
      });
      console.log(`[Browser] Pre-setting proxy auth for ${proxyConfig.username}`);
      await browserContext.setHTTPCredentials({
        username: proxyConfig.username,
        password: proxyConfig.password
      });
    } catch (err) {
      console.warn(`[Browser] Failed to set rotating proxy credentials: ${err.message}`);
      browserContext = await browser.newContext({
        ignoreHTTPSErrors: true,
        acceptInsecureCerts: true,
        userAgent: INSTAREAD_USER_AGENT,
        viewport: { width: 1280, height: 720 }
      });
    }
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
