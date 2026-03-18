/**
 * QAParentAgent.js - Parent orchestrator for all 5 sub-agents
 *
 * Orchestrates the complete 5-phase QA workflow:
 * 1. Discovery (sequential) - Find all articles
 * 2. Detection (parallel) - Locate players on articles
 * 3. Testing (parallel) - Test if players work
 * 4. Bypass (conditional parallel) - Handle WAF obstacles
 * 5. Evidence (sequential) - Collect artifacts
 *
 * Uses SubAgentInvoker to coordinate sub-agents and MemoryService
 * for session/persistent memory management.
 *
 * @extends AgnoAgent
 */

import { AgnoAgent } from '../base/AgnoAgent.js';
import { PromptLoader } from '../prompts/PromptLoader.js';

export class QAParentAgent extends AgnoAgent {
  /**
   * Creates an instance of QAParentAgent
   *
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance for structured logging
   * @param {AgnoRegistry} config.registry - Registry for agent/tool lookup
   * @param {MemoryService} config.memory - Memory service for session + persistent
   * @param {Object} config.browser - Browser pool instance
   * @param {Object} config.proxy - Proxy manager instance
   * @param {Object} config.s3 - S3 client instance
   * @param {Object} [config.promptsDir] - Path to prompts directory
   * @throws {Error} if required config missing
   */
  constructor(config) {
    super(config);

    // Update metadata
    this.metadata.type = 'parent';
    this.metadata.version = '3.0.0';
    this.metadata.phases = 5;

    // Initialize prompt loader
    this.promptLoader = new PromptLoader({
      logger: this.logger,
      promptsDir: config.promptsDir
    });

    // Sub-agent registry (from main registry)
    this.subAgents = {
      discovery: null,
      detection: null,
      testing: null,
      bypass: null,
      evidence: null
    };

    // Execution state
    this.currentJob = null;
    this.sessionMemory = null;
  }

  /**
   * Main execution entry point - orchestrates all 5 phases
   *
   * Flow:
   * 1. Validate input
   * 2. Load site profile from persistent memory
   * 3. Create session memory
   * 4. Phase 1: Discovery (sequential)
   * 5. Phase 2: Detection (parallel)
   * 6. Phase 3: Testing (parallel)
   * 7. Phase 4: Bypass (conditional parallel)
   * 8. Phase 5: Evidence (sequential)
   * 9. Synthesize results
   * 10. Update persistent memory
   * 11. Clear session memory
   *
   * @param {Object} jobInput - Job configuration
   * @param {string} jobInput.jobId - Unique job identifier
   * @param {string} jobInput.domain - Target domain
   * @param {string} jobInput.targetUrl - Starting URL
   * @param {number} [jobInput.depth=2] - Crawl depth for discovery
   * @param {Object} [jobInput.options] - Additional execution options
   * @returns {Promise<Object>} Final synthesized result with all phase data
   * @throws {Error} if input validation fails or critical phase fails
   */
  async execute(jobInput) {
    const startTime = Date.now();
    const { jobId, domain, targetUrl, depth, options } = jobInput;

    try {
      // Step 1: Validate input
      this.validateInput(jobInput);
      this.logger.info(`Starting job ${jobId} for domain ${domain}`);

      // Step 2: Load site profile and create session memory
      this.currentJob = jobId;
      const siteProfile = await this.memory.loadProfile(domain);
      this.sessionMemory = await this.memory.createSession(jobId, domain);
      this.sessionMemory.startTime = startTime;
      this.sessionMemory.phaseTimes = {};

      this.logger.debug(`Loaded site profile for ${domain}`, { profile: siteProfile });

      // Step 3: Execute all 5 phases
      await this.phaseDiscovery(jobInput);
      await this.phaseDetection();
      await this.phaseTesting();
      await this.phaseBypass();
      await this.phaseEvidence(jobId);

      // Step 4: Synthesize results
      const finalReport = this.synthesizeResults();

      // Step 5: Update persistent memory
      await this.memory.updateProfile(domain, this.sessionMemory);
      this.logger.info(`Updated profile for domain ${domain}`);

      // Step 6: Clear session memory
      this.memory.clearSession(jobId);

      const totalTime = Date.now() - startTime;
      finalReport.metrics.totalTime = totalTime;

      this.logger.info(`Job ${jobId} completed successfully in ${totalTime}ms`);

      return {
        status: 'success',
        data: finalReport,
        metrics: {
          totalTime,
          phases: this.sessionMemory.phaseTimes
        }
      };
    } catch (error) {
      await this.handleJobError(jobId, error);
      throw error;
    }
  }

