/**
 * GET /api/reports/[jobId]
 * Returns a specific report in normalized format with full details
 */

import { jobRegistry } from '@/lib/jobRegistry';
import { adaptJobToNormalizedReport } from '@/lib/reportAdapter';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = jobRegistry.get(jobId);
 
    if (!job || !job.report) {
      const { normalizeReport } = await import('@/lib/reportNormalizer');

      // 1. Try Supabase (Primary Persistence)
      try {
        const { supabase } = await import('../../../../../agents/core/memory/supabase-client.js');
        if (supabase) {
          const { data, error } = await supabase
            .from('test_history')
            .select('*')
            .eq('job_id', jobId)
            .single();
          
          if (!error && data) {
            return Response.json({ success: true, report: normalizeReport(data) }, { status: 200 });
          }
        }
      } catch (err) {}

      // 2. Try Storage (Secondary)
      try {
        const { getStorage } = await import('@/lib/storage');
        const storage = getStorage();
        const agentId = job?.agentId || 'agent-shivani';
        const storedReport = await storage.getReport(agentId, jobId);
        if (storedReport) {
          return Response.json({ success: true, report: normalizeReport(storedReport) }, { status: 200 });
        }
      } catch (err) {}

      if (!job) {
        return Response.json(
          {
            success: false,
            error: `Mission ${jobId} not found in nodes or storage.`,
          },
          { status: 404 }
        );
      }

      return Response.json(
        {
          success: false,
          error: `Job "${jobId}" still processing or report not yet available`,
          status: job.status,
        },
        { status: 202 }
      );
    }
 
    const report = adaptJobToNormalizedReport(job);

    return Response.json(
      {
        success: true,
        report,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[API] GET /api/reports/:jobId error:`, error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
