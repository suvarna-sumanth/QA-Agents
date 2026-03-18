/**
 * ScreenshotUploaderTool - Upload screenshots to S3
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ScreenshotUploaderTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ScreenshotUploader';
    this.description = 'Upload screenshots to S3';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        url: { type: 'string' },
        screenshot: { type: 'object' },
        index: { type: 'number' },
        s3: { type: 'object' }
      },
      required: ['jobId', 'screenshot', 's3']
    };
  }

  get outputSchema() {
    return { type: 'string' };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { jobId, url = 'unknown', screenshot, index = 0, s3 } = input;

      let s3Url = null;

      try {
        if (!s3 || !s3.putObject) {
          this.logger?.warn(`[${this.name}] S3 client not available`);
          return null;
        }

        const timestamp = Date.now();
        const filename = `${jobId}/${url.replace(/[^a-zA-Z0-9]/g, '-')}-${index}-${timestamp}.png`;

        const result = await s3.putObject({
          Bucket: process.env.S3_BUCKET || 'qa-agents',
          Key: filename,
          Body: Buffer.from(screenshot.data, 'base64'),
          ContentType: 'image/png'
        });

        s3Url = `s3://${process.env.S3_BUCKET || 'qa-agents'}/${filename}`;

        this.logger?.info(`[${this.name}] Uploaded screenshot: ${s3Url}`);

      } catch (e) {
        this.logger?.error(`[${this.name}] Upload failed: ${e.message}`);
      }

      await this.onAfter(s3Url);
      return s3Url;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ScreenshotUploaderTool;
