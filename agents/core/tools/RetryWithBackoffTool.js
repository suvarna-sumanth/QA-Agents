/**
 * RetryWithBackoffTool - Retry operation with exponential backoff
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class RetryWithBackoffTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'RetryWithBackoff';
    this.description = 'Retry failed operation with exponential backoff';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        fn: { type: 'object', description: 'Function to retry' },
        maxRetries: { type: 'number', default: 3 },
        initialDelay: { type: 'number', default: 1000 }
      },
      required: ['fn']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        attempts: { type: 'number' },
        result: { type: 'object' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { fn, maxRetries = 3, initialDelay = 1000 } = input;

      let lastError = null;
      let attempts = 0;

      for (let i = 0; i <= maxRetries; i++) {
        attempts++;

        try {
          if (typeof fn === 'function') {
            const result = await fn();
            const response = { success: true, attempts, result };
            this.logger?.info(`[${this.name}] Success on attempt ${attempts}`);
            await this.onAfter(response);
            return response;
          } else {
            const result = { success: true, attempts };
            await this.onAfter(result);
            return result;
          }
        } catch (e) {
          lastError = e;

          if (i < maxRetries) {
            const delay = initialDelay * Math.pow(2, i);
            this.logger?.debug(`[${this.name}] Attempt ${attempts} failed, retrying in ${delay}ms: ${e.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      const result = {
        success: false,
        attempts,
        error: lastError?.message
      };

      this.logger?.error(`[${this.name}] Failed after ${attempts} attempts: ${lastError?.message}`);
      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = RetryWithBackoffTool;
