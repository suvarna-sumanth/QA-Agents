/**
 * ManifestCreatorTool - Create result manifest
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ManifestCreatorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ManifestCreator';
    this.description = 'Create result manifest with metadata';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        results: { type: 'array' },
        s3Urls: { type: 'object' }
      },
      required: ['jobId', 'results']
    };
  }

  get outputSchema() {
    return {
      type: 'object'
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { jobId, results = [], s3Urls = {} } = input;

      const manifest = {
        jobId,
        created: new Date().toISOString(),
        summary: {
          totalResults: results.length,
          successCount: 0,
          failureCount: 0
        },
        phases: {},
        s3Urls,
        details: []
      };

      try {
        // Organize results by phase
        for (const result of results) {
          if (!manifest.phases[result.phase]) {
            manifest.phases[result.phase] = [];
          }
          manifest.phases[result.phase].push(result);

          // Track success/failure
          if (result.testResult?.playable || result.playerCount > 0) {
            manifest.summary.successCount++;
          } else {
            manifest.summary.failureCount++;
          }

          // Add detail
          manifest.details.push({
            phase: result.phase,
            url: result.url,
            timestamp: result.timestamp,
            success: result.testResult?.playable || result.playerCount > 0
          });
        }

        this.logger?.info(`[${this.name}] Created manifest: ${manifest.summary.successCount}/${manifest.summary.totalResults} success`);

      } catch (e) {
        this.logger?.warn(`[${this.name}] Error creating manifest: ${e.message}`);
      }

      await this.onAfter(manifest);
      return manifest;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ManifestCreatorTool;
