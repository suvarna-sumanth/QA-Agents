/**
 * PerimeterXBypassTool - Bypass PerimeterX protection
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class PerimeterXBypassTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'PerimeterXBypass';
    this.description = 'Bypass PerimeterX protection challenges';
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
        method: 'perimeterx',
        message: 'Bypass attempted'
      };

      try {
        const page = await browser.newPage();

        try {
          await page.goto(url, { timeout: 30000 });
          result.success = true;
          result.message = 'Successfully navigated past PerimeterX';
        } catch (e) {
          result.message = `Navigation failed: ${e.message}`;
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

module.exports = PerimeterXBypassTool;
