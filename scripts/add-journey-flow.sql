-- Adds the tables behind the Journey Interactive Flow: the AI's step
-- breakdown, the files a user uploads, and the coaching conversation.
-- Additive only (no existing table or row changes), safe to run twice.
--
--   psql "$DIRECT_URL" -f scripts/add-journey-flow.sql
-- or paste into the Supabase SQL editor.
--
-- Until this has run, opening a journey shows a notice; nothing else in the
-- app reads these tables.

BEGIN;

CREATE TABLE IF NOT EXISTS journey_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  position     smallint NOT NULL,
  title        text NOT NULL,
  tip          text,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'done')),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, position)
);

CREATE TABLE IF NOT EXISTS journey_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   integer NOT NULL,
  -- Path in the private Supabase Storage bucket, when storage is configured.
  storage_path text,
  -- The AI's summary of the file, used as coaching context.
  summary      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journey_files_journey_idx ON journey_files (journey_id);

CREATE TABLE IF NOT EXISTS journey_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journey_messages_journey_idx
  ON journey_messages (journey_id, created_at);

-- Same access model as the app's other tables.
REVOKE ALL ON journey_steps, journey_files, journey_messages FROM anon, authenticated;

COMMIT;
