-- 20260723100300_add_profiles_is_staff.sql
-- Staff flag for the onboarding review queue. Authorization lives server-side:
-- admin-review reads this with the service role and 403s non-staff.
--
-- The client-writable surface of profiles is a COLUMN-scoped grant
-- (20260722205636: GRANT UPDATE (full_name, avatar_url, home_city_id)).
-- is_staff is deliberately NOT added to that list, so a user can read their
-- own flag (existing own-row SELECT + table SELECT grant) but any client
-- UPDATE touching is_staff fails with 42501. Staff are appointed by hand:
--   UPDATE profiles SET is_staff = true WHERE email = '...';  -- as postgres

ALTER TABLE public.profiles
  ADD COLUMN is_staff boolean NOT NULL DEFAULT false;
