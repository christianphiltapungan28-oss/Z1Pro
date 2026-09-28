-- Adds two-factor login (authenticator app codes) for password accounts.
-- Additive only: a new table, nothing existing is changed, so it is safe to
-- run on the live database, and safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/add-two-factor.sql
-- or paste into the Supabase SQL editor.
--
-- Until this has run, Settings shows two-factor as unavailable and password
-- log-in works without it.

BEGIN;

CREATE TABLE IF NOT EXISTS user_two_factor (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- The authenticator secret, encrypted with a key derived from AUTH_SECRET
  -- (AES-256-GCM), so a database leak alone can't produce codes.
  secret_ciphertext  text NOT NULL,
  -- SHA-256 hashes of the unused one-time backup codes.
  backup_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled_at         timestamptz NOT NULL DEFAULT now()
);

-- Same access model as the app's other tables: the server connects with the
-- database owner role; Supabase's public API roles get nothing.
REVOKE ALL ON user_two_factor FROM anon, authenticated;

COMMIT;

-- Check:
-- SELECT count(*) FROM user_two_factor;
