-- rls_smoke_test.sql
-- RLS posture smoke test. Run with: supabase test db
-- Proves anon cannot read non-active businesses, cannot write businesses, and
-- cannot read un-published reviews. RLS is the last line of defense (CLAUDE.md);
-- this guards against a policy regression silently exposing data.
--
-- pgTAP wraps each file in a rolled-back transaction, so the fixtures we insert
-- (as the privileged test role, before switching to anon) never persist.

BEGIN;

-- pgTAP harness. (Supabase's local DB ships the extension.)
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(6);

-- ---------------------------------------------------------------------------
-- Fixtures: one ACTIVE + one PENDING business, one PUBLISHED + one PENDING
-- review. Inserted as the current (privileged) test role, which bypasses RLS.
-- ---------------------------------------------------------------------------
INSERT INTO cities (slug, name, is_active)
VALUES ('testcity', 'Test City', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('testcat', 'Test Cat', 'Store', 999)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO businesses (slug, name, category_id, city_id, hood, status)
VALUES
  ('rls-active', 'RLS Active Co',
   (SELECT id FROM categories WHERE slug='testcat'),
   (SELECT id FROM cities WHERE slug='testcity'), 'CBD', 'active'),
  ('rls-pending', 'RLS Pending Co',
   (SELECT id FROM categories WHERE slug='testcat'),
   (SELECT id FROM cities WHERE slug='testcity'), 'CBD', 'pending')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO reviews (business_id, reviewer_name, rating, body, status, published_at)
VALUES
  ((SELECT id FROM businesses WHERE slug='rls-active'),
   'Pub Reviewer', 5,
   'This is a published review long enough to satisfy the length check.',
   'published', now()),
  ((SELECT id FROM businesses WHERE slug='rls-active'),
   'Pending Reviewer', 4,
   'This is a pending review long enough to satisfy the length constraint.',
   'pending_moderation', NULL);

-- ---------------------------------------------------------------------------
-- Switch to the anon role — this is what an unauthenticated browser request
-- sees. From here, every query is subject to RLS.
-- ---------------------------------------------------------------------------
SET ROLE anon;

-- 1) anon sees the ACTIVE business.
SELECT is(
  (SELECT count(*)::int FROM businesses WHERE slug = 'rls-active'),
  1,
  'anon CAN read an active business'
);

-- 2) anon does NOT see the PENDING business.
SELECT is(
  (SELECT count(*)::int FROM businesses WHERE slug = 'rls-pending'),
  0,
  'anon CANNOT read a pending business'
);

-- 3) anon INSERT into businesses is blocked (no anon write policy).
SELECT throws_ok(
  $$ INSERT INTO businesses (slug, name, category_id, city_id, hood, status)
     VALUES ('rls-anon-insert', 'Should Fail',
       (SELECT id FROM categories WHERE slug='testcat'),
       (SELECT id FROM cities WHERE slug='testcity'), 'CBD', 'active') $$,
  '42501',  -- insufficient_privilege (RLS violation)
  NULL,
  'anon CANNOT insert a business'
);

-- 4) anon UPDATE of businesses is blocked at the privilege layer. anon holds NO
--    write grant on businesses (grants live in 20260622225015_add_role_grants),
--    so the statement is rejected before RLS is even consulted -- defense in
--    depth: even a stray UPDATE policy could not expose writes without the grant.
SELECT throws_ok(
  $$ UPDATE businesses SET name = 'hijacked' WHERE slug = 'rls-active' $$,
  '42501',  -- insufficient_privilege
  NULL,
  'anon CANNOT update a business (no write privilege)'
);

-- 5) anon does NOT see un-published (pending_moderation) reviews.
SELECT is(
  (SELECT count(*)::int FROM reviews WHERE reviewer_name = 'Pending Reviewer'),
  0,
  'anon CANNOT read a pending_moderation review'
);

-- 6) anon CAN see published reviews.
SELECT is(
  (SELECT count(*)::int FROM reviews WHERE reviewer_name = 'Pub Reviewer'),
  1,
  'anon CAN read a published review'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

-- ---------------------------------------------------------------------------
-- PLAIN-SQL FALLBACK (if pgTAP is unavailable, run these by hand after
-- `SET ROLE anon;` — each should return the noted result):
--
--   SET ROLE anon;
--   SELECT count(*) FROM businesses WHERE status = 'pending';        -- expect 0
--   SELECT count(*) FROM reviews    WHERE status = 'pending_moderation'; -- expect 0
--   INSERT INTO businesses (slug, name, category_id, city_id, hood)
--     VALUES ('x','x', '<cat>', '<city>', 'CBD');                    -- expect ERROR 42501
--   RESET ROLE;
-- ---------------------------------------------------------------------------
