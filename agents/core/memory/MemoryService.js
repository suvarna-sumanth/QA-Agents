/**
 * MemoryService.js - Coordinator for session and persistent memory
 *
 * Provides a unified interface for memory operations across both
 * session (volatile) and persistent (domain-scoped) memory layers.
 *
 * @class MemoryService
 */
export class MemoryService {
  /**
   * Creates a memory service
   *
   * @param {SessionMemoryStore} sessionStore - Session memory storage
   * @param {PersistentMemory} persistentMemory - Persistent memory service
   * @param {Object} [config] - Configuration
   * @param {Object} [config.logger] - Logger instance
   * @throws {Error} if stores not provided
   */
  constructor(sessionStore, persistentMemory, config = {}) {
    if (!sessionStore) throw new Error('sessionStore required');
    if (!persistentMemory) throw new Error('persistentMemory required');

    this.sessionStore = sessionStore;
    this.persistentMemory = persistentMemory;
    this.logger = config.logger || console;

    this.metadata = {
      type: 'memory-service',
      version: '1.0.0',
      createdAt: Date.now()
    };
  }

  /**
   * Creates a new session memory for a job
   *
   * Loads the site profile from persistent memory and creates
   * a new session with that as the initial target.
   *
   * @param {string} jobId - Unique job identifier
   * @param {string} domain - Target domain
   * @returns {Promise<SessionMemory>} Created session memory
   */
  async createSession(jobId, domain) {
    try {
      // Load site profile from persistent memory
      const siteProfile = await this.persistentMemory.load(domain);

      // Create session with profile as target
      const session = this.sessionStore.create(jobId, domain, siteProfile);

      this.logger.debug(`Created session ${jobId} for domain ${domain}`);
      return session;
    } catch (error) {
      this.logger.error(`Failed to create session ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Gets an active session by job ID
   *
   * @param {string} jobId - Job ID to look up
   * @returns {SessionMemory|null} Session or null if not found
   */
  getSession(jobId) {
    return this.sessionStore.get(jobId);
  }

  /**
   * Updates a session with phase results
   *
   * @param {string} jobId - Job ID
   * @param {Partial<SessionMemory>} updates - Updates to apply
   * @throws {Error} if session not found
   */
  updateSession(jobId, updates) {
    this.sessionStore.update(jobId, updates);
    this.logger.debug(`Updated session ${jobId}`);
  }

  /**
   * Loads a site profile from persistent memory
   *
   * @param {string} domain - Domain to load
   * @returns {Promise<Object>} Site profile
   */
  async loadProfile(domain) {
    return this.persistentMemory.load(domain);
  }

  /**
   * Updates persistent memory with job results
   *
   * Should be called after synthesis to persist learnings
   * from the job back to the site profile.
   *
   * @param {string} domain - Domain to update
   * @param {SessionMemory} sessionMem - Session memory with results
   * @returns {Promise<void>}
   */
  async updateProfile(domain, sessionMem) {
    await this.persistentMemory.update(domain, sessionMem);
    this.logger.debug(`Updated profile for domain ${domain}`);
  }

  /**
   * Clears a session after job completion
   *
   * Frees session memory and removes from active sessions.
   *
   * @param {string} jobId - Job ID to clear
   */
  clearSession(jobId) {
    this.sessionStore.clear(jobId);
    this.logger.debug(`Cleared session ${jobId}`);
  }

  /**
   * Gets all active sessions
   *
   * @returns {Array<SessionMemory>} Array of active sessions
   */
  getAllActiveSessions() {
    return this.sessionStore.getAllActive();
  }

  /**
   * Gets count of active sessions
   *
   * @returns {number} Number of active sessions
   */
  getActiveSessionCount() {
    return this.sessionStore.getAllActive().length;
  }

  /**
   * Clears persistent memory cache for a domain
   *
   * @param {string} domain - Domain to clear
   */
  clearPersistentCache(domain) {
    this.persistentMemory.clearCache(domain);
  }

  /**
   * Clears all persistent memory cache
   */
  clearAllPersistentCache() {
    this.persistentMemory.clearAllCache();
  }

  /**
   * Returns metadata about the memory service
   *
   * @returns {Object} Metadata with active session count
   */
  getMetadata() {
    return {
      ...this.metadata,
      activeSessions: this.getActiveSessionCount(),
      sessionStore: this.sessionStore.constructor.name,
      persistentMemory: this.persistentMemory.constructor.name
    };
  }
}
