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

-- =============================================
-- ADMIN SIGNUP NOTIFICATION — already deployed in production.
-- Mirror of /Users/azizsaif/Downloads/supabase-notification-setup.sql.
-- Safe to re-run. Idempotent.
-- =============================================

-- 11. HTTP from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 12. Notification log (per-attempt audit trail)
CREATE TABLE IF NOT EXISTS public.notification_log (
  id              bigserial PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  subscriber_email text NOT NULL,
  status          text NOT NULL,                 -- 'sent' | 'skipped_no_key' | 'error'
  request_id      bigint,                        -- pg_net request id
  http_status     int,
  resend_id       text,
  error_message   text
);

CREATE INDEX IF NOT EXISTS notification_log_created_at_idx
  ON public.notification_log (created_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no public access" ON public.notification_log;
CREATE POLICY "no public access" ON public.notification_log FOR ALL USING (false) WITH CHECK (false);

-- 13. Configurable recipient. Resend test mode currently restricts the destination
--     to the Resend account email; switch to aziz@azizsaif.com after verifying the
--     azizsaif.com sending domain at resend.com/domains.
INSERT INTO public.settings (key, value) VALUES ('notification_recipient', 'azizsaif1967@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 14. Notification function — called by the trigger below.
CREATE OR REPLACE FUNCTION public.send_admin_notification(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_resend_key text;
  v_from_email text;
  v_to_email   text;
  v_total      int;
  v_request_id bigint;
  v_html       text;
  v_subject    text;
BEGIN
  SELECT value INTO v_resend_key FROM public.settings WHERE key = 'resend_api_key';
  SELECT value INTO v_from_email FROM public.settings WHERE key = 'sender_email';
  SELECT value INTO v_to_email   FROM public.settings WHERE key = 'notification_recipient';

  IF v_resend_key IS NULL OR length(trim(v_resend_key)) = 0 THEN
    INSERT INTO public.notification_log (subscriber_email, status, error_message)
    VALUES (p_email, 'skipped_no_key', 'resend_api_key not set in settings');
    RETURN;
  END IF;

  IF v_from_email IS NULL OR length(trim(v_from_email)) = 0 THEN v_from_email := 'onboarding@resend.dev'; END IF;
  IF v_to_email   IS NULL OR length(trim(v_to_email))   = 0 THEN v_to_email   := 'azizsaif1967@gmail.com'; END IF;

  BEGIN
    SELECT count(*) INTO v_total FROM public.subscribers;
  EXCEPTION WHEN undefined_table THEN v_total := NULL; END;

  v_subject := 'New Newsletter Signup: ' || p_email;
  v_html :=
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#fff;color:#000;padding:32px;max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:8px;">' ||
    '<h1 style="margin:0 0 16px;color:#000;font-size:22px;">New Newsletter Signup</h1>' ||
    '<p style="margin:0 0 24px;color:#555;font-size:14px;">A new subscriber just joined azizsaif.com.</p>' ||
    '<table style="width:100%;border-collapse:collapse;font-size:14px;">' ||
    '<tr><td style="padding:8px 0;color:#888;width:140px;">Email</td><td style="padding:8px 0;color:#000;font-weight:600;">' || p_email || '</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#888;">Time</td><td style="padding:8px 0;color:#000;">' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || ' UTC</td></tr>' ||
    '<tr><td style="padding:8px 0;color:#888;">Total subscribers</td><td style="padding:8px 0;color:#cc0000;font-weight:700;">' || coalesce(v_total::text, 'n/a') || '</td></tr>' ||
    '</table>' ||
    '<p style="margin:24px 0 0;color:#888;font-size:12px;">Manage list: <a href="https://azizsaif.com/admin/newsletter.html" style="color:#cc0000;text-decoration:none;">Admin Console</a></p>' ||
    '</div>';

  BEGIN
    SELECT net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization','Bearer ' || v_resend_key,'Content-Type','application/json'),
      body := jsonb_build_object('from', v_from_email,'to', jsonb_build_array(v_to_email),'subject', v_subject,'html', v_html)
    ) INTO v_request_id;

    INSERT INTO public.notification_log (subscriber_email, status, request_id) VALUES (p_email, 'sent', v_request_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_log (subscriber_email, status, error_message) VALUES (p_email, 'error', SQLERRM);
  END;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.send_admin_notification(text) TO anon, authenticated;

-- 15. AFTER INSERT trigger on subscribers — fires the notification automatically
--     for every signup path (frontend form, admin console, raw API).
CREATE OR REPLACE FUNCTION public._tg_subscribers_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $tg$
BEGIN
  PERFORM public.send_admin_notification(NEW.email);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.notification_log (subscriber_email, status, error_message)
  VALUES (NEW.email, 'error', 'trigger error: ' || SQLERRM);
  RETURN NEW;
END;
$tg$;

DROP TRIGGER IF EXISTS subscribers_admin_notify ON public.subscribers;
CREATE TRIGGER subscribers_admin_notify
  AFTER INSERT ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public._tg_subscribers_notify();

-- =============================================
-- SUBSCRIBER DOUBLE OPT-IN — sends a verify link
-- to the new subscriber automatically. Idempotent.
-- =============================================

-- 16. Function: send the subscriber a verify email with their unique link.
CREATE OR REPLACE FUNCTION public.send_subscriber_verification(p_email text, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_resend_key text;
  v_from_email text;
  v_from_name  text;
  v_request_id bigint;
  v_html       text;
  v_subject    text;
  v_verify_url text;
BEGIN
  SELECT value INTO v_resend_key FROM public.settings WHERE key = 'resend_api_key';
  SELECT value INTO v_from_email FROM public.settings WHERE key = 'sender_email';
  SELECT value INTO v_from_name  FROM public.settings WHERE key = 'sender_name';

  IF v_resend_key IS NULL OR length(trim(v_resend_key)) = 0 THEN
    INSERT INTO public.notification_log (subscriber_email, status, error_message)
    VALUES (p_email, 'skipped_no_key', 'verify email skipped: resend_api_key not set');
    RETURN;
  END IF;

  IF v_from_email IS NULL OR length(trim(v_from_email)) = 0 THEN v_from_email := 'onboarding@resend.dev'; END IF;
  IF v_from_name  IS NULL OR length(trim(v_from_name))  = 0 THEN v_from_name  := 'Aziz Saif'; END IF;

  v_verify_url := 'https://azizsaif.com/admin/verify.html?token=' || p_token;
  v_subject    := 'Confirm your subscription to Aziz Saif';
  v_html :=
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">' ||
    '<div style="max-width:560px;margin:0 auto;background:#fff;padding:40px 36px;border:1px solid #e4e7eb;border-radius:8px">' ||
      '<div style="background:#0a1628;margin:-40px -36px 32px;padding:28px 36px">' ||
        '<h1 style="color:#c9a84c;font-family:Georgia,serif;font-size:22px;margin:0">Aziz Saif</h1>' ||
      '</div>' ||
      '<h2 style="color:#0a1628;font-family:Georgia,serif;font-size:20px;margin:0 0 16px">Confirm your subscription</h2>' ||
      '<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">Thanks for signing up at <strong>azizsaif.com</strong>. Please click the button below to confirm your email so we can start sending you the newsletter.</p>' ||
      '<p style="margin:0 0 28px"><a href="' || v_verify_url || '" style="display:inline-block;background:#c9a84c;color:#0a1628;padding:14px 32px;text-decoration:none;font-weight:600;border-radius:6px">Confirm my email &rarr;</a></p>' ||
      '<p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 8px">Or paste this link into your browser:</p>' ||
      '<p style="color:#374151;font-size:12px;word-break:break-all;background:#f7f8fa;padding:10px 14px;border-radius:4px;margin:0 0 28px">' || v_verify_url || '</p>' ||
      '<p style="color:#64748b;font-size:12px;line-height:1.5;margin:0">If you did not sign up, ignore this email — you will not be added.</p>' ||
    '</div></body></html>';

  BEGIN
    SELECT net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization','Bearer ' || v_resend_key,'Content-Type','application/json'),
      body := jsonb_build_object(
        'from', v_from_name || ' <' || v_from_email || '>',
        'to', jsonb_build_array(p_email),
        'subject', v_subject,
        'html', v_html
      )
    ) INTO v_request_id;

    INSERT INTO public.notification_log (subscriber_email, status, request_id)
    VALUES (p_email, 'verify_sent', v_request_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.notification_log (subscriber_email, status, error_message)
    VALUES (p_email, 'error', 'verify email failed: ' || SQLERRM);
  END;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.send_subscriber_verification(text, text) TO anon, authenticated;

-- 17. Replace the trigger so it sends BOTH the admin notification AND the
--     subscriber verify email on each new INSERT.
CREATE OR REPLACE FUNCTION public._tg_subscribers_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $tg$
BEGIN
  -- Notify the admin about the signup
  PERFORM public.send_admin_notification(NEW.email);
  -- Send the subscriber their verification link (skipped silently if unverified is false)
  IF NEW.verified IS NOT TRUE THEN
    PERFORM public.send_subscriber_verification(NEW.email, NEW.verify_token);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.notification_log (subscriber_email, status, error_message)
  VALUES (NEW.email, 'error', 'trigger error: ' || SQLERRM);
  RETURN NEW;
END;
$tg$;

DROP TRIGGER IF EXISTS subscribers_admin_notify ON public.subscribers;
CREATE TRIGGER subscribers_admin_notify
  AFTER INSERT ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public._tg_subscribers_notify();

-- ============================================================
-- USEFUL QUERIES
-- ============================================================
-- See recent attempts + Resend response:
--   SELECT l.id, l.created_at, l.subscriber_email, l.status, r.status_code, r.content::text
--   FROM public.notification_log l
--   LEFT JOIN net._http_response r ON r.id = l.request_id
--   ORDER BY l.created_at DESC LIMIT 20;
--
-- After verifying azizsaif.com at resend.com/domains, point notifications to aziz@:
--   UPDATE public.settings SET value='aziz@azizsaif.com' WHERE key='notification_recipient';
--   UPDATE public.settings SET value='noreply@azizsaif.com' WHERE key='sender_email';
--
-- Disable / re-enable the trigger:
--   ALTER TABLE public.subscribers DISABLE TRIGGER subscribers_admin_notify;
--   ALTER TABLE public.subscribers ENABLE  TRIGGER subscribers_admin_notify;

-- Done! Your newsletter database is ready.
