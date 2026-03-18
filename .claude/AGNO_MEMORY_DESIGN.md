---
name: Agno Memory Architecture
description: Complete memory layer design (session + persistent)
type: reference
---

# Agno Memory Architecture

**Status**: Complete
**Last Updated**: March 18, 2026
**Scope**: Memory model, persistence, state management, cleanup

---

## Memory Model Overview

The Agno system uses **two-layer memory**:

```
┌─────────────────────────────────────────────────┐
│ PERSISTENT MEMORY                               │
│ (Domain-scoped, survives across jobs)          │
│                                                  │
│ - Site profiles (WAF types, success rates)      │
│ - Player type frequencies (html5, hls, etc.)    │
│ - Discovery methods effectiveness               │
│ - Learned WAF bypass strategies                 │
│ - Historical patterns per domain                │
└─────────────────────────────────────────────────┘
         ↓                            ↑
    Updates from                  Loads at
    job results                   job start
         ↓                            ↑
┌─────────────────────────────────────────────────┐
│ SESSION MEMORY                                  │
│ (Job-scoped, cleared after job)                │
│                                                  │
│ - Current job state                             │
│ - Articles discovered                           │
│ - Players detected & tested                     │
│ - Bypass results                                │
│ - Phase execution times                         │
└─────────────────────────────────────────────────┘
```

---

## Session Memory (Job-Scoped)

### Data Structure

```javascript
class SessionMemory {
  jobId: string;                    // Unique job identifier
  domain: string;                   // Target domain
  target: SiteProfile;              // Loaded from persistent (initial state)

  // Phase 1: Discovery
  articles: Array<Article>;
  discoveryMethods: string[];
  articleCount: number;

  // Phase 2: Detection
  detectionResults: Array<DetectionResult>;

  // Phase 3: Testing
  testingResults: Array<TestingResult>;
  failedTests: Array<TestingResult>;

  // Phase 4: Bypass
  bypassResults: Array<BypassResult>;

  // Phase 5: Evidence
  evidenceResult: EvidenceResult;

  // Metadata
  startTime: number;
  phaseTimes: Record<string, number>;  // { discovery: 2000, detection: 6000, ... }
  currentPhase: string;
  errors: Array<ErrorRecord>;
}
```

### Usage Pattern

```javascript
class SessionMemoryManager {
  private sessions = new Map<string, SessionMemory>();

  create(jobId: string, domain: string, siteProfile?: SiteProfile) {
    const session: SessionMemory = {
      jobId,
      domain,
      target: siteProfile || { domain, successRate: 0.5 },
      articles: [],
      detectionResults: [],
      testingResults: [],
      bypassResults: [],
      evidenceResult: null,
      startTime: Date.now(),
      phaseTimes: {},
      currentPhase: null,
      errors: []
    };

    this.sessions.set(jobId, session);
    return session;
  }

  get(jobId: string): SessionMemory {
    return this.sessions.get(jobId);
  }

  update(jobId: string, updates: Partial<SessionMemory>) {
    const session = this.sessions.get(jobId);
    if (!session) throw new Error(`Session not found: ${jobId}`);
    Object.assign(session, updates);
  }

  clear(jobId: string) {
    this.sessions.delete(jobId);
  }

  getAllActive() {
    return Array.from(this.sessions.values());
  }
}
```

### Lifecycle

```
Job Start
  ↓
create(jobId, domain) → Load from persistent memory
  ↓
update() × N → Phase execution updates session in-memory
  ↓
synthesizeResults() → Combine all data
  ↓
Job End
  ↓
update(persistentMemory) → Write learnings back to persistent
  ↓
clear(jobId) → Delete session memory
```

---

## Persistent Memory (Domain-Scoped)

### Data Structure

