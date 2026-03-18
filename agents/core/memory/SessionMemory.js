/**
 * SessionMemory.js - Job-scoped session memory
 *
 * Manages temporary per-job state during QA execution.
 * Session memory is created at job start and cleared after synthesis.
 * All phase execution updates are stored here.
 *
 * @class SessionMemory
 */
export class SessionMemory {
  /**
   * Creates a session memory for a job
   *
   * @param {string} jobId - Unique job identifier
   * @param {string} domain - Target domain
   * @param {Object} [siteProfile] - Optional profile loaded from persistent memory
   */
  constructor(jobId, domain, siteProfile = null) {
    this.jobId = jobId;
    this.domain = domain;
    this.target = siteProfile || {
      domain,
      successRate: 0.5,
      detectionRate: 0.5,
      playerTypes: {},
      discoveryMethods: [],
      recommendations: []
    };

    // Phase 1: Discovery
    this.articles = [];
    this.discoveryMethods = [];
    this.articleCount = 0;

    // Phase 2: Detection
    this.detectionResults = [];

    // Phase 3: Testing
    this.testingResults = [];
    this.failedTests = [];

    // Phase 4: Bypass
    this.bypassResults = [];

    // Phase 5: Evidence
    this.evidenceResult = null;

    // Metadata
    this.startTime = Date.now();
    this.phaseTimes = {};
    this.currentPhase = null;
    this.errors = [];

    // Status tracking
    this.status = 'initialized';
  }

  /**
   * Updates articles from discovery phase
   *
   * @param {Array<Object>} articles - Articles with url, title, source
   * @param {Array<string>} methods - Methods used to discover
   */
  setDiscoveryResults(articles, methods) {
    this.articles = articles;
    this.discoveryMethods = methods;
    this.articleCount = articles.length;
    this.currentPhase = 'discovery';
    this.phaseTimes.discovery = Date.now() - this.startTime;
  }

  /**
   * Updates detection results from detection phase
   *
   * @param {Array<Object>} results - Detection results
   */
  setDetectionResults(results) {
    this.detectionResults = results;
    this.currentPhase = 'detection';
    this.phaseTimes.detection = Date.now() - this.startTime;
  }

  /**
   * Updates testing results from testing phase
   *
   * @param {Array<Object>} results - Testing results
   * @param {Array<Object>} [failed] - Failed test results
   */
  setTestingResults(results, failed = []) {
    this.testingResults = results;
    this.failedTests = failed;
    this.currentPhase = 'testing';
    this.phaseTimes.testing = Date.now() - this.startTime;
  }

  /**
   * Updates bypass results from bypass phase
   *
   * @param {Array<Object>} results - Bypass results
   */
  setBypassResults(results) {
    this.bypassResults = results;
    this.currentPhase = 'bypass';
    this.phaseTimes.bypass = Date.now() - this.startTime;
  }

  /**
   * Updates evidence result from evidence phase
   *
   * @param {Object} result - Evidence result
   */
  setEvidenceResult(result) {
    this.evidenceResult = result;
    this.currentPhase = 'evidence';
    this.phaseTimes.evidence = Date.now() - this.startTime;
  }

  /**
   * Adds an error to the session
   *
   * @param {Object} error - Error object or Error instance
   * @param {string} phase - Phase where error occurred
   */
  addError(error, phase) {
    this.errors.push({
      phase,
      message: error.message || String(error),
      timestamp: Date.now(),
      stack: error.stack
    });
  }

  /**
   * Gets the total execution time in milliseconds
   *
   * @returns {number} Total time
   */
  getTotalTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Returns a summary of the session
   *
   * @returns {Object} Summary object
   */
  getSummary() {
    return {
      jobId: this.jobId,
      domain: this.domain,
      status: this.status,
      articleCount: this.articleCount,
      detectionCount: this.detectionResults.length,
      testingCount: this.testingResults.length,
      failedCount: this.failedTests.length,
      bypassCount: this.bypassResults.length,
      errorCount: this.errors.length,
      totalTime: this.getTotalTime(),
      phaseTimes: this.phaseTimes
    };
  }

  /**
   * Validates that the session has required data for synthesis
   *
   * @returns {Object} Validation result with {valid, errors}
   */
  validate() {
    const errors = [];

    if (!this.jobId) errors.push('jobId is required');
    if (!this.domain) errors.push('domain is required');
    if (!Array.isArray(this.articles)) errors.push('articles must be an array');
    if (!Array.isArray(this.detectionResults)) errors.push('detectionResults must be an array');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Returns all data as a plain object
   *
   * @returns {Object} Session data
   */
  toObject() {
    return {
      jobId: this.jobId,
      domain: this.domain,
      target: this.target,
      articles: this.articles,
      discoveryMethods: this.discoveryMethods,
      articleCount: this.articleCount,
      detectionResults: this.detectionResults,
      testingResults: this.testingResults,
      failedTests: this.failedTests,
      bypassResults: this.bypassResults,
      evidenceResult: this.evidenceResult,
      startTime: this.startTime,
      phaseTimes: this.phaseTimes,
      currentPhase: this.currentPhase,
      errors: this.errors,
      status: this.status
    };
  }
}
