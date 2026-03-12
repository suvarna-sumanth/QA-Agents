import Agent from '../../core/Agent.js';
import { detectPlayer } from './detect.js';

export class DetectionAgent extends Agent {
  constructor(config = {}) {
    super({
      id: 'detection-agent',
      name: 'Swarm Detection Specialist',
      version: '1.0.0',
      capabilities: ['player-detection', 'observation-screenshot', 'bypass-challenges'],
      ...config
    });
  }

  /**
   * Run detection on a batch of URLs (usually 1 in swarm mode)
   */
  async runJob(job) {
    const { target, urls = [], sharedBrowser } = job;
    const urlsToTest = urls.length > 0 ? urls : [target];
    
    const startTime = Date.now();
    const results = await detectPlayer(urlsToTest, sharedBrowser);
    const duration = Date.now() - startTime;

    const summary = { total: results.length, passed: 0, failed: 0, skipped: 0 };
    const steps = results.map((res, i) => {
      if (res.hasPlayer) summary.passed++;
      else summary.failed++;

      return {
        id: `detect-${Date.now()}-${i}`,
        name: 'Player Detection',
        status: res.hasPlayer ? 'pass' : 'fail',
        message: res.hasPlayer 
          ? `Detected player at ${res.url}` 
          : `No player found at ${res.url}. Visual evidence captured.`,
        duration: Math.floor(duration / results.length),
        screenshot: res.screenshot,
        url: res.url,
        hasPlayer: res.hasPlayer
      };
    });

    return {
      agentId: this.id,
      overallStatus: summary.failed === 0 ? 'pass' : 'partial',
      summary,
      steps,
      results,
      duration
    };
  }
}

export default DetectionAgent;
