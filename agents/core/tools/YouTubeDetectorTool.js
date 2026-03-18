/**
 * YouTubeDetectorTool - Detect YouTube embedded players
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class YouTubeDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'YouTubeDetector';
    this.description = 'Detect YouTube embedded players';
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
            if (src && src.includes('youtube')) {
              const videoId = this.extractYouTubeId(src);
              players.push({
                id: `youtube-${videoId || i}`,
                type: 'youtube',
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

  extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
}

module.exports = YouTubeDetectorTool;
