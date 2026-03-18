/**
 * AgnoSubAgent.js - Base class for specialist sub-agents
 *
 * Provides the foundation for deterministic sub-agents that execute
 * specific phases (discovery, detection, testing, bypass, evidence).
 * Sub-agents validate input/output against JSON schemas and orchestrate tools.
 *
 * @class AgnoSubAgent
 * @abstract
 */
export class AgnoSubAgent {
  /**
   * Creates an instance of AgnoSubAgent
   *
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance
   * @param {Array<AgnoTool>} [config.tools] - Tools used by this agent
   * @param {Object} [config.memory] - Memory service reference
   * @throws {Error} if logger is not provided
   */
  constructor(config) {
    if (!config.logger) throw new Error('logger required');

    this.config = config;
    this.logger = config.logger;
    this.tools = config.tools || [];
    this.memory = config.memory;

    // Schema definitions (to be overridden by subclasses)
    this.inputSchema = {};
    this.outputSchema = {};

    // Metadata
    this.metadata = {
      name: this.constructor.name,
      type: 'sub-agent',
      version: '1.0.0',
      toolCount: this.tools.length,
      createdAt: Date.now()
    };
  }

  /**
   * Main execution entry point for the sub-agent
   *
   * Validates input, executes the sub-agent logic, validates output,
   * and returns structured result.
   *
   * @param {Object} input - Input data for the sub-agent
   * @returns {Promise<Object>} Result with phase-specific data
   * @throws {Error} if validation fails or execution fails
   * @abstract
   */
  async execute(input) {
    // Validate input
    this.validate(input);

    // Execute sub-agent logic
    const result = await this.run(input);

    // Validate output
    this.validateOutput(result);

    return result;
  }

  /**
   * Validates input against the agent's input schema
   *
   * @param {Object} input - Input to validate
   * @throws {Error} if validation fails
   * @abstract
   */
  validate(input) {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Core execution logic (to be implemented by subclasses)
   *
   * @param {Object} input - Validated input
   * @returns {Promise<Object>} Execution result
   * @protected
   * @abstract
   */
  async run(input) {
    throw new Error('run() must be implemented by subclass');
  }

  /**
   * Validates output against the agent's output schema
   *
   * @param {Object} result - Result to validate
   * @throws {Error} if validation fails
   * @abstract
   */
  validateOutput(result) {
    throw new Error('validateOutput() must be implemented by subclass');
  }

  /**
   * Returns the input and output schemas for this agent
   *
   * Schemas are used by the parent agent and orchestrator to validate
   * communication between agents and tools.
   *
   * @returns {Object} Schema object with {input, output}
   */
  getSchema() {
    return {
      input: this.inputSchema,
      output: this.outputSchema
    };
  }

  /**
   * Returns metadata about this sub-agent
   *
   * @returns {Object} Metadata with name, type, version, tools
   */
  getMetadata() {
    return {
      ...this.metadata,
      tools: this.tools.map(t => t.getMetadata())
    };
  }

  /**
   * Executes a tool and handles errors
   *
   * Helper method for running individual tools within the sub-agent.
   * Logs execution and validates tool output.
   *
   * @param {AgnoTool} tool - Tool to execute
   * @param {Object} input - Input for the tool
   * @returns {Promise<Object>} Tool result
   * @throws {Error} if tool execution fails
   * @protected
   */
  async executeTool(tool, input) {
    this.logger.debug(`Executing tool: ${tool.getMetadata().name}`, { input });

    try {
      const result = await tool.execute(input);
      this.logger.debug(`Tool succeeded: ${tool.getMetadata().name}`);
      return result;
    } catch (error) {
      this.logger.error(`Tool failed: ${tool.getMetadata().name}`, error);
      throw error;
    }
  }

  /**
   * Deduplicates URLs in array of objects
   *
   * Common utility for discovery and detection agents.
   *
   * @param {Array<Object>} items - Items with 'url' property
   * @returns {Array<Object>} Deduplicated items
   * @protected
   */
  deduplicateUrls(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }
}
