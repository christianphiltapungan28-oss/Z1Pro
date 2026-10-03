-- Records each user's acceptance of the Terms and Conditions, Privacy Policy
-- and Cookie Policy, from the modal shown after signing in.
-- Additive only: a new table, nothing existing is changed, so it is safe to
-- run on the live database, and safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/migrations/add-legal-acceptance.sql
-- or paste into the Supabase SQL editor.
--
-- Until this has run, the modal isn't shown (there is nowhere to record the
-- answer) and the app works as before.

BEGIN;

CREATE TABLE IF NOT EXISTS legal_acceptances (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- The policies' "Last updated" date that was accepted (LEGAL.lastUpdated).
  -- Changing that date asks everyone to accept again.
  version     text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

-- Same access model as the app's other tables: the server connects with the
-- database owner role; Supabase's public API roles get nothing.
REVOKE ALL ON legal_acceptances FROM anon, authenticated;

COMMIT;

-- Check:
-- SELECT count(*) FROM legal_acceptances;
