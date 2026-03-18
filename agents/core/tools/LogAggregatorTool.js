/**
 * LogAggregatorTool - Aggregate all logs
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class LogAggregatorTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'LogAggregator';
    this.description = 'Aggregate all logs from job execution';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        results: { type: 'array' }
      },
      required: ['jobId', 'results']
    };
  }

  get outputSchema() {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'number' },
          phase: { type: 'string' },
          url: { type: 'string' },
          status: { type: 'string' }
        }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { jobId, results = [] } = input;

      const logs = [];

      try {
        for (const result of results) {
          const phaseLog = {
            timestamp: result.timestamp || Date.now(),
            phase: result.phase,
            url: result.url || 'unknown',
            status: this.determineStatus(result),
            details: this.extractDetails(result)
          };

          logs.push(phaseLog);
        }

        // Sort by timestamp
        logs.sort((a, b) => a.timestamp - b.timestamp);

        this.logger?.info(`[${this.name}] Aggregated ${logs.length} log entries`);

      } catch (e) {
        this.logger?.warn(`[${this.name}] Error aggregating logs: ${e.message}`);
      }

      await this.onAfter(logs);
      return logs;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }

  determineStatus(result) {
    if (result.phase === 'discovery') {
      return result.articleCount > 0 ? 'success' : 'no_results';
    } else if (result.phase === 'detection') {
      return result.playerCount > 0 ? 'success' : 'no_players';
    } else if (result.phase === 'testing') {
      return result.testResult?.playable ? 'playable' : 'not_playable';
    } else if (result.phase === 'bypass') {
      return result.bypassResult?.success ? 'success' : 'failed';
    } else if (result.phase === 'evidence') {
      return 'completed';
    }
    return 'unknown';
  }

  extractDetails(result) {
    if (result.phase === 'testing') {
      return {
        hasAudio: result.testResult?.hasAudio,
        controlsWork: result.testResult?.controlsWork,
        progressDetected: result.testResult?.progressDetected,
        errors: result.testResult?.errors?.length || 0
      };
    }
    return {};
  }
}

module.exports = LogAggregatorTool;
