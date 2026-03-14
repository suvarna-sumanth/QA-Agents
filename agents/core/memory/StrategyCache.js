import { supabase } from './supabase-client.js';

export class StrategyCache {
  /**
   * Determine the empirically best bypass strategy for this domain based on historical success rates.
   * @param {string} domain 
   * @returns {Promise<Object>} e.g. { strategy_name: 'browser-headed' }
   */
  async getBestStrategy(domain) {
    if (!supabase) return { strategy_name: 'browser-headed', _mock: true };

    try {
      const { data, error } = await supabase
        .from('bypass_strategies')
        .select('*')
        .eq('domain', domain)
        .order('success_count', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0];
    } catch (err) {
      console.warn(`[StrategyCache] Error: ${err.message}`);
      return null;
    }
  }

  /**
   * Updates success/failure metrics for a specific strategy used on a domain.
   * @param {string} domain 
   * @param {string} strategyName 
   * @param {boolean} success 
   * @param {number} durationMs 
   */
  async recordStrategyResult(domain, strategyName, success, durationMs) {
    if (!supabase) return;

    try {
      // Get existing block
      const { data: existing } = await supabase
        .from('bypass_strategies')
        .select('*')
        .eq('domain', domain)
        .eq('strategy_name', strategyName)
        .single();
      
      const payload = {
        domain,
        strategy_name: strategyName,
        success_count: (existing?.success_count || 0) + (success ? 1 : 0),
        failure_count: (existing?.failure_count || 0) + (success ? 0 : 1),
        last_used_at: new Date().toISOString(),
      };

      // Moving average duration
      if (existing?.avg_duration_ms > 0 && durationMs) {
        payload.avg_duration_ms = Math.round((existing.avg_duration_ms + durationMs) / 2);
      } else if (durationMs) {
        payload.avg_duration_ms = durationMs;
      }

      const { error } = await supabase
        .from('bypass_strategies')
        .upsert(payload, { onConflict: 'domain, strategy_name' });
        
      if (error) throw error;
    } catch (err) {
      console.warn(`[StrategyCache] Error updating: ${err.message}`);
    }
  }
}