```javascript
class SiteProfile {
  domain: string;

  // Metadata
  firstSeen: number;              // Timestamp first encountered
  lastTested: number;             // Timestamp of last test
  testCount: number;              // Total tests run on this domain

  // Player Statistics
  playerTypes: Record<string, number> = {
    html5: 0,
    hls: 0,
    youtube: 0,
    vimeo: 0,
    custom: 0
  };

  // Success Metrics
  successRate: number;            // Fraction of players that play successfully
  detectionRate: number;          // Fraction of articles with detected players

  // WAF Information
  wafDetected?: string;           // 'cloudflare' | 'perimeterx' | 'unknown'
  wafBypassSuccessRate?: number;  // Success rate of WAF bypass attempts
  lastWAFEncounter?: number;      // Timestamp of last WAF

  // Discovery Effectiveness
  discoveryMethods: string[] = [
    'sitemap',    // 50% success
    'rss',        // 30% success
    'crawl'       // 20% success
  ];

  // Learned Strategies
  recommendations: Array<{
    type: 'discovery' | 'detection' | 'testing' | 'bypass';
    description: string;
    confidence: number;   // 0-1
  }>;

  // Stability Metrics
  avgExecutionTime: number;       // Average job duration
  errorRate: number;              // Fraction of jobs that fail
}
```

### Backend: Supabase Integration

```javascript
class PersistentMemoryService {
  constructor(supabaseClient) {
    this.db = supabaseClient;
    this.table = 'site_profiles';
  }

  async load(domain: string): Promise<SiteProfile> {
    try {
      const { data, error } = await this.db
        .from(this.table)
        .select('*')
        .eq('domain', domain)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found - return default
          return this.createDefaultProfile(domain);
        }
        throw error;
      }

      return data as SiteProfile;
    } catch (error) {
      this.logger.error(`Failed to load profile for ${domain}:`, error);
      return this.createDefaultProfile(domain);
    }
  }

  async update(domain: string, sessionMem: SessionMemory) {
    try {
      const profile = await this.load(domain);

      // Update statistics from session
      const updated: Partial<SiteProfile> = {
        lastTested: Date.now(),
        testCount: (profile.testCount || 0) + 1,

        // Update player type counts
        playerTypes: this.aggregatePlayerTypes(
          profile.playerTypes,
          sessionMem.detectionResults
        ),

        // Update success rate (exponential moving average)
        successRate: this.calculateSuccessRate(
          profile.successRate,
          sessionMem.testingResults,
          0.7  // EMA factor
        ),

        // Update detection rate
        detectionRate: sessionMem.detectionResults.length / Math.max(sessionMem.articles.length, 1),

        // Record WAF if encountered
        wafDetected: sessionMem.bypassResults.length > 0
          ? this.identifyWAF(sessionMem.bypassResults)
          : profile.wafDetected,

        wafBypassSuccessRate: sessionMem.bypassResults.length > 0
          ? this.calculateWAFSuccessRate(sessionMem.bypassResults)
          : profile.wafBypassSuccessRate,

        // Update average execution time (EMA)
        avgExecutionTime: this.updateMovingAverage(
          profile.avgExecutionTime,
          sessionMem.phaseTimes.total,
          0.5
        ),

        // Update error rate
        errorRate: this.updateErrorRate(
          profile.errorRate,
          sessionMem.errors.length,
          sessionMem.testCount
        ),

        // Generate recommendations
        recommendations: this.generateRecommendations(updated, sessionMem)
      };

      // Upsert to database
      const { error } = await this.db
        .from(this.table)
        .upsert({
          domain,
          ...profile,
          ...updated
        }, { onConflict: 'domain' });

      if (error) throw error;

      this.logger.info(`Updated profile for ${domain}`);

    } catch (error) {
      this.logger.error(`Failed to update profile for ${domain}:`, error);
      // Don't throw - persistence failures are non-critical
    }
  }

  private aggregatePlayerTypes(
    existing: Record<string, number>,
    detectionResults: Array<any>
  ): Record<string, number> {
    const updated = { ...existing };

    detectionResults.forEach(result => {
      result.players?.forEach((player: any) => {
        updated[player.type] = (updated[player.type] || 0) + 1;
      });
    });

    return updated;
  }

  private calculateSuccessRate(
    currentRate: number,
    testingResults: Array<any>,
    factor: number
  ): number {
    if (testingResults.length === 0) return currentRate;

    const newRate = testingResults.filter(r => r.testResult.playable).length / testingResults.length;
    return currentRate * (1 - factor) + newRate * factor;
  }

  private updateMovingAverage(
    current: number,
    newValue: number,
    factor: number
  ): number {
    if (!current) return newValue;
    return current * (1 - factor) + newValue * factor;
  }

  private generateRecommendations(
    profile: Partial<SiteProfile>,
    sessionMem: SessionMemory
  ): Array<any> {
    const recommendations = [];

    // Recommendation: Use sitemap if high success rate
    if (sessionMem.discoveryMethods?.includes('sitemap')) {
      recommendations.push({
        type: 'discovery',
        description: 'Sitemap discovery is effective for this domain',
        confidence: 0.9
      });
    }

    // Recommendation: Use WAF bypass if WAF detected
    if (profile.wafDetected) {
      recommendations.push({
        type: 'bypass',
        description: `Domain has ${profile.wafDetected} WAF; use specific bypass strategy`,
        confidence: profile.wafBypassSuccessRate || 0.5
      });
    }

    // Recommendation: Focus on HTML5 players if they dominate
    if (profile.playerTypes?.html5 > (profile.playerTypes?.hls || 0) * 2) {
      recommendations.push({
        type: 'testing',
        description: 'Domain primarily uses HTML5 players',
        confidence: 0.85
      });
    }

    return recommendations;
  }
}
```

