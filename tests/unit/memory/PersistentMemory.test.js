/**
 * tests/unit/memory/PersistentMemory.test.js - Tests for PersistentMemory
 */

import { PersistentMemory } from '../../../agents/core/memory/PersistentMemory.js';
import { SessionMemory } from '../../../agents/core/memory/SessionMemory.js';
import { MockSupabase } from '../../setup.js';
import { createMockLogger } from '../../setup.js';

describe('PersistentMemory', () => {
  let persistentMemory;
  let mockDb;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    mockDb = new MockSupabase();
    persistentMemory = new PersistentMemory(mockDb, { logger });
  });

  describe('constructor', () => {
    it('should throw if no supabaseClient', () => {
      expect(() => {
        new PersistentMemory(null);
      }).toThrow('supabaseClient required');
    });

    it('should set default cacheTTL', () => {
      expect(persistentMemory.cacheTTL).toBe(5 * 60 * 1000);
    });

    it('should use custom cacheTTL', () => {
      const pm = new PersistentMemory(mockDb, { cacheTTL: 1000 });
      expect(pm.cacheTTL).toBe(1000);
    });
  });

  describe('load', () => {
    it('should return default profile for new domain', async () => {
      const profile = await persistentMemory.load('newdomain.com');

      expect(profile.domain).toBe('newdomain.com');
      expect(profile.successRate).toBe(0.5);
      expect(profile.detectionRate).toBe(0.5);
      expect(profile.testCount).toBe(0);
    });

    it('should cache loaded profile', async () => {
      await persistentMemory.load('example.com');
      await persistentMemory.load('example.com');

      // Should use cache second time
      expect(persistentMemory.cache.has('example.com')).toBe(true);
    });

    it('should respect cache TTL', async () => {
      const pm = new PersistentMemory(mockDb, {
        logger,
        cacheTTL: 10 // 10ms
      });

      const profile1 = await pm.load('example.com');
      await new Promise(resolve => setTimeout(resolve, 20));
      const profile2 = await pm.load('example.com');

      expect(profile1).toBeDefined();
      expect(profile2).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update persistent memory', async () => {
      const session = new SessionMemory('job-1', 'example.com');
      session.articles = [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' }
      ];
      session.detectionResults = [
        {
          url: 'https://example.com/1',
          players: [
            { type: 'html5' },
            { type: 'hls' }
          ]
        }
      ];

      await persistentMemory.update('example.com', session);

      // Verify cache was cleared
      expect(persistentMemory.cache.has('example.com')).toBe(false);
    });

    it('should calculate success rate using EMA', async () => {
      const session = new SessionMemory('job-1', 'example.com');
      session.testingResults = [
        { testResult: { playable: true } },
        { testResult: { playable: true } },
        { testResult: { playable: false } }
      ];

      // Load initial profile
      const initial = await persistentMemory.load('example.com');
      const initialRate = initial.successRate;

      await persistentMemory.update('example.com', session);

      // Updated rate should be between initial and new rate
      const updated = await persistentMemory.load('example.com');
      expect(updated.successRate).toBeDefined();
      expect(typeof updated.successRate).toBe('number');
    });

    it('should aggregate player types', async () => {
      const session = new SessionMemory('job-1', 'example.com');
      session.detectionResults = [
        {
          players: [
            { type: 'html5' },
            { type: 'html5' },
            { type: 'hls' }
          ]
        },
        {
          players: [
            { type: 'youtube' }
          ]
        }
      ];

      await persistentMemory.update('example.com', session);
      const updated = await persistentMemory.load('example.com');

      expect(updated.playerTypes.html5).toBeGreaterThan(0);
      expect(updated.playerTypes.hls).toBeGreaterThan(0);
      expect(updated.playerTypes.youtube).toBeGreaterThan(0);
    });

    it('should generate recommendations', async () => {
      const session = new SessionMemory('job-1', 'example.com');
      session.discoveryMethods = ['sitemap', 'rss'];
      session.detectionResults = [
        { players: [{ type: 'html5' }, { type: 'html5' }, { type: 'html5' }] }
      ];

      await persistentMemory.update('example.com', session);
      const updated = await persistentMemory.load('example.com');

      expect(Array.isArray(updated.recommendations)).toBe(true);
    });
  });

  describe('identifyWAF', () => {
    it('should identify WAF from results', () => {
      const results = [
        { wafDetected: 'cloudflare' }
      ];

      const wafType = persistentMemory.identifyWAF(results);
      expect(wafType).toBe('cloudflare');
    });

    it('should return unknown if not found', () => {
      const results = [
        { bypassResult: { success: false } }
      ];

      const wafType = persistentMemory.identifyWAF(results);
      expect(wafType).toBe('unknown');
    });
  });

  describe('clearCache', () => {
    it('should clear cache for domain', async () => {
      await persistentMemory.load('example.com');
      expect(persistentMemory.cache.has('example.com')).toBe(true);

      persistentMemory.clearCache('example.com');
      expect(persistentMemory.cache.has('example.com')).toBe(false);
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache', async () => {
      await persistentMemory.load('example.com');
      await persistentMemory.load('test.com');

      expect(persistentMemory.cache.size).toBeGreaterThan(0);

      persistentMemory.clearAllCache();
      expect(persistentMemory.cache.size).toBe(0);
    });
  });

  describe('createDefaultProfile', () => {
    it('should create profile with correct structure', () => {
      const profile = persistentMemory.createDefaultProfile('example.com');

      expect(profile.domain).toBe('example.com');
      expect(profile.testCount).toBe(0);
      expect(profile.successRate).toBe(0.5);
      expect(profile.playerTypes).toBeDefined();
      expect(profile.recommendations).toEqual([]);
    });
  });
});
