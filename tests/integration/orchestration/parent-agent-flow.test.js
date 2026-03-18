/**
 * parent-agent-flow.test.js
 * Tests for complete 5-phase orchestration flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QAParentAgent } from '../../../agents/core/agents/QAParentAgent.js';
import { AgnoRegistry } from '../../../agents/core/base/AgnoRegistry.js';
import { SessionMemoryStore } from '../../../agents/core/memory/SessionMemoryStore.js';
import { PersistentMemory } from '../../../agents/core/memory/PersistentMemory.js';
import { MemoryService } from '../../../agents/core/memory/MemoryService.js';

describe('QAParentAgent - Complete Flow', () => {
  let agent;
  let registry;
  let memory;
  let logger;

  // Mock sub-agents
  const createMockAgent = (name) => ({
    execute: vi.fn(),
    getMetadata: vi.fn(() => ({ name }))
  });

  const mockDiscoveryAgent = createMockAgent('DiscoverySubAgent');
  const mockDetectionAgent = createMockAgent('DetectionSubAgent');
  const mockTestingAgent = createMockAgent('TestingSubAgent');
  const mockBypassAgent = createMockAgent('BypassSubAgent');
  const mockEvidenceAgent = createMockAgent('EvidenceSubAgent');

  beforeEach(() => {
    logger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    registry = new AgnoRegistry({ logger });

    // Register mock agents
    registry.registerAgent(mockDiscoveryAgent);
    registry.registerAgent(mockDetectionAgent);
    registry.registerAgent(mockTestingAgent);
    registry.registerAgent(mockBypassAgent);
    registry.registerAgent(mockEvidenceAgent);

    // Create memory service
    const sessionStore = new SessionMemoryStore({ logger });
    const persistentMemory = new PersistentMemory({ logger });
    memory = new MemoryService(sessionStore, persistentMemory, { logger });

    // Create parent agent
    agent = new QAParentAgent({
      logger,
      registry,
      memory,
      browser: {},
      proxy: {},
      s3: {}
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path - All phases succeed', () => {
    beforeEach(() => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 2,
        articles: [
          { url: 'https://example.com/article1', source: 'sitemap' },
          { url: 'https://example.com/article2', source: 'rss' }
        ],
        methods: ['sitemap', 'rss']
      });

      mockDetectionAgent.execute.mockResolvedValue({
        phase: 'detection',
        url: 'https://example.com/article1',
        playerCount: 1,
        players: [
          {
            id: 'html5-0',
            type: 'html5',
            selector: 'video#player',
            sources: [{ src: 'https://example.com/video.mp4', type: 'video/mp4' }]
          }
        ]
      });

      mockTestingAgent.execute.mockResolvedValue({
        phase: 'testing',
        url: 'https://example.com/article1',
        playerId: 'html5-0',
        playerType: 'html5',
        testResult: {
          playable: true,
          hasAudio: true,
          controlsWork: true,
          progressDetected: true,
          errors: []
        }
      });

      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: {
          s3Urls: { 'https://example.com/article1': 'https://s3.../job-123/...' },
          manifest: {
            jobId: 'job-123',
            timestamp: new Date().toISOString(),
            artifacts: []
          },
          aggregatedLogs: []
        }
      });
    });

    it('should execute all 5 phases successfully', async () => {
      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      const result = await agent.execute(jobInput);

      expect(result.status).toBe('success');
      expect(result.data.status).toBe('success');
      expect(result.data.summary.articlesFound).toBe(2);
      expect(result.data.summary.playersDetected).toBeGreaterThan(0);
      expect(result.data.summary.playersPlayable).toBeGreaterThan(0);
      expect(result.data.summary.evidenceCollected).toBe(true);
    });

    it('should execute phases in correct order', async () => {
      const executionOrder = [];

      mockDiscoveryAgent.execute.mockImplementation(async (input) => {
        executionOrder.push('discovery');
        return {
          phase: 'discovery',
          domain: 'example.com',
          articleCount: 1,
          articles: [{ url: 'https://example.com/article1' }],
          methods: ['sitemap']
        };
      });

      mockDetectionAgent.execute.mockImplementation(async (input) => {
        executionOrder.push('detection');
        return {
          phase: 'detection',
          url: input.url,
          playerCount: 1,
          players: [{ id: 'p1', type: 'html5', selector: 'video' }]
        };
      });

      mockTestingAgent.execute.mockImplementation(async (input) => {
        executionOrder.push('testing');
        return {
          phase: 'testing',
          url: input.url,
          playerId: 'p1',
          playerType: 'html5',
          testResult: { playable: true }
        };
      });

      mockEvidenceAgent.execute.mockImplementation(async (input) => {
        executionOrder.push('evidence');
        return {
          phase: 'evidence',
          jobId: 'job-123',
          evidence: { s3Urls: {}, manifest: {} }
        };
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      await agent.execute(jobInput);

      expect(executionOrder[0]).toBe('discovery');
      expect(executionOrder[executionOrder.length - 1]).toBe('evidence');
    });

    it('should record phase execution times', async () => {
      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      const result = await agent.execute(jobInput);

      expect(result.data.metrics.phaseTimes).toBeDefined();
      expect(result.data.metrics.phaseTimes.discovery).toBeGreaterThanOrEqual(0);
      expect(result.data.metrics.phaseTimes.detection).toBeGreaterThanOrEqual(0);
      expect(result.data.metrics.phaseTimes.testing).toBeGreaterThanOrEqual(0);
      expect(result.data.metrics.phaseTimes.evidence).toBeGreaterThanOrEqual(0);
      expect(result.data.metrics.totalTime).toBeGreaterThan(0);
    });
  });

  describe('Bypass Phase Activation', () => {
    it('should activate bypass only when tests fail', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 1,
        articles: [{ url: 'https://example.com/article1' }],
        methods: ['sitemap']
      });

      mockDetectionAgent.execute.mockResolvedValue({
        phase: 'detection',
        url: 'https://example.com/article1',
        playerCount: 1,
        players: [{ id: 'p1', type: 'html5', selector: 'video' }]
      });

      mockTestingAgent.execute.mockResolvedValue({
        phase: 'testing',
        url: 'https://example.com/article1',
        playerId: 'p1',
        playerType: 'html5',
        testResult: {
          playable: false,
          hasAudio: false,
          controlsWork: false,
          progressDetected: false,
          error: 'blocked by cloudflare'
        }
      });

      mockBypassAgent.execute.mockResolvedValue({
        phase: 'bypass',
        url: 'https://example.com/article1',
        wafDetected: 'cloudflare',
        bypassResult: {
          success: true,
          method: 'cloudflare-bypass',
          attempts: 1
        }
      });

      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: { s3Urls: {}, manifest: {} }
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      const result = await agent.execute(jobInput);

      expect(mockBypassAgent.execute).toHaveBeenCalled();
      expect(result.data.summary.wafEncountered).toBe(true);
    });

    it('should skip bypass phase when all tests pass', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 1,
        articles: [{ url: 'https://example.com/article1' }],
        methods: ['sitemap']
      });

      mockDetectionAgent.execute.mockResolvedValue({
        phase: 'detection',
        url: 'https://example.com/article1',
        playerCount: 1,
        players: [{ id: 'p1', type: 'html5', selector: 'video' }]
      });

      mockTestingAgent.execute.mockResolvedValue({
        phase: 'testing',
        url: 'https://example.com/article1',
        playerId: 'p1',
        playerType: 'html5',
        testResult: { playable: true }
      });

      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: { s3Urls: {}, manifest: {} }
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      await agent.execute(jobInput);

      expect(mockBypassAgent.execute).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should fail if discovery fails', async () => {
      mockDiscoveryAgent.execute.mockRejectedValue(
        new Error('Discovery error')
      );

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      await expect(agent.execute(jobInput)).rejects.toThrow(
        'Discovery phase failed'
      );
    });

    it('should continue if detection fails on some articles', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 2,
        articles: [
          { url: 'https://example.com/article1' },
          { url: 'https://example.com/article2' }
        ],
        methods: ['sitemap']
      });

      mockDetectionAgent.execute
        .mockResolvedValueOnce({
          phase: 'detection',
          url: 'https://example.com/article1',
          playerCount: 1,
          players: [{ id: 'p1', type: 'html5', selector: 'video' }]
        })
        .mockRejectedValueOnce(new Error('Timeout on article2'));

      mockTestingAgent.execute.mockResolvedValue({
        phase: 'testing',
        url: 'https://example.com/article1',
        playerId: 'p1',
        playerType: 'html5',
        testResult: { playable: true }
      });

      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: { s3Urls: {}, manifest: {} }
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      const result = await agent.execute(jobInput);

      // Should continue and succeed with partial results
      expect(result.status).toBe('success');
      expect(result.data.detections).toHaveLength(2);
      expect(result.data.detections[1]).toHaveProperty('error');
    });

    it('should return partial status when some phases fail', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 1,
        articles: [{ url: 'https://example.com/article1' }],
        methods: ['sitemap']
      });

      mockDetectionAgent.execute.mockRejectedValue(new Error('Detection error'));

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      await expect(agent.execute(jobInput)).rejects.toThrow('Detection phase failed');
    });
  });

  describe('Status Determination', () => {
    it('should return success status when all passes', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 1,
        articles: [{ url: 'https://example.com/article1' }],
        methods: ['sitemap']
      });

      mockDetectionAgent.execute.mockResolvedValue({
        phase: 'detection',
        url: 'https://example.com/article1',
        playerCount: 1,
        players: [{ id: 'p1', type: 'html5', selector: 'video' }]
      });

      mockTestingAgent.execute.mockResolvedValue({
        phase: 'testing',
        url: 'https://example.com/article1',
        playerId: 'p1',
        playerType: 'html5',
        testResult: { playable: true }
      });

      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: { s3Urls: {}, manifest: {} }
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      const result = await agent.execute(jobInput);

      expect(result.data.status).toBe('success');
    });

    it('should return no-data status when no results collected', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 0,
        articles: [],
        methods: []
      });

      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: { s3Urls: {}, manifest: {} }
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      const result = await agent.execute(jobInput);

      expect(result.data.status).toBe('no-data');
    });
  });

  describe('Input Validation', () => {
    it('should reject missing jobId', async () => {
      const jobInput = {
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      await expect(agent.execute(jobInput)).rejects.toThrow();
    });

    it('should reject missing domain', async () => {
      const jobInput = {
        jobId: 'job-123',
        targetUrl: 'https://example.com'
      };

      await expect(agent.execute(jobInput)).rejects.toThrow();
    });

    it('should reject missing targetUrl', async () => {
      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com'
      };

      await expect(agent.execute(jobInput)).rejects.toThrow();
    });
  });
});
