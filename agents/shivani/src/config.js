/**
 * Shared configuration for Agent Shivani.
 * Uses Instaread's user agent and proxy IPs to avoid bot detection on publisher sites.
 */

export const INSTAREAD_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

export const INSTAREAD_IPS = [
  '34.202.131.143',
  '3.232.43.240',
  '35.171.159.124',
];

/**
 * Get Playwright browser context options configured for Instaread identity.
 */
export function getBrowserContextOptions(extraOptions = {}) {
  return {
    userAgent: INSTAREAD_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'X-Forwarded-For': INSTAREAD_IPS[0],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua': '"Google Chrome";v="145", "Chromium";v="145", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    ...extraOptions,
  };
}

/**
 * Get Crawlee PlaywrightCrawler launch context with Instaread user agent.
 */
export function getCrawlerLaunchContext() {
  return {
    launchOptions: {
      headless: false,
      channel: 'chrome',
    },
    userAgent: INSTAREAD_USER_AGENT,
  };
}

/**
 * Stealth init script — injected into every browser context to hide automation signals.
 */
export const STEALTH_INIT_SCRIPT = () => {
  // Hide webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // Fake plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  // Fake languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Pass Chrome check
  window.chrome = { runtime: {} };

  // Fake permissions
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  }
};

/**
 * Common Crawlee crawler options for stealth + anti-blocking.
 */
export function getStealthCrawlerOptions() {
  return {
    launchContext: getCrawlerLaunchContext(),
    // Don't treat 403/451 as blocked — page HTML is often still served
    sessionPoolOptions: {
      blockedStatusCodes: [],
    },
    browserPoolOptions: {
      preLaunchHooks: [
        async (_pageId, launchContext) => {
          launchContext.launchOptions = {
            ...launchContext.launchOptions,
            args: [
              '--disable-blink-features=AutomationControlled',
              '--disable-features=IsolateOrigins,site-per-process',
              '--no-sandbox',
            ],
          };
        },
      ],
      postLaunchHooks: [
        async (_pageId, browserController) => {
          const context = browserController.browser.contexts()[0];
          if (context) {
            await context.addInitScript(STEALTH_INIT_SCRIPT);
            // Set extra headers on the context
            await context.setExtraHTTPHeaders({
              'X-Forwarded-For': INSTAREAD_IPS[0],
              'Accept-Language': 'en-US,en;q=0.9',
            });
          }
        },
      ],
    },
  };
}
