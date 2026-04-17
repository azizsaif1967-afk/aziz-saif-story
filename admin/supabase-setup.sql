-- =============================================
-- Newsletter System — Database Setup
-- Paste this entire script into your Supabase
-- SQL Editor and click "Run"
-- =============================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Subscribers table
CREATE TABLE IF NOT EXISTS public.subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  verified boolean DEFAULT false,
  verify_token text DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  subscribed_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  unsubscribed boolean DEFAULT false,
  unsubscribed_at timestamptz
);

-- 3. Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text NOT NULL,
  html_body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  sent_count integer DEFAULT 0
);

-- 4. Settings table (stores Resend API key, sender config)
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- 5. Default settings
INSERT INTO public.settings (key, value) VALUES
  ('sender_name', 'Aziz Saif'),
  ('sender_email', 'newsletter@azizsaif.com')
ON CONFLICT (key) DO NOTHING;

-- 6. Enable Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for subscribers
-- Anonymous users can subscribe (INSERT)
CREATE POLICY "anon_subscribe" ON public.subscribers
  FOR INSERT TO anon WITH CHECK (true);

-- Anonymous users can verify/unsubscribe (SELECT by token)
CREATE POLICY "anon_read_subscribers" ON public.subscribers
  FOR SELECT TO anon USING (true);

-- Anonymous users can update verification/unsubscribe status
CREATE POLICY "anon_update_subscribers" ON public.subscribers
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Authenticated users (admin) have full access
CREATE POLICY "auth_all_subscribers" ON public.subscribers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. RLS Policies for campaigns (admin only)
CREATE POLICY "auth_all_campaigns" ON public.campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. RLS Policies for settings (admin only for read/write)
CREATE POLICY "auth_read_settings" ON public.settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_write_settings" ON public.settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers (email);
CREATE INDEX IF NOT EXISTS idx_subscribers_verify_token ON public.subscribers (verify_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_verified ON public.subscribers (verified);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns (created_at DESC);

-- Done! Your newsletter database is ready.
