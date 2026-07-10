-- 20260710170000_move_postgis_out_of_public.sql
-- Get PostGIS and pg_trgm out of the PostgREST-exposed `public` schema.
--
-- WHY: `20260601000001_core_schema.sql` ran `CREATE EXTENSION postgis;` with no
-- schema, so PostGIS installed into `public`. Everything PostGIS creates lands
-- there too — including `spatial_ref_sys`, which:
--
--   * has no row-level security, and cannot be given any (we do not own it), and
--   * is served by PostgREST like any other public table, and
--   * had INSERT/DELETE granted to `anon` by the cloud's default privileges.
--
-- Measured on the cloud project:
--   has_table_privilege('anon','public.spatial_ref_sys','DELETE') -> true
--
-- The anon key is public by design, so that is a writable endpoint for anyone.
-- `20260710160000_lock_down_api_role_grants.sql` could not close it: the table is
-- owned by `supabase_admin`, and `postgres` is neither a superuser nor a member
-- of that role in either environment, so REVOKE and ALTER TABLE both no-op.
--
-- The only real fix is for the extension not to live in `public` at all. Supabase
-- pre-creates an unexposed `extensions` schema for exactly this (`uuid-ossp` is
-- already there). PostGIS does not support `ALTER EXTENSION ... SET SCHEMA`, so it
-- has to be dropped and recreated. pg_trgm does support it, but its index has to
-- be dropped first regardless.
--
-- SAFE TO DO NOW, EXPENSIVE LATER: `businesses.location` is read and written by no
-- application code, and is NULL on every row. Dropping and re-adding it loses
-- nothing today. Once real coordinates exist this becomes a data migration.
--
-- AFTER THIS MIGRATION: the `geography` type lives in `extensions` and is not on
-- the default search_path. Later migrations must write `extensions.geography(...)`
-- and `extensions.gin_trgm_ops`, as this file does.

-- ---------------------------------------------------------------------------
-- 1. Drop what depends on the two extensions. Order matters: the indexes and the
--    column reference types/opclasses that DROP EXTENSION would otherwise refuse
--    to remove (and CASCADE would remove without telling us what it took).
-- ---------------------------------------------------------------------------
DROP INDEX public.idx_businesses_name_trgm;
DROP INDEX public.idx_businesses_location;
ALTER TABLE public.businesses DROP COLUMN location;

-- ---------------------------------------------------------------------------
-- 2. Relocate. pg_trgm can move in place; PostGIS must be recreated.
-- ---------------------------------------------------------------------------
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

DROP EXTENSION postgis;
CREATE EXTENSION postgis WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 3. Restore the column and both indexes, now qualified against `extensions`.
--    The GIST default operator class is resolved from the column's type, so it
--    needs no qualification; the GIN one does.
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN location extensions.geography(Point, 4326);

COMMENT ON COLUMN public.businesses.location IS
  'WGS84 point. Type lives in the `extensions` schema — qualify it in migrations.';

CREATE INDEX idx_businesses_location
  ON public.businesses USING GIST (location);

CREATE INDEX idx_businesses_name_trgm
  ON public.businesses USING GIN (name extensions.gin_trgm_ops);
