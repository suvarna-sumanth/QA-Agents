/**
 * AgnoAgent.js - Base class for parent/orchestrator agents
 *
 * Provides the foundation for orchestrator agents that coordinate multiple
 * sub-agents and manage the overall QA workflow. Parent agents use LLM-powered
 * decision making to orchestrate phases and handle failures.
 *
 * @class AgnoAgent
 * @abstract
 */
export class AgnoAgent {
  /**
   * Creates an instance of AgnoAgent
   *
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance for structured logging
   * @param {AgnoRegistry} config.registry - Registry for tool and agent lookup
   * @param {Object} config.memory - Memory service (session + persistent)
   * @param {Object} [config.browser] - Browser pool instance
   * @param {Object} [config.proxy] - Proxy manager instance
   * @param {Object} [config.s3] - S3 client instance
   * @throws {Error} if logger or registry is not provided
   */
  constructor(config) {
    if (!config.logger) throw new Error('logger required');
    if (!config.registry) throw new Error('registry required');

    this.config = config;
    this.logger = config.logger;
    this.registry = config.registry;
    this.memory = config.memory;
    this.browser = config.browser;
    this.proxy = config.proxy;
    this.s3 = config.s3;

    // Metadata for introspection
    this.metadata = {
      name: this.constructor.name,
      version: '1.0.0',
      type: 'parent',
      createdAt: Date.now()
    };
  }

  /**
   * Main execution entry point for the agent
   *
   * Orchestrates the overall workflow by coordinating sub-agents
   * and making decisions about phase progression and error recovery.
   *
   * @param {Object} jobInput - Job configuration
   * @param {string} jobInput.jobId - Unique job identifier
   * @param {string} jobInput.domain - Target domain
   * @param {string} jobInput.targetUrl - Starting URL
   * @param {number} [jobInput.depth=2] - Crawl depth for discovery
   * @param {Object} [jobInput.options] - Additional execution options
   * @returns {Promise<Object>} Job result with status, articles, detections, tests, bypasses, evidence
   * @throws {Error} if input validation fails or execution fails
   * @abstract
   */
  async execute(jobInput) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * LLM-powered decision making for orchestration
   *
   * Uses the language model to analyze phase results and decide
   * on next actions, including retry strategies and alternative paths.
   *
   * @param {Object} context - Current execution context
   * @param {string} context.currentPhase - Name of current phase
   * @param {Object} context.results - Results from all completed phases
   * @param {Array} context.errors - Errors encountered so far
   * @returns {Promise<Object>} Decision object with {action, reasoning, nextPhase}
   * @abstract
   */
  async think(context) {
    throw new Error('think() must be implemented by subclass');
  }

  /**
   * Dispatches work to a sub-agent
   *
   * Validates input schema, invokes the sub-agent, validates output,
   * and integrates results into session memory.
   *
   * @param {string} agentType - Type of sub-agent (discovery, detection, etc.)
   * @param {Object} input - Input for the sub-agent
   * @returns {Promise<Object>} Sub-agent result
   * @abstract
   */
  async dispatch(agentType, input) {
    throw new Error('dispatch() must be implemented by subclass');
  }

  /**
   * Returns metadata about this agent
   *
   * Provides introspection information including name, version,
   * type, and creation timestamp.
   *
   * @returns {Object} Metadata object
   */
  getMetadata() {
    return {
      ...this.metadata,
      registeredTools: this.registry.getAll('tools').length,
      registeredAgents: this.registry.getAll('agents').length
    };
  }

  /**
   * Validates job input format
   *
   * @param {Object} input - Input to validate
   * @throws {Error} if validation fails
   * @protected
   */
  validateInput(input) {
    if (!input.jobId) throw new Error('jobId required');
    if (!input.domain) throw new Error('domain required');
    if (!input.targetUrl) throw new Error('targetUrl required');
  }

  /**
   * Synthesizes results from all phases into final report
   *
   * Combines phase results into a unified structure suitable
   * for returning to the client.
   *
   * @param {Object} phases - Results from all phases
   * @returns {Object} Final synthesized result
   * @protected
   * @abstract
   */
  synthesizeResults(phases) {
    throw new Error('synthesizeResults() must be implemented by subclass');
  }
}
