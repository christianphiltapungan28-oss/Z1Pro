-- Adds email + password sign-in. Additive only: a new table, nothing
-- existing is changed, so it is safe to run on the live database, and safe
-- to run twice.
--
--   psql "$DIRECT_URL" -f scripts/add-password-auth.sql
-- or paste into the Supabase SQL editor.
--
-- Until this has run, password sign-in and sign-up say they aren't
-- available yet; Google and Facebook keep working.

BEGIN;

-- Kept out of `users` so the auth adapter's full-row reads never carry the
-- hash. scrypt, in the form scrypt$N$r$p$salt$hash (base64url).
CREATE TABLE IF NOT EXISTS user_passwords (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash  text NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Same access model as the app's other tables: the server connects with the
-- database owner role; Supabase's public API roles get nothing.
REVOKE ALL ON user_passwords FROM anon, authenticated;

COMMIT;

-- Check:
-- SELECT count(*) FROM user_passwords;
