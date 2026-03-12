/**
 * Base Agent interface and contract.
 * All agents must implement the runJob() method and expose metadata.
 */

export class Agent {
  constructor(config = {}) {
    this.id = config.id || 'unknown-agent';
    this.name = config.name || 'Unknown Agent';
    this.version = config.version || '1.0.0';
    this.capabilities = config.capabilities || [];
  }

  /**
   * Run a job on behalf of an external caller (API, CLI, scheduler, etc).
   * Implementations must handle both 'domain' and 'url' job types.
   *
   * @param {Object} job
   * @param {string} job.jobId - Unique job identifier
   * @param {string} job.type - Job type: 'domain' or 'url'
   * @param {string} job.target - Target domain (https://example.com) or URL
   * @param {Object} job.config - Agent-specific configuration overrides
   * @param {Function} job.onStepStart - Callback: function(stepName, metadata)
   * @param {Function} job.onStepEnd - Callback: function(stepName, result)
   * @param {Function} job.onScreenshot - Callback: function(stepName, screenshotData)
   * @param {Function} job.onError - Callback: function(error, context)
   *
   * @returns {Promise<Object>} Report object with structure:
   *   {
   *     jobId: string,
   *     agentId: string,
   *     type: 'domain' | 'url',
   *     target: string,
   *     timestamp: ISO string,
   *     overallStatus: 'pass' | 'partial' | 'fail' | 'error',
   *     summary: { passed, partial, failed, skipped, total },
   *     steps: [{ name, status, message, duration, screenshot }],
   *     metadata: { ... agent-specific }
   *   }
   */
  async runJob(job) {
    throw new Error('Agent.runJob() must be implemented by subclass');
  }

  /**
   * Return agent metadata for registration and discovery.
   */
  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
    };
  }
}

export default Agent;