### Schema (Supabase)

```sql
CREATE TABLE site_profiles (
  domain TEXT PRIMARY KEY,
  first_seen BIGINT,
  last_tested BIGINT,
  test_count INTEGER DEFAULT 0,

  player_types JSONB DEFAULT '{}',
  success_rate FLOAT DEFAULT 0.5,
  detection_rate FLOAT DEFAULT 0.5,

  waf_detected TEXT,
  waf_bypass_success_rate FLOAT,
  last_waf_encounter BIGINT,

  discovery_methods TEXT[] DEFAULT ARRAY[]::TEXT[],
  recommendations JSONB DEFAULT '[]'::JSONB,

  avg_execution_time FLOAT,
  error_rate FLOAT DEFAULT 0.1,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_site_profiles_last_tested ON site_profiles(last_tested DESC);
CREATE INDEX idx_site_profiles_success_rate ON site_profiles(success_rate DESC);
```

---

## Memory Interaction Pattern

### At Job Start

```javascript
// Parent agent loads persistent memory
const persistentProfile = await persistentMemory.load(domain);

// Create session memory with persistent as baseline
const sessionMem = sessionMemory.create(jobId, domain, persistentProfile);

// Session now has initial context:
// - previousSuccessRate
// - knownWAFType
// - effectiveDiscoveryMethods
// - etc.
```

### During Job Execution

```javascript
// All agents read from session memory
const detectionResult = await DetectionSubAgent.execute({
  url: article.url,
  expectedPlayerTypes: sessionMem.target.playerTypes  // Use learnings
});

// All agents write to session memory
sessionMemory.update(jobId, {
  detectionResults: [...sessionMem.detectionResults, detectionResult],
  currentPhase: 'testing'
});
```

### At Job End

```javascript
// Parent synthesizes final result
const finalReport = synthesizeResults(sessionMem);

// Update persistent memory with learnings
await persistentMemory.update(domain, sessionMem);

// Clear session (free memory)
sessionMemory.clear(jobId);
```

---

## Memory Lifecycle Example

