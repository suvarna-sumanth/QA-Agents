/**
 * result-synthesis.test.js
 * Tests for result synthesis and status determination
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QAParentAgent } from '../../../agents/core/agents/QAParentAgent.js';
import { AgnoRegistry } from '../../../agents/core/base/AgnoRegistry.js';
import { SessionMemoryStore } from '../../../agents/core/memory/SessionMemoryStore.js';
import { PersistentMemory } from '../../../agents/core/memory/PersistentMemory.js';
import { MemoryService } from '../../../agents/core/memory/MemoryService.js';

describe('QAParentAgent - Result Synthesis', () => {
  let agent;

  beforeEach(() => {
    const logger = console;
    const registry = new AgnoRegistry({ logger });
    const sessionStore = new SessionMemoryStore({ logger });
    const persistentMemory = new PersistentMemory({ logger });
    const memory = new MemoryService(sessionStore, persistentMemory, { logger });

    agent = new QAParentAgent({
      logger,
      registry,
      memory,
      browser: {},
      proxy: {},
      s3: {}
    });
  });

  describe('Status Determination', () => {
    it('should return success status with no errors and results', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [{ url: 'https://example.com/article1' }],
        testingResults: [
          {
            url: 'https://example.com/article1',
            playerId: 'p1',
            testResult: { playable: true }
          }
        ],
        detectionResults: [
          {
            url: 'https://example.com/article1',
            playerCount: 1,
            players: []
          }
        ],
        bypassResults: [],
        evidenceResult: { phase: 'evidence', jobId: 'job-123' },
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.status).toBe('success');
    });

    it('should return partial status with errors but has results', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [
          {
            phase: 'detection',
            severity: 'error',
            message: 'One article failed'
          }
        ],
        articles: [{ url: 'https://example.com/article1' }],
        testingResults: [
          {
            url: 'https://example.com/article1',
            playerId: 'p1',
            testResult: { playable: true }
          }
        ],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.status).toBe('partial');
    });

    it('should return no-data status with no errors but no results', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.status).toBe('no-data');
    });

    it('should return failed status with errors and no results', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [
          {
            phase: 'discovery',
            severity: 'error',
            message: 'Discovery failed'
          }
        ],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.status).toBe('failed');
    });
  });

  describe('Summary Aggregation', () => {
    it('should count articles correctly', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [
          { url: 'https://example.com/article1' },
          { url: 'https://example.com/article2' },
          { url: 'https://example.com/article3' }
        ],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.summary.articlesFound).toBe(3);
    });

    it('should count detected players', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [
          {
            url: 'https://example.com/article1',
            playerCount: 2,
            players: [
              { id: 'p1', type: 'html5' },
              { id: 'p2', type: 'hls' }
            ]
          },
          {
            url: 'https://example.com/article2',
            playerCount: 1,
            players: [{ id: 'p3', type: 'youtube' }]
          }
        ],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.summary.playersDetected).toBe(3);
    });

    it('should count playable players', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        detectionResults: [],
        testingResults: [
          {
            url: 'https://example.com/article1',
            playerId: 'p1',
            testResult: { playable: true }
          },
          {
            url: 'https://example.com/article1',
            playerId: 'p2',
            testResult: { playable: false }
          },
          {
            url: 'https://example.com/article2',
            playerId: 'p3',
            testResult: { playable: true }
          }
        ],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.summary.playersPlayable).toBe(2);
    });

    it('should detect WAF encounters', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [
          {
            url: 'https://example.com/article1',
            wafDetected: 'cloudflare',
            bypassResult: { success: true }
          },
          {
            url: 'https://example.com/article2',
            wafDetected: 'unknown',
            bypassResult: { success: false }
          }
        ],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.summary.wafEncountered).toBe(true);
    });

    it('should mark evidence collected when present', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: {
          phase: 'evidence',
          jobId: 'job-123',
          evidence: { s3Urls: {}, manifest: {} }
        },
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.summary.evidenceCollected).toBe(true);
    });
  });

  describe('Success Rate Calculation', () => {
    it('should calculate success rate from testing results', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        detectionResults: [],
        testingResults: [
          { playerId: 'p1', testResult: { playable: true } },
          { playerId: 'p2', testResult: { playable: true } },
          { playerId: 'p3', testResult: { playable: false } },
          { playerId: 'p4', testResult: { playable: false } }
        ],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.metrics.successRate).toBe(0.5); // 2 playable out of 4
    });

    it('should return 0 success rate when no tests', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.metrics.successRate).toBe(0);
    });

    it('should return 1.0 success rate when all pass', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles: [],
        detectionResults: [],
        testingResults: [
          { playerId: 'p1', testResult: { playable: true } },
          { playerId: 'p2', testResult: { playable: true } }
        ],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.metrics.successRate).toBe(1.0);
    });
  });

  describe('Error Aggregation', () => {
    it('should include all errors in final report', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [
          {
            phase: 'discovery',
            severity: 'warning',
            message: 'No articles found'
          },
          {
            phase: 'detection',
            severity: 'error',
            message: 'One article failed'
          },
          {
            phase: 'bypass',
            severity: 'warning',
            message: 'Bypass not attempted'
          }
        ],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.errors).toHaveLength(3);
      expect(report.errors[0].phase).toBe('discovery');
      expect(report.errors[1].phase).toBe('detection');
      expect(report.errors[2].phase).toBe('bypass');
    });

    it('should track error severities', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [
          {
            phase: 'discovery',
            severity: 'warning',
            message: 'Warning message'
          },
          {
            phase: 'detection',
            severity: 'error',
            message: 'Error message'
          },
          {
            phase: 'testing',
            severity: 'critical',
            message: 'Critical message'
          }
        ],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.errors.filter(e => e.severity === 'warning')).toHaveLength(1);
      expect(report.errors.filter(e => e.severity === 'error')).toHaveLength(1);
      expect(report.errors.filter(e => e.severity === 'critical')).toHaveLength(1);
    });
  });

  describe('Metrics Collection', () => {
    it('should record all phase times', () => {
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime: Date.now() - 10000, // 10 seconds ago
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {
          discovery: 1000,
          detection: 2000,
          testing: 3000,
          bypass: 1500,
          evidence: 500
        },
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.metrics.phaseTimes.discovery).toBe(1000);
      expect(report.metrics.phaseTimes.detection).toBe(2000);
      expect(report.metrics.phaseTimes.testing).toBe(3000);
      expect(report.metrics.phaseTimes.bypass).toBe(1500);
      expect(report.metrics.phaseTimes.evidence).toBe(500);
    });

    it('should calculate total time', () => {
      const startTime = Date.now() - 10000;
      agent.currentJob = 'job-123';
      agent.sessionMemory = {
        startTime,
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.metrics.totalTime).toBeGreaterThanOrEqual(10000 - 100); // ~10 seconds
      expect(report.metrics.totalTime).toBeLessThan(10000 + 1000);
    });

    it('should include timestamps', () => {
      agent.currentJob = 'job-123';
      const now = Date.now();
      agent.sessionMemory = {
        startTime: now,
        errors: [],
        articles: [],
        testingResults: [],
        detectionResults: [],
        bypassResults: [],
        evidenceResult: null,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.metrics.startTime).toBe(now);
      expect(report.metrics.endTime).toBeGreaterThanOrEqual(now);
    });
  });

  describe('Details Aggregation', () => {
    it('should include all phase results in details', () => {
      agent.currentJob = 'job-123';
      const articles = [{ url: 'https://example.com/article1' }];
      const detections = [
        {
          url: 'https://example.com/article1',
          playerCount: 1,
          players: []
        }
      ];
      const tests = [
        {
          url: 'https://example.com/article1',
          playerId: 'p1',
          testResult: { playable: true }
        }
      ];
      const bypasses = [];
      const evidence = { phase: 'evidence', jobId: 'job-123' };

      agent.sessionMemory = {
        startTime: Date.now(),
        errors: [],
        articles,
        detectionResults: detections,
        testingResults: tests,
        bypassResults: bypasses,
        evidenceResult: evidence,
        phaseTimes: {},
        currentPhase: 'done'
      };

      const report = agent.synthesizeResults();

      expect(report.details.articles).toEqual(articles);
      expect(report.details.detections).toEqual(detections);
      expect(report.details.tests).toEqual(tests);
      expect(report.details.bypasses).toEqual(bypasses);
      expect(report.details.evidence).toEqual(evidence);
    });
  });
});
