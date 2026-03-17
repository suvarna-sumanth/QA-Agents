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

    let reports: any[] = [];
    
    // 1. Fetch from Supabase (Primary Persistence) - Get latest confirmed results
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
          const { normalizeReport } = await import('@/lib/reportNormalizer');
          for (const row of dbRows) {
            reports.push(normalizeReport(row));
          }
        }
      }
    } catch (err) {
      console.warn('[API] Supabase fetch failed in normalized route:', err);
    }

    // 2. Add jobs from memory (Real-time / Recent)
    const jobs = Array.from(jobRegistry.values());
    const memoryJobsFiltered = agentFilter ? jobs.filter((j: any) => j.agentId === agentFilter) : jobs;

    // Filter memory jobs to only include ones from the last 24 hours to avoid stale "thehill.com" data
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentMemoryJobs = memoryJobsFiltered.filter((j: any) => {
      const createdAt = new Date(j.createdAt || 0).getTime();
      return createdAt > oneDayAgo;
    });

    // Add completed jobs from memory that aren't in Supabase yet
    const completedMemoryReports = adaptJobsToNormalizedReports(recentMemoryJobs.filter((j: any) => j.status === 'completed' && j.report));
    for (const r of completedMemoryReports) {
      if (!reports.some(existing => existing.jobId === r.jobId)) {
        reports.push(r);
      }
    }
    
    // 3. Add running/queued jobs as partial reports for "What agent is doing" feedback
    const activeJobs = recentMemoryJobs.filter((j: any) => j.status === 'running' || j.status === 'queued');
    const { normalizeReport } = await import('@/lib/reportNormalizer');

    for (const job of activeJobs as any[]) {
      if (reports.some(r => r.jobId === job.jobId)) continue;
      
      const mockRaw: any = {
        jobId: job.jobId,
        agentId: job.agentId,
        target: job.target,
        type: job.type,
        timestamp: job.createdAt || new Date().toISOString(),
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

    // 4. Fetch from S3 storage if available as secondary fallback
    if (reports.length < limit) {
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
    }

    // Apply status filter to combined results
    if (statusFilter) {
      reports = reports.filter(r => r.overallStatus === statusFilter);
    }

    // Final Sort: Always newest first
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