  /**
   * PHASE 1: Discovery (Sequential)
   *
   * Goal: Find all article URLs on the domain using multiple methods
   * (sitemap, RSS, crawling)
   *
   * @param {Object} jobInput - Job input with domain and targetUrl
   * @returns {Promise<void>}
   * @private
   */
  async phaseDiscovery(jobInput) {
    const phaseStartTime = Date.now();
    this.sessionMemory.currentPhase = 'discovery';

    try {
      this.logger.info('Starting PHASE 1: Discovery');

      // Get DiscoverySubAgent from registry
      const discoveryAgent = this.registry.getAgent('DiscoverySubAgent');
      if (!discoveryAgent) {
        throw new Error('DiscoverySubAgent not registered');
      }

      // Prepare input
      const discoveryInput = {
        domain: jobInput.domain,
        targetUrl: jobInput.targetUrl,
        depth: jobInput.depth || 2,
        maxArticles: jobInput.options?.maxArticles || 100
      };

      this.logger.debug('Discovery input:', discoveryInput);

      // Execute agent
      const result = await discoveryAgent.execute(discoveryInput);

      // Validate result
      this.validatePhaseResult(result, 'discovery');

      // Store in session memory
      this.sessionMemory.articles = result.articles || [];
      this.sessionMemory.discoveryMethods = result.methods || [];
      this.sessionMemory.articleCount = result.articleCount || 0;

      this.logger.info(
        `Discovery found ${this.sessionMemory.articleCount} articles ` +
        `using methods: ${this.sessionMemory.discoveryMethods.join(', ')}`
      );

      // Handle edge case: no articles
      if (this.sessionMemory.articles.length === 0) {
        this.sessionMemory.errors.push({
          phase: 'discovery',
          severity: 'warning',
          message: 'No articles discovered',
          timestamp: Date.now()
        });
        this.logger.warn('No articles discovered on domain');
      }
    } catch (error) {
      this.sessionMemory.errors.push({
        phase: 'discovery',
        severity: 'error',
        message: error.message,
        timestamp: Date.now()
      });
      this.logger.error('Discovery phase failed:', error);
      throw new Error(`Discovery phase failed: ${error.message}`);
    }

    this.sessionMemory.phaseTimes.discovery = Date.now() - phaseStartTime;
  }

  /**
   * PHASE 2: Detection (Parallel)
   *
   * Goal: For each article URL, detect all video players present
   * (HTML5, HLS, YouTube, Vimeo, custom)
   *
   * @returns {Promise<void>}
   * @private
   */
  async phaseDetection() {
    const phaseStartTime = Date.now();
    this.sessionMemory.currentPhase = 'detection';

    const articles = this.sessionMemory.articles || [];

    if (articles.length === 0) {
      this.logger.warn('Skipping detection: no articles to process');
      this.sessionMemory.phaseTimes.detection = 0;
      return;
    }

    try {
      this.logger.info(`Starting PHASE 2: Detection for ${articles.length} articles`);

      // Get DetectionSubAgent from registry
      const detectionAgent = this.registry.getAgent('DetectionSubAgent');
      if (!detectionAgent) {
        throw new Error('DetectionSubAgent not registered');
      }

      // Create parallel detection tasks
      const detectionTasks = articles.map((article) =>
        detectionAgent.execute({
          url: article.url,
          browser: this.browser,
          timeout: 30000
        }).catch((error) => ({
          url: article.url,
          phase: 'detection',
          error: error.message,
          playerCount: 0,
          players: []
        }))
      );

      // Execute all detections in parallel
      const detectionResults = await Promise.all(detectionTasks);

      // Store results
      this.sessionMemory.detectionResults = detectionResults;

      // Aggregate statistics
      const totalPlayers = detectionResults.reduce(
        (sum, r) => sum + (r.playerCount || 0),
        0
      );
      const playersByType = this.aggregatePlayerTypes(detectionResults);

      this.logger.info(
        `Detection found ${totalPlayers} players across ${articles.length} articles`
      );
      this.logger.debug('Player types:', playersByType);

      // Handle edge case: no players detected
      if (totalPlayers === 0) {
        this.sessionMemory.errors.push({
          phase: 'detection',
          severity: 'warning',
          message: 'No video players detected on any article',
          timestamp: Date.now()
        });
        this.logger.warn('No video players detected');
      }
    } catch (error) {
      this.sessionMemory.errors.push({
        phase: 'detection',
        severity: 'error',
        message: error.message,
        timestamp: Date.now()
      });
      this.logger.error('Detection phase failed:', error);
      throw new Error(`Detection phase failed: ${error.message}`);
    }

    this.sessionMemory.phaseTimes.detection = Date.now() - phaseStartTime;
  }

