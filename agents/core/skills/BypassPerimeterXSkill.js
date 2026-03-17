import { Skill } from './Skill.js';
import { bypassChallenge } from '../../shivani/src/bypass.js';

export class BypassPerimeterXSkill extends Skill {
  constructor() {
    super(
      'bypass_perimeterx',
      'Attempt to solve a PerimeterX/HUMAN "press and hold" bot challenge on the current page.',
      {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to if no page is active' },
          maxRetries: { type: 'number', description: 'Number of times to retry solving', default: 3 }
        }
      },
      { type: 'object', properties: { success: { type: 'boolean' } } }
    );
  }

  async execute(input, context) {
    const { maxRetries = 3 } = input;
    const { launchForUrl, applyStealthScripts } = await import('../../shivani/src/browser.js');
    const { INSTAREAD_USER_AGENT } = await import('../../shivani/src/config.js');

    // 1. Ensure we have a shared browser context
    if (!context.sharedBrowser) {
      console.log('[BypassPerimeterXSkill] No shared browser found. Launching initial session...');
      const targetUrl = input.url || 'https://google.com';
      const { browser, cleanup } = await launchForUrl(targetUrl);
      context.sharedBrowser = { browser, cleanup };
    }

    // 2. Ensure we have a page
    if (!context.sharedBrowser.page) {
      console.log('[BypassPerimeterXSkill] Creating new stealth page...');
      const browserContext = await context.sharedBrowser.browser.newContext({
        userAgent: INSTAREAD_USER_AGENT,
        ignoreHTTPSErrors: true
      });
      await applyStealthScripts(browserContext);
      context.sharedBrowser.page = await browserContext.newPage();
      await context.sharedBrowser.page.setViewportSize({ width: 1280, height: 720 });
      
      if (input.url) {
        await context.sharedBrowser.page.goto(input.url, { waitUntil: 'domcontentloaded' });
      }
    }

    const page = context.sharedBrowser.page;

    try {
      console.log('[BypassPerimeterXSkill] Attempting PerimeterX press/hold bypass...');
      const success = await bypassChallenge(page, maxRetries);
      return { success };
    } catch (err) {
      console.warn(`[BypassPerimeterXSkill] Failed: ${err.message}`);
      return { success: false };
    }
  }
}
