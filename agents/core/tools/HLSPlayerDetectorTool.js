/**
 * HLSPlayerDetectorTool - Detect HLS streaming players
 *
 * Detects HLS (m3u8) streams through network monitoring
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class HLSPlayerDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'HLSPlayerDetector';
    this.description = 'Detect HLS streaming players';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        page: { type: 'object', description: 'Playwright page object' }
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
          id: { type: 'string' },
          type: { type: 'string' },
          selector: { type: 'string' },
          sources: { type: 'array' }
        }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page } = input;
      const players = [];

      try {
        // Look for m3u8 playlist files in script tags
        const scripts = await page.locator('script').count();
        for (let i = 0; i < scripts; i++) {
          try {
            const content = await page.locator('script').nth(i).textContent();
            const m3u8Urls = this.extractM3U8Urls(content);

            for (const url of m3u8Urls) {
              players.push({
                id: `hls-${url.hashCode()}`,
                type: 'hls',
                selector: `script:nth-of-type(${i + 1})`,
                sources: [{ src: url, type: 'application/vnd.apple.mpegurl' }]
              });
            }
          } catch (e) {
            // Skip
          }
        }

        // Check data attributes
        const elements = await page.locator('[data-*]').count();
        for (let i = 0; i < Math.min(elements, 50); i++) {
          try {
            const attrs = await page.locator('[data-*]').nth(i).getAttribute('data-src');
            if (attrs?.includes('.m3u8')) {
              players.push({
                id: `hls-data-${i}`,
                type: 'hls',
                selector: `[data-*]:nth-of-type(${i + 1})`,
                sources: [{ src: attrs }]
              });
            }
          } catch (e) {
            // Skip
          }
        }

      } catch (e) {
        this.logger?.warn(`[${this.name}] Error detecting HLS players: ${e.message}`);
      }

      await this.onAfter(players);
      return players;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }

  extractM3U8Urls(content) {
    const urls = [];
    const m3u8Regex = /https?:\/\/[^\s'"<>]+\.m3u8[^\s'"<>]*/g;
    let match;
    while ((match = m3u8Regex.exec(content)) !== null) {
      urls.push(match[0]);
    }
    return urls;
  }
}

module.exports = HLSPlayerDetectorTool;
