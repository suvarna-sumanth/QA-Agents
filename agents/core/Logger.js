/**
 * Centralized logging for cognitive agents.
 * Supports real-time stream callbacks and a recent-log buffer for dashboard polling.
 */
const RECENT_LOG_MAX = 50;

class AgentLogger {
  constructor() {
    this.callbacks = new Set();
    this.recentLogs = [];
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get recent log entries for polling (e.g. by jobId). Newest first.
   * @param {string} [jobId] - If provided, only logs for this job; otherwise last N globally.
   * @param {number} [limit=20] - Max entries to return.
   */
  getRecentLogs(jobId, limit = 20) {
    let list = this.recentLogs;
    if (jobId) {
      list = list.filter((e) => e.jobId === jobId);
    }
    return list.slice(-limit).reverse();
  }

  log(component, message, jobId = 'system') {
    const logEntry = {
      time: new Date().toLocaleTimeString(),
      msg: message,
      type: component,
      jobId,
      timestamp: Date.now()
    };

    console.log(`[${component}] ${message}`);
    this.recentLogs.push(logEntry);
    if (this.recentLogs.length > RECENT_LOG_MAX) {
      this.recentLogs.shift();
    }
    this.callbacks.forEach(cb => cb(logEntry));
  }
}

export const agentLogger = new AgentLogger();
