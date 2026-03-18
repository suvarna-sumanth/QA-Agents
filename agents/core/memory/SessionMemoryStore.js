/**
 * SessionMemoryStore.js - In-memory storage for session instances
 *
 * Stores active session memory instances. Provides O(1) access
 * to session state during job execution.
 *
 * @class SessionMemoryStore
 */
export class SessionMemoryStore {
  /**
   * Creates a session memory store
   *
   * @param {Object} [config] - Configuration
   * @param {Object} [config.logger] - Logger instance
   */
  constructor(config = {}) {
    this.sessions = new Map(); // jobId -> SessionMemory
    this.logger = config.logger || console;

    this.metadata = {
      type: 'session-store',
      version: '1.0.0',
      createdAt: Date.now()
    };
  }

  /**
   * Creates a new session
   *
   * @param {string} jobId - Unique job identifier
   * @param {string} domain - Target domain
   * @param {Object} [siteProfile] - Optional profile from persistent memory
   * @returns {SessionMemory} Created session
   * @throws {Error} if jobId already exists
   */
  create(jobId, domain, siteProfile = null) {
    // Import here to avoid circular dependencies
    const { SessionMemory } = require('./SessionMemory.js');

    if (this.sessions.has(jobId)) {
      throw new Error(`Session already exists: ${jobId}`);
    }

    const session = new SessionMemory(jobId, domain, siteProfile);
    this.sessions.set(jobId, session);

    this.logger.debug(`Created session in store: ${jobId}`);
    return session;
  }

  /**
   * Gets a session by job ID
   *
   * @param {string} jobId - Job ID
   * @returns {SessionMemory|undefined} Session or undefined
   */
  get(jobId) {
    return this.sessions.get(jobId);
  }

  /**
   * Updates a session with partial updates
   *
   * @param {string} jobId - Job ID
   * @param {Object} updates - Partial updates
   * @throws {Error} if session not found
   */
  update(jobId, updates) {
    const session = this.sessions.get(jobId);
    if (!session) {
      throw new Error(`Session not found: ${jobId}`);
    }

    Object.assign(session, updates);
    this.logger.debug(`Updated session in store: ${jobId}`);
  }

  /**
   * Clears a session
   *
   * @param {string} jobId - Job ID
   */
  clear(jobId) {
    if (this.sessions.has(jobId)) {
      this.sessions.delete(jobId);
      this.logger.debug(`Cleared session from store: ${jobId}`);
    }
  }

  /**
   * Gets all active sessions
   *
   * @returns {Array<SessionMemory>} Array of sessions
   */
  getAllActive() {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets all active job IDs
   *
   * @returns {Array<string>} Array of job IDs
   */
  getAllJobIds() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Gets count of active sessions
   *
   * @returns {number} Session count
   */
  getCount() {
    return this.sessions.size;
  }

  /**
   * Checks if a session exists
   *
   * @param {string} jobId - Job ID
   * @returns {boolean} True if exists
   */
  has(jobId) {
    return this.sessions.has(jobId);
  }

  /**
   * Clears all sessions (usually for testing)
   */
  clearAll() {
    this.sessions.clear();
    this.logger.debug('Cleared all sessions from store');
  }

  /**
   * Returns metadata about the store
   *
   * @returns {Object} Metadata with count
   */
  getMetadata() {
    return {
      ...this.metadata,
      activeSessions: this.getCount()
    };
  }
}
