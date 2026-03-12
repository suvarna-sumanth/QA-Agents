/**
 * Report Normalizer
 * Converts agent reports into a stable, dashboard-friendly schema
 *
 * Input: Raw report from agent.runJob()
 * Output: NormalizedReport ready for dashboard consumption
 */

interface Step {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'partial';
  message: string;
  duration: number;
  screenshot?: string;
  s3Key?: string;
  nestedSteps?: Step[];
}

interface RawReport {
  jobId: string;
  agentId: string;
  type: 'domain' | 'url';
  target: string;
  timestamp: string;
  overallStatus: 'pass' | 'partial' | 'fail' | 'error' | 'skip';
  summary: {
    passed: number;
    partial: number;
    failed: number;
    skipped: number;
    total: number;
  };
  steps: Step[];
  metadata?: any;
  duration?: number;
}

interface NormalizedStep {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'partial';
  message: string;
  duration: number;
  durationMs: number;
  screenshotUrl?: string;
  nestedSteps?: NormalizedStep[];
}

export interface NormalizedReport {
  // Identifiers
  jobId: string;
  agentId: string;

  // Execution info
  type: 'domain' | 'url';
  target: string;
  timestamp: string;
  startedAt?: string;
  completedAt?: string;

  // Status
  overallStatus: 'pass' | 'partial' | 'fail' | 'error' | 'skip';
  statusLabel: string;
  statusColor: string;

  // Metrics
  duration: number;
  durationSeconds: number;
  durationLabel: string;

  // Results summary
  summary: {
    passed: number;
    partial: number;
    failed: number;
    skipped: number;
    total: number;
    passRate: number;
  };

  // Steps (normalized)
  steps: NormalizedStep[];

  // Metadata
  agentName?: string;
  agentVersion?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
  aiSummary?: string;
}

export function normalizeReport(rawReport: RawReport): NormalizedReport {
  const summary = rawReport.summary || {
    passed: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };

  const passRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

  const { statusLabel, statusColor } = getStatusDisplay(rawReport.overallStatus);

  const durationMs = rawReport.duration || 0;
  const durationSeconds = Math.round(durationMs / 1000);
  const durationLabel =
    durationSeconds < 60
      ? `${durationSeconds}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

  const normalizedSteps = rawReport.steps.map((step, index) =>
    normalizeStep(step, index)
  );

  // Generate AI Executive Summary
  const aiSummary = generateAISummary(rawReport, summary, passRate);

  return {
    // Identifiers
    jobId: rawReport.jobId,
    agentId: rawReport.agentId,

    // Execution info
    type: rawReport.type,
    target: rawReport.target,
    timestamp: rawReport.timestamp,
    startedAt: rawReport.timestamp,
    completedAt: rawReport.timestamp,

    // Status
    overallStatus: rawReport.overallStatus,
    statusLabel: rawReport.metadata?.statusLabel || statusLabel,
    statusColor: rawReport.metadata?.statusColor || statusColor,

    // Metrics
    duration: durationMs,
    durationSeconds,
    durationLabel,

    // Results summary
    summary: {
      ...summary,
      passRate,
    },

    // Steps
    steps: normalizedSteps,

    // Metadata & Swarm Telemetry
    agentName: rawReport.metadata?.agentName || 'Shivani Swarm Orchestrator',
    agentVersion: rawReport.metadata?.agentVersion || '2.0.0-swarm',
    capabilities: rawReport.metadata?.capabilities || [],
    metadata: {
      ...rawReport.metadata,
      swarmActive: rawReport.metadata?.swarmMode || false,
      parallelEfficiency: rawReport.metadata?.swarmEfficiency || 0,
    },
    aiSummary,
  };
}

function generateAISummary(rawReport: RawReport, summary: any, passRate: number): string {
  if (rawReport.overallStatus === 'error') {
    return `Critical execution error occurred during the QA run. The agent was unable to complete the analysis for ${rawReport.target}. Please check the system logs for infrastructure issues.`;
  }

  const articleCount = rawReport.metadata?.articlesWithPlayer || 1;
  const status = passRate >= 100 ? 'excellent' : passRate >= 80 ? 'good' : passRate >= 50 ? 'concerning' : 'critical';
  
  let text = `The QA analysis for **${new URL(rawReport.target).hostname}** is complete. Over a span of **${Math.round(rawReport.duration! / 1000)} seconds**, the Shivani Agent evaluated **${articleCount} article(s)** across the domain.\n\n`;
  
  if (passRate >= 100) {
    text += `### Executive Summary: HEALTHY\nAll player modules are functioning perfectly. The Instaread player was successfully detected, triggered, and verified for audio playback, seek functionality, and speed controls. AdPushup units were also correctly rendered without blocking the user experience.`;
  } else if (passRate >= 80) {
    text += `### Executive Summary: MINOR ISSUES\nThe overall player health is good, but **${summary.failed} minor failed check(s)** were detected. Most core functions like playback and seeking work correctly, but there may be discrepancies in ad rendering or secondary controls. Recommended for review by the engineering team.`;
  } else {
    text += `### Executive Summary: CRITICAL FAILURES\nSignificant issues were detected in the player integration. Only **${Math.round(passRate)}%** of the test suite passed. Key failures in **playback or iframe access** suggest a potential break in the partner script or a change in the site's DOM structure. Immediate attention is required.`;
  }

  if (summary.failed > 0) {
    const failedStepNames = rawReport.steps
      .filter(s => s.status === 'fail')
      .map(s => s.name.split('] ').pop())
      .slice(0, 3);
    text += `\n\n**Top Issues Identified:**\n` + failedStepNames.map(name => `- ${name}`).join('\n');
  }

  return text;
}

