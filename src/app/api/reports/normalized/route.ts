/**
 * GET /api/reports/normalized
 * Returns all completed reports in normalized format
 *
 * Query parameters:
 * - agent=<agentId> - filter by agent
 * - status=<status> - filter by status (pass, fail, partial, skip, error)
 * - limit=<n> - limit results (default 50)
 */

import { jobRegistry } from '../../jobs/route';
import {
  adaptJobsToNormalizedReports,
  filterReportsByStatus,
} from '@/lib/reportAdapter';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agentFilter = url.searchParams.get('agent');
    const statusFilter = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    const jobs = Array.from(jobRegistry.values());
 
     // Include all jobs from memory to show real-time progress
     const memoryJobsFiltered = agentFilter ? jobs.filter(j => j.agentId === agentFilter) : jobs;
 
     // For memory jobs that aren't completed yet, we create a placeholder report or use what's there
     let reports = adaptJobsToNormalizedReports(memoryJobsFiltered.filter(j => j.status === 'completed' && j.report));
     
     // Add running/queued jobs as partial reports
     const activeJobs = memoryJobsFiltered.filter(j => j.status === 'running' || j.status === 'queued');
     const { normalizeReport } = await import('@/lib/reportNormalizer');
 
     for (const job of activeJobs) {
       const mockRaw: any = {
         jobId: job.jobId,
         agentId: job.agentId,
         target: job.target,
         type: job.type,
         timestamp: job.createdAt,
         overallStatus: job.status === 'running' ? 'partial' : 'skip',
         summary: { passed: 0, partial: 0, failed: 0, skipped: 0, total: 0 },
         steps: [],
         metadata: { swarmActive: true, statusLabel: job.status === 'running' ? 'Running' : 'Queued' }
       };
       reports.push(normalizeReport(mockRaw));
     }

    // Fetch from S3 storage if available
    try {
      const { getStorage } = await import('@/lib/storage');
      const storage = getStorage();

      // Known agents to check if no filter
      const agentsToCheck = agentFilter ? [agentFilter] : ['agent-shivani'];

      const { normalizeReport } = await import('@/lib/reportNormalizer');
      
      for (const agId of agentsToCheck) {
        const storedReports = await storage.listReports(agId, limit);
        if (storedReports && storedReports.length > 0) {
          for (const r of storedReports) {
            // Check if we already have this jobId in memory to avoid duplicates
            if (reports.some(existing => existing.jobId === r.jobId)) continue;
            
            try {
              const normalized = normalizeReport(r as any);
              reports.push(normalized);
            } catch (e) {
              console.warn(`[API] Failed to normalize stored report ${r.jobId}:`, e);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[API] Storage listing failed or unavailable:', err);
    }

    // Apply status filter
    if (statusFilter) {
      reports = filterReportsByStatus(reports, statusFilter);
    }

    // Sort by timestamp (newest first)
    reports = reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    const totalCount = reports.length;
    reports = reports.slice(0, limit);

    return Response.json(
      {
        success: true,
        count: reports.length,
        totalCount,
        limit,
        reports: reports.map((r) => ({
          jobId: r.jobId,
          agentId: r.agentId,
          target: r.target,
          type: r.type,
          timestamp: r.timestamp,
          overallStatus: r.overallStatus,
          statusLabel: r.statusLabel,
          durationLabel: r.durationLabel,
          summary: r.summary,
        })),
      },
      { 
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      }
    );
  } catch (error) {
    console.error('[API] GET /api/reports/normalized error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
