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

/** Convert cognitive agent state (LangGraph results) into flat steps + metadata for dashboard */
function cognitiveToLegacy(cognitive: any): any {
  const results = cognitive.results || [];
  const steps: any[] = [];
  const uniqueArticleUrls = new Set<string>();
  let protection: string | undefined;

  for (const r of results) {
    if (r.skill === 'discover_articles' && r.data?.urls?.length) {
      steps.push({ name: 'Discovery', status: r.status === 'error' ? 'fail' : 'pass', message: `Found ${r.data.urls.length} articles`, duration: 0 });
      continue;
    }
    if (r.skill === 'detect_player' && r.data?.results) {
      if (!protection && typeof r.data.protection === 'string') {
        protection = r.data.protection;
      }
      for (const item of r.data.results) {
        const url = (item.url || '').trim();
        if (url) uniqueArticleUrls.add(url);
        const short = url.split('/').filter(Boolean).pop() || 'article';
        const isPerimeterX = protection === 'perimeterx';

        steps.push({
          name: `[${short}] Detection`,
          status: item.hasPlayer
            ? 'pass'
            : isPerimeterX
              ? 'partial'
              : 'fail',
          message: item.hasPlayer
            ? 'Player detected'
            : isPerimeterX
              ? 'Blocked by PerimeterX WAF (no player accessible)'
              : 'No instaread-player detected',
          duration: 0,
          screenshot: item.screenshot,
          s3Key: item.s3Key,
        });
      }
      continue;
    }
    if (r.skill === 'test_player' && r.data?.report?.steps) {
      const reportUrl = (r.data.report?.url || '').trim();
      if (reportUrl) uniqueArticleUrls.add(reportUrl);
      const short = reportUrl.split('/').filter(Boolean).pop() || 'article';
      for (const step of r.data.report.steps) {
        steps.push({
          name: `[${short}] ${step.name || 'Step'}`,
          status: step.status === 'info' ? 'pass' : (step.status || 'pass'),
          message: step.message || '',
          duration: step.duration || 0,
          screenshot: step.screenshot,
          s3Key: step.s3Key,
        });
      }
    }
  }

  const target = cognitive.url || cognitive.target || cognitive.domain || 'Unknown Mission';
  const durationMs = cognitive.totalDuration ?? (cognitive.startTime ? Date.now() - cognitive.startTime : 0);
  const articlesWithPlayer = Math.max(uniqueArticleUrls.size, 1);

  return {
    ...cognitive,
    target,
    url: target,
    steps,
    duration: durationMs,
    totalDuration: durationMs,
    overallStatus: cognitive.overallStatus || (steps.some((s: any) => s.status === 'fail') ? 'fail' : 'pass'),
    metadata: {
      ...(cognitive.metadata || {}),
      articlesWithPlayer,
      ...(protection ? { protection } : {}),
    },
  };
}