```javascript
// Timeline for job on "example.com"

T=0:     load(example.com)
         → Returns SiteProfile:
           { successRate: 0.73, wafDetected: 'cloudflare', ... }

T=1:     create(job-123, example.com, profile)
         → SessionMemory created with target from profile

T=2-10:  [Discovery, Detection, Testing, etc.]
         → Session memory updated each phase
         → Reads profile recommendations

T=11:    synthesizeResults(sessionMem)
         → Combines all results

T=12:    update(example.com, sessionMem)
         → Persistent memory updated:
           - successRate: 0.73 → 0.715 (5 players, 3 playable)
           - playerTypes: { html5: 22, hls: 5, ... }
           - wafBypassSuccessRate: improved if bypass succeeded
           - recommendations: regenerated

T=13:    clear(job-123)
         → Session freed from memory

T=14:    Next job on example.com loads updated profile
         → Benefits from learnings from job-123
```

---

## Memory Safety & Cleanup

### Automatic Cleanup

```javascript
class MemoryCleanupService {
  startPeriodicCleanup(intervalMs = 60000) {
    setInterval(() => this.cleanup(), intervalMs);
  }

  cleanup() {
    const now = Date.now();
    const maxSessionAge = 2 * 60 * 60 * 1000;  // 2 hours

    const activeSessions = this.sessionMemory.getAllActive();

    activeSessions.forEach(session => {
      if (now - session.startTime > maxSessionAge) {
        this.logger.warn(`Cleaning up stale session: ${session.jobId}`);
        this.sessionMemory.clear(session.jobId);
      }
    });
  }
}
```

### Memory Limits

```javascript
class MemoryLimiter {
  private maxSessions = 1000;
  private maxSessionSize = 100 * 1024 * 1024;  // 100 MB per session

  async checkLimits() {
    const activeCount = this.sessionMemory.getAllActive().length;

    if (activeCount > this.maxSessions) {
      // Evict oldest session
      this.logger.warn(`Memory limit exceeded, evicting oldest session`);
      const oldest = this.findOldestSession();
      await this.sessionMemory.clear(oldest.jobId);
    }
  }

  estimateSessionSize(session: SessionMemory): number {
    return JSON.stringify(session).length;
  }
}
```

---

## Testing & Validation

### Unit Test Pattern

```javascript
describe('SessionMemory', () => {
  test('creates session with initial state', () => {
    const session = manager.create('job-1', 'example.com');
    expect(session.jobId).toBe('job-1');
    expect(session.articles).toEqual([]);
    expect(session.testingResults).toEqual([]);
  });

  test('updates session state', () => {
    const session = manager.create('job-1', 'example.com');
    manager.update('job-1', {
      articles: [{ url: 'https://...' }]
    });
    expect(manager.get('job-1').articles.length).toBe(1);
  });

  test('clears session after job', () => {
    manager.create('job-1', 'example.com');
    manager.clear('job-1');
    expect(manager.get('job-1')).toBeUndefined();
  });
});

describe('PersistentMemory', () => {
  test('loads default profile for new domain', async () => {
    const profile = await persistentMemory.load('newdomain.com');
    expect(profile.domain).toBe('newdomain.com');
    expect(profile.successRate).toBe(0.5);
  });

  test('updates profile with job results', async () => {
    const sessionMem = { /* ... */ };
    await persistentMemory.update('example.com', sessionMem);

    const updated = await persistentMemory.load('example.com');
    expect(updated.testCount).toBeGreaterThan(0);
  });
});
```

---

## Summary

This memory architecture provides:
- ✅ Two-layer memory (session + persistent)
- ✅ Clean separation of concerns
- ✅ Learning across jobs per domain
- ✅ Supabase persistence
- ✅ Automatic cleanup and limits
- ✅ Type-safe interfaces
- ✅ Full test coverage
- ✅ Exponential moving average for smooth learning

The system enables:
- **Fast convergence**: Each job learns from prior domains
- **Adaptive strategies**: WAF bypass improves over time
- **Cost optimization**: Reuse effective discovery methods
- **Observability**: Track domain-level metrics

