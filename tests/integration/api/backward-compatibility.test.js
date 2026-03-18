/**
 * backward-compatibility.test.js - Integration tests for old API format
 *
 * Tests that old API format (id, url, depth, options) continues to work
 * through the new LegacyAPIAdapter, ensuring 100% backward compatibility.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LegacyAPIAdapter } from '../../../agents/core/adapters/LegacyAPIAdapter.js';
import { Logger } from '../../../agents/core/monitoring/Logger.js';
import { Metrics } from '../../../agents/core/monitoring/Metrics.js';

describe('LegacyAPIAdapter - Backward Compatibility', () => {
  let adapter;
  let mockParentAgent;
  let logger;
  let metrics;

  beforeEach(() => {
    logger = new Logger({ name: 'test-logger', level: 'debug' });
    metrics = new Metrics();

    // Mock parent agent
    mockParentAgent = {
      execute: vi.fn(async (input) => {
        // Simulate parent agent returning new format result
        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime: Date.now() - 1000,
          phases: {
            discovery: {
              articles: [
                { url: 'https://example.com/article1', title: 'Article 1' },
                { url: 'https://example.com/article2', title: 'Article 2' }
              ]
            },
            detection: {
              players: [
                { url: 'https://example.com/article1', type: 'html5' },
                { url: 'https://example.com/article2', type: 'hls' }
              ]
            },
            testing: {
              results: [
                { url: 'https://example.com/article1', status: 'success' },
                { url: 'https://example.com/article2', status: 'failed' }
              ]
            },
            bypass: {
              results: []
            },
            evidence: {
              evidence: { s3Urls: ['https://s3.example.com/shot1.png'] }
            }
          },
          phaseTimes: {
            discovery: 100,
            detection: 200,
            testing: 300
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

  describe('Input Format Conversion', () => {
    it('should convert old format input to new format correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com/article',
        depth: 2,
        options: { maxArticles: 10 }
      };

      await adapter.executeJob(oldFormat);

      expect(mockParentAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-123',
          domain: 'example.com',
          targetUrl: 'https://example.com/article',
          depth: 2,
          options: { maxArticles: 10 }
        })
      );
    });

    it('should extract domain from URL correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://subdomain.example.com:8080/path/to/page',
        depth: 1,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      expect(mockParentAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'subdomain.example.com'
        })
      );
    });

    it('should use default depth if not provided', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        options: {}
      };

      await adapter.executeJob(oldFormat);

      expect(mockParentAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 2
        })
      );
    });
  });

  describe('Output Format Conversion', () => {
    it('should convert new format result to old format correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      // Check old format response structure
      expect(result).toHaveProperty('id', 'job-123');
      expect(result).toHaveProperty('status', 'success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metrics');

      // Check data structure
      expect(result.data).toHaveProperty('articles');
      expect(result.data).toHaveProperty('detections');
      expect(result.data).toHaveProperty('tests');
      expect(result.data).toHaveProperty('bypasses');
      expect(result.data).toHaveProperty('evidence');
    });

    it('should map articles correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.articles).toEqual([
        { url: 'https://example.com/article1', title: 'Article 1' },
        { url: 'https://example.com/article2', title: 'Article 2' }
      ]);
    });

    it('should map detections correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.detections).toEqual([
        { url: 'https://example.com/article1', type: 'html5' },
        { url: 'https://example.com/article2', type: 'hls' }
      ]);
    });

    it('should map tests correctly', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.tests).toEqual([
        { url: 'https://example.com/article1', status: 'success' },
        { url: 'https://example.com/article2', status: 'failed' }
      ]);
    });

    it('should include metrics in response', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.metrics).toHaveProperty('executionTime');
      expect(result.metrics).toHaveProperty('timestamp');
      expect(result.metrics).toHaveProperty('phases');
      expect(typeof result.metrics.executionTime).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle parent agent errors gracefully', async () => {
      mockParentAgent.execute = vi.fn(async () => {
        throw new Error('Parent agent failed');
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Parent agent failed');
      expect(result.data).toBeNull();
    });

    it('should return proper error format on conversion failure', async () => {
      // Create a scenario where result conversion fails
      mockParentAgent.execute = vi.fn(async () => {
        return {}; // Invalid result format
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      // Should still return valid old format response
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('metrics');
    });

    it('should mark job failed if parent agent returns with errors', async () => {
      mockParentAgent.execute = vi.fn(async (input) => {
        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime: Date.now() - 1000,
          phases: { discovery: { articles: [] } },
          phaseTimes: {},
          errors: [
            { phase: 'discovery', message: 'No articles found', critical: true }
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
    });
  });

  describe('Metrics Recording', () => {
    it('should record job metrics', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      const jobMetrics = metrics.getJobMetrics('job-123');
      expect(jobMetrics).toBeTruthy();
      expect(jobMetrics.status).toBe('success');
      expect(jobMetrics.articleCount).toBeGreaterThan(0);
    });

    it('should record errors in metrics on failure', async () => {
      mockParentAgent.execute = vi.fn(async () => {
        throw new Error('Test error');
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      const jobMetrics = metrics.getJobMetrics('job-123');
      expect(jobMetrics.status).toBe('failed');
      expect(jobMetrics.error).toBe('Test error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with query parameters', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com/page?param1=value1&param2=value2',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      expect(mockParentAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUrl: 'https://example.com/page?param1=value1&param2=value2'
        })
      );
    });

    it('should handle URLs with fragments', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com/page#section',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      expect(mockParentAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com'
        })
      );
    });

    it('should handle missing optional fields gracefully', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com'
        // depth and options are missing
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result).toHaveProperty('id', 'job-123');
      expect(result.status).toBe('success');
    });

    it('should handle empty options object', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      await adapter.executeJob(oldFormat);

      expect(mockParentAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {}
        })
      );
    });
  });

  describe('Response Format Compliance', () => {
    it('should always return response with required fields', async () => {
      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      // Required fields
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('metrics');

      // Status must be valid
      expect(['success', 'failed']).toContain(result.status);

      // Metrics must have required fields
      expect(result.metrics).toHaveProperty('executionTime');
      expect(result.metrics).toHaveProperty('timestamp');
    });

    it('should include error details in metrics on failure', async () => {
      mockParentAgent.execute = vi.fn(async () => {
        throw new Error('Detailed error message');
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.status).toBe('failed');
      expect(result.error).toBeTruthy();
      expect(result.metrics.timestamp).toBeTruthy();
    });

    it('should return empty arrays for missing phase data', async () => {
      mockParentAgent.execute = vi.fn(async (input) => {
        return {
          jobId: input.jobId,
          domain: input.domain,
          startTime: Date.now() - 1000,
          phases: {
            // Missing discovery, detection, testing, bypass, evidence
          },
          phaseTimes: {},
          errors: []
        };
      });

      const oldFormat = {
        id: 'job-123',
        url: 'https://example.com',
        depth: 2,
        options: {}
      };

      const result = await adapter.executeJob(oldFormat);

      expect(result.data.articles).toEqual([]);
      expect(result.data.detections).toEqual([]);
      expect(result.data.tests).toEqual([]);
      expect(result.data.bypasses).toEqual([]);
    });
  });
});
