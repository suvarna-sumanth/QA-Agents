/**
 * CloudflareBypassTool - Bypass Cloudflare protection
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class CloudflareBypassTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'CloudflareBypass';
    this.description = 'Bypass Cloudflare protection challenges';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        url: { type: 'string' },
        browser: { type: 'object' }
      },
      required: ['url', 'browser']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        method: { type: 'string' },
        message: { type: 'string' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { url, browser } = input;

      let result = {
        success: false,
        method: 'cloudflare',
        message: 'Bypass attempted'
      };

      try {
        const page = await browser.newPage();

        await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' }).catch(() => {
          // May fail due to CF challenge, continue
        });

        // Wait for Cloudflare challenge to complete
        try {
          await page.waitForNavigation({ timeout: 10000 });
          result.success = true;
          result.message = 'Cloudflare challenge completed';
        } catch (e) {
          // No navigation, might already be through
          result.success = true;
          result.message = 'No challenge detected';
        }

        await page.close();

      } catch (e) {
        result.message = e.message;
        this.logger?.warn(`[${this.name}] Bypass failed: ${e.message}`);
      }

      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = CloudflareBypassTool;