function normalizeStep(step: Step, index: number): NormalizedStep {
  const durationMs = step.duration || 0;
  const durationSeconds = Math.round(durationMs / 1000);
  const durationLabel =
    durationSeconds < 60 ? `${durationSeconds}s` : `${durationSeconds / 60}m`;

  let screenshotUrl = undefined;
  if (step.s3Key) {
    screenshotUrl = `/api/screenshots?key=${encodeURIComponent(step.s3Key)}`;
  } else if (step.screenshot) {
    // In local dev, we serve screenshots via a dedicated api or public path
    // We'll use a virtual path that the server can resolve
    const fileName = step.screenshot.split('/').pop();
    screenshotUrl = `/api/screenshots/local/${fileName}`;
  }

  return {
    id: `step-${index}`,
    name: step.name,
    status: step.status,
    message: step.message,
    duration: durationMs,
    durationMs,
    // durationLabel,
    screenshotUrl,
    nestedSteps: step.nestedSteps?.map((nested, i) => normalizeStep(nested, i)),
  };
}

function getStatusDisplay(
  status: string
): { statusLabel: string; statusColor: string } {
  switch (status) {
    case 'pass':
      return { statusLabel: 'Passed', statusColor: 'green' };
    case 'partial':
      return { statusLabel: 'Partial', statusColor: 'yellow' };
    case 'fail':
      return { statusLabel: 'Failed', statusColor: 'red' };
    case 'error':
      return { statusLabel: 'Error', statusColor: 'red' };
    case 'skip':
      return { statusLabel: 'Skipped', statusColor: 'gray' };
    default:
      return { statusLabel: 'Unknown', statusColor: 'gray' };
  }
}

/**
 * Batch normalize multiple reports
 */
export function normalizeReports(rawReports: RawReport[]): NormalizedReport[] {
  return rawReports.map(normalizeReport);
}

/**
 * Extract key metrics for dashboard summary card
 */
export function getSummaryMetrics(reports: NormalizedReport[]) {
  if (reports.length === 0) {
    return {
      totalRuns: 0,
      passRate: 0,
      avgDuration: 0,
      avgDurationLabel: '0s',
    };
  }

  const passedReports = reports.filter((r) => r.overallStatus === 'pass').length;
  const passRate = Math.round((passedReports / reports.length) * 100);
  const totalDuration = reports.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = Math.round(totalDuration / reports.length);
  const avgDurationSeconds = Math.round(avgDuration / 1000);
  const avgDurationLabel =
    avgDurationSeconds < 60
      ? `${avgDurationSeconds}s`
      : `${avgDurationSeconds / 60}m`;

  return {
    totalRuns: reports.length,
    passRate,
    avgDuration,
    avgDurationLabel,
  };
}

/**
 * Group reports by agent
 */
export function groupReportsByAgent(
  reports: NormalizedReport[]
): Record<string, NormalizedReport[]> {
  return reports.reduce(
    (acc, report) => {
      if (!acc[report.agentId]) {
        acc[report.agentId] = [];
      }
      acc[report.agentId].push(report);
      return acc;
    },
    {} as Record<string, NormalizedReport[]>
  );
}

/**
 * Filter reports by date range
 */
export function filterReportsByDateRange(
  reports: NormalizedReport[],
  startDate: Date,
  endDate: Date
): NormalizedReport[] {
  return reports.filter((report) => {
    const reportDate = new Date(report.timestamp);
    return reportDate >= startDate && reportDate <= endDate;
  });
}

/**
 * Filter reports by status
 */
export function filterReportsByStatus(
  reports: NormalizedReport[],
  status: string
): NormalizedReport[] {
  return reports.filter((report) => report.overallStatus === status);
}

export default normalizeReport;
