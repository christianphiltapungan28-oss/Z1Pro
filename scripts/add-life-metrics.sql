-- Adds the table behind Profile — Life Metrics: AI scores for seven life
-- areas, worked out from a user's conversations and journeys at most once a
-- week. Additive only (no existing table or row changes), safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/add-life-metrics.sql
-- or paste into the Supabase SQL editor.
--
-- Scores touch health and faith, which are sensitive personal information,
-- so a row only exists once the user has turned Life Metrics on (consent is
-- recorded in consented_at). Turning it off deletes the row.
--
-- Until this has run, the Profile page shows a notice; nothing else in the
-- app reads this table.

BEGIN;

CREATE TABLE IF NOT EXISTS life_metrics (
  user_id                uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  consented_at           timestamptz NOT NULL DEFAULT now(),
  archetype              text,
  tagline                text,
  summary                text,
  categories             jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversations_analysed integer NOT NULL DEFAULT 0,
  computed_at            timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Only the app reads this; keep the Supabase client roles out.
REVOKE ALL ON life_metrics FROM anon, authenticated;

COMMIT;
