const RECENT_LOG_MAX = 50;
const GLOBAL_LOGGER_KEY = Symbol.for('qa-agents.logger');

class AgentLogger {
  constructor() {
    this.callbacks = new Set();
    this.recentLogs = [];
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

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
    this.callbacks.forEach(cb => {
      try {
        cb(logEntry);
      } catch (err) {
        console.error('[AgentLogger] Callback error:', err);
      }
    });
  }
}

if (!globalThis[GLOBAL_LOGGER_KEY]) {
  globalThis[GLOBAL_LOGGER_KEY] = new AgentLogger();
}

export const agentLogger = globalThis[GLOBAL_LOGGER_KEY];
