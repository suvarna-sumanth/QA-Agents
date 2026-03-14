import { supabase } from './supabase-client.js';
import { SiteProfileStore } from './SiteProfileStore.js';
import { TestHistoryStore } from './TestHistoryStore.js';
import { StrategyCache } from './StrategyCache.js';

/**
 * High-level memory API for agents.
 * Acts as a facade over specific database stores.
 */
export class MemoryService {
  constructor() {
    this.siteProfiles = new SiteProfileStore();
    this.testHistory = new TestHistoryStore();
    this.strategies = new StrategyCache();
  }

  // --- Site Profiles ---

  /**
   * Before testing a site, recall what we know
   */
  async recallSiteProfile(domain) {
    return this.siteProfiles.getProfile(domain);
  }

  /**
   * Update the profile of a site based on latest findings
   */
  async updateSiteProfile(domain, partialProfile) {
    return this.siteProfiles.upsertProfile(domain, partialProfile);
  }

  // --- Test History ---

  /**
   * After testing, store what we learned
   */
  async recordTestResult(jobId, url, result) {
    return this.testHistory.recordTestResult(jobId, url, result);
  }

  /**
   * Fetch recent outcomes for a domain
   */
  async getRecentResults(domain, limit = 5) {
    return this.testHistory.getRecentResults(domain, limit);
  }

  // --- Strategy Cache ---

  /**
   * Get the best bypass strategy for a domain based on history
   */
  async getBestStrategy(domain) {
    return this.strategies.getBestStrategy(domain);
  }

  /**
   * Records the result of a specific bypass strategy
   */
  async recordStrategyResult(domain, strategyName, success, durationMs) {
    return this.strategies.recordStrategyResult(domain, strategyName, success, durationMs);
  }

  // --- General Agent Memory (Semantic/Episodic) ---

  /**
   * Store arbitrary agent memory (semantic knowledge)
   */
  async remember(agentId, key, value, type = 'semantic') {
    if (!supabase) return;
    try {
      await supabase
        .from('agent_memory')
        .upsert({
          agent_id: agentId,
          memory_type: type,
          key,
          value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'agent_id, memory_type, key' });
    } catch (err) {
      console.warn(`[MemoryService] Failed to remember ${key}: ${err.message}`);
    }
  }

  /**
   * Recall arbitrary agent memory
   */
  async recall(agentId, key, type = 'semantic') {
    if (!supabase) return null;
    try {
      const { data } = await supabase
        .from('agent_memory')
        .select('value')
        .eq('agent_id', agentId)
        .eq('memory_type', type)
        .eq('key', key)
        .single();
      return data ? data.value : null;
    } catch (err) {
      return null;
    }
  }
}
