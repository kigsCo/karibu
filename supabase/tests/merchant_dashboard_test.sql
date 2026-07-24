-- merchant_dashboard_test.sql
-- Migration 20260723200000 (owner edit grant + bounds).
-- Run with: supabase test db
--
-- Proves: an owner can update the safe columns on their own row; the
-- column-scoped grant refuses locked columns (42501); a stranger's update
-- matches zero rows; the exact grant list holds. pgTAP rolls back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(12);

-- Fixtures --------------------------------------------------------------
INSERT INTO cities (slug, name, is_active)
VALUES ('mdcity', 'MD City', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('mdcat', 'MD Cat', 'Store', 995) ON CONFLICT (slug) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'md-owner@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'md-stranger@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO businesses (slug, name, category_id, city_id, hood, status, owner_id)
VALUES ('md-owned', 'MD Owned Co',
        (SELECT id FROM categories WHERE slug = 'mdcat'),
        (SELECT id FROM cities WHERE slug = 'mdcity'),
        'CBD', 'active', '00000000-0000-0000-0000-0000000000d1');

-- Grant list ------------------------------------------------------------
SELECT ok(has_column_privilege('authenticated', 'public.businesses', 'phone', 'UPDATE'),
          'authenticated may update phone');
SELECT ok(has_column_privilege('authenticated', 'public.businesses', 'hours_json', 'UPDATE'),
          'authenticated may update hours_json');
SELECT ok(has_column_privilege('authenticated', 'public.businesses', 'gallery_image_urls', 'UPDATE'),
          'authenticated may update gallery_image_urls');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'name', 'UPDATE'),
          'name stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'status', 'UPDATE'),
          'status stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'tier', 'UPDATE'),
          'tier stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'owner_id', 'UPDATE'),
          'owner_id stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'ranking_score', 'UPDATE'),
          'ranking_score stays locked');

-- As the owner ----------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ UPDATE businesses SET phone = '254712345678',
       hours_json = to_jsonb('Mon-Sat 9am-7pm'::text)
     WHERE slug = 'md-owned' $$,
  'the owner updates safe fields on their own row');
SELECT throws_ok(
  $$ UPDATE businesses SET name = 'Renamed Co' WHERE slug = 'md-owned' $$,
  '42501', NULL, 'the owner cannot rename their listing');
SELECT throws_ok(
  $$ UPDATE businesses SET about = repeat('x', 2001) WHERE slug = 'md-owned' $$,
  '23514', NULL, 'the about bound holds even for the owner');

-- As a stranger ---------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}', true);

-- A data-modifying CTE can only appear as the top-level statement of a
-- query, not nested inside a scalar subquery passed to is() — so land the
-- RETURNING rows in a temp table first, then assert on that.
CREATE TEMP TABLE stranger_update_result AS
WITH updated AS (
  UPDATE businesses SET phone = '254700000000'
   WHERE slug = 'md-owned' RETURNING id
)
SELECT count(*)::int AS n FROM updated;

SELECT is(
  (SELECT n FROM stranger_update_result),
  0, 'a stranger''s update matches zero rows');

SELECT * FROM finish();
ROLLBACK;
