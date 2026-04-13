-- ============================================================
-- VAS PLATFORM — SUPABASE MIGRATION
-- Run this entire file in Supabase SQL Editor (one shot)
-- ============================================================

-- 1. TELCOS TABLE
CREATE TABLE IF NOT EXISTS telcos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL DEFAULT '',
  user_telco_service_id INTEGER NOT NULL,
  ad_agency_campaign_id INTEGER NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  callback_url TEXT DEFAULT '',
  success_page_url TEXT DEFAULT '',
  failure_page_url TEXT DEFAULT '',
  schedule_start TEXT DEFAULT '00:00',
  schedule_end TEXT DEFAULT '23:59',
  timezone TEXT DEFAULT 'UTC',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telcos_country ON telcos(country_code, is_enabled);

INSERT INTO telcos (name, country_code, country_name, user_telco_service_id, ad_agency_campaign_id, timezone, schedule_start, schedule_end)
VALUES ('Kuwait Default', 'KW', 'Kuwait', 100, 100, 'Asia/Kuwait', '00:00', '23:59')
ON CONFLICT DO NOTHING;

-- 2. COUNTRIES TABLE
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  flow_type TEXT NOT NULL DEFAULT 'dcb',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO countries (code, name, is_enabled, flow_type) VALUES
  ('KW', 'Kuwait', true, 'dcb'),
  ('SA', 'Saudi Arabia', false, 'dcb'),
  ('BH', 'Bahrain', false, 'dcb'),
  ('AE', 'UAE', false, 'dcb'),
  ('QA', 'Qatar', false, 'dcb'),
  ('OM', 'Oman', false, 'dcb'),
  ('EG', 'Egypt', false, 'dcb'),
  ('JO', 'Jordan', false, 'dcb'),
  ('IQ', 'Iraq', false, 'dcb'),
  ('US', 'United States', false, 'global'),
  ('GB', 'United Kingdom', false, 'global'),
  ('IN', 'India', false, 'global'),
  ('PK', 'Pakistan', false, 'global')
ON CONFLICT (code) DO NOTHING;

-- 3. GLOBAL USERS TABLE
CREATE TABLE IF NOT EXISTS global_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  phone_verified BOOLEAN DEFAULT false,
  country_code TEXT DEFAULT '',
  session_token TEXT,
  subscription_status TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_users_email ON global_users(email);
CREATE INDEX IF NOT EXISTS idx_global_users_google ON global_users(google_id);
CREATE INDEX IF NOT EXISTS idx_global_users_session ON global_users(session_token);

-- 4. UPDATE SUBSCRIPTIONS TABLE
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS telco_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS telco_name TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS flow_type TEXT DEFAULT 'dcb';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS error_code INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS vas_response TEXT DEFAULT '';

-- 5. RLS POLICIES
ALTER TABLE telcos ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all for anon" ON telcos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all for anon" ON countries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all for anon" ON global_users FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Done!
