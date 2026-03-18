/**
 * tests/unit/memory/SessionMemory.test.js - Tests for SessionMemory
 */

import { SessionMemory } from '../../../agents/core/memory/SessionMemory.js';

describe('SessionMemory', () => {
  let session;
  const jobId = 'job-123';
  const domain = 'example.com';

  beforeEach(() => {
    session = new SessionMemory(jobId, domain);
  });

  describe('constructor', () => {
    it('should create session with jobId and domain', () => {
      expect(session.jobId).toBe(jobId);
      expect(session.domain).toBe(domain);
    });

    it('should initialize empty arrays', () => {
      expect(session.articles).toEqual([]);
      expect(session.detectionResults).toEqual([]);
      expect(session.testingResults).toEqual([]);
      expect(session.failedTests).toEqual([]);
      expect(session.bypassResults).toEqual([]);
    });

    it('should initialize status', () => {
      expect(session.status).toBe('initialized');
    });

    it('should create default target profile', () => {
      expect(session.target).toBeDefined();
      expect(session.target.domain).toBe(domain);
      expect(session.target.successRate).toBe(0.5);
    });

    it('should accept site profile', () => {
      const profile = { domain, successRate: 0.8 };
      const sess = new SessionMemory(jobId, domain, profile);
      expect(sess.target.successRate).toBe(0.8);
    });
  });

  describe('setDiscoveryResults', () => {
    it('should set articles and methods', () => {
      const articles = [
        { url: 'https://example.com/1', title: 'Article 1' },
        { url: 'https://example.com/2', title: 'Article 2' }
      ];
      const methods = ['sitemap', 'rss'];

      session.setDiscoveryResults(articles, methods);

      expect(session.articles).toEqual(articles);
      expect(session.discoveryMethods).toEqual(methods);
      expect(session.articleCount).toBe(2);
      expect(session.currentPhase).toBe('discovery');
    });

    it('should update phase time', () => {
      const startTime = session.startTime;
      session.setDiscoveryResults([], []);

      expect(session.phaseTimes.discovery).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setDetectionResults', () => {
    it('should set detection results', () => {
      const results = [
        { url: 'https://example.com/1', players: [] },
        { url: 'https://example.com/2', players: [] }
      ];

      session.setDetectionResults(results);

      expect(session.detectionResults).toEqual(results);
      expect(session.currentPhase).toBe('detection');
    });
  });

  describe('setTestingResults', () => {
    it('should set testing results', () => {
      const results = [
        { playerId: 'p1', testResult: { playable: true } },
        { playerId: 'p2', testResult: { playable: false } }
      ];
      const failed = [results[1]];

      session.setTestingResults(results, failed);

      expect(session.testingResults).toEqual(results);
      expect(session.failedTests).toEqual(failed);
      expect(session.currentPhase).toBe('testing');
    });
  });

  describe('setBypassResults', () => {
    it('should set bypass results', () => {
      const results = [
        { url: 'https://example.com/1', bypassResult: { success: true } }
      ];

      session.setBypassResults(results);

      expect(session.bypassResults).toEqual(results);
      expect(session.currentPhase).toBe('bypass');
    });
  });

  describe('setEvidenceResult', () => {
    it('should set evidence result', () => {
      const result = {
        jobId,
        s3Urls: {},
        manifest: {}
      };

      session.setEvidenceResult(result);

      expect(session.evidenceResult).toEqual(result);
      expect(session.currentPhase).toBe('evidence');
    });
  });

  describe('addError', () => {
    it('should add error to array', () => {
      const error = new Error('Test error');
      session.addError(error, 'discovery');

      expect(session.errors.length).toBe(1);
      expect(session.errors[0].phase).toBe('discovery');
      expect(session.errors[0].message).toBe('Test error');
    });

    it('should include stack trace', () => {
      const error = new Error('Test error');
      session.addError(error, 'discovery');

      expect(session.errors[0].stack).toBeDefined();
    });
  });

  describe('getTotalTime', () => {
    it('should return elapsed time', () => {
      const total = session.getTotalTime();
      expect(total).toBeGreaterThanOrEqual(0);
      expect(typeof total).toBe('number');
    });

    it('should increase over time', async () => {
      const time1 = session.getTotalTime();
      await new Promise(resolve => setTimeout(resolve, 50));
      const time2 = session.getTotalTime();

      expect(time2).toBeGreaterThan(time1);
    });
  });

  describe('getSummary', () => {
    it('should return summary object', () => {
      session.articles = [{}, {}, {}];
      session.detectionResults = [{}, {}];
      session.testingResults = [{}];
      session.failedTests = [];
      session.bypassResults = [];
      session.errors = [];

      const summary = session.getSummary();

      expect(summary.jobId).toBe(jobId);
      expect(summary.domain).toBe(domain);
      expect(summary.articleCount).toBe(3);
      expect(summary.detectionCount).toBe(2);
      expect(summary.testingCount).toBe(1);
      expect(summary.failedCount).toBe(0);
      expect(summary.bypassCount).toBe(0);
      expect(summary.errorCount).toBe(0);
      expect(summary.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validate', () => {
    it('should pass with valid session', () => {
      const result = session.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail if jobId missing', () => {
      session.jobId = null;
      const result = session.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('jobId is required');
    });

    it('should fail if domain missing', () => {
      session.domain = null;
      const result = session.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('domain is required');
    });

    it('should fail if articles not array', () => {
      session.articles = 'not array';
      const result = session.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('articles must be an array');
    });
  });

  describe('toObject', () => {
    it('should return all fields', () => {
      session.articles = [{ url: 'https://example.com/1' }];
      session.errors = [{ message: 'error' }];

      const obj = session.toObject();

      expect(obj.jobId).toBe(jobId);
      expect(obj.domain).toBe(domain);
      expect(obj.articles).toEqual([{ url: 'https://example.com/1' }]);
      expect(obj.errors).toEqual([{ message: 'error' }]);
      expect(obj.status).toBe('initialized');
    });
  });
});
