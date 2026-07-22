-- improvement_window_test.sql
-- Regression for the 3.5★ improvement-window re-flag bug (FIX_PLAN P0 #8, fixed
-- in 20260718000000_fix_improvement_window_reset.sql). Run with: supabase test db
--
-- Proves the recover -> dip cycle: a business that recovered above 3.5 must earn
-- a FRESH 60-day window on a later dip, and must NOT be unlisted on a stale,
-- past-dated window. Mirrors the nightly order (flag BEFORE unlist).
--
-- rating / review_count are cached columns normally maintained by the reviews
-- trigger; here we set them directly (as the privileged test role) to drive the
-- helper functions in isolation. pgTAP rolls the whole file back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(5);

-- Fixtures.
INSERT INTO cities (slug, name, is_active)
VALUES ('iwcity', 'IW City', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('iwcat', 'IW Cat', 'Store', 998) ON CONFLICT (slug) DO NOTHING;

-- Judged (>= 20 reviews), currently below 3.5, active, no window yet.
INSERT INTO businesses
  (slug, name, category_id, city_id, hood, status, rating, review_count, improvement_until)
VALUES
  ('iw-biz', 'Improvement Window Co',
   (SELECT id FROM categories WHERE slug = 'iwcat'),
   (SELECT id FROM cities     WHERE slug = 'iwcity'),
   'CBD', 'active', 3.20, 25, NULL);

-- 1) First dip: flag grants a 60-day window.
SELECT flag_low_rated_businesses();
SELECT isnt(
  (SELECT improvement_until FROM businesses WHERE slug = 'iw-biz'),
  NULL,
  'flag grants an improvement window to a newly under-3.5 business'
);

-- 2) Recovery to 4.1: flag must CLEAR the window (the exact line the bug omitted).
UPDATE businesses SET rating = 4.10 WHERE slug = 'iw-biz';
SELECT flag_low_rated_businesses();
SELECT is(
  (SELECT improvement_until FROM businesses WHERE slug = 'iw-biz'),
  NULL,
  'flag clears the window once the business recovers to >= 3.5'
);

-- 3) Re-dip after recovery: flag must grant a FRESH (future) window, not reuse a
--    stale past date.
UPDATE businesses SET rating = 3.10 WHERE slug = 'iw-biz';
SELECT flag_low_rated_businesses();
SELECT ok(
  (SELECT improvement_until FROM businesses WHERE slug = 'iw-biz') > now(),
  're-dip earns a fresh future window, not a stale past date'
);

-- 4) unlist right after (as the cron does) must NOT unlist it — the fresh window
--    has not expired.
SELECT unlist_unimproved_businesses();
SELECT is(
  (SELECT status FROM businesses WHERE slug = 'iw-biz'),
  'active',
  'a business inside a fresh window is not unlisted'
);

-- 5) Control: a genuinely expired window with rating still < 3.5 DOES unlist
--    (unlist_unimproved_businesses behaviour is unchanged).
UPDATE businesses SET improvement_until = now() - interval '1 day' WHERE slug = 'iw-biz';
SELECT unlist_unimproved_businesses();
SELECT is(
  (SELECT status FROM businesses WHERE slug = 'iw-biz'),
  'unlisted',
  'an expired window with rating still < 3.5 unlists (unchanged behaviour)'
);

SELECT * FROM finish();
ROLLBACK;
