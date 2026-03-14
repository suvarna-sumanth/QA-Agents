/**
 * Standalone Cloudflare discovery — runs in a separate Node process (same as test-cloudflare-articles.js).
 * Use this when the agent runs inside Next.js so the browser sees a clean process and Cloudflare serves the normal Turnstile iframe.
 *
 * Usage: node agents/shivani/src/run-cloudflare-discovery.js <domain>
 * Output: Single JSON line to stdout { "links": [ {url, text, pathname, hostname}, ... ] } or { "error": "..." }
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTAREAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

async function main() {
  const domain = process.argv[2] || '';
  if (!domain.startsWith('http')) {
    console.log(JSON.stringify({ error: 'Missing or invalid domain (use https://example.com)' }));
    process.exit(1);
  }

  const baseUrl = new URL(domain);
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 500,
    });
  } catch (err) {
    console.log(JSON.stringify({ error: `Launch failed: ${err.message}` }));
    process.exit(1);
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    const title = await page.title().catch(() => '');
    const isChallenge = title.includes('Just a moment') || title.includes('Challenge');
    if (isChallenge) {
      try {
        const cf = await page.locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]').first();
        if (await cf.isVisible({ timeout: 5000 }).catch(() => false)) {
          const box = await cf.boundingBox().catch(() => null);
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(500);
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          }
          await page.waitForTimeout(1000);
        }
      } catch (e) {}
      try {
        await page.click('body');
        await page.waitForTimeout(500);
      } catch (e) {}
      try {
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);
      } catch (e) {}
      await page.waitForTimeout(2000);

      for (let i = 0; i < 60; i++) {
        const t = await page.title().catch(() => 'error');
        const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || '').catch(() => '');
        if (t !== 'error' && !t.includes('Just a moment') && !t.includes('Challenge') &&
            !bodyText.includes('checking your browser') && !bodyText.includes('enable javascript')) {
          break;
        }
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForTimeout(3000);
    try {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);
    } catch (e) {}

    const linkData = await page.evaluate((hostname) => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map((a) => {
          try {
            const href = a.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
            const url = new URL(href, window.location.href);
            const text = (a.innerText || '').trim().slice(0, 200) || url.pathname;
            return { url: url.href, text, pathname: url.pathname, hostname: url.hostname };
          } catch {
            return null;
          }
        })
        .filter((item) => item !== null && (item.hostname === hostname || item.hostname.replace('www.', '') === hostname.replace('www.', '')));
    }, baseUrl.hostname).catch(() => []);

    const uniqueLinks = [...new Map(linkData.map((l) => [l.url, l])).values()]
      .filter((l) => l.pathname !== '/' && l.pathname !== '');

    const cookies = await context.cookies().catch(() => []);
    await browser.close();
    console.log(JSON.stringify({ links: uniqueLinks, cookies }));
  } catch (err) {
    try { await browser.close(); } catch (e) {}
    console.log(JSON.stringify({ error: err.message, links: [], cookies: [] }));
    process.exit(1);
  }
}

main();
