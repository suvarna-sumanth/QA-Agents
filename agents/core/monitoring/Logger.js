/**
 * Logger.js - Structured logging with levels and job context
 *
 * Provides structured logging with levels (debug, info, warn, error),
 * includes job ID, phase, and timestamp in all logs.
 * Supports async logging for non-blocking operation.
 */

export class Logger {
  /**
   * Log levels enumeration
   */
  static LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  };

  /**
   * Creates an instance of Logger
   *
   * @param {Object} [config] - Configuration object
   * @param {string} [config.name='Logger'] - Logger name/identifier
   * @param {string} [config.level='info'] - Minimum log level (debug, info, warn, error)
   * @param {boolean} [config.async=false] - Whether to use async logging
   * @param {Function} [config.transport] - Custom transport function for logs
   */
  constructor(config = {}) {
    this.name = config.name || 'Logger';
    this.level = config.level || 'info';
    this.async = config.async || false;
    this.transport = config.transport || null;
    this.subscribers = [];

    // Validate level
    if (!Object.values(Logger.LEVELS).includes(this.level)) {
      throw new Error(`Invalid log level: ${this.level}`);
    }
  }

  /**
   * Logs a debug message
   *
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context data
   * @returns {void}
   */
  debug(message, context = {}) {
    this._log(Logger.LEVELS.DEBUG, message, context);
  }

  /**
   * Logs an info message
   *
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context data
   * @returns {void}
   */
  info(message, context = {}) {
    this._log(Logger.LEVELS.INFO, message, context);
  }

  /**
   * Logs a warning message
   *
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context data
   * @returns {void}
   */
  warn(message, context = {}) {
    this._log(Logger.LEVELS.WARN, message, context);
  }

  /**
   * Logs an error message
   *
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context data
   * @returns {void}
   */
  error(message, context = {}) {
    this._log(Logger.LEVELS.ERROR, message, context);
  }

  /**
   * Creates a child logger with inherited context
   *
   * @param {Object} childContext - Context to inherit
   * @param {string} [childContext.jobId] - Job ID for this logger
   * @param {string} [childContext.phase] - Phase name for this logger
   * @param {string} [childContext.agent] - Agent name for this logger
   * @returns {Logger} Child logger instance with inherited context
   */
  child(childContext = {}) {
    const childLogger = new Logger({
      name: this.name,
      level: this.level,
      async: this.async,
      transport: this.transport
    });

    // Inherit subscriber relationships
    childLogger.subscribers = this.subscribers;

    // Store context
    childLogger._context = childContext;

    return childLogger;
  }

  /**
   * Subscribes to all log events
   *
   * @param {Function} callback - Callback function(logEntry)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Logger.subscribe requires a function');
    }

    this.subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Internal logging implementation
   *
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Context data
   * @private
   */
  _log(level, message, context = {}) {
    // Check if this level should be logged
    if (!this._shouldLog(level)) {
      return;
    }

    // Build log entry
    const entry = this._buildLogEntry(level, message, context);

    // Emit to subscribers
    this._notifySubscribers(entry);

    // Use transport if provided
    if (this.transport) {
      if (this.async) {
        setImmediate(() => this.transport(entry));
      } else {
        this.transport(entry);
      }
    } else {
      // Default console output
      this._defaultOutput(entry);
    }
  }

  /**
   * Determines if a log level should be recorded
   *
   * @param {string} level - Log level to check
   * @returns {boolean} True if level should be logged
   * @private
   */
  _shouldLog(level) {
    const levels = [Logger.LEVELS.DEBUG, Logger.LEVELS.INFO, Logger.LEVELS.WARN, Logger.LEVELS.ERROR];
    const currentIndex = levels.indexOf(this.level);
    const checkIndex = levels.indexOf(level);
    return checkIndex >= currentIndex;
  }

  /**
   * Builds a structured log entry
   *
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @returns {Object} Structured log entry
   * @private
   */
  _buildLogEntry(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      msg: message,
      // Add inherited context
      ...(this._context || {}),
      // Add provided context
      ...context
    };

    return entry;
  }

  /**
   * Notifies all subscribers of a log entry
   *
   * @param {Object} entry - Log entry
   * @private
   */
  _notifySubscribers(entry) {
    for (const callback of this.subscribers) {
      try {
        callback(entry);
      } catch (error) {
        console.error(`[Logger] Subscriber error: ${error.message}`);
      }
    }
  }

  /**
   * Default console output for logs
   *
   * @param {Object} entry - Log entry
   * @private
   */
  _defaultOutput(entry) {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const jobContext = entry.jobId ? ` [${entry.jobId}]` : '';
    const phaseContext = entry.phase ? ` [${entry.phase}]` : '';

    const contextString = jobContext + phaseContext ? `${jobContext}${phaseContext} ` : ' ';

    switch (entry.level) {
      case Logger.LEVELS.DEBUG:
        console.debug(`${prefix}${contextString}${entry.msg}`, entry);
        break;
      case Logger.LEVELS.INFO:
        console.log(`${prefix}${contextString}${entry.msg}`, entry);
        break;
      case Logger.LEVELS.WARN:
        console.warn(`${prefix}${contextString}${entry.msg}`, entry);
        break;
      case Logger.LEVELS.ERROR:
        console.error(`${prefix}${contextString}${entry.msg}`, entry);
        break;
      default:
        console.log(`${prefix}${contextString}${entry.msg}`, entry);
    }
  }

  /**
   * Creates a logger bound to a specific job
   *
   * @param {string} jobId - Job ID
   * @param {string} [phase] - Phase name (optional)
   * @returns {Logger} Logger instance with job context
   */
  forJob(jobId, phase = null) {
    const context = { jobId };
    if (phase) {
      context.phase = phase;
    }
    return this.child(context);
  }

  /**
   * Creates a logger bound to a specific agent
   *
   * @param {string} agentName - Agent name
   * @returns {Logger} Logger instance with agent context
   */
  forAgent(agentName) {
    return this.child({ agent: agentName });
  }
}

export default Logger;
