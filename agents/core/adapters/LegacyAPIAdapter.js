/**
 * LegacyAPIAdapter.js - Backward compatibility adapter for old API format
 *
 * Wraps QAParentAgent to maintain 100% API compatibility with the old system.
 * Converts old job format → new format, executes through new orchestration,
 * and converts results back to old format.
 *
 * Old API Format (input):
 * {
 *   id: "job-123",
 *   url: "https://example.com/article",
 *   depth: 2,
 *   options: { maxArticles: 10, ... }
 * }
 *
 * Old API Format (output):
 * {
 *   id: "job-123",
 *   status: "success",
 *   data: {
 *     articles: [...],
 *     detections: [...],
 *     tests: [...],
 *     bypasses: [...],
 *     evidence: {...}
 *   },
 *   metrics: { executionTime, ... }
 * }
 */

export class LegacyAPIAdapter {
  /**
   * Creates an instance of LegacyAPIAdapter
   *
   * @param {Object} config - Configuration object
   * @param {QAParentAgent} config.parentAgent - Parent agent instance
   * @param {MemoryService} [config.memory] - Memory service for persistence
   * @param {Logger} [config.logger] - Logger instance
   * @param {Metrics} [config.metrics] - Metrics tracker instance
   * @throws {Error} if parentAgent not provided
   */
  constructor(config = {}) {
    if (!config.parentAgent) {
      throw new Error('LegacyAPIAdapter requires parentAgent in config');
    }

    this.parentAgent = config.parentAgent;
    this.memory = config.memory;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.name = 'LegacyAPIAdapter';
  }

  /**
   * Executes a job using old API format and returns old result format
   *
   * @param {Object} oldJobFormat - Old API job format
   * @param {string} oldJobFormat.id - Job ID
   * @param {string} oldJobFormat.url - Target URL
   * @param {number} [oldJobFormat.depth=2] - Crawl depth
   * @param {Object} [oldJobFormat.options] - Additional options
   * @returns {Promise<Object>} Old format result
   * @throws {Error} if job execution fails
   */
  async executeJob(oldJobFormat) {
    const startTime = Date.now();
    const { id: jobId, url, depth = 2, options = {} } = oldJobFormat;

    try {
      // Log incoming job
      this._log('info', `Adapter: Received job ${jobId} for URL ${url}`, { jobId });

      // Step 1: Convert old format → new format
      const newJobFormat = this._convertInputFormat({
        jobId,
        url,
        depth,
        options
      });

      this._log('debug', `Adapter: Converted input format for job ${jobId}`, { jobId, newFormat: newJobFormat });

      // Step 2: Execute through parent agent
      let result;
      try {
        result = await this.parentAgent.execute(newJobFormat);
      } catch (error) {
        this._log('error', `Adapter: Parent agent failed for job ${jobId}`, { jobId, error: error.message });
        throw error;
      }

      // Step 3: Convert result back to old format
      const oldResultFormat = this._convertOutputFormat(result, jobId);

      // Step 4: Record metrics
      const executionTime = Date.now() - startTime;
      this._recordMetrics(jobId, executionTime, oldJobFormat, oldResultFormat);

      this._log('info', `Adapter: Job ${jobId} completed in ${executionTime}ms`, { jobId, executionTime });

      return oldResultFormat;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult = {
        id: jobId,
        status: 'failed',
        error: error.message || 'Unknown error',
        data: null,
        metrics: {
          executionTime,
          timestamp: new Date().toISOString(),
          phases: {}
        }
      };

      // Record failure metrics
      this._recordMetrics(jobId, executionTime, oldJobFormat, errorResult, error);

      this._log('error', `Adapter: Job ${jobId} failed after ${executionTime}ms`, {
        jobId,
        executionTime,
        error: error.message
      });

      return errorResult;
    }
  }

  /**
   * Converts old input format to new format
   *
   * Old format:
   * {
   *   id: "job-123",
   *   url: "https://example.com/article",
   *   depth: 2,
   *   options: { maxArticles: 10, ... }
   * }
   *
   * New format:
   * {
   *   jobId: "job-123",
   *   domain: "example.com",
   *   targetUrl: "https://example.com/article",
   *   depth: 2,
   *   options: { maxArticles: 10, ... }
   * }
   *
   * @param {Object} oldFormat - Old format job
   * @returns {Object} New format job
   * @private
   */
  _convertInputFormat(oldFormat) {
    const { jobId, url, depth, options } = oldFormat;

    // Extract domain from URL
    let domain = 'unknown.com';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch (e) {
      this._log('warn', `Adapter: Could not parse domain from URL: ${url}`, { url });
    }

    return {
      jobId,
      domain,
      targetUrl: url,
      depth: depth || 2,
      options: options || {}
    };
  }

