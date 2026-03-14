import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load root level .env
const rootEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: rootEnv });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not found in environment. Memory features will operate in degraded/mock mode.');
} else {
  console.log(`[SupabaseClient] Initializing with URL: ${supabaseUrl}`);
}

/**
 * Singleton Supabase client for agent data access.
 * We use the SERVICE ROLE KEY because agents need to bypass RLS to write system records.
 */
// Minimal Docker setup: SDK appends /rest/v1 but local PostgREST is at /
const client = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (client && supabaseUrl?.includes('localhost:54321')) {
  client.rest.url = supabaseUrl;
}

export const supabase = client;

// Connectivity check
if (supabase) {
  supabase.from('site_profiles').select('count', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) {
        console.error('[SupabaseClient] ❌ Connection test failed:', JSON.stringify(error, null, 2));
      } else {
        console.log('[SupabaseClient] ✅ Connection test successful');
      }
    });
}
