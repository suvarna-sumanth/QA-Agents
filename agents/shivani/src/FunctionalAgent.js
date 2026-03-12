import Agent from '../../core/Agent.js';
import { testPlayer } from './test-player.js';

export class FunctionalAgent extends Agent {
  constructor(config = {}) {
    super({
      id: 'functional-agent',
      name: 'Swarm Interaction Specialist',
      version: '1.0.0',
      capabilities: ['interaction-testing', 'play-seek-speed', 'ad-verification'],
      ...config
    });
  }

  async runJob(job) {
    const { target, playerSelector = 'instaread-player', sharedBrowser } = job;
    
    const startTime = Date.now();
    const testReport = await testPlayer(target, playerSelector, sharedBrowser);
    const duration = Date.now() - startTime;

    return {
      agentId: this.id,
      url: target,
      overallStatus: testReport.overallStatus,
      summary: testReport.summary,
      steps: testReport.steps,
      duration
    };
  }
}

export default FunctionalAgent;
