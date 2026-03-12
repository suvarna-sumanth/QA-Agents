import Agent from './Agent.js';
import os from 'os';

export class SwarmOrchestrator extends Agent {
  constructor(config = {}) {
    super(config);
    // Use single browser with sequential processing to reduce resource usage
    // Set maxParallel to 1 to process articles one at a time using the same pooled browser
    const cpuCount = config.maxParallel || 1;
    this.maxParallel = cpuCount;
    this.subAgents = new Map();
    this.events = [];
    console.log(`[Swarm] Initialized with maxParallel=${this.maxParallel} (detected ${os.cpus().length} CPUs)`);
  }

  logEvent(component, message, data = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      component,
      message,
      ...data
    };
    this.events.push(event);
    console.log(`[Swarm][${component}] ${message}`);
  }

  /**
   * Register a sub-agent with the swarm.
   */
  registerSubAgent(role, agent) {
    this.subAgents.set(role, agent);
  }

  /**
   * Execute a task across a pool of sub-agents in parallel.
   * @param {Array} items - Items to process
   * @param {Function} taskFn - The task to run (item => result)
   * @returns {Promise<Array>} Aggregated results
   */
  async runInParallel(items, taskFn) {
    const results = [];
    const queue = [...items];
    
    const workers = Array(Math.min(this.maxParallel, queue.length))
      .fill(null)
      .map(async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          try {
            const result = await taskFn(item);
            results.push(result);
          } catch (err) {
            console.error(`[Swarm] Worker error:`, err);
            results.push({ error: err.message, item });
          }
        }
      });

    await Promise.all(workers);
    return results;
  }

  /**
   * Standardized aggregation for swarm reports.
   */
  aggregateReports(reports, missionStart) {
    const summary = { passed: 0, partial: 0, failed: 0, skipped: 0, total: 0 };
    const allSteps = [];
    const wallTime = Date.now() - missionStart;
    let totalWorkerTime = 0;
    
    for (const report of reports) {
      if (!report) continue;
      
      summary.passed += report.summary?.passed || 0;
      summary.partial += report.summary?.partial || 0;
      summary.failed += report.summary?.failed || 0;
      summary.skipped += report.summary?.skipped || 0;
      summary.total += report.summary?.total || 0;
      
      if (report.duration) {
        totalWorkerTime += report.duration;
      }

      if (Array.isArray(report.steps)) {
        allSteps.push(...report.steps);
      }
    }

    const efficiency = wallTime > 0 ? (totalWorkerTime / wallTime) * 100 : 0;

    return { 
      summary, 
      steps: allSteps,
      telemetry: {
        wallTime,
        totalWorkerTime,
        swarmEfficiency: Math.min(efficiency, 100 * this.maxParallel),
        speedupFactor: wallTime > 0 ? (totalWorkerTime / wallTime).toFixed(2) : '1.00'
      }
    };
  }
}

export default SwarmOrchestrator;