  /**
   * PHASE 3: Testing (Parallel)
   *
   * Goal: For each detected player, test if it can play video
   * and collect test results (playable, hasAudio, controlsWork, etc.)
   *
   * @returns {Promise<void>}
   * @private
   */
  async phaseTesting() {
    const phaseStartTime = Date.now();
    this.sessionMemory.currentPhase = 'testing';

    // Flatten all detected players from detection results
    const playersToTest = [];
    (this.sessionMemory.detectionResults || []).forEach((detection) => {
      (detection.players || []).forEach((player) => {
        playersToTest.push({
          article: detection.url,
          player
        });
      });
    });

    if (playersToTest.length === 0) {
      this.logger.warn('Skipping testing: no players to test');
      this.sessionMemory.phaseTimes.testing = 0;
      return;
    }

    try {
      this.logger.info(`Starting PHASE 3: Testing ${playersToTest.length} players`);

      // Get TestingSubAgent from registry
      const testingAgent = this.registry.getAgent('TestingSubAgent');
      if (!testingAgent) {
        throw new Error('TestingSubAgent not registered');
      }

      // Create parallel testing tasks
      const testingTasks = playersToTest.map(({ article, player }) =>
        testingAgent.execute({
          url: article,
          player,
          browser: this.browser,
          timeout: 45000
        }).catch((error) => ({
          url: article,
          playerId: player.id,
          playerType: player.type,
          phase: 'testing',
          testResult: {
            playable: false,
            hasAudio: false,
            controlsWork: false,
            progressDetected: false,
            error: error.message
          }
        }))
      );

      // Execute all tests in parallel
      const testingResults = await Promise.all(testingTasks);

      // Store results
      this.sessionMemory.testingResults = testingResults;

      // Aggregate statistics
      const playableCount = testingResults.filter(
        (r) => r.testResult?.playable === true
      ).length;
      const failedCount = testingResults.length - playableCount;

      this.logger.info(
        `Testing: ${playableCount}/${testingResults.length} players playable`
      );

      // Identify failures for bypass phase
      this.sessionMemory.failedTests = testingResults.filter(
        (r) => r.testResult?.playable !== true
      );

      this.logger.debug(`${failedCount} tests failed, will proceed to bypass phase`);
    } catch (error) {
      this.sessionMemory.errors.push({
        phase: 'testing',
        severity: 'error',
        message: error.message,
        timestamp: Date.now()
      });
      this.logger.error('Testing phase failed:', error);
      throw new Error(`Testing phase failed: ${error.message}`);
    }

    this.sessionMemory.phaseTimes.testing = Date.now() - phaseStartTime;
  }

