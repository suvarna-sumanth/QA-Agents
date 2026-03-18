/**
 * CustomPlayerDetectorTool - Detect custom player frameworks
 *
 * Detects common custom video player libraries
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class CustomPlayerDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'CustomPlayerDetector';
    this.description = 'Detect custom video player frameworks';
  }

  get inputSchema() {
    return { type: 'object', properties: { page: { type: 'object' } }, required: ['page'] };
  }

  get outputSchema() {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, type: { type: 'string' }, selector: { type: 'string' }, framework: { type: 'string' } }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page } = input;
      const players = [];

      const playerPatterns = [
        { class: 'video-js', name: 'VideoJS' },
        { class: 'plyr', name: 'Plyr' },
        { class: 'jwplayer', name: 'JWPlayer' },
        { class: 'flowplayer', name: 'Flowplayer' },
        { class: 'brightcove', name: 'Brightcove' },
        { class: 'kaltura', name: 'Kaltura' },
        { class: 'wistia', name: 'Wistia' }
      ];

      try {
        for (const pattern of playerPatterns) {
          const count = await page.locator(`.${pattern.class}`).count();
          for (let i = 0; i < count; i++) {
            try {
              const element = page.locator(`.${pattern.class}`).nth(i);
              const id = await element.getAttribute('id') || `${pattern.name.toLowerCase()}-${i}`;
              players.push({
                id,
                type: 'custom',
                selector: `.${pattern.class}${id ? `#${id}` : `:nth-of-type(${i + 1})`}`,
                framework: pattern.name
              });
            } catch (e) {
              // Skip
            }
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
}

module.exports = CustomPlayerDetectorTool;
