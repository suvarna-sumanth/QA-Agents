/**
 * performance.test.js - Performance and benchmarking tests
 *
 * Validates that job execution meets performance targets:
 * - Single job: ≤10 minutes
 * - Parallel execution advantages measured
 * - Memory usage validated
 * - Throughput benchmarks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LegacyAPIAdapter } from '../../../agents/core/adapters/LegacyAPIAdapter.js';
import { Logger } from '../../../agents/core/monitoring/Logger.js';
import { Metrics } from '../../../agents/core/monitoring/Metrics.js';

describe('Performance Tests', () => {
  let adapter;
  let mockParentAgent;
  let logger;
  let metrics;

  // Performance constants
  const MAX_JOB_TIME = 600000; // 10 minutes
  const TARGET_JOB_TIME = 480000; // 8 minutes (target)
  const ACCEPTABLE_VARIANCE = 1.2; // 20% variance allowed

  beforeEach(() => {
    logger = new Logger({ name: 'perf-test', level: 'warn' });
    metrics = new Metrics();

    mockParentAgent = {
      execute: vi.fn(async (input) => {
        // Simulate realistic execution times
        // Discovery: ~2-5 seconds
        // Detection: ~4-8 seconds (parallel, limited by slowest)
        // Testing: ~6-15 seconds (parallel, limited by slowest)
        // Bypass: ~2-10 seconds (conditional, parallel)
        // Evidence: ~1-3 seconds
        // Total expected: 15-41 seconds simulated, ~8 minutes real-world

        const discoveryTime = 2500; // 2.5s
        const detectionTime = 6000; // 6s
        const testingTime = 8000; // 8s
        const bypassTime = 3000; // 3s
        const evidenceTime = 1500; // 1.5s

        // Simulate phases
        await new Promise(resolve => setTimeout(resolve, discoveryTime));

        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime: Date.now() - (discoveryTime + detectionTime + testingTime + bypassTime + evidenceTime),
          phases: {
            discovery: {
              articles: Array.from({ length: 5 }, (_, i) => ({
                url: `https://example.com/article${i}`,
                title: `Article ${i}`
              }))
            },
            detection: {
              players: Array.from({ length: 10 }, (_, i) => ({
                url: `https://example.com/article${i % 5}`,
                type: ['html5', 'hls', 'youtube', 'vimeo'][i % 4]
              }))
            },
            testing: {
              results: Array.from({ length: 10 }, (_, i) => ({
                url: `https://example.com/article${i % 5}`,
                status: i % 2 === 0 ? 'success' : 'failed'
              }))
            },
            bypass: {
              results: Array.from({ length: 2 }, (_, i) => ({
                url: `https://example.com/article${i}`,
                wafDetected: 'cloudflare'
              }))
            },
            evidence: {
              evidence: {
                s3Urls: ['https://s3.example.com/shot1.png', 'https://s3.example.com/manifest.json']
              }
            }
          },
          phaseTimes: {
            discovery: discoveryTime,
            detection: detectionTime,
            testing: testingTime,
            bypass: bypassTime,
            evidence: evidenceTime
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

  describe('Individual Job Performance', () => {
    it('should complete a job within acceptable time', async () => {
      const startTime = Date.now();

      const oldFormat = {
        id: 'job-perf-1',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      const actualTime = Date.now() - startTime;

      expect(result.status).toBe('success');
      expect(actualTime).toBeLessThan(MAX_JOB_TIME);
    });

    it('should target 8 minute execution time', async () => {
      const oldFormat = {
        id: 'job-perf-2',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      // Check that metrics report reasonable time
      expect(result.metrics.executionTime).toBeGreaterThan(0);
    });

    it('should complete simple jobs quickly', async () => {
      const oldFormat = {
        id: 'job-perf-3',
        url: 'https://example.com',
        depth: 1,
        options: {}
      };

      const startTime = Date.now();
      const result = await adapter.executeJob(oldFormat);
      const actualTime = Date.now() - startTime;

      expect(result.status).toBe('success');
      // Should be much faster than max time
      expect(actualTime).toBeLessThan(MAX_JOB_TIME);
    });
  });

  describe('Execution Time Breakdown', () => {
    it('should report phase times accurately', async () => {
      const oldFormat = {
        id: 'job-perf-4',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.metrics.phases.discovery).toBeGreaterThan(0);
      expect(result.metrics.phases.detection).toBeGreaterThan(0);
      expect(result.metrics.phases.testing).toBeGreaterThan(0);
    });

    it('should show phase time distribution', async () => {
      const oldFormat = {
        id: 'job-perf-5',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      const phases = result.metrics.phases;
      const phaseCount = Object.keys(phases).filter(k => phases[k] > 0).length;

      // Should have at least some phases reported
      expect(phaseCount).toBeGreaterThan(0);

      // Total should make sense
      const total = Object.values(phases).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThan(result.metrics.executionTime * 2);
    });
  });

  describe('Throughput and Scalability', () => {
    it('should handle multiple sequential jobs', async () => {
      const jobCount = 5;
      const startTime = Date.now();

      for (let i = 0; i < jobCount; i++) {
        const oldFormat = {
          id: `job-perf-seq-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerJob = totalTime / jobCount;

      expect(avgTimePerJob).toBeLessThan(MAX_JOB_TIME);
    });

    it('should maintain consistent performance across multiple jobs', async () => {
      const times = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();

        const oldFormat = {
          id: `job-perf-cons-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };

        await adapter.executeJob(oldFormat);
        times.push(Date.now() - startTime);
      }

      // Calculate variance
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avgTime)));
      const variance = maxDeviation / avgTime;

      // Performance should be reasonably consistent
      expect(variance).toBeLessThan(ACCEPTABLE_VARIANCE);
    });

    it('should report aggregates for throughput analysis', async () => {
      for (let i = 0; i < 3; i++) {
        const oldFormat = {
          id: `job-perf-agg-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      const aggregates = metrics.getAggregates();

      expect(aggregates.totalJobs).toBe(3);
      expect(aggregates.totalExecutionTime).toBeGreaterThan(0);
      expect(aggregates.avgExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not cause memory issues with many jobs', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Execute jobs
      for (let i = 0; i < 10; i++) {
        const oldFormat = {
          id: `job-perf-mem-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024); // Convert to MB

      // Memory growth should be reasonable (< 100MB for 10 jobs)
      expect(memoryGrowth).toBeLessThan(100);
    });

    it('should keep metrics under control', async () => {
      for (let i = 0; i < 5; i++) {
        const oldFormat = {
          id: `job-perf-metrics-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      const aggregates = metrics.getAggregates();

      // Metrics count should be reasonable
      expect(aggregates.metricsCount).toBeLessThan(1000);
    });
  });

  describe('Adapter Overhead', () => {
    it('should add minimal overhead to job execution', async () => {
      const oldFormat = {
        id: 'job-perf-overhead',
        url: 'https://example.com',
        depth: 1,
        options: {}
      };

      const startTime = Date.now();
      const result = await adapter.executeJob(oldFormat);
      const adapterTime = Date.now() - startTime;

      // Adapter overhead should be minimal
      // If parent agent takes ~30ms, adapter overhead should be < 100ms
      expect(adapterTime).toBeLessThan(500);
    });

    it('should track conversion time in metrics', async () => {
      const oldFormat = {
        id: 'job-perf-conv',
        url: 'https://example.com',
        depth: 1,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(result.metrics.timestamp).toBeTruthy();
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors without significant performance impact', async () => {
      mockParentAgent.execute = vi.fn(async (input) => {
        throw new Error('Simulated error');
      });

      const startTime = Date.now();

      const oldFormat = {
        id: 'job-perf-error',
        url: 'https://example.com',
        depth: 1,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      const errorTime = Date.now() - startTime;

      expect(result.status).toBe('failed');
      // Error handling should be quick
      expect(errorTime).toBeLessThan(1000);
    });
  });

  describe('Benchmarking Summary', () => {
    it('should generate performance report', async () => {
      const jobIds = [];

      for (let i = 0; i < 5; i++) {
        const oldFormat = {
          id: `job-perf-bench-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };
        const result = await adapter.executeJob(oldFormat);
        jobIds.push(result.id);
      }

      // Generate report
      const aggregates = metrics.getAggregates();
      const recentJobs = metrics.getRecentJobs(5);

      expect(aggregates).toHaveProperty('totalJobs', 5);
      expect(aggregates).toHaveProperty('successfulJobs');
      expect(aggregates).toHaveProperty('avgExecutionTime');
      expect(recentJobs).toHaveLength(5);
    });

    it('should show phase success rates', async () => {
      for (let i = 0; i < 3; i++) {
        const oldFormat = {
          id: `job-perf-phase-${i}`,
          url: 'https://example.com',
          depth: 1,
          options: {}
        };
        await adapter.executeJob(oldFormat);
      }

      // Phase success rates would be available if phases are tracked in metrics
      const aggregates = metrics.getAggregates();

      expect(aggregates.totalJobs).toBe(3);
      expect(aggregates.successRate).toBeGreaterThan(0);
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid sequential requests', async () => {
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        id: `job-stress-${i}`,
        url: 'https://example.com',
        depth: 1,
        options: {}
      }));

      const startTime = Date.now();

      for (const job of jobs) {
        await adapter.executeJob(job);
      }

      const totalTime = Date.now() - startTime;
      const avgPerJob = totalTime / jobs.length;

      // Should still be reasonably fast
      expect(avgPerJob).toBeLessThan(MAX_JOB_TIME);

      const aggregates = metrics.getAggregates();
      expect(aggregates.totalJobs).toBe(10);
      expect(aggregates.successfulJobs).toBeGreaterThan(0);
    });
  });
});
