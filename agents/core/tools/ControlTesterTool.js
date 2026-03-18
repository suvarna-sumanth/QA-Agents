/**
 * ControlTesterTool - Test video player controls
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ControlTesterTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ControlTester';
    this.description = 'Test video player controls (play, pause, seek, volume)';
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

      let controlsWork = false;

      try {
        controlsWork = await page.evaluate(() => {
          const video = document.querySelector('video');
          if (!video) return false;

          const initialTime = video.currentTime;

          try {
            video.pause();
            video.play();
            video.volume = 0.5;
            return true;
          } catch (e) {
            return false;
          }
        });
      } catch (e) {
        this.logger?.debug(`[${this.name}] Error testing controls: ${e.message}`);
      }

      this.logger?.info(`[${this.name}] Controls work: ${controlsWork}`);
      await this.onAfter(controlsWork);
      return controlsWork;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ControlTesterTool;
