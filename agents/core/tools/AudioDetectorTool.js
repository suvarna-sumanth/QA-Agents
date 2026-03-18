/**
 * AudioDetectorTool - Detect if audio is playing
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class AudioDetectorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'AudioDetector';
    this.description = 'Detect if audio is playing';
  }

  get inputSchema() {
    return { type: 'object', properties: { page: { type: 'object' } }, required: ['page'] };
  }

  get outputSchema() {
    return { type: 'boolean' };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { page } = input;

      let hasAudio = false;

      try {
        hasAudio = await page.evaluate(() => {
          const videos = document.querySelectorAll('video');
          for (const video of videos) {
            if (!video.paused && !video.muted && video.volume > 0) {
              return true;
            }
          }

          const audios = document.querySelectorAll('audio');
          for (const audio of audios) {
            if (!audio.paused && !audio.muted && audio.volume > 0) {
              return true;
            }
          }

          return false;
        });
      } catch (e) {
        this.logger?.debug(`[${this.name}] Error checking audio: ${e.message}`);
      }

      this.logger?.info(`[${this.name}] Audio detected: ${hasAudio}`);
      await this.onAfter(hasAudio);
      return hasAudio;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = AudioDetectorTool;
