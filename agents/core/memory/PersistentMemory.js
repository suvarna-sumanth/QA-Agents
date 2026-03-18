/**
 * PersistentMemory.js - Domain-scoped persistent memory via Supabase
 *
 * Stores learned information about domains across jobs.
 * Tracks player types, success rates, WAF information, and recommendations.
 * Uses exponential moving average (EMA) for smooth metric updates.
 *
 * @class PersistentMemory
 */
export class PersistentMemory {
  /**
   * Creates a persistent memory service
   *
   * @param {Object} supabaseClient - Supabase client instance
   * @param {Object} [config] - Configuration
   * @param {Object} [config.logger] - Logger instance
   * @param {number} [config.cacheTTL=300000] - Cache TTL in ms (5 min default)
   * @throws {Error} if supabaseClient not provided
   */
  constructor(supabaseClient, config = {}) {
    if (!supabaseClient) {
      throw new Error('supabaseClient required');
    }

    this.db = supabaseClient;
    this.logger = config.logger || console;
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5 minutes
    this.table = 'site_profiles';

    // In-memory cache
    this.cache = new Map();
  }

  /**
   * Loads a site profile from persistent storage
   *
   * Checks cache first (5-min TTL), then queries Supabase.
   * Returns default profile if domain not found.
   *
   * @param {string} domain - Domain to load profile for
   * @returns {Promise<Object>} Site profile
   */
  async load(domain) {
    try {
      // Check cache
      if (this.cache.has(domain)) {
        const cached = this.cache.get(domain);
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          this.logger.debug(`Using cached profile for ${domain}`);
          return cached.data;
        }
      }

      // Query database
      const { data, error } = await this.db
        .from(this.table)
        .select('*')
        .eq('domain', domain)
        .single();

      if (error) {
        // 406 or PGRST116 means not found - return default
        if (error.code === 'PGRST116' || error.status === 406) {
          const defaultProfile = this.createDefaultProfile(domain);
          this.logger.debug(`No profile found for ${domain}, returning default`);
          return defaultProfile;
        }

        throw error;
      }

      // Cache the result
      this.cache.set(domain, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      this.logger.error(`Failed to load profile for ${domain}:`, error);
      return this.createDefaultProfile(domain);
    }
  }

  /**
   * Updates a site profile with results from a job
   *
   * Calculates new metrics (EMA, success rates) and stores
   * learnings back to Supabase.
   *
   * @param {string} domain - Domain to update
   * @param {SessionMemory} sessionMem - Session memory with job results
   * @returns {Promise<void>}
   */
  async update(domain, sessionMem) {
    try {
      const profile = await this.load(domain);

      // Calculate updated metrics
      const updated = {
        lastTested: Date.now(),
        testCount: (profile.testCount || 0) + 1,

        // Player type aggregation
        playerTypes: this.aggregatePlayerTypes(
          profile.playerTypes || {},
          sessionMem.detectionResults
        ),

        // Success rate (EMA with factor 0.7)
        successRate: this.calculateSuccessRate(
          profile.successRate || 0.5,
          sessionMem.testingResults,
          0.7
        ),

        // Detection rate
        detectionRate:
          sessionMem.detectionResults.length /
          Math.max(sessionMem.articles.length, 1),

        // WAF detection
        wafDetected:
          sessionMem.bypassResults.length > 0
            ? this.identifyWAF(sessionMem.bypassResults)
            : profile.wafDetected,

        // Average execution time (EMA with factor 0.5)
        avgExecutionTime: this.updateMovingAverage(
          profile.avgExecutionTime || 0,
          sessionMem.getTotalTime(),
          0.5
        ),

        // Error rate (EMA)
        errorRate: this.updateErrorRate(
          profile.errorRate || 0.1,
          sessionMem.errors.length,
          Math.max(1, sessionMem.testingResults.length)
        )
      };

      // Generate recommendations
      updated.recommendations = this.generateRecommendations(
        { ...profile, ...updated },
        sessionMem
      );

      // Clear cache for this domain
      this.cache.delete(domain);

      // Upsert to database
      const { error } = await this.db.from(this.table).upsert(
        {
          domain,
          ...profile,
          ...updated,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'domain' }
      );

      if (error) throw error;

      this.logger.info(`Updated profile for ${domain}`);
    } catch (error) {
      // Log but don't throw - persistence failures are non-critical
      this.logger.error(`Failed to update profile for ${domain}:`, error);
    }
  }

