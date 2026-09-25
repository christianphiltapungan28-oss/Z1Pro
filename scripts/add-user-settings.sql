-- Adds the user_settings table used by Settings → Account and
-- Settings → Notifications. Additive only: no existing table or row is
-- changed, so it is safe to run on the live database, and safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/add-user-settings.sql
-- or paste into the Supabase SQL editor.
--
-- Until this has run, the Settings page shows a notice and the other tabs
-- keep working; nothing else in the app reads this table.

BEGIN;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone              text,
  timezone           text,
  about              text,
  country            text,
  notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Same access model as the app's other tables: the server connects with the
-- database owner role; Supabase's public API roles get nothing.
REVOKE ALL ON user_settings FROM anon, authenticated;

COMMIT;

-- Check:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'user_settings' ORDER BY ordinal_position;
