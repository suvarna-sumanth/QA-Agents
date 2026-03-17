/**
 * GET /api/jobs/status
 * Returns the current running job (if any), recent live logs, and progress for the dashboard.
 */

import { jobRegistry } from '@/lib/jobRegistry';

export const dynamic = 'force-dynamic';

function deriveProgress(currentStep: string | null): number {
  if (!currentStep) return 0;
  const s = (currentStep || '').toLowerCase();
  if (s.includes('planning') || s.includes('strategic')) return 5;
  if (s.includes('discover') || s.includes('exploration')) return 15;
  if (s.includes('detect') || s.includes('availability')) return 35;
  if (s.includes('test') || s.includes('functional')) return 70;
  if (s.includes('evaluating') || s.includes('cognitive')) return 95;
  if (s.includes('expand')) return 25;
  return 50;
}

export async function GET() {
  const jobs = Array.from(jobRegistry.values());
  const running = jobs.find((j) => j.status === 'running');
  let recentLogs: Array<{ time: string; msg: string; type: string }> = [];
  try {
    const { agentLogger } = await import('../../../../../agents/core/Logger.js');
    recentLogs = running
      ? agentLogger.getRecentLogs(running.jobId, 15)
      : agentLogger.getRecentLogs(undefined, 10);
  } catch (_) {}
  return Response.json({
    running: running
      ? {
          jobId: running.jobId,
          target: running.target,
          status: running.status,
          currentStep: running.currentStep || null,
          lastUpdate: running.lastUpdate,
          progress: deriveProgress(running.currentStep || null),
        }
      : null,
    recentLogs,
  });
}
