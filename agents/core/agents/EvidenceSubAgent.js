/**
 * EvidenceSubAgent - Deterministic sub-agent for evidence collection and aggregation
 *
 * Responsibility: Aggregate all results and collect evidence artifacts using:
 * - Screenshot uploading to S3
 * - Manifest creation
 * - Log aggregation
 *
 * Execution: Sequential tool invocation with aggregation
 * Input: { jobId, allResults, s3, logger }
 * Output: { phase, jobId, evidence, timestamp }
 *
 * @extends AgnoSubAgent
 */

const { AgnoSubAgent } = require('../base');
const {
  ScreenshotUploaderTool,
  ManifestCreatorTool,
  LogAggregatorTool
} = require('../tools/index');

class EvidenceSubAgent extends AgnoSubAgent {
  /**
   * Initialize evidence sub-agent with required tools
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.s3 - S3 client instance
   */
  constructor(config = {}) {
    super(config);
    this.name = 'EvidenceSubAgent';
    this.description = 'Collect and aggregate evidence from all phases';

    // Initialize tools
    this.tools = [
      new ScreenshotUploaderTool(config),
      new ManifestCreatorTool(config),
      new LogAggregatorTool(config)
    ];
  }

  /**
   * Input schema for evidence phase
   * @type {Object}
   */
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'Job ID for result tracking'
        },
        allResults: {
          type: 'array',
          items: { type: 'object' },
          description: 'All results from previous phases'
        },
        s3: {
          type: 'object',
          description: 'S3 client instance'
        },
        logger: {
          type: 'object',
          description: 'Logger instance'
        },
        maxScreenshots: {
          type: 'number',
          default: 100,
          description: 'Maximum screenshots to upload'
        }
      },
      required: ['jobId', 'allResults', 's3']
    };
  }

  /**
   * Output schema for evidence phase
   * @type {Object}
   */
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        phase: {
          enum: ['evidence'],
          description: 'Phase identifier'
        },
        jobId: {
          type: 'string',
          description: 'Job ID'
        },
        evidence: {
          type: 'object',
          properties: {
            s3Urls: { type: 'object' },
            manifest: { type: 'object' },
            aggregatedLogs: { type: 'array' },
            screenshotCount: { type: 'number' }
          }
        },
        timestamp: {
          type: 'number',
          description: 'Execution timestamp'
        }
      },
      required: ['phase', 'jobId', 'evidence']
    };
  }

  /**
   * Execute evidence phase
   *
   * Process:
   * 1. Extract all screenshots from results
   * 2. Upload screenshots to S3
   * 3. Create manifest with all metadata
   * 4. Aggregate all logs
   * 5. Return evidence package
   *
   * @param {Object} input - Evidence input
   * @param {string} input.jobId - Job ID
   * @param {Array} input.allResults - All phase results
   * @param {Object} input.s3 - S3 client
   * @param {Object} input.logger - Logger
   * @param {number} input.maxScreenshots - Max screenshots
   * @returns {Promise<Object>} Evidence result
   */
  async execute(input) {
    try {
      // Validate input
      this.validate(input);

      const {
        jobId,
        allResults,
        s3,
        logger = this.logger,
        maxScreenshots = 100
      } = input;

      const evidence = {
        jobId,
        s3Urls: {},
        manifest: null,
        aggregatedLogs: [],
        screenshotCount: 0
      };

      logger?.info(`[${this.name}] Starting evidence collection for job ${jobId}`);

      // Collect all screenshots
      const screenshots = this.extractScreenshots(allResults);
      logger?.info(`[${this.name}] Found ${screenshots.length} screenshots to upload`);

      // Upload screenshots to S3
      try {
        let uploadCount = 0;
        for (const { url, screenshot, index } of screenshots) {
          if (uploadCount >= maxScreenshots) break;

          try {
            const s3Url = await this.tools[0].execute({
              jobId,
              url,
              screenshot,
              index,
              s3
            });

            if (s3Url) {
              if (!evidence.s3Urls[url]) {
                evidence.s3Urls[url] = [];
              }
              evidence.s3Urls[url].push(s3Url);
              uploadCount++;
            }
          } catch (e) {
            logger?.warn(`[${this.name}] Failed to upload screenshot for ${url}: ${e.message}`);
          }
        }
        evidence.screenshotCount = uploadCount;
        logger?.info(`[${this.name}] Uploaded ${uploadCount} screenshots to S3`);
      } catch (e) {
        logger?.error(`[${this.name}] Screenshot upload failed: ${e.message}`);
      }

      // Create manifest
      try {
        evidence.manifest = await this.tools[1].execute({
          jobId,
          results: allResults,
          s3Urls: evidence.s3Urls
        });
        logger?.info(`[${this.name}] Created manifest with ${Object.keys(evidence.manifest || {}).length} keys`);
      } catch (e) {
        logger?.error(`[${this.name}] Manifest creation failed: ${e.message}`);
        evidence.manifest = this.createMinimalManifest(jobId, allResults);
      }

      // Aggregate logs
      try {
        evidence.aggregatedLogs = await this.tools[2].execute({
          jobId,
          results: allResults
        });
        logger?.info(`[${this.name}] Aggregated ${evidence.aggregatedLogs?.length || 0} log entries`);
      } catch (e) {
        logger?.error(`[${this.name}] Log aggregation failed: ${e.message}`);
        evidence.aggregatedLogs = this.createMinimalLogs(allResults);
      }

      const result = {
        phase: 'evidence',
        jobId,
        evidence,
        timestamp: Date.now()
      };

      // Validate output
      this.validateOutput(result);

      logger?.info(`[${this.name}] Evidence collection complete`);
      return result;

    } catch (error) {
      this.logger?.error(`[${this.name}] Execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract all screenshots from results
   * @param {Array} allResults - All phase results
   * @returns {Array} Array of {url, screenshot, index}
   */
  extractScreenshots(allResults) {
    const screenshots = [];

    for (const result of allResults || []) {
      if (result.testResult?.screenshots && Array.isArray(result.testResult.screenshots)) {
        for (let i = 0; i < result.testResult.screenshots.length; i++) {
          screenshots.push({
            url: result.url,
            screenshot: result.testResult.screenshots[i],
            index: i
          });
        }
      }
    }

    return screenshots;
  }

  /**
   * Create minimal manifest if primary method fails
   * @param {string} jobId - Job ID
   * @param {Array} allResults - All results
   * @returns {Object} Minimal manifest
   */
  createMinimalManifest(jobId, allResults) {
    return {
      jobId,
      created: new Date().toISOString(),
      phases: {
        discovery: allResults.filter(r => r.phase === 'discovery'),
        detection: allResults.filter(r => r.phase === 'detection'),
        testing: allResults.filter(r => r.phase === 'testing'),
        bypass: allResults.filter(r => r.phase === 'bypass')
      },
      summary: {
        totalResults: allResults.length,
        failedUrl: []
      }
    };
  }

  /**
   * Create minimal logs if primary method fails
   * @param {Array} allResults - All results
   * @returns {Array} Minimal logs
   */
  createMinimalLogs(allResults) {
    const logs = [];

    for (const result of allResults || []) {
      logs.push({
        timestamp: result.timestamp || Date.now(),
        phase: result.phase,
        url: result.url,
        success: result.testResult?.playable || result.playerCount > 0
      });
    }

    return logs;
  }

  /**
   * Get schema for this agent
   * @returns {Object} Combined input/output schema
   */
  getSchema() {
    return {
      input: this.inputSchema,
      output: this.outputSchema
    };
  }
}

module.exports = EvidenceSubAgent;
