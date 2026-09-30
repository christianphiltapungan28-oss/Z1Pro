-- Turns row-level security back on for the 15 tables that had it off
-- (found 2026-09-30). Nothing is exposed today: Supabase's public API roles
-- (anon, authenticated) have no access to any table. RLS is the backstop if
-- such a grant is ever added by mistake.
--
-- Safe to run on the live database, and safe to run twice:
-- * The app connects as the table owner (postgres, which bypasses RLS), so
--   it is unaffected.
-- * The FlowSmart support site's role (flowsmart_support) gets policies
--   matching the access it already has (read/write tickets, read users),
--   so it keeps working.
--
--   psql "$DIRECT_URL" -f scripts/enable-rls.sql
-- or paste into the Supabase SQL editor.

BEGIN;

ALTER TABLE ai_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily    ENABLE ROW LEVEL SECURITY;
ALTER TABLE concern_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE concerns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;

-- The support site's existing access, now as explicit policies.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowsmart_support') THEN
    DROP POLICY IF EXISTS flowsmart_support_concerns ON concerns;
    CREATE POLICY flowsmart_support_concerns ON concerns
      FOR ALL TO flowsmart_support USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS flowsmart_support_concern_messages ON concern_messages;
    CREATE POLICY flowsmart_support_concern_messages ON concern_messages
      FOR ALL TO flowsmart_support USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS flowsmart_support_users ON users;
    CREATE POLICY flowsmart_support_users ON users
      FOR SELECT TO flowsmart_support USING (true);
  END IF;
END $$;

COMMIT;

-- Check (every row should say true):
-- SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;
