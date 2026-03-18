/**
 * AgnoMemory.js - Abstract memory interface
 *
 * Defines the contract for memory implementations used throughout
 * the Agno system. Memory can be session-based (temporary) or
 * persistent (domain-scoped).
 *
 * @class AgnoMemory
 * @abstract
 */
export class AgnoMemory {
  /**
   * Creates an instance of AgnoMemory
   *
   * @param {Object} [config] - Optional configuration
   * @param {Object} [config.logger] - Logger instance
   */
  constructor(config = {}) {
    this.config = config;
    this.logger = config.logger || console;

    // Schema for validation
    this.schema = {};

    this.metadata = {
      type: 'memory',
      abstract: true,
      version: '1.0.0'
    };
  }

  /**
   * Loads data from memory
   *
   * For session memory: loads from in-memory store
   * For persistent memory: loads from database
   *
   * @param {string} key - Key to load
   * @returns {Promise<Object>} Loaded data or null if not found
   * @abstract
   */
  async load(key) {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Saves data to memory
   *
   * For session memory: saves to in-memory store
   * For persistent memory: saves to database
   *
   * @param {string} key - Key to save
   * @param {Object} data - Data to save
   * @returns {Promise<void>}
   * @abstract
   */
  async save(key, data) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Clears data from memory
   *
   * For session memory: deletes from in-memory store
   * For persistent memory: deletes from database
   *
   * @param {string} key - Key to clear
   * @returns {Promise<void>}
   * @abstract
   */
  async clear(key) {
    throw new Error('clear() must be implemented by subclass');
  }

  /**
   * Gets all keys in memory
   *
   * @returns {Promise<Array<string>>} Array of keys
   * @abstract
   */
  async getAllKeys() {
    throw new Error('getAllKeys() must be implemented by subclass');
  }

  /**
   * Checks if a key exists in memory
   *
   * @param {string} key - Key to check
   * @returns {Promise<boolean>} True if key exists
   * @abstract
   */
  async exists(key) {
    throw new Error('exists() must be implemented by subclass');
  }

  /**
   * Returns the schema definition for this memory type
   *
   * @returns {Object} Schema object
   */
  getSchema() {
    return this.schema;
  }

  /**
   * Returns metadata about this memory implementation
   *
   * @returns {Object} Metadata object
   */
  getMetadata() {
    return {
      ...this.metadata,
      implementation: this.constructor.name
    };
  }
}
