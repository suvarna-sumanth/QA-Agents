/**
 * PlayButtonClickerTool - Click play button on video player
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class PlayButtonClickerTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'PlayButtonClicker';
    this.description = 'Click play button on video player';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        page: { type: 'object' },
        playerSelector: { type: 'string' }
      },
      required: ['page', 'playerSelector']
    };
  }

  get outputSchema() {
    return { type: 'boolean' };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page, playerSelector } = input;

      const playSelectors = [
        `${playerSelector} button[aria-label*="Play"]`,
        `${playerSelector} button.play-button`,
        `${playerSelector} .vjs-play-button`,
        `${playerSelector} button:has-text("Play")`,
        `${playerSelector} button[data-action="play"]`,
        `${playerSelector} .plyr__controls button[aria-label="Play"]`,
        'video'
      ];

      for (const selector of playSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            await element.click();
            this.logger?.info(`[${this.name}] Clicked play button: ${selector}`);
            await this.onAfter(true);
            return true;
          }
        } catch (e) {
          // Try next selector
        }
      }

      this.logger?.warn(`[${this.name}] Could not find play button`);
      await this.onAfter(false);
      return false;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = PlayButtonClickerTool;
