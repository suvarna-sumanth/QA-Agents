/**
 * CookieManagementTool - Clear/manage cookies
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class CookieManagementTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'CookieManagement';
    this.description = 'Clear or manage browser cookies';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        browser: { type: 'object' },
        mode: { enum: ['clear', 'clearWAF', 'preserve'], default: 'clear' }
      },
      required: ['browser']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        clearedCount: { type: 'number' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { browser, mode = 'clear' } = input;

      const result = {
        success: false,
        clearedCount: 0
      };

      try {
        const context = await browser.newContext();
        await context.clearCookies();
        await context.close();

        result.success = true;
        result.clearedCount = -1; // Unknown count

        this.logger?.info(`[${this.name}] Cookies cleared`);

      } catch (e) {
        this.logger?.error(`[${this.name}] Failed to clear cookies: ${e.message}`);
      }

      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = CookieManagementTool;
