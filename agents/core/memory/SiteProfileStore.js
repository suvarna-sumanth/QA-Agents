import { supabase } from './supabase-client.js';
import util from 'util';

export class SiteProfileStore {
  /**
   * Retrieves what the agent knows about a specific domain.
   * @param {string} domain 
   * @returns {Promise<Object|null>}
   */
  async getProfile(domain) {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('site_profiles')
        .select('*')
        .eq('domain', domain)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    } catch (err) {
      console.error(`[SiteProfileStore] Error fetching profile for ${domain}:`, util.inspect(err, { depth: null, colors: true }));
      return null;
    }
  }

  /**
   * Updates or inserts a new site profile with latest knowledge.
   * @param {string} domain 
   * @param {Object} partialProfile attributes to update
   */
  async upsertProfile(domain, partialProfile) {
    if (!supabase) {
      console.log(`[Mock SiteProfileStore] UPSERT ${domain}:`, partialProfile);
      return;
    }

    try {
      // Get existing to preserve untouched fields
      const { data: existing } = await supabase
        .from('site_profiles')
        .select('*')
        .eq('domain', domain)
        .single();

      const payload = { 
        ...(existing || {}), 
        ...partialProfile, 
        domain,
        updated_at: new Date().toISOString() 
      };

      const { error } = await supabase
        .from('site_profiles')
        .upsert(payload, { onConflict: 'domain' });

      if (error) throw error;
      console.log(`[SiteProfileStore] ✓ Updated profile for ${domain}`);
    } catch (err) {
      console.error(`[SiteProfileStore] Failed to upsert profile for ${domain}:`, util.inspect(err, { depth: null, colors: true }));
    }
  }
}
