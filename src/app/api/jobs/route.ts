/**
 * POST /api/jobs
 * Submit a new job to an agent
 *
 * GET /api/jobs
 * List recent job

s
 */

// In-memory job queue and registry (MVP)
// In production, use Redis, BullMQ, or similar
export const jobRegistry = new Map<
  string,
  {
    jobId: string;
    agentId: string;
    type: 'domain' | 'url';
    target: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    currentStep?: string;
    createdAt: string;
    lastUpdate: string;
    completedAt?: string;
    report?: any;
    error?: string;
  }
>();

import { bootstrapAgents } from '@/lib/bootstrap-loader';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Dynamically import browser.js at runtime using path.resolve + webpackIgnore
 * to prevent Turbopack from statically analyzing and bundling playwright modules.
 */
async function getBrowserModule() {
  try {
    const browserPath = path.resolve(process.cwd(), 'agents', 'shivani', 'src', 'browser.js');
    return await import(/* webpackIgnore: true */ browserPath);
  } catch {
    return null;
  }
}

async function uploadScreenshotsToS3(report: any, jobId: string, agentId: string) {
  try {
    const { getStorage } = await import('@/lib/storage');
    const storage = getStorage();

    // Track unique local paths we've already uploaded
    const uploaded = new Map<string, string>(); // localPath -> s3Key

    for (let i = 0; i < (report.steps || []).length; i++) {
      const step = report.steps[i];
      const localPath = step.screenshot;

      if (!localPath || typeof localPath !== 'string') continue;
      // Skip if already an S3 URL
      if (localPath.startsWith('s3://') || localPath.startsWith('http')) continue;
      // Skip if file doesn't exist locally
      if (!existsSync(localPath)) continue;

      // Re-use if same file already uploaded
      if (uploaded.has(localPath)) {
        step.s3Key = uploaded.get(localPath);
        continue;
      }

      try {
        const result = await storage.saveScreenshot(agentId, jobId, localPath, i);
        step.s3Key = result.key;
        uploaded.set(localPath, result.key);
        console.log(`[S3] Uploaded screenshot for step ${i}: ${result.key}`);
        
        // CLEANUP: Delete local file after successful upload
        try {
          const { unlinkSync } = await import('fs');
          unlinkSync(localPath);
        } catch (unlinkErr) {
          console.warn(`[Cleanup] Failed to delete local screenshot ${localPath}:`, unlinkErr);
        }
      } catch (err) {
        console.warn(`[S3] Failed to upload screenshot for step ${i}:`, err);
      }
    }

    // Upload the report itself
    try {
      await storage.saveReport(agentId, jobId, report);
      console.log(`[S3] Report saved for job ${jobId}`);
    } catch (err) {
      console.warn(`[S3] Failed to save report:`, err);
    }
  } catch (err) {
    console.warn(`[S3] Storage not available, screenshots remain local:`, err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, type, target, config = {} } = body;

    // Validate input
    if (!agentId || !type || !target) {
      return Response.json(
        {
          success: false,
          error: 'Missing required fields: agentId, type, target',
        },
        { status: 400 }
      );
    }

    if (!['domain', 'url'].includes(type)) {
      return Response.json(
        {
          success: false,
          error: 'Invalid type. Must be "domain" or "url"',
        },
        { status: 400 }
      );
    }

    // Get agent from registry
    const { registry } = await bootstrapAgents();
    const agent = registry.getAgent(agentId);

    if (!agent) {
      return Response.json(
        {
          success: false,
          error: `Agent "${agentId}" not found`,
        },
        { status: 404 }
      );
    }

    // Create job descriptor
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const job = {
      jobId,
      type,
      target,
      config,
      onStepStart: (stepName: string, metadata: any) => {
        const existing = jobRegistry.get(jobId);
        if (existing) {
          jobRegistry.set(jobId, {
            ...existing,
            currentStep: stepName,
            status: 'running',
            lastUpdate: new Date().toISOString(),
          });
        }
      },
      onStepEnd: (stepName: string, result: any) => {
        const existing = jobRegistry.get(jobId);
        if (existing) {
          jobRegistry.set(jobId, {
            ...existing,
            status: 'running',
            lastUpdate: new Date().toISOString(),
          });
        }
      },
      onError: (error: Error, context: any) => {
        console.error(`[Job ${jobId}] Error in ${context.phase}:`, error.message);
      },
    };

    // Register job as queued
    jobRegistry.set(jobId, {
      jobId,
      agentId,
      type: type as 'domain' | 'url',
      target,
      status: 'queued',
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    });

    // Run job asynchronously (MVP: no queue, direct execution)
    // In production, push to Redis queue instead
    (async () => {
      try {
        jobRegistry.set(jobId, {
          ...jobRegistry.get(jobId)!,
          status: 'running',
          lastUpdate: new Date().toISOString(),
        });

        const report = await agent.runJob(job);

        // Upload screenshots to S3 and save report
        await uploadScreenshotsToS3(report, jobId, agentId);

        // Close pooled browsers after job completes to free resources
        // This ensures browsers don't stay open indefinitely
        // Only attempt cleanup at runtime (not during build)
        try {
          const browserModule = await getBrowserModule();
          if (browserModule?.closeBrowserForType) {
            await browserModule.closeBrowserForType('perimeterx').catch(() => {});
            await browserModule.closeBrowserForType('cloudflare').catch(() => {});
          }
        } catch {
          // Silently ignore cleanup errors - browser pool will cleanup on app exit
        }

        jobRegistry.set(jobId, {
          ...jobRegistry.get(jobId)!,
          status: 'completed',
          report,
          lastUpdate: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        jobRegistry.set(jobId, {
          ...jobRegistry.get(jobId)!,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          lastUpdate: new Date().toISOString(),
        });

        // Also try to cleanup browsers on failure
        try {
          const browserModule = await getBrowserModule();
          if (browserModule?.closeBrowserForType) {
            await browserModule.closeBrowserForType('perimeterx').catch(() => {});
            await browserModule.closeBrowserForType('cloudflare').catch(() => {});
          }
        } catch {
          // Silently ignore cleanup errors
        }
      }
    })();

    return Response.json(
      {
        success: true,
        jobId,
        status: 'queued',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API] POST /api/jobs error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return list of recent jobs
    const jobs = Array.from(jobRegistry.values());

    return Response.json(
      {
        success: true,
        jobs: jobs.slice(-20), // Return last 20 jobs
        count: jobs.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/jobs error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
