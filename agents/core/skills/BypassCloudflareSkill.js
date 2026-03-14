import { Skill } from './Skill.js';
import { bypassCloudflareIfNeeded } from '../../shivani/src/cloudflare-browser-bypass.js';

export class BypassCloudflareSkill extends Skill {
  constructor() {
    super(
      'bypass_cloudflare',
      'Solve a Cloudflare Turnstile challenge on the current browser page. Returns true if the challenge was resolved.',
      {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to if no page is active' },
          maxWaitMs: { type: 'number', description: 'Max time to wait for solution in ms', default: 90000 }
        }
      },
      { type: 'object', properties: { success: { type: 'boolean' } } }
    );
  }

  async execute(input, context) {
    const { maxWaitMs = 90000 } = input;
    const { launchForUrl, applyStealthScripts } = await import('../../shivani/src/browser.js');
    const { INSTAREAD_USER_AGENT } = await import('../../shivani/src/config.js');

    // 1. Ensure we have a shared browser context
    if (!context.sharedBrowser) {
      console.log('[BypassCloudflareSkill] No shared browser found. Launching initial session...');
      // We pass state.url but here we don't have it easily. We'll use a placeholder or expect it in input.
      // Actually, skills usually get the target URL in context or input.
      // Let's assume input has URL if needed or we use a default.
      const targetUrl = input.url || 'https://google.com'; // Fallback
      const { browser, cleanup } = await launchForUrl(targetUrl);
      context.sharedBrowser = { browser, cleanup };
    }

    // 2. Ensure we have a page
    if (!context.sharedBrowser.page) {
      console.log('[BypassCloudflareSkill] Creating new stealth page...');
      const browserContext = await context.sharedBrowser.browser.newContext({
        userAgent: INSTAREAD_USER_AGENT
      });
      await applyStealthScripts(browserContext);
      context.sharedBrowser.page = await browserContext.newPage();
      await context.sharedBrowser.page.setViewportSize({ width: 1280, height: 720 });
      
      // If we launched the page, we might need to navigate to the target
      if (input.url) {
        await context.sharedBrowser.page.goto(input.url, { waitUntil: 'domcontentloaded' });
      }
    }

    const page = context.sharedBrowser.page;

    try {
      console.log('[BypassCloudflareSkill] Attempting Turnstile bypass...');
      const success = await bypassCloudflareIfNeeded(page, maxWaitMs);
      return { success };
    } catch (err) {
      console.warn(`[BypassCloudflareSkill] Override logic failed: ${err.message}`);
      return { success: false };
    }
  }
}
