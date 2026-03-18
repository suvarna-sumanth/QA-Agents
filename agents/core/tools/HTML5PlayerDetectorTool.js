/**
 * HTML5PlayerDetectorTool - Detect HTML5 video players
 *
 * Detects native HTML5 <video> elements and extracts metadata
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class HTML5PlayerDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'HTML5PlayerDetector';
    this.description = 'Detect HTML5 video player elements';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        page: {
          type: 'object',
          description: 'Playwright page object'
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
          id: { type: 'string' },
          type: { type: 'string' },
          selector: { type: 'string' },
          sources: { type: 'array' }
        },
        required: ['id', 'type', 'selector']
      }
    };
  }

  /**
   * Execute HTML5 player detection
   * @param {Object} input - Input with page object
   * @returns {Promise<Array>} Array of detected players
   */
  async execute(input) {
    try {
      await this.onBefore(input);

      const { page } = input;
      const players = [];

      try {
        // Find all video elements
        const videoCount = await page.locator('video').count();

        for (let i = 0; i < videoCount; i++) {
          try {
            const videoElement = page.locator('video').nth(i);
            const id = await videoElement.getAttribute('id') || `html5-video-${i}`;
            const selector = `video${await videoElement.getAttribute('id') ? `#${await videoElement.getAttribute('id')}` : `:nth-of-type(${i + 1})`}`;

            // Get video sources
            const sources = [];
            const sourceCount = await videoElement.locator('source').count();

            for (let j = 0; j < sourceCount; j++) {
              try {
                const src = await videoElement.locator('source').nth(j).getAttribute('src');
                const type = await videoElement.locator('source').nth(j).getAttribute('type');
                if (src) {
                  sources.push({ src, type });
                }
              } catch (e) {
                // Skip this source
              }
            }

            // Also check poster and src attributes
            const poster = await videoElement.getAttribute('poster');
            const src = await videoElement.getAttribute('src');

            players.push({
              id,
              type: 'html5',
              selector,
              sources: sources.length > 0 ? sources : (src ? [{ src }] : []),
              poster
            });

            this.logger?.debug(`[${this.name}] Found HTML5 player: ${id}`);

          } catch (e) {
            this.logger?.debug(`[${this.name}] Error processing video element ${i}: ${e.message}`);
          }
        }

      } catch (e) {
        this.logger?.warn(`[${this.name}] Error detecting HTML5 players: ${e.message}`);
      }

      await this.onAfter(players);
      return players;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = HTML5PlayerDetectorTool;
