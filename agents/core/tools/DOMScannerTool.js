/**
 * DOMScannerTool - Generic DOM scanning utilities
 *
 * Provides DOM scanning capabilities for other tools
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class DOMScannerTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'DOMScanner';
    this.description = 'Scan DOM for video player elements';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        page: {
          type: 'object',
          description: 'Playwright page object'
        },
        selector: {
          type: 'string',
          description: 'CSS selector to search for'
        }
      },
      required: ['page']
    };
  }

  get outputSchema() {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          count: { type: 'number' },
          elements: { type: 'array' }
        }
      }
    };
  }

  /**
   * Execute DOM scan
   * @param {Object} input - Input with page and optional selector
   * @returns {Promise<Object>} Scan results
   */
  async execute(input) {
    try {
      await this.onBefore(input);

      const { page, selector } = input;

      if (!page) {
        throw new Error('Page object required');
      }

      const result = {
        selector: selector || '*',
        count: 0,
        elements: []
      };

      try {
        if (selector) {
          const elements = await page.locator(selector).count();
          result.count = elements;
        }
      } catch (e) {
        this.logger?.debug(`[${this.name}] DOM scan error: ${e.message}`);
      }

      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = DOMScannerTool;
