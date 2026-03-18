/**
 * ScreenshotCapturerTool - Capture screenshot of player
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ScreenshotCapturerTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ScreenshotCapturer';
    this.description = 'Capture screenshot of video player';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        page: { type: 'object' },
        selector: { type: 'string' }
      },
      required: ['page']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        data: { type: 'string' },
        mimeType: { type: 'string' },
        timestamp: { type: 'number' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page, selector } = input;

      let screenshot = null;

      try {
        const buffer = await page.screenshot({
          fullPage: false
        });

        screenshot = {
          data: buffer.toString('base64'),
          mimeType: 'image/png',
          timestamp: Date.now()
        };

        this.logger?.info(`[${this.name}] Screenshot captured (${buffer.length} bytes)`);

      } catch (e) {
        this.logger?.warn(`[${this.name}] Failed to capture screenshot: ${e.message}`);
      }

      await this.onAfter(screenshot);
      return screenshot;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ScreenshotCapturerTool;
