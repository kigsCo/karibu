-- 20260722205636_create_profiles.sql
-- The customer database: one public.profiles row per auth.users row, created
-- by trigger the moment a user signs up (email/password, magic link, or
-- Google OAuth). Owner-only RLS — profiles are private, there is no public
-- read. The id IS the auth.users id (1:1), so this PK deliberately does not
-- use uuid_generate_v4().

-- 1. Table ------------------------------------------------------------------
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  full_name    text,
  avatar_url   text,
  home_city_id uuid REFERENCES public.cities(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- full_name/avatar_url are the only client-writable text columns anywhere
  -- outside reviews; bound them so a client cannot store megabytes in a row.
  CONSTRAINT profiles_full_name_chk  CHECK (char_length(full_name)  <= 120),
  CONSTRAINT profiles_avatar_url_chk CHECK (char_length(avatar_url) <= 2048)
);

-- 2. Indexes (every FK) -----------------------------------------------------
CREATE INDEX idx_profiles_home_city ON public.profiles(home_city_id);

-- 3. RLS — owner-only, no public read ---------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT/DELETE policies: rows are created by the auth trigger below and
-- removed by the ON DELETE CASCADE when the auth user is deleted.

-- 4. Grants — deterministic local vs cloud (see 20260710160000) -------------
-- In the cloud, default privileges hand anon/authenticated ALL on every new
-- table; locally they get nothing. Revoke-then-grant converges both.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
-- Column-scoped UPDATE: a client may edit display fields, never its id or the
-- server-maintained email copy.
GRANT UPDATE (full_name, avatar_url, home_city_id) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 5. auth.users -> profiles triggers ----------------------------------------
-- SECURITY DEFINER because the inserting role at signup time (supabase_auth_admin
-- via GoTrue) has no privileges on public.profiles. Everything in the body is
-- schema-qualified, so search_path is pinned to the strictest value.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    -- Google supplies name/picture in raw_user_meta_data; email signups have
    -- neither and start blank. Truncate defensively to the CHECK bounds —
    -- a signup must never fail because a provider sent an oversized value.
    left(COALESCE(NEW.raw_user_meta_data ->> 'full_name',
                  NEW.raw_user_meta_data ->> 'name'), 120),
    left(COALESCE(NEW.raw_user_meta_data ->> 'avatar_url',
                  NEW.raw_user_meta_data ->> 'picture'), 2048)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep the email copy from drifting when a user changes it through GoTrue.
CREATE OR REPLACE FUNCTION public.handle_user_email_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.handle_user_email_updated();

-- 6. updated_at (reuse the shared helper) -----------------------------------
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Backfill any users that predate this table -----------------------------
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT
  u.id,
  u.email,
  left(COALESCE(u.raw_user_meta_data ->> 'full_name',
                u.raw_user_meta_data ->> 'name'), 120),
  left(COALESCE(u.raw_user_meta_data ->> 'avatar_url',
                u.raw_user_meta_data ->> 'picture'), 2048)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
