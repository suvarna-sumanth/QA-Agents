/**
 * Metrics.js - Execution metrics tracking and aggregation
 *
 * Tracks execution time per phase, success rates, error frequencies,
 * and provides aggregation methods for monitoring and observability.
 *
 * Metrics tracked:
 * - Per-phase execution times (discovery, detection, testing, bypass, evidence)
 * - Overall job execution time
 * - Success/failure rates per phase
 * - Error frequencies and types
 * - Article/player/test counts
 */

export class Metrics {
  /**
   * Creates an instance of Metrics
   *
   * @param {Object} [config] - Configuration object
   * @param {number} [config.retentionMs=3600000] - How long to keep metrics (1 hour default)
   * @param {number} [config.maxMetrics=10000] - Maximum number of metrics to store
   */
  constructor(config = {}) {
    this.retentionMs = config.retentionMs || 3600000; // 1 hour
    this.maxMetrics = config.maxMetrics || 10000;
    this.name = 'Metrics';

    // Storage for metrics
    this.jobs = new Map(); // jobId → job metrics
    this.phases = new Map(); // phaseKey → phase metrics
    this.errors = new Map(); // errorType → error count
    this.aggregates = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalExecutionTime: 0,
      startedAt: Date.now()
    };
  }

  /**
   * Records metrics for a completed job
   *
   * @param {Object} jobMetrics - Job metrics object
   * @param {string} jobMetrics.jobId - Job ID
   * @param {number} jobMetrics.executionTime - Total execution time in ms
   * @param {string} jobMetrics.status - 'success' or 'failed'
   * @param {number} [jobMetrics.articleCount=0] - Number of articles found
   * @param {number} [jobMetrics.detectionCount=0] - Number of detections
   * @param {number} [jobMetrics.testCount=0] - Number of tests run
   * @param {number} [jobMetrics.bypassCount=0] - Number of bypass attempts
   * @param {boolean} [jobMetrics.hasEvidence=false] - Whether evidence was collected
   * @param {string} [jobMetrics.error] - Error message if failed
   * @returns {void}
   */
  recordJob(jobMetrics) {
    const {
      jobId,
      executionTime,
      status,
      articleCount = 0,
      detectionCount = 0,
      testCount = 0,
      bypassCount = 0,
      hasEvidence = false,
      error = null
    } = jobMetrics;

    if (!jobId || !executionTime || !status) {
      console.warn('[Metrics] Incomplete job metrics, skipping', jobMetrics);
      return;
    }

    // Store job metrics
    const entry = {
      jobId,
      timestamp: Date.now(),
      executionTime,
      status,
      articleCount,
      detectionCount,
      testCount,
      bypassCount,
      hasEvidence,
      error
    };

    this.jobs.set(jobId, entry);

    // Update aggregates
    this.aggregates.totalJobs++;
    this.aggregates.totalExecutionTime += executionTime;

    if (status === 'success') {
      this.aggregates.successfulJobs++;
    } else {
      this.aggregates.failedJobs++;
      if (error) {
        this.recordError(error);
      }
    }

    // Cleanup old metrics if needed
    this._cleanup();
  }

  /**
   * Records metrics for a specific phase execution
   *
   * @param {string} jobId - Job ID
   * @param {string} phase - Phase name (discovery, detection, testing, bypass, evidence)
   * @param {Object} phaseMetrics - Phase execution metrics
   * @param {number} phaseMetrics.startTime - Phase start timestamp
   * @param {number} phaseMetrics.endTime - Phase end timestamp
   * @param {string} phaseMetrics.status - Phase status (success, failed, skipped)
   * @param {number} [phaseMetrics.itemCount=0] - Number of items processed
   * @param {string} [phaseMetrics.error] - Error message if failed
   * @returns {void}
   */
  recordPhase(jobId, phase, phaseMetrics) {
    const {
      startTime,
      endTime,
      status,
      itemCount = 0,
      error = null
    } = phaseMetrics;

    if (!phase || !startTime || !endTime || !status) {
      console.warn('[Metrics] Incomplete phase metrics, skipping', { phase, phaseMetrics });
      return;
    }

    const phaseKey = `${jobId}:${phase}`;
    const executionTime = endTime - startTime;

    const entry = {
      jobId,
      phase,
      timestamp: Date.now(),
      executionTime,
      status,
      itemCount,
      error
    };

    this.phases.set(phaseKey, entry);

    // Record error if occurred
    if (error) {
      this.recordError(`${phase}:${error}`);
    }
  }

  /**
   * Records an error occurrence
   *
   * @param {string} errorType - Type/description of error
   * @returns {void}
   */
  recordError(errorType) {
    if (!errorType) return;

    const key = String(errorType).substring(0, 100); // Limit key length
    const count = this.errors.get(key) || 0;
    this.errors.set(key, count + 1);
  }

  /**
   * Gets aggregated metrics across all jobs
   *
   * @returns {Object} Aggregated metrics
   */
  getAggregates() {
    const successRate = this.aggregates.totalJobs > 0
      ? (this.aggregates.successfulJobs / this.aggregates.totalJobs * 100).toFixed(2)
      : 0;

    const avgExecutionTime = this.aggregates.totalJobs > 0
      ? Math.round(this.aggregates.totalExecutionTime / this.aggregates.totalJobs)
      : 0;

    return {
      ...this.aggregates,
      successRate: parseFloat(successRate),
      avgExecutionTime,
      uptime: Date.now() - this.aggregates.startedAt,
      metricsCount: this.jobs.size + this.phases.size,
      errorCount: Array.from(this.errors.values()).reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Gets metrics for a specific job
   *
   * @param {string} jobId - Job ID to lookup
   * @returns {Object|null} Job metrics or null if not found
   */
  getJobMetrics(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Gets metrics for a specific phase
   *
   * @param {string} jobId - Job ID
   * @param {string} phase - Phase name
   * @returns {Object|null} Phase metrics or null if not found
   */
  getPhaseMetrics(jobId, phase) {
    const key = `${jobId}:${phase}`;
    return this.phases.get(key) || null;
  }

  /**
   * Gets all phases for a job
   *
   * @param {string} jobId - Job ID
   * @returns {Object} Map of phase name → metrics
   */
  getJobPhases(jobId) {
    const result = {};
    for (const [key, metrics] of this.phases.entries()) {
      if (metrics.jobId === jobId) {
        result[metrics.phase] = metrics;
      }
    }
    return result;
  }

  /**
   * Gets top errors by frequency
   *
   * @param {number} [limit=10] - Number of top errors to return
   * @returns {Array} Array of {error, count} sorted by frequency
   */
  getTopErrors(limit = 10) {
    return Array.from(this.errors.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Gets success rate by phase
   *
   * @returns {Object} Map of phase → success rate (0-100)
   */
  getPhaseSuccessRates() {
    const phaseStats = {};

    for (const metrics of this.phases.values()) {
      const phase = metrics.phase;
      if (!phaseStats[phase]) {
        phaseStats[phase] = { total: 0, successful: 0 };
      }
      phaseStats[phase].total++;
      if (metrics.status === 'success') {
        phaseStats[phase].successful++;
      }
    }

    const result = {};
    for (const [phase, stats] of Object.entries(phaseStats)) {
      result[phase] = stats.total > 0
        ? Math.round((stats.successful / stats.total) * 100)
        : 0;
    }

    return result;
  }

  /**
   * Gets average execution time by phase
   *
   * @returns {Object} Map of phase → average execution time in ms
   */
  getPhaseAverageTimes() {
    const phaseStats = {};

    for (const metrics of this.phases.values()) {
      const phase = metrics.phase;
      if (!phaseStats[phase]) {
        phaseStats[phase] = { total: 0, count: 0 };
      }
      phaseStats[phase].total += metrics.executionTime;
      phaseStats[phase].count++;
    }

    const result = {};
    for (const [phase, stats] of Object.entries(phaseStats)) {
      result[phase] = stats.count > 0
        ? Math.round(stats.total / stats.count)
        : 0;
    }

    return result;
  }

  /**
   * Gets metrics for recent jobs
   *
   * @param {number} [limit=20] - Number of recent jobs to return
   * @returns {Array} Array of recent job metrics
   */
  getRecentJobs(limit = 20) {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clears all metrics
   *
   * @returns {void}
   */
  clear() {
    this.jobs.clear();
    this.phases.clear();
    this.errors.clear();
    this.aggregates = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      totalExecutionTime: 0,
      startedAt: Date.now()
    };
  }

  /**
   * Cleans up old metrics based on retention policy
   *
   * @private
   */
  _cleanup() {
    const now = Date.now();
    const cutoff = now - this.retentionMs;

    // Clean up old job metrics
    for (const [jobId, metrics] of this.jobs.entries()) {
      if (metrics.timestamp < cutoff) {
        this.jobs.delete(jobId);
      }
    }

    // Clean up old phase metrics
    for (const [key, metrics] of this.phases.entries()) {
      if (metrics.timestamp < cutoff) {
        this.phases.delete(key);
      }
    }

    // Prevent unbounded memory growth
    if (this.jobs.size > this.maxMetrics) {
      const toRemove = this.jobs.size - this.maxMetrics;
      let removed = 0;
      for (const [jobId] of this.jobs.entries()) {
        if (removed >= toRemove) break;
        this.jobs.delete(jobId);
        removed++;
      }
    }
  }
}

export default Metrics;
