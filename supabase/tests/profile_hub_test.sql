-- profile_hub_test.sql
-- The two profile-hub migrations (20260722231313 owner-read reviews policy,
-- 20260722231317 visited_places). Run with: supabase test db
--
-- Proves: a reviewer sees their own pending review while other users and
-- anon still see published-only; visited_places is owner-only in every verb
-- (read, insert, upsert-refresh, clear) and invisible to anon. pgTAP rolls
-- the whole file back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(12);

-- Fixtures --------------------------------------------------------------
INSERT INTO cities (slug, name, is_active)
VALUES ('phcity', 'PH City', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('phcat', 'PH Cat', 'Store', 997) ON CONFLICT (slug) DO NOTHING;
INSERT INTO businesses (slug, name, category_id, city_id, hood, status)
VALUES ('ph-biz', 'Profile Hub Co',
        (SELECT id FROM categories WHERE slug = 'phcat'),
        (SELECT id FROM cities     WHERE slug = 'phcity'),
        'CBD', 'active');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'ph-u1@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'ph-u2@example.com');

-- u1 has one pending review; u2 has none.
INSERT INTO reviews (business_id, reviewer_id, reviewer_name, rating, body, status)
VALUES ((SELECT id FROM businesses WHERE slug = 'ph-biz'),
        '00000000-0000-0000-0000-0000000000b1', 'PH User One', 5,
        'Forty-plus characters of body text so the length check passes fine.',
        'pending_moderation');

-- u2 has a visit-history row (inserted as postgres to test isolation).
INSERT INTO visited_places (user_id, business_id)
VALUES ('00000000-0000-0000-0000-0000000000b2',
        (SELECT id FROM businesses WHERE slug = 'ph-biz'));

-- Reviews owner-read policy ---------------------------------------------
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE tablename = 'reviews'
            AND policyname = 'Reviewer reads own reviews'),
  'the owner-read policy exists on reviews'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE tablename = 'reviews'
            AND indexname = 'idx_reviews_reviewer_recent'),
  'the reviewer/recency index exists'
);

-- Become u1.
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM reviews
   WHERE reviewer_id = '00000000-0000-0000-0000-0000000000b1'
     AND status = 'pending_moderation'),
  1,
  'a reviewer sees their own pending review'
);

-- visited_places as u1: insert own, cannot forge u2's -------------------
INSERT INTO visited_places (user_id, business_id)
VALUES ('00000000-0000-0000-0000-0000000000b1',
        (SELECT id FROM businesses WHERE slug = 'ph-biz'));

SELECT throws_ok(
  $$ INSERT INTO visited_places (user_id, business_id)
     VALUES ('00000000-0000-0000-0000-0000000000b2',
             (SELECT id FROM businesses WHERE slug = 'ph-biz'))
     ON CONFLICT (user_id, business_id)
       DO UPDATE SET visited_at = now() $$,
  '42501',
  NULL,
  'a user cannot write another user''s history row'
);

SELECT is(
  (SELECT count(*)::int FROM visited_places),
  1,
  'a user sees only their own history (u2''s row is invisible)'
);

-- Upsert-refresh (the revisit path) needs UPDATE to work under RLS.
INSERT INTO visited_places (user_id, business_id, visited_at)
VALUES ('00000000-0000-0000-0000-0000000000b1',
        (SELECT id FROM businesses WHERE slug = 'ph-biz'),
        now() + interval '1 hour')
ON CONFLICT (user_id, business_id)
  DO UPDATE SET visited_at = EXCLUDED.visited_at;

SELECT ok(
  (SELECT visited_at > now() FROM visited_places
   WHERE user_id = '00000000-0000-0000-0000-0000000000b1'),
  'revisiting refreshes visited_at via upsert (last-visit-wins)'
);

-- Clear history: delete everything of one's own.
DELETE FROM visited_places;
SELECT is(
  (SELECT count(*)::int FROM visited_places),
  0,
  'clear history removes the user''s own rows'
);

-- Become u2: cannot see u1's pending review.
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM reviews WHERE status = 'pending_moderation'),
  0,
  'another user cannot see someone else''s pending review'
);

RESET ROLE;

-- u2's history row survived u1's clear (scoped delete, not table-wide).
SELECT is(
  (SELECT count(*)::int FROM visited_places
   WHERE user_id = '00000000-0000-0000-0000-0000000000b2'),
  1,
  'clear history only touched the caller''s rows'
);

-- Anon: published-only reviews, no history access ------------------------
SET LOCAL ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM reviews WHERE status = 'pending_moderation'),
  0,
  'anon still cannot see pending reviews'
);
RESET ROLE;

SELECT ok(
  NOT has_table_privilege('anon', 'visited_places', 'SELECT'),
  'anon has no access to visited_places'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'visited_places'::regclass),
  'RLS is enabled on visited_places'
);

SELECT * FROM finish();
ROLLBACK;