  /**
   * PHASE 4: Bypass (Conditional Parallel)
   *
   * Goal: If tests failed, attempt to bypass WAF obstacles and retry testing
   * Only runs if failedTests.length > 0
   *
   * @returns {Promise<void>}
   * @private
   */
  async phaseBypass() {
    const phaseStartTime = Date.now();
    this.sessionMemory.currentPhase = 'bypass';

    const failedTests = this.sessionMemory.failedTests || [];

    if (failedTests.length === 0) {
      this.logger.info('No failures detected - skipping bypass phase');
      this.sessionMemory.phaseTimes.bypass = 0;
      return;
    }

    try {
      this.logger.info(
        `Starting PHASE 4: Bypass for ${failedTests.length} failed tests`
      );

      // Get BypassSubAgent from registry
      const bypassAgent = this.registry.getAgent('BypassSubAgent');
      if (!bypassAgent) {
        throw new Error('BypassSubAgent not registered');
      }

      // Create bypass tasks - one per unique URL
      const urlsToBypass = new Set(failedTests.map((f) => f.url));
      const bypassTasks = Array.from(urlsToBypass).map((url) => {
        const failures = failedTests.filter((f) => f.url === url);
        const failureReason = this.synthesizeFailureReason(failures);

        return bypassAgent.execute({
          url,
          failureReason,
          browser: this.browser,
          proxy: this.proxy,
          maxRetries: 3
        }).catch((error) => ({
          url,
          phase: 'bypass',
          wafDetected: 'unknown',
          bypassResult: {
            success: false,
            error: error.message
          }
        }));
      });

      // Execute all bypass attempts in parallel
      const bypassResults = await Promise.all(bypassTasks);

      // Store results
      this.sessionMemory.bypassResults = bypassResults;

      // Check which bypasses succeeded
      const successfulBypasses = bypassResults.filter(
        (r) => r.bypassResult?.success === true
      );
      this.logger.info(
        `Bypass: ${successfulBypasses.length}/${bypassResults.length} succeeded`
      );

      // If bypasses succeeded, retry testing on those URLs
      if (successfulBypasses.length > 0) {
        await this.retestAfterBypass(successfulBypasses);
      }
    } catch (error) {
      this.sessionMemory.errors.push({
        phase: 'bypass',
        severity: 'warning',
        message: `Bypass phase error: ${error.message}`,
        timestamp: Date.now()
      });
      this.logger.warn('Bypass phase failed, continuing:', error.message);
      // Don't throw - bypass failures are non-critical
    }

    this.sessionMemory.phaseTimes.bypass = Date.now() - phaseStartTime;
  }

  /**
   * PHASE 5: Evidence (Sequential Aggregation)
   *
   * Goal: Aggregate all results and collect evidence artifacts
   * (screenshots, manifest, logs) and upload to S3
   *
   * @param {string} jobId - Job identifier
   * @returns {Promise<void>}
   * @private
   */
  async phaseEvidence(jobId) {
    const phaseStartTime = Date.now();
    this.sessionMemory.currentPhase = 'evidence';

    const allResults = [
      ...(this.sessionMemory.detectionResults || []),
      ...(this.sessionMemory.testingResults || []),
      ...(this.sessionMemory.bypassResults || [])
    ];

    try {
      this.logger.info('Starting PHASE 5: Evidence collection');

      // Get EvidenceSubAgent from registry
      const evidenceAgent = this.registry.getAgent('EvidenceSubAgent');
      if (!evidenceAgent) {
        throw new Error('EvidenceSubAgent not registered');
      }

      // Execute evidence collection
      const evidenceResult = await evidenceAgent.execute({
        jobId,
        allResults,
        s3: this.s3
      }).catch((error) => ({
        phase: 'evidence',
        jobId,
        error: error.message,
        evidence: {
          s3Urls: {},
          manifest: null,
          aggregatedLogs: []
        }
      }));

      // Store result
      this.sessionMemory.evidenceResult = evidenceResult;

      this.logger.info('Evidence collection completed');
    } catch (error) {
      this.sessionMemory.errors.push({
        phase: 'evidence',
        severity: 'warning',
        message: `Evidence collection failed: ${error.message}`,
        timestamp: Date.now()
      });
      this.logger.warn('Evidence phase failed:', error.message);
      // Don't throw - evidence failures are non-critical
    }

    this.sessionMemory.phaseTimes.evidence = Date.now() - phaseStartTime;
  }

