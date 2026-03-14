-- Site profiles: what we know about each domain
CREATE TABLE site_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  protection_type TEXT,              -- 'cloudflare' | 'perimeterx' | 'none'
  cloudflare_tier TEXT,              -- 'free' | 'pro' | 'enterprise'
  has_instaread_player BOOLEAN,
  player_version TEXT,
  typical_popup_types TEXT[],        -- ['cookie-consent', 'newsletter', 'ad-overlay']
  bypass_success_rate FLOAT,         -- 0.0 to 1.0
  avg_challenge_solve_time_ms INT,
  last_tested_at TIMESTAMPTZ,
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test history: every test run with results
CREATE TABLE test_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  site_profile_id UUID REFERENCES site_profiles(id),
  url TEXT NOT NULL,
  overall_status TEXT,               -- 'pass' | 'fail' | 'partial' | 'error'
  steps JSONB,                       -- array of step results
  bypass_method_used TEXT,           -- 'curl-impersonate' | 'browser-turnstile' | 'press-hold'
  bypass_succeeded BOOLEAN,
  challenge_solve_time_ms INT,
  total_duration_ms INT,
  error_message TEXT,
  screenshots JSONB,                 -- S3 keys
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy cache: what bypass approach works best for each site
CREATE TABLE bypass_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  strategy_name TEXT NOT NULL,       -- 'http-curl' | 'browser-headed' | 'browser-headless'
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  avg_duration_ms INT,
  last_used_at TIMESTAMPTZ,
  config JSONB,                      -- strategy-specific config (hold duration, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, strategy_name)
);

-- Agent memory: general-purpose key-value memory for agents
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,         -- 'episodic' | 'semantic' | 'procedural'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  relevance_score FLOAT DEFAULT 1.0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, memory_type, key)
);

-- Enable real-time subscriptions for dashboard
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE test_history;
ALTER PUBLICATION supabase_realtime ADD TABLE site_profiles;