export function normalizeReport(rawReport: any): NormalizedReport {
  const isCognitive =
    Array.isArray(rawReport.results) &&
    rawReport.results.length > 0 &&
    rawReport.results.some((r: any) => r && (r.skill === 'discover_articles' || r.skill === 'detect_player' || r.skill === 'test_player'));

  const raw = isCognitive ? cognitiveToLegacy(rawReport) : rawReport;
  const rawSteps = raw.steps || raw.results || [];

  const summary = raw.summary || {
    passed: rawSteps.filter((s: any) => s.status === 'pass').length,
    partial: rawSteps.filter((s: any) => s.status === 'partial').length,
    failed: rawSteps.filter((s: any) => s.status === 'fail' || s.status === 'error').length,
    skipped: rawSteps.filter((s: any) => s.status === 'skip').length,
    total: rawSteps.length,
  };

  const passRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

  // Derive base overall status from multiple possible shapes (DB rows vs in-memory reports)
  let baseOverallStatus: RawReport['overallStatus'] =
    raw.overallStatus ??
    raw.overall_status ??
    rawReport.overallStatus ??
    rawReport.overall_status ??
    (summary.failed > 0 ? 'fail' : 'pass');

  // Detect WAF / protection metadata (e.g. PerimeterX) and map to a clearer semantic status
  const protection =
    raw.metadata?.protection ||
    raw.protection ||
    rawReport.metadata?.protection ||
    rawReport.protection;

  if (protection === 'perimeterx' && baseOverallStatus === 'fail') {
    // Distinguish infra / WAF blockage from a genuine player regression
    baseOverallStatus = 'partial';
  }

  const { statusLabel, statusColor } = getStatusDisplay(baseOverallStatus || (summary.failed > 0 ? 'fail' : 'pass'));

  const durationMs = raw.duration || raw.total_duration_ms || raw.totalDuration || 0;
  const durationSeconds = Math.round(durationMs / 1000);
  const durationLabel =
    durationSeconds < 60
      ? `${durationSeconds}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

  const timestamp = raw.timestamp || raw.created_at || raw.createdAt || new Date().toISOString();
  const target = raw.target || raw.url || raw.domain || 'Mission Target';
  const type = raw.type || (target.includes('/') ? 'url' : 'domain');

  const normalizedSteps = rawSteps.map((step: any, index: number) =>
    normalizeStep(step, index)
  );

  const aiSummary = generateAISummary(raw, rawSteps, summary, passRate);

  return {
    jobId: raw.jobId || raw.job_id || rawReport.jobId || rawReport.job_id || `job-${Date.now()}`,
    agentId: raw.agentId || raw.agent_id || rawReport.agentId || rawReport.agent_id || 'agent-shivani',

    type: type as any,
    target,
    timestamp,
    startedAt: timestamp,
    completedAt: timestamp,

    overallStatus: baseOverallStatus || (summary.failed > 0 ? 'fail' : 'pass'),
    statusLabel: raw.metadata?.statusLabel || statusLabel,
    statusColor: raw.metadata?.statusColor || statusColor,

    duration: durationMs,
    durationSeconds,
    durationLabel,

    summary: { ...summary, passRate },

    steps: normalizedSteps,

    agentName: raw.agentName || raw.metadata?.agentName || 'Shivani Swarm Orchestrator',
    agentVersion: raw.agentVersion || raw.metadata?.agentVersion || '2.1.0-agentic',
    capabilities: raw.capabilities || raw.metadata?.capabilities || ['Discovery', 'Detection', 'Functional'],
    metadata: {
      ...raw.metadata,
      swarmActive: true,
      parallelEfficiency: raw.metadata?.swarmEfficiency || 0,
      ...(protection ? { protection } : {}),
    },
    aiSummary,
  };
}

function generateAISummary(rawReport: any, rawSteps: any[], summary: any, passRate: number): string {
  const target = rawReport.target || rawReport.domain || 'Unknown Mission';
  
  if (rawReport.overallStatus === 'error') {
    return `Critical execution error occurred during the QA run. The agent was unable to complete the analysis for ${target}. Please check the system logs for infrastructure issues.`;
  }

  const articleCount = rawReport.metadata?.articlesWithPlayer || 1;
  const status = passRate >= 100 ? 'excellent' : passRate >= 80 ? 'good' : passRate >= 50 ? 'concerning' : 'critical';
  
  // Safe URL logic
  let hostname = target;
  try {
    const targetUrl = target.includes('://') ? target : `https://${target}`;
    hostname = new URL(targetUrl).hostname || target;
  } catch (e) {
    // Keep hostname as target
  }

  const durationMs = Number(rawReport.duration) || 0;
  let text = `The QA analysis for **${hostname}** is complete. Over a span of **${Math.round(durationMs / 1000)} seconds**, the Shivani Agent evaluated **${articleCount} article(s)** across the domain.\n\n`;
  
  if (passRate >= 100) {
    text += `### Executive Summary: HEALTHY\nAll player modules are functioning perfectly. The Instaread player was successfully detected, triggered, and verified for audio playback, seek functionality, and speed controls. AdPushup units were also correctly rendered without blocking the user experience.`;
  } else if (passRate >= 80) {
    text += `### Executive Summary: MINOR ISSUES\nThe overall player health is good, but **${summary.failed} minor failed check(s)** were detected. Most core functions like playback and seeking work correctly, but there may be discrepancies in ad rendering or secondary controls. Recommended for review by the engineering team.`;
  } else {
    text += `### Executive Summary: CRITICAL FAILURES\nSignificant issues were detected in the player integration. Only **${Math.round(passRate)}%** of the test suite passed. Key failures in **playback or iframe access** suggest a potential break in the partner script or a change in the site's DOM structure. Immediate attention is required.`;
  }

  if (summary.failed > 0 && rawSteps.length > 0) {
    const failedStepNames = rawSteps
      .filter((s: any) => s.status === 'fail' || s.status === 'error')
      .map((s: any) => (s.name || s.skill || 'Unknown Task').split('] ').pop())
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
    name: step.name || (step as any).skill || 'Mission Operation',
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
