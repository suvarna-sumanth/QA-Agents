/**
 * Report Adapter
 * Bridges the gap between raw agent reports and dashboard consumption
 *
 * Provides utilities to:
 * - Normalize reports for display
 * - Extract data for charts/metrics
 * - Format timestamps and durations
 * - Provide filtered views
 */

import {
  normalizeReport,
  normalizeReports,
  NormalizedReport,
} from './reportNormalizer';

/**
 * Convert a job object from the API (with raw report) into normalized format
 */
export function adaptJobToNormalizedReport(job: any): NormalizedReport | null {
  if (!job.report) {
    return null;
  }

  return normalizeReport(job.report);
}

/**
 * Convert list of jobs into normalized reports
 */
export function adaptJobsToNormalizedReports(jobs: any[]): NormalizedReport[] {
  return jobs
    .filter((job) => job.report)
    .map((job) => adaptJobToNormalizedReport(job))
    .filter((report) => report !== null) as NormalizedReport[];
}

/**
 * Format a report for API response
 */
export function formatReportForAPI(report: NormalizedReport) {
  return {
    jobId: report.jobId,
    agentId: report.agentId,
    type: report.type,
    target: report.target,
    timestamp: report.timestamp,
    overallStatus: report.overallStatus,
    statusLabel: report.statusLabel,
    statusColor: report.statusColor,
    duration: report.duration,
    durationLabel: report.durationLabel,
    summary: report.summary,
    stepsCount: report.steps.length,
    steps: report.steps.map((step) => ({
      id: step.id,
      name: step.name,
      status: step.status,
      duration: step.duration,
      durationMs: step.durationMs,
      screenshotUrl: step.screenshotUrl,
      childStepsCount: step.nestedSteps?.length || 0,
    })),
  };
}

/**
 * Get dashboard summary from recent reports
 */
export interface DashboardSummary {
  totalRuns: number;
  successRate: number;
  avgRunTime: string;
  recentRuns: Array<{
    jobId: string;
    target: string;
    status: string;
    timestamp: string;
  }>;
}

export function generateDashboardSummary(
  reports: NormalizedReport[]
): DashboardSummary {
  const successfulRuns = reports.filter(
    (r) => r.overallStatus === 'pass'
  ).length;
  const successRate =
    reports.length > 0 ? (successfulRuns / reports.length) * 100 : 0;

  const totalDuration = reports.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration =
    reports.length > 0 ? totalDuration / reports.length / 1000 : 0;
  const avgRunTime =
    avgDuration < 60 ? `${Math.round(avgDuration)}s` : `${Math.round(avgDuration / 60)}m`;

  return {
    totalRuns: reports.length,
    successRate: Math.round(successRate),
    avgRunTime,
    recentRuns: reports.slice(0, 10).map((r) => ({
      jobId: r.jobId,
      target: new URL(r.target).hostname,
      status: r.statusLabel,
      timestamp: new Date(r.timestamp).toLocaleString(),
    })),
  };
}

/**
 * Filter reports by overall status
 */
export function filterReportsByStatus(
  reports: NormalizedReport[],
  status: string
): NormalizedReport[] {
  const normalizedStatus = status.toLowerCase();
  return reports.filter((report) => {
    // Match against overallStatus or statusLabel
    return (
      report.overallStatus.toLowerCase() === normalizedStatus ||
      report.statusLabel.toLowerCase() === normalizedStatus
    );
  });
}

/**
 * Extract step-level data for detailed analysis
 */
export interface StepAnalysis {
  stepName: string;
  passRate: number;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  avgDuration: number;
}

export function analyzeStepPerformance(
  reports: NormalizedReport[]
): StepAnalysis[] {
  const stepStats = new Map<
    string,
    { passed: number; failed: number; totalDuration: number }
  >();

  // Aggregate step-level data
  for (const report of reports) {
    for (const step of report.steps) {
      if (!stepStats.has(step.name)) {
        stepStats.set(step.name, { passed: 0, failed: 0, totalDuration: 0 });
      }

      const stats = stepStats.get(step.name)!;
      if (step.status === 'pass') {
        stats.passed++;
      } else if (step.status === 'fail') {
        stats.failed++;
      }
      stats.totalDuration += step.duration;
    }
  }

  // Convert to analysis
  return Array.from(stepStats.entries()).map(([stepName, stats]) => ({
    stepName,
    passRate:
      Math.round(
        (stats.passed / (stats.passed + stats.failed)) * 100 || 0
      ) || 0,
    totalRuns: stats.passed + stats.failed,
    passedRuns: stats.passed,
    failedRuns: stats.failed,
    avgDuration:
      stats.totalDuration / (stats.passed + stats.failed) || 0,
  }));
}

export default {
  adaptJobToNormalizedReport,
  adaptJobsToNormalizedReports,
  formatReportForAPI,
  generateDashboardSummary,
  filterReportsByStatus,
  analyzeStepPerformance,
};
