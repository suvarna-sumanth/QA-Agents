import Agent from '../../core/Agent.js';
import { discoverArticles } from './discover.js';

export class DiscoveryAgent extends Agent {
  constructor(config = {}) {
    super({
      id: 'discovery-agent',
      name: 'Swarm Discovery Specialist',
      version: '1.0.0',
      capabilities: ['domain-crawl', 'sitemap-extraction', 'rss-extraction', 'llm-link-filtering'],
      ...config
    });
  }

  async runJob(job) {
    const { target, config = {} } = job;
    const maxArticles = config.maxArticles || 10;
    
    const startTime = Date.now();
    const urls = await discoverArticles(target, maxArticles);
    const duration = Date.now() - startTime;

    return {
      agentId: this.id,
      status: urls.length > 0 ? 'pass' : 'skip',
      urls,
      duration,
      summary: {
        total: 1,
        passed: urls.length > 0 ? 1 : 0,
        skipped: urls.length === 0 ? 1 : 0,
        failed: 0
      },
      steps: [{
        name: 'Article Discovery',
        status: urls.length > 0 ? 'pass' : 'skip',
        message: `Discovered ${urls.length} articles on ${target}`,
        duration
      }]
    };
  }
}

export default DiscoveryAgent;