  /**
   * Synthesizes all phase results into final report
   *
   * Combines results from all 5 phases, determines overall status,
   * and calculates success metrics.
   *
   * @returns {Object} Final report with all phase data
   * @private
   */
  synthesizeResults() {
    const totalTime = Date.now() - this.sessionMemory.startTime;

    const report = {
      jobId: this.currentJob,
      domain: this.sessionMemory.domain,
      status: this.determineStatus(),
      summary: {
        articlesFound: this.sessionMemory.articles?.length || 0,
        playersDetected: this.countPlayers(this.sessionMemory.detectionResults),
        playersPlayable: this.countPlayable(this.sessionMemory.testingResults),
        wafEncountered: (this.sessionMemory.bypassResults || []).some(
          (r) => r.wafDetected && r.wafDetected !== 'unknown'
        ),
        evidenceCollected: this.sessionMemory.evidenceResult !== null &&
          this.sessionMemory.evidenceResult !== undefined
      },
      details: {
        articles: this.sessionMemory.articles || [],
        detections: this.sessionMemory.detectionResults || [],
        tests: this.sessionMemory.testingResults || [],
        bypasses: this.sessionMemory.bypassResults || [],
        evidence: this.sessionMemory.evidenceResult
      },
      errors: this.sessionMemory.errors || [],
      metrics: {
        phaseTimes: this.sessionMemory.phaseTimes,
        totalTime,
        successRate: this.calculateSuccessRate(),
        startTime: this.sessionMemory.startTime,
        endTime: Date.now()
      }
    };

    return report;
  }

  /**
   * Determines overall job status based on execution results
   *
   * @returns {string} Status: 'success', 'partial', 'no-data', or 'failed'
   * @private
   */
  determineStatus() {
    const errors = this.sessionMemory.errors || [];
    const criticalErrors = errors.filter((e) => e.severity === 'error');
    const hasResults = (this.sessionMemory.testingResults || []).length > 0;

    if (criticalErrors.length === 0 && hasResults) return 'success';
    if (criticalErrors.length === 0 && !hasResults) return 'no-data';
    if (criticalErrors.length > 0 && hasResults) return 'partial';
    return 'failed';
  }

  /**
   * Counts total players across detection results
   *
   * @param {Array} detectionResults - Detection phase results
   * @returns {number} Total player count
   * @private
   */
  countPlayers(detectionResults) {
    if (!detectionResults) return 0;
    return detectionResults.reduce((sum, r) => sum + (r.playerCount || 0), 0);
  }

  /**
   * Counts playable players across testing results
   *
   * @param {Array} testingResults - Testing phase results
   * @returns {number} Playable player count
   * @private
   */
  countPlayable(testingResults) {
    if (!testingResults) return 0;
    return testingResults.filter(
      (r) => r.testResult?.playable === true
    ).length;
  }

  /**
   * Calculates overall success rate
   *
   * @returns {number} Success rate between 0 and 1
   * @private
   */
  calculateSuccessRate() {
    const testingResults = this.sessionMemory.testingResults || [];
    if (testingResults.length === 0) return 0;

    const playable = this.countPlayable(testingResults);
    return playable / testingResults.length;
  }

  /**
   * Aggregates player types from detection results
   *
   * @param {Array} detectionResults - Detection phase results
   * @returns {Object} Map of player type to count
   * @private
   */
  aggregatePlayerTypes(detectionResults) {
    const types = {};
    (detectionResults || []).forEach((result) => {
      (result.players || []).forEach((player) => {
        types[player.type] = (types[player.type] || 0) + 1;
      });
    });
    return types;
  }

  /**
   * Synthesizes failure reasons for bypass phase
   *
   * Combines error messages to help identify WAF type.
   *
   * @param {Array} failures - Failed test results
   * @returns {string} Synthesized failure reason
   * @private
   */
  synthesizeFailureReason(failures) {
    const reasons = failures
      .map((f) => f.testResult?.error)
      .filter(Boolean);
    return reasons.join(' | ') || 'Unknown failure';
  }

