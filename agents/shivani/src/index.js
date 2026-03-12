#!/usr/bin/env node

/**
 * Agent Shivani - QA Player Verification Agent
 *
 * Automated QA agent that:
 * 1. Discovers latest articles from a publisher domain
 * 2. Detects <instaread-player/> tags on each article
 * 3. Tests player functionality (play, pause, scrubber, replay)
 * 4. Captures screenshots at every step
 * 5. Generates a pass/fail report
 *
 * Usage:
 *   node src/index.js --domain https://example.com
 *   node src/index.js --url https://example.com/article-1  (test single URL)
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
// Priority: .env.local (overrides) > .env (defaults)
const rootDir = path.resolve(import.meta.dirname, '..', '..');
dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config({ path: path.join(rootDir, '.env') });

import AgentShivani from './AgentShivani.js';

const REPORTS_DIR = path.resolve(import.meta.dirname, '..', 'reports');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { domain: null, url: null, maxArticles: 10 };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--domain' && args[i + 1]) {
      config.domain = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      config.url = args[i + 1];
      i++;
    } else if (args[i] === '--max-articles' && args[i + 1]) {
      config.maxArticles = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return config;
}

function printReport(report) {
  const RESET = '\x1b[0m';
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const BOLD = '\x1b[1m';
  const CYAN = '\x1b[36m';

  console.log('\n' + '═'.repeat(70));
  console.log(`${BOLD}${CYAN}  AGENT SHIVANI - QA REPORT${RESET}`);
  console.log('═'.repeat(70));
  console.log(`  Target:    ${report.target}`);
  console.log(`  Job Type:  ${report.type}`);
  console.log(`  Timestamp: ${report.timestamp}`);
  console.log('─'.repeat(70));

  for (const step of report.steps) {
    const icon = step.status === 'pass' ? `${GREEN}✓` : step.status === 'fail' ? `${RED}✗` : `${YELLOW}⊘`;
    const durationStr = step.duration ? ` (${step.duration}ms)` : '';
    console.log(`  ${icon} ${step.name}${RESET}${durationStr}`);
    console.log(`    ${step.message}`);

    // Show nested steps if present
    if (step.nestedSteps && step.nestedSteps.length > 0) {
      for (const nested of step.nestedSteps.slice(0, 3)) {
        const nestedIcon = nested.status === 'pass' ? `${GREEN}✓` : nested.status === 'fail' ? `${RED}✗` : `${YELLOW}⊘`;
        console.log(`      ${nestedIcon} ${nested.name}${RESET}`);
      }
      if (step.nestedSteps.length > 3) {
        console.log(`      ... and ${step.nestedSteps.length - 3} more steps`);
      }
    }
  }

  console.log('─'.repeat(70));
  const statusColor = report.overallStatus === 'pass' ? GREEN : report.overallStatus === 'fail' ? RED : YELLOW;
  console.log(`  ${BOLD}Result: ${statusColor}${report.overallStatus.toUpperCase()}${RESET}`);
  console.log(`  Passed: ${report.summary.passed} | Partial: ${report.summary.partial} | Failed: ${report.summary.failed} | Skipped: ${report.summary.skipped} | Total: ${report.summary.total}`);
  console.log('═'.repeat(70) + '\n');
}

async function run() {
  const config = parseArgs();

  if (!config.domain && !config.url) {
    console.error('Usage:');
    console.error('  node src/index.js --domain https://example.com');
    console.error('  node src/index.js --url https://example.com/some-article');
    console.error('  node src/index.js --domain https://example.com --max-articles 5');
    process.exit(1);
  }

  console.log('\n🤖 Agent Shivani starting...\n');

  const agent = new AgentShivani({ maxArticles: config.maxArticles });

  const jobConfig = {
    maxArticles: config.maxArticles,
  };

  const job = {
    jobId: `shivani-${Date.now()}`,
    type: config.url ? 'url' : 'domain',
    target: config.url || config.domain,
    config: jobConfig,
    onStepStart: (stepName, metadata) => {
      console.log(`[${stepName}] Starting...`);
    },
    onStepEnd: (stepName, result) => {
      console.log(`[${stepName}] Complete: ${result.status}`);
    },
    onError: (error, context) => {
      console.error(`[Error] ${context.phase || context.phase}: ${error.message}`);
    },
  };

  const report = await agent.runJob(job);

  // Print report
  printReport(report);

  // Save report to filesystem
  saveReport(report);

  console.log('\n' + '═'.repeat(70));
  console.log('  FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`  Job ID:               ${report.jobId}`);
  console.log(`  Overall Status:       ${report.overallStatus.toUpperCase()}`);
  console.log(`  Articles Scanned:     ${report.metadata.articlesScanned}`);
  console.log(`  Articles with Player: ${report.metadata.articlesWithPlayer}`);
  console.log(`  Steps Passed:         ${report.summary.passed}`);
  console.log(`  Steps Partial:        ${report.summary.partial}`);
  console.log(`  Steps Failed:         ${report.summary.failed}`);
  console.log(`  Duration:             ${(report.duration / 1000).toFixed(1)}s`);
  console.log('═'.repeat(70) + '\n');
}

function saveReport(report) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = `report_${Date.now()}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved: ${filepath}`);
}

run().catch((err) => {
  if (err.code !== 'ERR_PROCESS_EXIT') {
    console.error('Agent Shivani encountered an error:', err);
  }
  process.exit(1);
});
