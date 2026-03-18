/**
 * sub-agent-invocation.test.js
 * Tests for invoking sub-agents via parent agent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QAParentAgent } from '../../../agents/core/agents/QAParentAgent.js';
import { AgnoRegistry } from '../../../agents/core/base/AgnoRegistry.js';
import { SessionMemoryStore } from '../../../agents/core/memory/SessionMemoryStore.js';
import { PersistentMemory } from '../../../agents/core/memory/PersistentMemory.js';
import { MemoryService } from '../../../agents/core/memory/MemoryService.js';

describe('QAParentAgent - Sub-Agent Invocation', () => {
  let agent;
  let registry;
  let memory;
  let logger;

  // Mock sub-agents
  const mockDiscoveryAgent = {
    execute: vi.fn(),
    getMetadata: vi.fn(() => ({ name: 'DiscoverySubAgent' }))
  };

  const mockDetectionAgent = {
    execute: vi.fn(),
    getMetadata: vi.fn(() => ({ name: 'DetectionSubAgent' }))
  };

  const mockTestingAgent = {
    execute: vi.fn(),
    getMetadata: vi.fn(() => ({ name: 'TestingSubAgent' }))
  };

  const mockBypassAgent = {
    execute: vi.fn(),
    getMetadata: vi.fn(() => ({ name: 'BypassSubAgent' }))
  };

  const mockEvidenceAgent = {
    execute: vi.fn(),
    getMetadata: vi.fn(() => ({ name: 'EvidenceSubAgent' }))
  };

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

  describe('Discovery Sub-Agent Invocation', () => {
    it('should invoke discovery agent with correct input', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 5,
        articles: [
          { url: 'https://example.com/article1', source: 'sitemap' },
          { url: 'https://example.com/article2', source: 'rss' }
        ],
        methods: ['sitemap', 'rss']
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      await agent.phaseDiscovery(jobInput);

      expect(mockDiscoveryAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          targetUrl: 'https://example.com',
          depth: 2,
          maxArticles: 100
        })
      );

      expect(agent.sessionMemory.articles.length).toBe(2);
      expect(agent.sessionMemory.articleCount).toBe(5);
    });

    it('should handle discovery agent errors', async () => {
      mockDiscoveryAgent.execute.mockRejectedValue(
        new Error('Discovery timeout')
      );

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      agent.sessionMemory = await memory.createSession('job-123', 'example.com');
      agent.sessionMemory.errors = [];

      await expect(agent.phaseDiscovery(jobInput)).rejects.toThrow(
        'Discovery phase failed'
      );

      expect(agent.sessionMemory.errors.length).toBeGreaterThan(0);
      expect(agent.sessionMemory.errors[0].severity).toBe('error');
    });

    it('should log warning when no articles found', async () => {
      mockDiscoveryAgent.execute.mockResolvedValue({
        phase: 'discovery',
        domain: 'example.com',
        articleCount: 0,
        articles: [],
        methods: []
      });

      const jobInput = {
        jobId: 'job-123',
        domain: 'example.com',
        targetUrl: 'https://example.com'
      };

      agent.sessionMemory = await memory.createSession('job-123', 'example.com');
      agent.sessionMemory.errors = [];

      await agent.phaseDiscovery(jobInput);

      expect(agent.sessionMemory.errors.some(e => e.severity === 'warning')).toBe(
        true
      );
    });
  });

  describe('Detection Sub-Agent Invocation', () => {
    beforeEach(async () => {
      agent.sessionMemory = await memory.createSession('job-123', 'example.com');
      agent.sessionMemory.articles = [
        { url: 'https://example.com/article1' },
        { url: 'https://example.com/article2' }
      ];
      agent.sessionMemory.errors = [];
    });

    it('should invoke detection agent for each article in parallel', async () => {
      mockDetectionAgent.execute.mockResolvedValue({
        phase: 'detection',
        url: 'https://example.com/article1',
        playerCount: 1,
        players: [
          {
            id: 'html5-0',
            type: 'html5',
            selector: 'video#player'
          }
        ]
      });

      await agent.phaseDetection();

      expect(mockDetectionAgent.execute).toHaveBeenCalledTimes(2);
      expect(agent.sessionMemory.detectionResults.length).toBe(2);
    });

    it('should handle detection agent errors gracefully', async () => {
      mockDetectionAgent.execute
        .mockResolvedValueOnce({
          phase: 'detection',
          url: 'https://example.com/article1',
          playerCount: 1,
          players: [{ id: 'html5-0', type: 'html5' }]
        })
        .mockRejectedValueOnce(new Error('Navigation timeout'));

      await agent.phaseDetection();

      expect(agent.sessionMemory.detectionResults.length).toBe(2);
      expect(agent.sessionMemory.detectionResults[1]).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          playerCount: 0
        })
      );
    });

    it('should skip detection if no articles', async () => {
      agent.sessionMemory.articles = [];

      await agent.phaseDetection();

      expect(mockDetectionAgent.execute).not.toHaveBeenCalled();
      expect(agent.sessionMemory.phaseTimes.detection).toBe(0);
    });
  });

  describe('Testing Sub-Agent Invocation', () => {
    beforeEach(async () => {
      agent.sessionMemory = await memory.createSession('job-123', 'example.com');
      agent.sessionMemory.detectionResults = [
        {
          phase: 'detection',
          url: 'https://example.com/article1',
          playerCount: 2,
          players: [
            { id: 'player-1', type: 'html5', selector: 'video#1' },
            { id: 'player-2', type: 'hls', selector: 'video#2' }
          ]
        }
      ];
      agent.sessionMemory.errors = [];
    });

    it('should invoke testing agent for each detected player', async () => {
      mockTestingAgent.execute.mockResolvedValue({
        phase: 'testing',
        url: 'https://example.com/article1',
        playerId: 'player-1',
        playerType: 'html5',
        testResult: {
          playable: true,
          hasAudio: true,
          controlsWork: true,
          progressDetected: true,
          errors: []
        }
      });

      await agent.phaseTesting();

      expect(mockTestingAgent.execute).toHaveBeenCalledTimes(2);
      expect(agent.sessionMemory.testingResults.length).toBe(2);
    });

    it('should identify failed tests for bypass phase', async () => {
      mockTestingAgent.execute
        .mockResolvedValueOnce({
          phase: 'testing',
          url: 'https://example.com/article1',
          playerId: 'player-1',
          testResult: { playable: true }
        })
        .mockResolvedValueOnce({
          phase: 'testing',
          url: 'https://example.com/article1',
          playerId: 'player-2',
          testResult: { playable: false, error: 'blocked by cloudflare' }
        });

      await agent.phaseTesting();

      expect(agent.sessionMemory.failedTests.length).toBe(1);
      expect(agent.sessionMemory.failedTests[0].playerId).toBe('player-2');
    });

    it('should skip testing if no players detected', async () => {
      agent.sessionMemory.detectionResults = [];

      await agent.phaseTesting();

      expect(mockTestingAgent.execute).not.toHaveBeenCalled();
      expect(agent.sessionMemory.phaseTimes.testing).toBe(0);
    });
  });

  describe('Bypass Sub-Agent Invocation', () => {
    beforeEach(async () => {
      agent.sessionMemory = await memory.createSession('job-123', 'example.com');
      agent.sessionMemory.testingResults = [
        {
          phase: 'testing',
          url: 'https://example.com/article1',
          playerId: 'player-1',
          testResult: { playable: false, error: 'blocked' }
        }
      ];
      agent.sessionMemory.failedTests = agent.sessionMemory.testingResults;
      agent.sessionMemory.errors = [];
    });

    it('should invoke bypass agent only if tests failed', async () => {
      mockBypassAgent.execute.mockResolvedValue({
        phase: 'bypass',
        url: 'https://example.com/article1',
        wafDetected: 'cloudflare',
        bypassResult: { success: true, method: 'cloudflare-bypass' }
      });

      await agent.phaseBypass();

      expect(mockBypassAgent.execute).toHaveBeenCalled();
      expect(agent.sessionMemory.bypassResults.length).toBe(1);
    });

    it('should skip bypass phase if all tests passed', async () => {
      agent.sessionMemory.failedTests = [];

      await agent.phaseBypass();

      expect(mockBypassAgent.execute).not.toHaveBeenCalled();
      expect(agent.sessionMemory.phaseTimes.bypass).toBe(0);
    });

    it('should handle bypass agent errors gracefully', async () => {
      mockBypassAgent.execute.mockRejectedValue(new Error('Bypass failed'));

      await agent.phaseBypass();

      // Should not throw, should continue
      expect(agent.sessionMemory.errors.some(e => e.severity === 'warning')).toBe(
        true
      );
    });
  });

  describe('Evidence Sub-Agent Invocation', () => {
    beforeEach(async () => {
      agent.sessionMemory = await memory.createSession('job-123', 'example.com');
      agent.sessionMemory.detectionResults = [];
      agent.sessionMemory.testingResults = [];
      agent.sessionMemory.bypassResults = [];
      agent.sessionMemory.errors = [];
    });

    it('should invoke evidence agent with all results', async () => {
      mockEvidenceAgent.execute.mockResolvedValue({
        phase: 'evidence',
        jobId: 'job-123',
        evidence: {
          s3Urls: {},
          manifest: { jobId: 'job-123', artifacts: [] },
          aggregatedLogs: []
        }
      });

      await agent.phaseEvidence('job-123');

      expect(mockEvidenceAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-123',
          allResults: expect.any(Array)
        })
      );

      expect(agent.sessionMemory.evidenceResult).toBeDefined();
    });

    it('should handle evidence agent errors gracefully', async () => {
      mockEvidenceAgent.execute.mockRejectedValue(new Error('S3 upload failed'));

      await agent.phaseEvidence('job-123');

      // Should not throw, should continue
      expect(agent.sessionMemory.errors.some(e => e.severity === 'warning')).toBe(
        true
      );
    });
  });
});