  /**
   * Retests players after successful bypass
   *
   * @param {Array} successfulBypasses - Successful bypass results
   * @returns {Promise<void>}
   * @private
   */
  async retestAfterBypass(successfulBypasses) {
    try {
      const testingAgent = this.registry.getAgent('TestingSubAgent');
      if (!testingAgent) {
        this.logger.warn('TestingSubAgent not available for retest');
        return;
      }

      // Find players on URLs that were successfully bypassed
      const bypassedUrls = new Set(successfulBypasses.map((b) => b.url));
      const playersToRetest = (this.sessionMemory.testingResults || []).filter(
        (result) => bypassedUrls.has(result.url)
      );

      if (playersToRetest.length === 0) {
        this.logger.debug('No players to retest after bypass');
        return;
      }

      this.logger.info(`Retesting ${playersToRetest.length} players after bypass`);

      // Retest each player
      const retestTasks = playersToRetest.map(async (testResult) => {
        // Find the original player from detection results
        const detection = (this.sessionMemory.detectionResults || []).find(
          (d) => d.url === testResult.url
        );

        if (!detection) return null;

        const player = detection.players?.find((p) => p.id === testResult.playerId);
        if (!player) return null;

        try {
          return await testingAgent.execute({
            url: testResult.url,
            player,
            browser: this.browser,
            timeout: 45000
          });
        } catch (error) {
          this.logger.debug(
            `Retest failed for player ${player.id}:`,
            error.message
          );
          return null;
        }
      });

      const retestResults = await Promise.allSettled(retestTasks);

      // Merge successful retests back
      retestResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const originalIndex = (this.sessionMemory.testingResults || []).findIndex(
            (t) =>
              t.url === playersToRetest[index].url &&
              t.playerId === playersToRetest[index].playerId
          );

          if (originalIndex !== -1) {
            this.sessionMemory.testingResults[originalIndex] = result.value;
          }
        }
      });

      // Update failed tests list
      this.sessionMemory.failedTests = (this.sessionMemory.testingResults || []).filter(
        (r) => r.testResult?.playable !== true
      );

      this.logger.info('Retest completed');
    } catch (error) {
      this.logger.warn('Error during retest after bypass:', error.message);
      // Non-critical, don't throw
    }
  }

  /**
   * Validates phase result structure
   *
   * @param {Object} result - Result to validate
   * @param {string} expectedPhase - Expected phase name
   * @throws {Error} if validation fails
   * @private
   */
  validatePhaseResult(result, expectedPhase) {
    if (!result) {
      throw new Error(`Result is null or undefined`);
    }

    if (result.phase !== expectedPhase) {
      throw new Error(
        `Expected phase '${expectedPhase}' but got '${result.phase}'`
      );
    }
  }

  /**
   * Handles critical job errors
   *
   * @param {string} jobId - Job ID
   * @param {Error} error - Error that occurred
   * @returns {Promise<void>}
   * @private
   */
  async handleJobError(jobId, error) {
    try {
      // Record error
      if (this.sessionMemory) {
        this.sessionMemory.errors.push({
          phase: this.sessionMemory.currentPhase || 'unknown',
          severity: 'critical',
          message: error.message,
          timestamp: Date.now()
        });
      }

      // Log error
      this.logger.error(`Job ${jobId} failed:`, error);

      // Clean up session
      try {
        this.memory.clearSession(jobId);
      } catch (e) {
        this.logger.warn(`Failed to clear session ${jobId}:`, e.message);
      }

      this.currentJob = null;
      this.sessionMemory = null;
    } catch (e) {
      this.logger.error('Error during error handling:', e);
    }
  }

  /**
   * Gets metadata about this agent
   *
   * @returns {Object} Metadata object
   */
  getMetadata() {
    return {
      ...this.metadata,
      registeredTools: this.registry.getAll('tools').length,
      registeredAgents: this.registry.getAll('agents').length,
      currentJob: this.currentJob
    };
  }
}

export default QAParentAgent;
