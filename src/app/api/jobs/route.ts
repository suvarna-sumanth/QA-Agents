/**
 * POST /api/jobs
 * Submit a new job to the Cognitive Agent or QA Parent Agent
 * Supports both old and new API formats with LegacyAPIAdapter
 *
 * GET /api/jobs
 * List recent jobs (Now queries from Supabase if available)
 */

export const dynamic = 'force-dynamic';

import { supabase } from '../../../../agents/core/memory/supabase-client.js';
import { existsSync } from 'fs';
import path from 'path';
import { jobRegistry } from '@/lib/jobRegistry';

// Phase 4: New monitoring and adapter classes
let cachedMonitoring: any = null;

async function getMonitoring() {
  if (cachedMonitoring) return cachedMonitoring;

  try {
    const indexPath = path.resolve(process.cwd(), 'agents', 'core', 'index.js');
    const mod = await import(/* webpackIgnore: true */ indexPath);
    cachedMonitoring = {
      Metrics: mod.Metrics,
      Logger: mod.Logger,
      LegacyAPIAdapter: mod.LegacyAPIAdapter
    };
  } catch (error) {
    console.warn('[API] Failed to load monitoring classes:', error.message);
    cachedMonitoring = { Metrics: null, Logger: null, LegacyAPIAdapter: null };
  }

  return cachedMonitoring;
}

let cachedCognitiveSystem: any = null;

async function getCognitiveSystem() {
  if (cachedCognitiveSystem) return cachedCognitiveSystem;

  // Construct path at runtime so Webpack cannot statically analyze it
  const indexPath = path.resolve(process.cwd(), 'agents', 'core', 'index.js');
  const mod = await import(/* webpackIgnore: true */ indexPath);
  cachedCognitiveSystem = mod.createCognitiveSystem();
  return cachedCognitiveSystem;
}

async function uploadScreenshotsToS3(report: any, jobId: string, agentId: string) {
  try {
    const { storage } = await import('@/lib/storage');
    // Ensure we use the specialized sync logic which handles all various report structures
    await storage.syncReportScreenshots(agentId, jobId, report);
    console.log(`[S3] Successfully synced all report artifacts for ${jobId}`);
  } catch (err) {
    console.error(`[S3] Critical failure during artifact sync:`, err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, type, target, config = {}, id, url, depth } = body;

    // Phase 4: Support both old and new API formats
    const isOldFormat = Boolean(id && url && !agentId && !target);
    const jobId = isOldFormat ? id : `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const targetUrl = isOldFormat ? url : target;

    if (!targetUrl) {
      return Response.json({ success: false, error: 'Missing target URL/Domain' }, { status: 400 });
    }

    // Phase 4: Load monitoring
    const { Metrics, Logger, LegacyAPIAdapter } = await getMonitoring();
    const metrics = Metrics ? new Metrics() : null;
    const logger = Logger ? new Logger({ name: 'API', level: 'info' }) : null;

    // Optional: Log to local memory registry for fast dashboard UI updates
    jobRegistry.set(jobId, {
      jobId,
      agentId: agentId || 'cognitive-supervisor',
      type: (type as 'domain' | 'url') || 'url',
      target: targetUrl,
      status: 'queued',
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      isOldFormat: isOldFormat ? true : undefined
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

        // Phase 4: Use LegacyAPIAdapter for old format, or new agent system for new format
        if (isOldFormat && LegacyAPIAdapter) {
          try {
            logger?.info(`[API] Processing old format job ${jobId}`, { jobId, url });

            // Get the parent agent from registry
            const parentAgent = registry.getAgent('qa-parent');
            if (parentAgent && LegacyAPIAdapter) {
              const adapter = new LegacyAPIAdapter({
                parentAgent,
                logger,
                metrics
              });

              finalState = await adapter.executeJob({
                id: jobId,
                url: targetUrl,
                depth: depth || 2,
                options: config
              });

              logger?.info(`[API] Old format job ${jobId} completed`, { jobId, status: finalState.status });
            } else {
              throw new Error('Parent agent not available for legacy adapter');
            }
          } catch (adapterError) {
            logger?.error(`[API] Legacy adapter failed for job ${jobId}`, { jobId, error: adapterError.message });
            // Fallback to cognitive supervisor
            const system: any = await getCognitiveSystem();
            finalState = await system.supervisor.run(jobId, targetUrl, null, null, config);
          }
        } else {
          // New format - use registered agent or fallback
          const requestedAgent = registry.getAgent(agentId);

          if (requestedAgent && typeof requestedAgent.runJob === 'function') {
            logger?.info(`[API] Using registered agent: ${requestedAgent.name}`, { jobId, agentId });
            finalState = await requestedAgent.runJob({
              jobId,
              type,
              target: targetUrl,
              config,
              onStepStart: (name: string, meta: any) => {},
              onStepEnd: (name: string, res: any) => {}
            });
          } else {
            logger?.info(`[API] Falling back to default Cognitive Supervisor`, { jobId });
            const system: any = await getCognitiveSystem();
            finalState = await system.supervisor.run(jobId, targetUrl, null, null, config);
          }
        }

        // Try to upload screenshots found in the state
        await uploadScreenshotsToS3(finalState, jobId, agentId || 'cognitive-supervisor');

        jobRegistry.set(jobId, {
          ...jobRegistry.get(jobId)!,
          status: 'completed',
          report: finalState,
          lastUpdate: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger?.error(`[API] Job ${jobId} failed`, { jobId, error: err instanceof Error ? err.message : String(err) });
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
