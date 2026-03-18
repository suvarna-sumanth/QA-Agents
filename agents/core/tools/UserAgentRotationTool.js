/**
 * UserAgentRotationTool - Rotate user agent
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class UserAgentRotationTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'UserAgentRotation';
    this.description = 'Rotate browser user agent';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        browser: { type: 'object' }
      },
      required: ['browser']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        newUserAgent: { type: 'string' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { browser } = input;

      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      ];

      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      const result = {
        success: true,
        newUserAgent: randomUA
      };

      this.logger?.info(`[${this.name}] Rotated user agent`);
      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = UserAgentRotationTool;
