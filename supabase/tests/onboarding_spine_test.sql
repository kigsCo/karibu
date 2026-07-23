-- onboarding_spine_test.sql
-- The five onboarding-spine migrations (20260723100000..100400).
-- Run with: supabase test db
--
-- Proves: the three new tables are RLS-locked (owner/claimant read own rows,
-- strangers read nothing, clients cannot write at all); admin_decisions is
-- invisible to clients; is_staff cannot be self-granted; storage buckets exist
-- and only own-folder writes are accepted. pgTAP rolls everything back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(18);

-- Fixtures ---------------------------------------------------------------
INSERT INTO cities (slug, name, is_active, hoods)
VALUES ('obcity', 'OB City', true, ARRAY['CBD','Uptown'])
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('obcat', 'OB Cat', 'Store', 996) ON CONFLICT (slug) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'ob-u1@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'ob-u2@example.com')
ON CONFLICT (id) DO NOTHING;

-- ob-pending: a registration by u1 (owner) with its verification row.
INSERT INTO businesses (slug, name, category_id, city_id, hood, status, owner_id)
VALUES ('ob-pending', 'OB Pending Co',
        (SELECT id FROM categories WHERE slug = 'obcat'),
        (SELECT id FROM cities WHERE slug = 'obcity'),
        'CBD', 'pending', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO business_verifications
  (business_id, submitted_by, kra_pin, contact_phone, id_document_path)
VALUES ((SELECT id FROM businesses WHERE slug = 'ob-pending'),
        '00000000-0000-0000-0000-0000000000c1',
        'A123456789Z', '254712345678',
        '00000000-0000-0000-0000-0000000000c1/id.jpg');

-- ob-unowned: an active listing u1 has a pending claim on.
INSERT INTO businesses (slug, name, category_id, city_id, hood, status)
VALUES ('ob-unowned', 'OB Unowned Co',
        (SELECT id FROM categories WHERE slug = 'obcat'),
        (SELECT id FROM cities WHERE slug = 'obcity'),
        'CBD', 'active');
INSERT INTO business_claims
  (business_id, claimant_id, kra_pin, contact_phone, id_document_path)
VALUES ((SELECT id FROM businesses WHERE slug = 'ob-unowned'),
        '00000000-0000-0000-0000-0000000000c1',
        'A123456789Z', '254712345678',
        '00000000-0000-0000-0000-0000000000c1/id.jpg');

INSERT INTO admin_decisions (subject_type, subject_id, action, decided_by)
VALUES ('claim', uuid_generate_v4(), 'approved',
        '00000000-0000-0000-0000-0000000000c1');

-- Structure ---------------------------------------------------------------
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'business_verifications'),
          'RLS enabled on business_verifications');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'business_claims'),
          'RLS enabled on business_claims');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_decisions'),
          'RLS enabled on admin_decisions');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_verifications'
                  AND policyname = 'Owner reads own verification'),
          'owner-read policy exists on business_verifications');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_claims'
                  AND policyname = 'Claimant reads own claims'),
          'claimant-read policy exists on business_claims');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE tablename = 'admin_decisions'),
          0, 'admin_decisions has zero policies (service-role only)');

-- As u1 (the applicant) -----------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is((SELECT count(*)::int FROM business_verifications), 1,
          'the owner sees their own verification evidence');
SELECT is((SELECT count(*)::int FROM business_claims), 1,
          'the claimant sees their own claim');
SELECT throws_ok(
  $$ INSERT INTO business_verifications
       (business_id, submitted_by, kra_pin, contact_phone, id_document_path)
     VALUES ((SELECT id FROM businesses WHERE slug = 'ob-unowned'),
             '00000000-0000-0000-0000-0000000000c1',
             'A123456789Z', '254712345678', 'x/id.jpg') $$,
  '42501', NULL, 'clients cannot insert verification evidence');
SELECT throws_ok(
  $$ INSERT INTO business_claims
       (business_id, claimant_id, kra_pin, contact_phone, id_document_path)
     VALUES ((SELECT id FROM businesses WHERE slug = 'ob-pending'),
             '00000000-0000-0000-0000-0000000000c1',
             'A123456789Z', '254712345678', 'x/id.jpg') $$,
  '42501', NULL, 'clients cannot insert claims directly');
SELECT throws_ok(
  $$ SELECT count(*) FROM admin_decisions $$,
  '42501', NULL, 'clients cannot read the decision log');
SELECT throws_ok(
  $$ UPDATE profiles SET is_staff = true
     WHERE id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', NULL, 'a user cannot appoint themselves staff');

-- Storage: own-folder discipline ---------------------------------------------
SELECT lives_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('verification-docs',
             '00000000-0000-0000-0000-0000000000c1/own.jpg',
             '00000000-0000-0000-0000-0000000000c1') $$,
  'a user can write into their own verification-docs folder');
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name, owner)
     VALUES ('verification-docs',
             '00000000-0000-0000-0000-0000000000c2/theirs.jpg',
             '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', NULL, 'a user cannot write into another user''s folder');

-- As u2 (a stranger) ----------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated"}', true);

SELECT is((SELECT count(*)::int FROM business_verifications), 0,
          'a stranger sees no verification evidence');
SELECT is((SELECT count(*)::int FROM business_claims), 0,
          'a stranger sees no claims');
SELECT is((SELECT count(*)::int FROM storage.objects
           WHERE bucket_id = 'verification-docs'), 0,
          'a stranger sees no verification-docs objects');

RESET ROLE;
SELECT is((SELECT count(*)::int FROM storage.buckets
           WHERE id IN ('verification-docs','business-photos')), 2,
          'both onboarding buckets exist');

SELECT * FROM finish();
ROLLBACK;
