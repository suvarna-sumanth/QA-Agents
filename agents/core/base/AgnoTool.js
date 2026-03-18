/**
 * AgnoTool.js - Base class for all tools
 *
 * Provides the foundation for all specialized tools that perform
 * specific operations (parsing, detecting, testing, etc.).
 * Tools are deterministic and focused on a single capability.
 *
 * @class AgnoTool
 * @abstract
 */
export class AgnoTool {
  /**
   * Creates an instance of AgnoTool
   *
   * @param {Object} [config] - Optional configuration object
   * @param {Object} [config.logger] - Logger instance
   * @param {number} [config.timeout=30000] - Tool timeout in milliseconds
   * @param {number} [config.retries=3] - Number of retries on failure
   */
  constructor(config = {}) {
    this.config = config;
    this.logger = config.logger || console;
    this.timeout = config.timeout || 30000;
    this.retries = config.retries !== undefined ? config.retries : 3;

    // Schema definitions
    this.inputSchema = {};
    this.outputSchema = {};

    // Lifecycle hooks
    this.onBefore = null;
    this.onAfter = null;
    this.onError = null;

    // Metadata
    this.metadata = {
      name: this.constructor.name,
      version: '1.0.0',
      type: 'tool',
      createdAt: Date.now()
    };
  }

  /**
   * Main execution entry point for the tool
   *
   * Executes the tool with input validation, lifecycle hooks,
   * timeout handling, and retry logic.
   *
   * @param {Object} input - Input data for the tool
   * @returns {Promise<Object>} Tool result
   * @throws {Error} if execution fails or validation fails
   * @abstract
   */
  async execute(input) {
    // Validate input
    this.validate(input);

    // Call onBefore hook
    if (this.onBefore) {
      await this.onBefore(input);
    }

    let result;
    let lastError;

    // Retry loop with backoff
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        // Execute with timeout
        result = await Promise.race([
          this.run(input),
          this.createTimeout(this.timeout)
        ]);

        // Call onAfter hook on success
        if (this.onAfter) {
          await this.onAfter(result);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < this.retries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 100;
          this.logger.warn(
            `Tool ${this.metadata.name} attempt ${attempt + 1} failed, retrying in ${delay}ms`,
            error
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Call onError hook
    if (this.onError) {
      await this.onError(lastError);
    }

    throw lastError;
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
   * Validates input against the tool's input schema
   *
   * Basic implementation - subclasses can override for custom validation.
   *
   * @param {Object} input - Input to validate
   * @throws {Error} if validation fails
   * @protected
   */
  validate(input) {
    // Default: no validation. Subclasses should override.
  }

  /**
   * Returns JSON schema definition for this tool
   *
   * Used by the orchestrator to understand tool capabilities
   * and validate I/O.
   *
   * @returns {Object} Definition object with name, inputSchema, outputSchema
   */
  toDefinition() {
    return {
      name: this.metadata.name,
      description: this.getDescription(),
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema
    };
  }

  /**
   * Returns human-readable description of this tool
   *
   * @returns {string} Description text
   * @protected
   */
  getDescription() {
    return `Tool: ${this.metadata.name}`;
  }

  /**
   * Returns metadata about this tool
   *
   * @returns {Object} Metadata with name, version, type
   */
  getMetadata() {
    return {
      ...this.metadata
    };
  }

  /**
   * Sets the onBefore lifecycle hook
   *
   * Called before tool execution. Can be used for setup or validation.
   *
   * @param {Function} fn - Hook function (input) => Promise<void>
   * @returns {AgnoTool} this for chaining
   */
  before(fn) {
    this.onBefore = fn;
    return this;
  }

  /**
   * Sets the onAfter lifecycle hook
   *
   * Called after successful tool execution. Can be used for cleanup.
   *
   * @param {Function} fn - Hook function (result) => Promise<void>
   * @returns {AgnoTool} this for chaining
   */
  after(fn) {
    this.onAfter = fn;
    return this;
  }

  /**
   * Sets the onError lifecycle hook
   *
   * Called when tool execution fails. Can be used for error handling.
   *
   * @param {Function} fn - Hook function (error) => Promise<void>
   * @returns {AgnoTool} this for chaining
   */
  catch(fn) {
    this.onError = fn;
    return this;
  }

  /**
   * Helper method for creating timeout promise
   *
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise} Promise that rejects after ms
   * @private
   */
  createTimeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool timeout after ${ms}ms`)), ms)
    );
  }
}