  /**
   * Creates a default profile for a new domain
   *
   * @param {string} domain - Domain name
   * @returns {Object} Default site profile
   * @private
   */
  createDefaultProfile(domain) {
    return {
      domain,
      firstSeen: Date.now(),
      lastTested: null,
      testCount: 0,
      playerTypes: {
        html5: 0,
        hls: 0,
        youtube: 0,
        vimeo: 0,
        custom: 0
      },
      successRate: 0.5,
      detectionRate: 0.5,
      wafDetected: null,
      wafBypassSuccessRate: null,
      lastWAFEncounter: null,
      discoveryMethods: [],
      recommendations: [],
      avgExecutionTime: 0,
      errorRate: 0.1
    };
  }

  /**
   * Aggregates player types from detection results
   *
   * @param {Object} existing - Existing player type counts
   * @param {Array} detectionResults - Detection results to aggregate
   * @returns {Object} Updated player type counts
   * @private
   */
  aggregatePlayerTypes(existing, detectionResults) {
    const updated = { ...existing };

    detectionResults.forEach(result => {
      result.players?.forEach(player => {
        updated[player.type] = (updated[player.type] || 0) + 1;
      });
    });

    return updated;
  }

  /**
   * Calculates success rate using EMA
   *
   * @param {number} currentRate - Current success rate
   * @param {Array} testingResults - Testing results
   * @param {number} factor - EMA smoothing factor (0-1)
   * @returns {number} Updated success rate
   * @private
   */
  calculateSuccessRate(currentRate, testingResults, factor) {
    if (testingResults.length === 0) return currentRate;

    const newRate =
      testingResults.filter(r => r.testResult?.playable).length /
      testingResults.length;
    return currentRate * (1 - factor) + newRate * factor;
  }

  /**
   * Updates a metric using exponential moving average
   *
   * @param {number} current - Current value
   * @param {number} newValue - New value
   * @param {number} factor - Smoothing factor (0-1)
   * @returns {number} Updated value
   * @private
   */
  updateMovingAverage(current, newValue, factor) {
    if (!current) return newValue;
    return current * (1 - factor) + newValue * factor;
  }

  /**
   * Updates error rate using EMA
   *
   * @param {number} current - Current error rate
   * @param {number} errorCount - Number of errors in job
   * @param {number} testCount - Number of tests in job
   * @returns {number} Updated error rate
   * @private
   */
  updateErrorRate(current, errorCount, testCount) {
    if (testCount === 0) return current;
    const jobErrorRate = errorCount / testCount;
    return this.updateMovingAverage(current, jobErrorRate, 0.5);
  }

  /**
   * Identifies WAF type from bypass results
   *
   * @param {Array} bypassResults - Bypass results
   * @returns {string} WAF type or 'unknown'
   * @private
   */
  identifyWAF(bypassResults) {
    // Look for WAF detection in results
    for (const result of bypassResults) {
      if (result.wafDetected) {
        return result.wafDetected;
      }
    }
    return 'unknown';
  }

  /**
   * Generates recommendations for next jobs
   *
   * @param {Object} profile - Updated profile
   * @param {SessionMemory} sessionMem - Session memory
   * @returns {Array} Recommendations
   * @private
   */
  generateRecommendations(profile, sessionMem) {
    const recommendations = [];

    // Recommend discovery methods
    if (sessionMem.discoveryMethods?.length > 0) {
      recommendations.push({
        type: 'discovery',
        description: `${sessionMem.discoveryMethods.join(', ')} are effective for this domain`,
        confidence: Math.min(0.95, 0.5 + sessionMem.discoveryMethods.length * 0.2)
      });
    }

    // Recommend WAF bypass if needed
    if (profile.wafDetected) {
      recommendations.push({
        type: 'bypass',
        description: `Domain has ${profile.wafDetected} WAF; use specific bypass strategy`,
        confidence: profile.wafBypassSuccessRate || 0.5
      });
    }

    // Recommend focus on dominant player type
    const playerCounts = Object.entries(profile.playerTypes || {});
    if (playerCounts.length > 0) {
      const dominant = playerCounts.sort((a, b) => b[1] - a[1])[0];
      if (dominant[1] > 0) {
        recommendations.push({
          type: 'testing',
          description: `Domain primarily uses ${dominant[0]} players (${dominant[1]} detected)`,
          confidence: Math.min(0.95, 0.7 + dominant[1] * 0.05)
        });
      }
    }

    return recommendations;
  }

  /**
   * Clears cache for a domain
   *
   * @param {string} domain - Domain to clear cache for
   */
  clearCache(domain) {
    this.cache.delete(domain);
  }

  /**
   * Clears all cache
   */
  clearAllCache() {
    this.cache.clear();
  }

  /**
   * Returns metadata about persistent memory
   *
   * @returns {Object} Metadata
   */
  getMetadata() {
    return {
      type: 'persistent-memory',
      version: '1.0.0',
      tableName: this.table,
      cacheSize: this.cache.size,
      cacheTTL: this.cacheTTL
    };
  }
}
