/**
 * Agent Shivani - Swarm Orchestrator
 * Orchestrates specialized sub-agents for discovery, detection, and testing.
 */

import SwarmOrchestrator from '../../core/SwarmOrchestrator.js';
import DiscoveryAgent from './DiscoveryAgent.js';
import DetectionAgent from './DetectionAgent.js';
import FunctionalAgent from './FunctionalAgent.js';
import { launchForUrl, cleanupBrowserPool } from './browser.js';

export class AgentShivani extends SwarmOrchestrator {
  constructor(config = {}) {
    super({
      id: 'agent-shivani',
      name: 'Shivani Swarm Orchestrator',
      version: '2.1.0-swarm-live',
      capabilities: [
        'swarm-orchestration',
        'parallel-detection',
        'unified-reporting',
        'live-telemetry'
      ],
      ...config,
    });

    // Initialize Sub-Agents
    this.registerSubAgent('discovery', new DiscoveryAgent(config));
    this.registerSubAgent('detection', new DetectionAgent(config));
    this.registerSubAgent('functional', new FunctionalAgent(config));

    this.defaultConfig = {
      maxArticles: 10,
      maxParallel: 3,
      ...config,
    };

    console.log(`[Shivani] Swarm Orchestrator v${this.version} initialized at ${new Date().toISOString()}`);
  }

  async runJob(job) {
    this.events = []; // Clear for new job
    const {
      jobId,
      type = 'url',
      target,
      config = {},
      onStepStart = () => {},
      onStepEnd = () => {},
      onError = () => {},
    } = job;

    this.logEvent('Orchestrator', `Initializing swarm mission for ${target}`, { jobId, type });

    const startTime = Date.now();
    const report = {
      jobId,
      agentId: this.id,
      type,
      target,
      timestamp: new Date().toISOString(),
      overallStatus: 'pass',
      summary: { passed: 0, partial: 0, failed: 0, skipped: 0, total: 0 },
      steps: [],
      metadata: {
        swarmMode: true,
        agentVersion: this.version,
        testedUrls: [],
        swarmEvents: this.events
      },
    };

    let sharedBrowser = null;

    try {
      // 1. Discovery Phase
      let urlsToTest = [];
      if (type === 'url') {
        urlsToTest = [target];
        this.logEvent('Discovery', `Single URL mode active for ${target}`);
      } else {
        this.logEvent('Discovery', `Starting article discovery for domain ${target}`);
        onStepStart('swarm-discovery', { target });
        const discResult = await this.subAgents.get('discovery').runJob({ target, config });
        urlsToTest = discResult?.urls || [];
        this.logEvent('Discovery', `Discovered ${urlsToTest.length} URLs to test`);
        if (Array.isArray(discResult?.steps)) {
          report.steps.push(...discResult.steps.map(s => ({ ...s, name: `[Discovery] ${s.name}` })));
        }
        onStepEnd('swarm-discovery', { count: urlsToTest.length });
      }

      report.metadata.testedUrls = urlsToTest;

      // MISSION RESOURCE ALLOCATION: Launch one shared browser for detection + functional phases
      if (urlsToTest.length > 0) {
        sharedBrowser = await launchForUrl(urlsToTest[0]);
      }

      // 2. Parallel Detection Phase
      this.logEvent('Detection', `Starting parallel player detection for ${urlsToTest.length} targets`);
      onStepStart('swarm-detection', { urls: urlsToTest.length });
      
      const detectionResults = await this.runInParallel(urlsToTest, async (url) => {
        return this.subAgents.get('detection').runJob({ target: url, sharedBrowser });
      });
      
      const flatDetectionResults = (detectionResults || []).flatMap(r => r?.results || []); 
      const articlesWithPlayer = flatDetectionResults.filter(r => r?.hasPlayer); 
      this.logEvent('Detection', `Detection phase complete. ${articlesWithPlayer.length} players found.`);
      
      onStepEnd('swarm-detection', { detected: articlesWithPlayer.length });

      // 3. Parallel Functional Phase
      this.logEvent('Functional', `Starting deep-dive interaction testing for ${articlesWithPlayer.length} players`);
      onStepStart('swarm-functional', { urls: urlsToTest.length });
      
      const testReports = await this.runInParallel(urlsToTest, async (url) => {
        try {
          const detection = flatDetectionResults.find(d => d && d.url === url);
          
          if (detection?.hasPlayer) {
            return this.subAgents.get('functional').runJob({ 
              target: url, 
              playerSelector: detection.playerSelector,
              sharedBrowser
            });
          } else {
            // Context fallthrough: find the detection step for the failure report
            const detectStep = (detectionResults || [])
              .filter(dr => dr && Array.isArray(dr.steps))
              .flatMap(dr => dr.steps)
              .find(s => s && s.url === url);

            return {
              url,
              overallStatus: 'fail',
              summary: { passed: 0, failed: 1, skipped: 0, total: 1 },
              steps: [{
                ...(detectStep || {}),
                name: 'Player Availability Check',
                status: 'fail',
                message: 'No instaread-player detected. Observation mode active.',
                url
              }]
            };
          }
        } catch (workerErr) {
          return { error: workerErr.message, url };
        }
      });

      // 4. Aggregation & Telemetry
      const swarmData = this.aggregateReports(testReports, startTime);
      
      for (const tReport of testReports) {
        if (!tReport || tReport.error) {
          report.steps.push({
            name: `[Error] ${tReport?.url || target}`,
            status: 'fail',
            message: tReport?.error || 'Worker execution failed',
            duration: 0
          });
          continue;
        }

        const urlObj = new URL(tReport.url || target);
        const articlePath = urlObj.pathname.replace(/\/$/, '').split('/').pop() || urlObj.hostname;
        
        if (Array.isArray(tReport.steps)) {
          for (const step of tReport.steps) {
            report.steps.push({
              ...step,
              name: `[${articlePath}] ${step.name}`,
            });
          }
        }
      }

      report.summary = swarmData.summary;
      report.overallStatus = report.summary.failed > 0 ? 'fail' : 'pass';
      report.metadata.swarmEfficiency = swarmData.telemetry.swarmEfficiency;
      report.metadata.speedupFactor = swarmData.telemetry.speedupFactor;
      
      onStepEnd('swarm-execution', { 
        status: report.overallStatus,
        efficiency: `${report.metadata.swarmEfficiency.toFixed(1)}%`
      });
      report.duration = Date.now() - startTime;
      
      return report;
    } catch (err) {
      console.error(`[Shivani] Mission Crash: ${err.message}`, err.stack);
      onError(err, { phase: 'swarm-orchestration' });
      report.overallStatus = 'error';
      report.steps.push({
        name: 'Swarm Crash',
        status: 'fail',
        message: err.message,
        duration: Date.now() - startTime
      });
      return report;
    } finally {
      // ABSOLUTE CLEANUP: Force-close ALL pooled browsers after every mission
      // sharedBrowser.cleanup() is a no-op for pooled instances, so we must
      // explicitly close the entire browser pool to free Chrome processes.
      try {
        await cleanupBrowserPool();
        this.logEvent('Resource', 'All browsers closed after mission');
      } catch (cleanupErr) {
        console.error('[Shivani] Cleanup error:', cleanupErr);
      }
    }
  }
}

export default AgentShivani;
