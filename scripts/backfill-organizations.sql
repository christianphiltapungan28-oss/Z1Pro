-- One-time backfill: create a personal organization for every existing user
-- who doesn't have one yet, make them its owner, point users.default_org_id
-- at it, and re-point their existing subscriptions/payments at the new org.
--
-- Run this AFTER the additive schema push (organizations/organization_members/
-- organization_invites tables + users.default_org_id + subscriptions.org_id +
-- payments.org_id all nullable). Run it interactively — inspect the sanity
-- SELECTs below before typing COMMIT. If anything looks wrong, ROLLBACK.
--
--   psql "$DIRECT_URL" -f scripts/backfill-organizations.sql
-- or paste into the Supabase SQL editor and run statement-by-statement.

BEGIN;

DO $$
DECLARE
  u RECORD;
  new_org_id uuid;
BEGIN
  FOR u IN
    SELECT id, email, display_name
    FROM users
    WHERE deleted_at IS NULL
      AND id NOT IN (SELECT user_id FROM organization_members)
  LOOP
    INSERT INTO organizations (name)
    VALUES (COALESCE(NULLIF(u.display_name, ''), split_part(u.email, '@', 1)) || '''s Organization')
    RETURNING id INTO new_org_id;

    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, u.id, 'owner');

    UPDATE users SET default_org_id = new_org_id WHERE id = u.id;

    UPDATE subscriptions SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
    UPDATE payments      SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
  END LOOP;
END $$;

-- Sanity checks — every count below should be 0 before you COMMIT.
SELECT count(*) AS users_without_org
  FROM users WHERE deleted_at IS NULL AND default_org_id IS NULL;

SELECT count(*) AS subscriptions_without_org
  FROM subscriptions WHERE org_id IS NULL;

SELECT count(*) AS payments_without_org
  FROM payments WHERE org_id IS NULL;

-- If all three counts above are 0, run:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
