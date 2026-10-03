-- Adds what the Conversation History switch, web push notifications and
-- verified phone numbers need. Additive only: no existing row is changed,
-- so it is safe to run on the live database, and safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/migrations/add-account-services.sql
-- or paste into the Supabase SQL editor.
--
-- Run it before deploying the code that uses it: the app reads the two
-- new user_settings columns.

BEGIN;

-- Settings → Privacy → Conversation History. Off = Life Metrics stops
-- reading the user's chats.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS use_conversation_history boolean NOT NULL DEFAULT true;

-- Set when the phone number was confirmed with an SMS code.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- One row per browser/phone that allowed push notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user
  ON push_subscriptions (user_id);

-- Same access model as the app's other tables: the server connects with the
-- database owner role; Supabase's public API roles get nothing.
REVOKE ALL ON push_subscriptions FROM anon, authenticated;

COMMIT;

-- Check:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_settings' ORDER BY ordinal_position;
-- SELECT count(*) FROM push_subscriptions;
