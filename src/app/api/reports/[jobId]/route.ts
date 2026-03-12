/**
 * GET /api/reports/[jobId]
 * Returns a specific report in normalized format with full details
 */

import { jobRegistry } from '../../jobs/route';
import { adaptJobToNormalizedReport } from '@/lib/reportAdapter';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = jobRegistry.get(jobId);
 
    if (!job || !job.report) {
      // Try to fetch from storage
      try {
        const { getStorage } = await import('@/lib/storage');
        const storage = getStorage();
        
        // Use the agentId from the job if available
        const agentId = job?.agentId || 'agent-shivani';
        const storedReport = await storage.getReport(agentId, jobId);
        
        if (storedReport) {
          const { normalizeReport } = await import('@/lib/reportNormalizer');
          const report = normalizeReport(storedReport);
          return Response.json({ success: true, report }, { status: 200 });
        }
      } catch (err) {
        // Log the error for debugging
        console.warn(`[API] Storage fetch failed for ${jobId} with agentId "${job?.agentId || 'agent-shivani'}":`, err);
      }

      if (!job) {
        return Response.json(
          {
            success: false,
            error: `Job "${jobId}" not found in memory or storage`,
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
