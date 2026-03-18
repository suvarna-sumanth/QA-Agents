/**
 * ProgressDetectorTool - Detect video progress
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ProgressDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ProgressDetector';
    this.description = 'Detect video progress (currentTime advancing)';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        page: { type: 'object' },
        playerSelector: { type: 'string' },
        waitTime: { type: 'number', default: 3000 }
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
      const { page, playerSelector, waitTime = 3000 } = input;

      let progressDetected = false;

      try {
        const initialTime = await page.evaluate(() => {
          const video = document.querySelector('video');
          return video ? video.currentTime : -1;
        });

        await page.waitForTimeout(waitTime);

        const currentTime = await page.evaluate(() => {
          const video = document.querySelector('video');
          return video ? video.currentTime : -1;
        });

        progressDetected = currentTime > initialTime && currentTime >= 0;

        this.logger?.info(`[${this.name}] Progress: ${initialTime}s → ${currentTime}s`);
      } catch (e) {
        this.logger?.debug(`[${this.name}] Error detecting progress: ${e.message}`);
      }

      await this.onAfter(progressDetected);
      return progressDetected;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ProgressDetectorTool;
