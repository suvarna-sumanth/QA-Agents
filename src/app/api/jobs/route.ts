/**
 * POST /api/jobs
 * Submit a new job to the Cognitive Agent
 *
 * GET /api/jobs
 * List recent jobs (Now queries from Supabase if available)
 */

export const dynamic = 'force-dynamic';

import { supabase } from '../../../../agents/core/memory/supabase-client.js';
import { existsSync } from 'fs';

// Instantiate the cognitive system dynamically to bypass Next.js Webpack bundling Playwright
let cognitiveSystemCache: any = null;

async function getCognitiveSystem() {
  if (cognitiveSystemCache) return cognitiveSystemCache;
  try {
    const mod = await import('../../../../agents/core/index.js');
    cognitiveSystemCache = mod.createCognitiveSystem();
    return cognitiveSystemCache;
  } catch (err) {
    console.error('[API] Error loading cognitive system:', err);
    throw err;
  }
}

import { jobRegistry } from '@/lib/jobRegistry';

async function uploadScreenshotsToS3(report: any, jobId: string, agentId: string) {
  try {
    const { getStorage } = await import('@/lib/storage');
    const storage = getStorage();

    const uploaded = new Map<string, string>();

    // The new agent's report structure might be deeply nested in results
    const results = report?.results || [];
    
    let stepIndex = 0;
    for (const result of results) {
      // test_player: data.report.steps[].screenshot
      const reportSteps = result.data?.report?.steps;
      if (reportSteps && Array.isArray(reportSteps)) {
        for (const step of reportSteps) {
          const localPath = step.screenshot;
          if (!localPath || typeof localPath !== 'string') continue;
          if (localPath.startsWith('s3://') || localPath.startsWith('http')) continue;
          if (!existsSync(localPath)) continue;
          if (uploaded.has(localPath)) {
            step.s3Key = uploaded.get(localPath);
            continue;
          }
          try {
            const s3Result = await storage.saveScreenshot(agentId, jobId, localPath, stepIndex++);
            step.s3Key = s3Result.key;
            uploaded.set(localPath, s3Result.key);
            console.log(`[S3] Uploaded screenshot: ${s3Result.key}`);
            try {
              const { unlinkSync } = await import('fs');
              if (existsSync(localPath)) unlinkSync(localPath);
            } catch (e) {}
          } catch (err) {
            console.warn(`[S3] Failed to upload:`, err);
          }
        }
        continue;
      }
      // detect_player or other: data.results[].screenshot
      if (!result.data || !result.data.results) continue;
      for (const step of result.data.results) {
        const localPath = step.screenshot;

        if (!localPath || typeof localPath !== 'string') continue;
        if (localPath.startsWith('s3://') || localPath.startsWith('http')) continue;
        if (!existsSync(localPath)) continue;

        if (uploaded.has(localPath)) {
          step.s3Key = uploaded.get(localPath);
          continue;
        }

        try {
          const s3Result = await storage.saveScreenshot(agentId, jobId, localPath, stepIndex++);
          step.s3Key = s3Result.key;
          uploaded.set(localPath, s3Result.key);
          console.log(`[S3] Uploaded screenshot: ${s3Result.key}`);
          
          try {
            const { unlinkSync } = await import('fs');
            if (existsSync(localPath)) {
              unlinkSync(localPath);
            }
          } catch (e) {}
        } catch (err) {
          console.warn(`[S3] Failed to upload:`, err);
        }
      }
    }

    try {
      await storage.saveReport(agentId, jobId, report);
    } catch (err) {}
  } catch (err) {
    console.warn(`[S3] Storage not available:`, err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, type, target, config = {} } = body;

    if (!target) {
      return Response.json({ success: false, error: 'Missing target URL/Domain' }, { status: 400 });
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Optional: Log to local memory registry for fast dashboard UI updates
    jobRegistry.set(jobId, {
      jobId,
      agentId: agentId || 'cognitive-supervisor',
      type: type as 'domain' | 'url',
      target,
      status: 'queued',
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    });

    // Run asynchronously
    (async () => {
      jobRegistry.set(jobId, { ...jobRegistry.get(jobId)!, status: 'running' });

      let unsubscribe: any;
      try {
        // Dynamically load the agent registry and logger
        const { bootstrapAgents } = await import('../../../lib/bootstrap-loader');
        const { registry } = await bootstrapAgents();
        const { agentLogger } = await import('../../../../agents/core/Logger.js');

        // Subscribe local registry to live updates
        unsubscribe = agentLogger.subscribe((log: any) => {
          if (log.jobId === jobId) {
            const entry = jobRegistry.get(jobId);
            if (entry) {
              jobRegistry.set(jobId, {
                ...entry,
                currentStep: log.msg,
                lastUpdate: new Date().toISOString()
              });
            }
          }
        });

        let finalState;
        const requestedAgent = registry.getAgent(agentId);
        
        if (requestedAgent && typeof requestedAgent.runJob === 'function') {
           console.log(`[API] Using registered agent: ${requestedAgent.name}`);
           finalState = await requestedAgent.runJob({ 
             jobId, 
             type, 
             target, 
             config,
             // Map callbacks if the agent supports them
             onStepStart: (name: string, meta: any) => {},
             onStepEnd: (name: string, res: any) => {}
           });
        } else {
           console.log(`[API] Falling back to default Cognitive Supervisor`);
           // The Cognitive Agent handles its own state graph (config.maxArticles = Mission Payload Depth)
           const system: any = await import('../../../../agents/core/index.js').then(m => m.createCognitiveSystem());
           finalState = await system.supervisor.run(jobId, target, null, null, config);
        }

        // Try to upload screenshots found in the state
        await uploadScreenshotsToS3(finalState, jobId, agentId || 'cognitive-supervisor');

        jobRegistry.set(jobId, {
          ...jobRegistry.get(jobId)!,
          status: 'completed',
          report: finalState, // Mount the LangGraph state as the report
          lastUpdate: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`[API] Job ${jobId} failed:`, err);
        jobRegistry.set(jobId, {
          ...jobRegistry.get(jobId)!,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          lastUpdate: new Date().toISOString(),
        });
      } finally {
        if (typeof unsubscribe === 'function') unsubscribe();
      }
    })();

    return Response.json({ success: true, jobId, status: 'queued' }, { status: 202 });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    // If Supabase is connected, we can fetch real test history
    if (supabase) {
      const { data, error } = await supabase
        .from('test_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (!error && data && data.length > 0) {
        // Map DB rows to Dashboard format
        const dbJobs = data.map((row: any) => ({
          jobId: row.job_id,
          target: row.url,
          status: row.overall_status === 'pass' ? 'completed' : 
                 (row.overall_status === 'error' ? 'failed' : 'completed'),
          createdAt: row.created_at,
          report: row,
        }));
        
        return Response.json({ success: true, jobs: dbJobs, count: dbJobs.length }, { status: 200 });
      }
    }

    // Fallback to in-memory registry
    const jobs = Array.from(jobRegistry.values());
    return Response.json({ success: true, jobs: jobs.slice(-20), count: jobs.length }, { status: 200 });
  } catch (error) {
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
