-- profiles_test.sql
-- The customer database (20260722205636_create_profiles.sql). Run with:
-- supabase test db
--
-- Proves the privacy model end to end: anon sees nothing, a signed-in user
-- sees exactly their own row and cannot touch anyone else's, the client can
-- never rewrite the server-maintained email copy, and the auth.users
-- triggers create + sync profile rows for every signup flavour (Google
-- metadata and bare email). pgTAP rolls the whole file back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(10);

-- 1) anon has no privileges at all — profiles are private.
SELECT ok(
  NOT has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon cannot SELECT profiles'
);

-- 2) RLS is enabled.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

-- 3) Exactly the two owner policies exist.
SELECT policies_are(
  'public', 'profiles',
  ARRAY['Users read own profile', 'Users update own profile'],
  'profiles has exactly the two owner-only policies'
);

-- 4/5) Column-scoped UPDATE: display fields yes, the email copy no.
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'),
  'authenticated cannot UPDATE the server-maintained email copy'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'),
  'authenticated can UPDATE full_name'
);

-- Fixtures: two auth users. u1 signs up via Google (name/picture metadata),
-- u2 via bare email. The AFTER INSERT trigger must create both profiles.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'g@example.com',
        '{"name": "Google Person", "picture": "https://lh3.example/pic.jpg"}'::jsonb);
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-0000000000a2', 'plain@example.com', '{}'::jsonb);

-- 6) Google signup: profile created with name + avatar copied from metadata.
SELECT results_eq(
  $$ SELECT full_name, avatar_url FROM public.profiles
     WHERE id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ VALUES ('Google Person', 'https://lh3.example/pic.jpg') $$,
  'signup trigger copies Google name/picture metadata into the profile'
);

-- 7) Bare email signup: profile row exists, display fields empty.
SELECT results_eq(
  $$ SELECT email, full_name FROM public.profiles
     WHERE id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ VALUES ('plain@example.com', NULL) $$,
  'signup trigger creates a blank profile for a bare-email signup'
);

-- Become u1 (authenticated) the way PostgREST does: role + JWT claims.
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}',
  true);
SET LOCAL ROLE authenticated;

-- 8) u1 sees exactly one profile row — their own.
SELECT results_eq(
  $$ SELECT id FROM public.profiles $$,
  $$ VALUES ('00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'an authenticated user sees only their own profile'
);

-- u1 tries to rename u2 — RLS must filter it to zero rows, silently.
UPDATE public.profiles SET full_name = 'hax'
WHERE id = '00000000-0000-0000-0000-0000000000a2';

RESET ROLE;

-- 9) u2's row is untouched.
SELECT is(
  (SELECT full_name FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-0000000000a2'),
  NULL,
  'RLS blocks updating another user''s profile'
);

-- 10) Changing the auth email syncs the profile copy.
UPDATE auth.users SET email = 'renamed@example.com'
WHERE id = '00000000-0000-0000-0000-0000000000a2';
SELECT is(
  (SELECT email FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-0000000000a2'),
  'renamed@example.com',
  'email-update trigger keeps the profile email copy in sync'
);

SELECT * FROM finish();
ROLLBACK;
