/**
 * VimeoDetectorTool - Detect Vimeo embedded players
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class VimeoDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'VimeoDetector';
    this.description = 'Detect Vimeo embedded players';
  }

  get inputSchema() {
    return { type: 'object', properties: { page: { type: 'object' } }, required: ['page'] };
  }

  get outputSchema() {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, type: { type: 'string' }, selector: { type: 'string' } }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page } = input;
      const players = [];

      try {
        const iframes = await page.locator('iframe').count();
        for (let i = 0; i < iframes; i++) {
          try {
            const src = await page.locator('iframe').nth(i).getAttribute('src');
            if (src && src.includes('vimeo')) {
              const videoId = this.extractVimeoId(src);
              players.push({
                id: `vimeo-${videoId || i}`,
                type: 'vimeo',
                selector: `iframe:nth-of-type(${i + 1})`,
                sources: [{ src }]
              });
            }
          } catch (e) {
            // Skip
          }
        }
      } catch (e) {
        this.logger?.warn(`[${this.name}] Error: ${e.message}`);
      }

      await this.onAfter(players);
      return players;
    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }

  extractVimeoId(url) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  }
}

module.exports = VimeoDetectorTool;
