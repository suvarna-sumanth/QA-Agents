/**
 * full-job-execution.test.js - End-to-end job execution tests
 *
 * Tests that full job execution works correctly with all 5 phases,
 * results are aggregated properly, and metrics are collected.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LegacyAPIAdapter } from '../../../agents/core/adapters/LegacyAPIAdapter.js';
import { Logger } from '../../../agents/core/monitoring/Logger.js';
import { Metrics } from '../../../agents/core/monitoring/Metrics.js';

describe('Full Job Execution - End-to-End', () => {
  let adapter;
  let mockParentAgent;
  let logger;
  let metrics;

  beforeEach(() => {
    logger = new Logger({ name: 'test-logger', level: 'info' });
    metrics = new Metrics();

    // Mock parent agent with complete execution
    mockParentAgent = {
      execute: vi.fn(async (input) => {
        const startTime = Date.now();

        // Simulate each phase execution
        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime,
          phases: {
            discovery: {
              phase: 'discovery',
              status: 'success',
              articles: [
                {
                  url: 'https://example.com/article1',
                  title: 'Article 1: Video Player Test',
                  depth: 0
                },
                {
                  url: 'https://example.com/article2',
                  title: 'Article 2: More Videos',
                  depth: 1
                },
                {
                  url: 'https://example.com/article3',
                  title: 'Article 3: Player Review',
                  depth: 1
                }
              ]
            },
            detection: {
              phase: 'detection',
              status: 'success',
              players: [
                { url: 'https://example.com/article1', type: 'html5', detected: true },
                { url: 'https://example.com/article1', type: 'hls', detected: true },
                { url: 'https://example.com/article2', type: 'youtube', detected: true },
                { url: 'https://example.com/article3', type: 'vimeo', detected: false }
              ]
            },
            testing: {
              phase: 'testing',
              status: 'partial',
              results: [
                {
                  url: 'https://example.com/article1',
                  type: 'html5',
                  status: 'success',
                  audioDetected: true,
                  duration: 5200
                },
                {
                  url: 'https://example.com/article1',
                  type: 'hls',
                  status: 'failed',
                  error: 'Timeout loading stream'
                },
                {
                  url: 'https://example.com/article2',
                  type: 'youtube',
                  status: 'success',
                  audioDetected: true,
                  duration: 3400
                },
                {
                  url: 'https://example.com/article3',
                  type: 'vimeo',
                  status: 'failed',
                  error: 'Player not detected'
                }
              ]
            },
            bypass: {
              phase: 'bypass',
              status: 'success',
              results: [
                {
                  url: 'https://example.com/article1',
                  type: 'hls',
                  wafDetected: 'cloudflare',
                  bypassAttempts: 2,
                  bypassStatus: 'failed'
                }
              ]
            },
            evidence: {
              phase: 'evidence',
              status: 'success',
              evidence: {
                s3Urls: [
                  'https://s3.amazonaws.com/bucket/job-123/screenshot-article1.png',
                  'https://s3.amazonaws.com/bucket/job-123/screenshot-article2.png',
                  'https://s3.amazonaws.com/bucket/job-123/manifest.json'
                ],
                manifest: {
                  jobId: input.jobId,
                  domain: input.domain,
                  executedAt: new Date().toISOString(),
                  phases: ['discovery', 'detection', 'testing', 'bypass', 'evidence'],
                  summary: {
                    articlesFound: 3,
                    playersDetected: 4,
                    testsRun: 4,
                    testsPassed: 2,
                    testsFailed: 2,
                    wafDetected: true,
                    bypassAttempted: true
                  }
                }
              }
            }
          },
          phaseTimes: {
            discovery: 1200,
            detection: 4500,
            testing: 8300,
            bypass: 2100,
            evidence: 800
          },
          errors: []
        };
      })
    };

    adapter = new LegacyAPIAdapter({
      parentAgent: mockParentAgent,
      logger,
      metrics
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Execution Flow', () => {
    it('should execute all 5 phases successfully', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.status).toBe('success');
      expect(result.data.articles.length).toBeGreaterThan(0);
      expect(result.data.detections.length).toBeGreaterThan(0);
      expect(result.data.tests.length).toBeGreaterThan(0);
    });

    it('should aggregate discovery results correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.articles).toHaveLength(3);
      expect(result.data.articles[0]).toHaveProperty('url');
      expect(result.data.articles[0]).toHaveProperty('title');
    });

    it('should aggregate detection results correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.detections).toHaveLength(4);
      expect(result.data.detections[0]).toHaveProperty('url');
      expect(result.data.detections[0]).toHaveProperty('type');
    });

    it('should aggregate testing results correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.tests).toHaveLength(4);
      expect(result.data.tests[0]).toHaveProperty('status');
      expect(['success', 'failed']).toContain(result.data.tests[0].status);
    });

    it('should include bypass results', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.bypasses).toBeTruthy();
    });

    it('should include evidence data', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.evidence).toBeTruthy();
      expect(result.data.evidence.s3Urls).toBeTruthy();
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate metrics across all phases', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.metrics.phases).toBeTruthy();
      expect(result.metrics.phases.discovery).toBeGreaterThan(0);
      expect(result.metrics.phases.detection).toBeGreaterThan(0);
      expect(result.metrics.phases.testing).toBeGreaterThan(0);
    });

    it('should calculate correct total execution time', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      // Total should be >= sum of phase times
      const phaseTotal = Object.values(result.metrics.phases).reduce((a, b) => a + b, 0);
      expect(result.metrics.executionTime).toBeGreaterThanOrEqual(phaseTotal);
    });

    it('should provide timestamp for result', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.metrics.timestamp).toBeTruthy();
      // Should be ISO format
      expect(new Date(result.metrics.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Metrics Collection', () => {
    it('should record job with all metric fields', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      const jobMetrics = metrics.getJobMetrics('job-123');

      expect(jobMetrics).toBeTruthy();
      expect(jobMetrics.jobId).toBe('job-123');
      expect(jobMetrics.status).toBe('success');
      expect(jobMetrics.executionTime).toBeGreaterThan(0);
      expect(jobMetrics.articleCount).toBe(3);
      expect(jobMetrics.detectionCount).toBe(4);
      expect(jobMetrics.testCount).toBe(4);
    });

    it('should track success rate in aggregates', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      const aggregates = metrics.getAggregates();

      expect(aggregates.totalJobs).toBe(1);
      expect(aggregates.successfulJobs).toBe(1);
      expect(aggregates.failedJobs).toBe(0);
      expect(aggregates.successRate).toBe(100);
    });

    it('should calculate average execution time', async () => {
      // Run multiple jobs
      for (let i = 0; i < 3; i++) {
        const oldFormat = {
          id: `job-${i}`,
          url: 'https://example.com',
          depth: 2,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      const aggregates = metrics.getAggregates();

      expect(aggregates.totalJobs).toBe(3);
      expect(aggregates.avgExecutionTime).toBeGreaterThan(0);
    });

    it('should provide recent jobs list', async () => {
      // Run multiple jobs
      for (let i = 0; i < 3; i++) {
        const oldFormat = {
          id: `job-${i}`,
          url: 'https://example.com',
          depth: 2,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      const recentJobs = metrics.getRecentJobs(10);

      expect(recentJobs.length).toBe(3);
      expect(recentJobs[0].jobId).toBeTruthy();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle partial execution (some phases fail)', async () => {
      mockParentAgent.execute = vi.fn(async (input) => {
        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime: Date.now() - 5000,
          phases: {
            discovery: { articles: [{ url: 'https://example.com/page1', title: 'Page 1' }] },
            detection: { players: [] }, // No players detected
            testing: { results: [] },
            bypass: { results: [] },
            evidence: { evidence: {} }
          },
          phaseTimes: { discovery: 1000, detection: 2000 },
          errors: [
            { phase: 'detection', message: 'No players found on any article' }
          ]
        };
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.status).toBe('success'); // Non-critical error
      expect(result.data.articles.length).toBe(1);
      expect(result.data.detections.length).toBe(0);
    });

    it('should mark job failed on critical errors', async () => {
      mockParentAgent.execute = vi.fn(async (input) => {
        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime: Date.now() - 5000,
          phases: {
            discovery: { articles: [] },
            detection: { players: [] },
            testing: { results: [] },
            bypass: { results: [] },
            evidence: { evidence: {} }
          },
          phaseTimes: {},
          errors: [
            { phase: 'discovery', message: 'Could not discover any articles', critical: true }
          ]
        };
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.status).toBe('failed');
      expect(result.metrics.errorCount).toBeGreaterThan(0);
    });

    it('should handle parent agent crash', async () => {
      mockParentAgent.execute = vi.fn(async () => {
        throw new Error('Parent agent crashed');
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Parent agent crashed');
      expect(result.data).toBeNull();
    });
  });

  describe('Response Consistency', () => {
    it('should always return consistent response format', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      // Check response structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metrics');

      // Check data structure
      expect(result.data).toHaveProperty('articles');
      expect(result.data).toHaveProperty('detections');
      expect(result.data).toHaveProperty('tests');
      expect(result.data).toHaveProperty('bypasses');
      expect(result.data).toHaveProperty('evidence');

      // Check metrics structure
      expect(result.metrics).toHaveProperty('executionTime');
      expect(result.metrics).toHaveProperty('timestamp');
      expect(result.metrics).toHaveProperty('phases');
    });

    it('should maintain data types throughout execution', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(typeof result.id).toBe('string');
      expect(typeof result.status).toBe('string');
      expect(Array.isArray(result.data.articles)).toBe(true);
      expect(Array.isArray(result.data.detections)).toBe(true);
      expect(Array.isArray(result.data.tests)).toBe(true);
      expect(Array.isArray(result.data.bypasses)).toBe(true);
      expect(typeof result.data.evidence).toBe('object');
    });
  });

  describe('Multiple Job Execution', () => {
    it('should handle sequential job execution', async () => {
      const jobs = [
        { id: 'job-1', url: 'https://site1.com', depth: 1, options: {} },
        { id: 'job-2', url: 'https://site2.com', depth: 2, options: {} },
        { id: 'job-3', url: 'https://site3.com', depth: 1, options: {} }
      ];

      const results = [];
      for (const job of jobs) {
        const result = await adapter.executeJob(job);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'success')).toBe(true);
      expect(results.every(r => r.id)).toBe(true);
    });

    it('should isolate metrics between jobs', async () => {
      const job1 = { id: 'job-1', url: 'https://site1.com', depth: 1, options: {} };
      const job2 = { id: 'job-2', url: 'https://site2.com', depth: 2, options: {} };

      await adapter.executeJob(job1);
      await adapter.executeJob(job2);

      const metrics1 = metrics.getJobMetrics('job-1');
      const metrics2 = metrics.getJobMetrics('job-2');

      expect(metrics1.jobId).not.toBe(metrics2.jobId);
      expect(metrics1).not.toEqual(metrics2);
    });
  });
});
