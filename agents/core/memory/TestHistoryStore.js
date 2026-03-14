import { supabase } from './supabase-client.js';
import util from 'util';

export class TestHistoryStore {
  /**
   * Records the outcome of a single URL test run.
   * @param {string} jobId 
   * @param {string} url 
   * @param {Object} result - Needs overallStatus, steps, duration, etc.
   */
  async recordTestResult(jobId, url, result) {
    if (!supabase) {
      console.log(`[Mock TestHistory] RECORD job:${jobId} url:${url}`);
      return;
    }

    try {
      // First, get the site profile ID if it exists
      const domain = new URL(url).hostname;
      // First, get the site profile ID if it exists
      let profileData = null;
      try {
        const { data, error: profileError } = await supabase
          .from('site_profiles')
          .select('id')
          .eq('domain', domain)
          .single();
        if (!profileError) profileData = data;
      } catch (e) {
        // Ignore profile recall errors during recording
      }

      const payload = {
        job_id: jobId,
        url,
        site_profile_id: profileData?.id || null,
        overall_status: result.overallStatus || 'pass',
        steps: result.results || result.steps || [],
        total_duration_ms: result.totalDuration || 0,
        bypass_succeeded: result.summary?.passed > 0 || (result.results?.some(r => r.skill?.includes('bypass') && r.data?.success)), 
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('test_history')
        .insert([payload]);

      if (error) throw error;
    } catch (err) {
      console.error(`[TestHistoryStore] Failed to record result for ${url}:`, util.inspect(err, { depth: null, colors: true }));
    }
  }

  /**
   * Fetch recent test runs for a given domain to give agents context.
   * @param {string} domain 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getRecentResults(domain, limit = 5) {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('test_history')
        .select('*, site_profiles!inner(domain)')
        .eq('site_profiles.domain', domain)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error(`[TestHistoryStore] Failed to fetch recent results for ${domain}:`, err);
      return [];
    }
  }
}
