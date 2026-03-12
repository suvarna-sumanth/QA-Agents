/**
 * GET /api/reports/summary
 * Returns normalized reports with dashboard-friendly formatting
 */

import { jobRegistry } from '../../jobs/route';
import {
  generateDashboardSummary,
} from '@/lib/reportAdapter';

export async function GET(request: Request) {
  try {
    const jobs = Array.from(jobRegistry.values());
    // Normalize all relevant records including active ones
    const { normalizeReport } = await import('@/lib/reportNormalizer');
    let reports: any[] = [];

    for (const job of jobs) {
      if (job.status === 'completed' && job.report) {
         reports.push(normalizeReport(job.report));
      } else if (job.status === 'running' || job.status === 'queued') {
         reports.push(normalizeReport({
           jobId: job.jobId,
           agentId: job.agentId,
           target: job.target,
           type: job.type as any,
           timestamp: job.createdAt,
           overallStatus: job.status === 'running' ? 'partial' : 'skip',
           summary: { passed: 0, partial: 0, failed: 0, skipped: 0, total: 0 },
           steps: [],
           metadata: { statusLabel: job.status === 'running' ? 'Running' : 'Queued' }
         }));
      }
    }

    // Fetch from S3 storage if available
    try {
      const { getStorage } = await import('@/lib/storage');
      const storage = getStorage();
      
      const storedReports = await storage.listReports('agent-shivani', 50);
      
      if (storedReports && storedReports.length > 0) {
        for (const r of storedReports) {
          if (reports.some(existing => existing.jobId === r.jobId)) continue;
          try {
            const normalized = normalizeReport(r as any);
            reports.push(normalized);
          } catch (e) {
            console.warn(`[API] Failed to normalize summary report ${r.jobId}:`, e);
          }
        }
      }
    } catch (err) {
      console.warn('[API] Storage summary listing failed:', err);
    }

    // Generate dashboard summary
    const summary = generateDashboardSummary(reports);

    return Response.json(
      {
        success: true,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/reports/summary error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