  /**
   * Converts new format output to old format
   *
   * New format result contains:
   * {
   *   jobId, domain, startTime, phases: {
   *     discovery: { articles: [...] },
   *     detection: { players: [...] },
   *     testing: { results: [...] },
   *     bypass: { results: [...] },
   *     evidence: { ... }
   *   },
   *   phaseTimes: {},
   *   errors: []
   * }
   *
   * Old format output:
   * {
   *   id, status, data: {
   *     articles, detections, tests, bypasses, evidence
   *   }, metrics: { ... }
   * }
   *
   * @param {Object} newResult - New format result
   * @param {string} jobId - Job ID
   * @returns {Object} Old format result
   * @private
   */
  _convertOutputFormat(newResult, jobId) {
    try {
      const { phases = {}, phaseTimes = {}, errors = [], startTime } = newResult;

      // Extract phase data
      const discoveryData = phases.discovery || {};
      const detectionData = phases.detection || {};
      const testingData = phases.testing || {};
      const bypassData = phases.bypass || {};
      const evidenceData = phases.evidence || {};

      // Determine overall status
      let status = 'success';
      if (errors.length > 0) {
        // Check if errors are critical (phase failures)
        const criticalErrors = errors.filter(e => e.critical === true || e.phase === 'discovery');
        status = criticalErrors.length > 0 ? 'failed' : 'success';
      }

      // Build old format result
      return {
        id: jobId,
        status,
        data: {
          articles: discoveryData.articles || [],
          detections: detectionData.players || [],
          tests: testingData.results || [],
          bypasses: bypassData.results || [],
          evidence: evidenceData.evidence || {}
        },
        metrics: {
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          phases: phaseTimes,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors.map(e => e.message) : undefined
        }
      };
    } catch (error) {
      this._log('error', `Adapter: Failed to convert output format for job ${jobId}`, {
        jobId,
        error: error.message
      });

      // Return minimal valid response on conversion failure
      return {
        id: jobId,
        status: 'failed',
        error: 'Failed to convert result format',
        data: null,
        metrics: {
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Records metrics for monitoring and analysis
   *
   * @param {string} jobId - Job ID
   * @param {number} executionTime - Total execution time in ms
   * @param {Object} inputJob - Input job object
   * @param {Object} resultJob - Result job object
   * @param {Error} [error] - Error if occurred
   * @private
   */
  _recordMetrics(jobId, executionTime, inputJob, resultJob, error = null) {
    if (!this.metrics) return;

    try {
      const payload = {
        jobId,
        executionTime,
        status: resultJob.status,
        articleCount: resultJob.data?.articles?.length || 0,
        detectionCount: resultJob.data?.detections?.length || 0,
        testCount: resultJob.data?.tests?.length || 0,
        bypassCount: resultJob.data?.bypasses?.length || 0,
        hasEvidence: Boolean(resultJob.data?.evidence),
        error: error ? error.message : null
      };

      this.metrics.recordJob(payload);
    } catch (metricError) {
      this._log('warn', `Adapter: Failed to record metrics for job ${jobId}`, {
        jobId,
        error: metricError.message
      });
    }
  }

  /**
   * Logs a message with structured context
   *
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context
   * @private
   */
  _log(level, message, context = {}) {
    if (!this.logger) {
      console.log(`[${level.toUpperCase()}] ${message}`, context);
      return;
    }

    const logData = {
      adapter: 'LegacyAPIAdapter',
      ...context
    };

    switch (level) {
      case 'debug':
        this.logger.debug(message, logData);
        break;
      case 'info':
        this.logger.info(message, logData);
        break;
      case 'warn':
        this.logger.warn(message, logData);
        break;
      case 'error':
        this.logger.error(message, logData);
        break;
      default:
        this.logger.info(message, logData);
    }
  }

  /**
   * Validates that old format input is valid
   *
   * @param {Object} oldFormat - Old format job
   * @throws {Error} if validation fails
   * @private
   */
  _validateInput(oldFormat) {
    const { id, url } = oldFormat;

    if (!id || typeof id !== 'string') {
      throw new Error('LegacyAPIAdapter: Invalid or missing job id');
    }

    if (!url || typeof url !== 'string') {
      throw new Error('LegacyAPIAdapter: Invalid or missing URL');
    }

    try {
      new URL(url);
    } catch (e) {
      throw new Error(`LegacyAPIAdapter: Invalid URL format: ${url}`);
    }
  }
}

export default LegacyAPIAdapter;
