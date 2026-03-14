/**
 * GET /api/reports/normalized
 * Returns all completed reports in normalized format
 *
 * Query parameters:
 * - agent=<agentId> - filter by agent
 * - status=<status> - filter by status (pass, fail, partial, skip, error)
 * - limit=<n> - limit results (default 50)
 */

import { jobRegistry } from '@/lib/jobRegistry';
import {
  adaptJobsToNormalizedReports,
  filterReportsByStatus,
} from '@/lib/reportAdapter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agentFilter = url.searchParams.get('agent');
    const statusFilter = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    const jobs = Array.from(jobRegistry.values());
 
    // Include all jobs from memory to show real-time progress
    const memoryJobsFiltered = agentFilter ? jobs.filter((j: any) => j.agentId === agentFilter) : jobs;

    // Normalize memory jobs
    let reports = adaptJobsToNormalizedReports(memoryJobsFiltered.filter((j: any) => j.status === 'completed' && j.report));
    
    // Add running/queued jobs as partial reports
    const activeJobs = memoryJobsFiltered.filter((j: any) => j.status === 'running' || j.status === 'queued');
    const { normalizeReport } = await import('@/lib/reportNormalizer');

    for (const job of activeJobs as any[]) {
      const mockRaw: any = {
        jobId: job.jobId,
        agentId: job.agentId,
        target: job.target,
        type: job.type,
        timestamp: job.createdAt,
        overallStatus: job.status === 'running' ? 'partial' : 'skip',
        summary: { passed: 0, partial: 0, failed: 0, skipped: 0, total: 0 },
        steps: [],
        metadata: { 
          swarmActive: true, 
          statusLabel: job.status === 'running' ? 'Running' : 'Queued',
          currentStep: job.currentStep
        }
      };
      reports.push(normalizeReport(mockRaw));
    }

    // Fetch from Supabase (Primary Persistence)
    try {
      const { supabase } = await import('../../../../../agents/core/memory/supabase-client.js');
      if (supabase) {
        let query = supabase
          .from('test_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (statusFilter) {
          query = query.eq('overall_status', statusFilter);
        }

        const { data: dbRows, error } = await query;
        
        if (!error && dbRows) {
          for (const row of dbRows) {
            // Avoid duplicates with memory
            if (reports.some(r => r.jobId === row.job_id)) continue;
            
            reports.push(normalizeReport(row));
          }
        }
      }
    } catch (err) {
      console.warn('[API] Supabase fetch failed in normalized route:', err);
    }

    // Fetch from S3 storage if available as secondary fallback
    try {
      const { getStorage } = await import('@/lib/storage');
      const storage = getStorage();
      const agentsToCheck = agentFilter ? [agentFilter] : ['agent-shivani'];
      
      for (const agId of agentsToCheck) {
        const storedReports = await storage.listReports(agId, limit);
        if (storedReports && storedReports.length > 0) {
          for (const r of storedReports) {
            if (reports.some(existing => existing.jobId === r.jobId)) continue;
            try {
              reports.push(normalizeReport(r as any));
            } catch (e) {}
          }
        }
      }
    } catch (err) {}

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
          metadata: r.metadata,
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
