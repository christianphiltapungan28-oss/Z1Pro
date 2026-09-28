-- Adds the notifications table behind the in-app Notifications page.
-- Additive only: no existing table or row is changed, so it is safe to run
-- on the live database, and safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/add-notifications.sql
-- or paste into the Supabase SQL editor.
--
-- Until this has run, the Notifications page shows "all caught up" and
-- nothing else in the app is affected.

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  link_type   text,
  link_id     uuid,
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Several NULL dedupe keys are allowed; a non-NULL key is unique per user.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key
  ON notifications (user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Same access model as the app's other tables: the server connects with the
-- database owner role; Supabase's public API roles get nothing.
REVOKE ALL ON notifications FROM anon, authenticated;

COMMIT;

-- Check:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'notifications' ORDER BY ordinal_position;
