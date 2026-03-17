import Agent from './Agent.js';
import { createCognitiveSystem } from './index.js';

/**
 * Senior Engineer Agent
 * Wraps the LangGraph-based Cognitive Supervisor as a standard Agent.
 */
export class SeniorEngineerAgent extends Agent {
  constructor(config = {}) {
    super({
      id: 'agent-senior-engineer',
      name: 'Senior Software Engineer (Cognitive)',
      version: '1.5.0-agentic',
      capabilities: [
        'autonomous-planning',
        'cognitive-orchestration',
        'strategic-testing',
        'memory-retrieval',
        'result-evaluation'
      ],
      ...config,
    });
    
    // Instantiate the underlying cognitive system
    const { supervisor, memory, skills } = createCognitiveSystem();
    this.supervisor = supervisor;
    this.memory = memory;
    this.skills = skills;
  }

  /**
   * Run a job using the cognitive supervisor (LangGraph)
   */
  async runJob(job) {
    const { 
      jobId, 
      target, 
      config = {},
      onStepStart = () => {},
      onStepEnd = () => {}
    } = job;

    // The SupervisorAgent.run method handles the LangGraph execution
    // It already logs to agentLogger via its internal nodes
    const finalState = await this.supervisor.run(jobId, target, null, null, config);

    // Convert LangGraph final state to Agent-compliant report
    const results = finalState.results || [];
    const steps = [];
    
    // 1. Strategic Planning Analytics
    steps.push({
        name: 'Strategic Mission Planning',
        status: 'pass',
        message: `Architected an autonomous mission for ${target} with ${finalState.plan?.length || 0} tactical operations.`,
        duration: 0,
        metadata: {
            plan: finalState.plan?.map(p => p.skill),
            siteProfile: finalState.siteProfile
        }
    });

    // 2. Tactical Execution Results
    for (const r of results) {
       const skillName = r.skill.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
       steps.push({
         name: `${skillName} Operation`,
         status: (r.status === 'error' || r.status === 'fail') ? 'fail' : 'pass',
         message: r.error || (r.data?.message) || `Successfully completed ${r.skill} tactical phase.`,
         duration: r.data?.duration || 0,
         screenshot: r.data?.screenshot || (r.data?.results?.[0]?.screenshot),
         s3Key: r.data?.s3Key || (r.data?.results?.[0]?.s3Key),
         metadata: r.data
       });
    }

    // 3. Post-Mission Evaluation
    steps.push({
        name: 'Cognitive Evaluation',
        status: finalState.overallStatus === 'pass' ? 'pass' : 'fail',
        message: finalState.overallStatus === 'pass' 
            ? 'Mission objectives achieved. Intelligence updated in long-term memory.'
            : 'Mission objectives partially failed. Analyzing failure vectors for self-healing...',
        duration: 0
    });

    return {
      jobId,
      agentId: this.id,
      agentName: this.name,
      agentVersion: this.version,
      type: job.type || (target.includes('/') ? 'url' : 'domain'),
      target,
      timestamp: new Date().toISOString(),
      overallStatus: finalState.overallStatus || (steps.some(s => s.status === 'fail') ? 'fail' : 'pass'),
      summary: {
        passed: steps.filter(s => s.status === 'pass').length,
        partial: 0,
        failed: steps.filter(s => s.status === 'fail').length,
        skipped: 0,
        total: steps.length
      },
      steps,
      metadata: {
        ...finalState.metadata,
        cognitive: true,
        missionParameters: config,
        swarmEfficiency: finalState.metadata?.swarmEfficiency || 100,
        articlesScanned: finalState.metadata?.articlesScanned || 1
      }
    };
  }
}

export default SeniorEngineerAgent;
