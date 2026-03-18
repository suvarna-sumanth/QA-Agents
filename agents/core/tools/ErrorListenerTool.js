/**
 * ErrorListenerTool - Listen for player errors
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ErrorListenerTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ErrorListener';
    this.description = 'Listen for and capture player errors';
  }

  get inputSchema() {
    return { type: 'object', properties: { page: { type: 'object' } }, required: ['page'] };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        errors: { type: 'array' },
        errorCount: { type: 'number' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page } = input;

      const errors = [];

      try {
        await page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          }
        });

        await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video) {
            video.addEventListener('error', (e) => {
              window.__videoErrors = window.__videoErrors || [];
              window.__videoErrors.push(e.target.error?.message || 'Unknown error');
            });
          }
        });

        const videoErrors = await page.evaluate(() => window.__videoErrors || []);
        errors.push(...videoErrors);

      } catch (e) {
        this.logger?.debug(`[${this.name}] Error setting up listener: ${e.message}`);
      }

      const result = {
        errors,
        errorCount: errors.length
      };

      this.logger?.info(`[${this.name}] Found ${errors.length} errors`);
      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ErrorListenerTool;
