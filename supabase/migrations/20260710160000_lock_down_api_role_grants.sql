-- 20260710160000_lock_down_api_role_grants.sql
-- Make the API-role grant model deterministic, and identical local vs cloud.
--
-- WHY THIS EXISTS: 20260622225015_add_role_grants.sql was written against the
-- LOCAL stack, where migrations run as `postgres` and Supabase's auto-grant
-- default privilege (scoped to `supabase_admin`) never fires — leaving anon,
-- authenticated, and service_role with NO privileges at all. In the CLOUD the
-- opposite happens: default privileges hand anon and authenticated ALL
-- privileges on every table in `public` — SELECT, INSERT, UPDATE, DELETE,
-- TRUNCATE — the moment the table is created.
--
-- Measured on the cloud project right after the first push:
--   has_table_privilege('anon','public.businesses','DELETE')               -> true
--   has_table_privilege('anon','public.reviews','UPDATE')                  -> true
--   has_table_privilege('anon','public.mv_business_review_stats','SELECT') -> true
--
-- RLS was still holding the line on the app tables (no anon write policy exists,
-- so PostgREST writes get filtered away). But that made RLS the ONLY layer,
-- which is exactly what add_role_grants set out to avoid. And materialized views
-- are NOT subject to RLS at all, so the SELECT grant on
-- `mv_business_review_stats` was unconditional read access to every business's
-- pending-moderation counts.
--
-- So: revoke everything from the API roles on the objects we own, then re-grant
-- exactly the model documented in add_role_grants. Written revoke-then-grant so
-- it converges to the same end state whichever way the environment started, and
-- is safe to re-run.
--
-- NOT FIXED HERE — `public.spatial_ref_sys` (and the `geometry_columns` /
-- `geography_columns` views) are created by the PostGIS extension and owned by
-- `supabase_admin`. `postgres` is neither a superuser nor a member of that role
-- in either environment, so it cannot REVOKE on them or enable RLS. PostgREST
-- serves them, and anon holds INSERT/DELETE. `businesses.location` is unused and
-- NULL everywhere today, so the practical remedy is to reinstall PostGIS into the
-- unexposed `extensions` schema (PostGIS does not support ALTER EXTENSION ... SET
-- SCHEMA, so it must be dropped and recreated). Tracked in MIGRATION_CHECKLIST.md.

-- ---------------------------------------------------------------------------
-- 1. Reset. Objects are enumerated rather than `ALL TABLES IN SCHEMA public`,
--    because that form also expands to the PostGIS objects we do not own and
--    would emit a warning per table while changing nothing.
-- ---------------------------------------------------------------------------
REVOKE ALL ON
  public.cities,
  public.categories,
  public.sub_types,
  public.businesses,
  public.reviews,
  public.guides,
  public.subscriptions,
  public.saved_places,
  public.ai_conversations,
  public.rate_limits
FROM anon, authenticated;

-- Materialized views are not covered by `ALL TABLES`, and not covered by RLS.
REVOKE ALL ON public.mv_category_stats        FROM anon, authenticated;
REVOKE ALL ON public.mv_business_review_stats FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Re-grant the intended model (mirrors 20260622225015_add_role_grants.sql).
--    RLS narrows rows; the grant only permits the statement to be attempted.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
  public.cities,
  public.categories,
  public.sub_types,
  public.businesses,
  public.reviews,
  public.guides
TO anon, authenticated;

GRANT INSERT ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. service_role keeps full access to the app tables and the analytics views
--    (the edge functions read them). Idempotent.
-- ---------------------------------------------------------------------------
GRANT ALL ON
  public.cities,
  public.categories,
  public.sub_types,
  public.businesses,
  public.reviews,
  public.guides,
  public.subscriptions,
  public.saved_places,
  public.ai_conversations,
  public.rate_limits
TO service_role;

GRANT SELECT ON public.mv_category_stats        TO service_role;
GRANT SELECT ON public.mv_business_review_stats TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Pin search_path on our own functions.
--    A mutable search_path lets anyone who can create objects shadow an
--    unqualified name the function body resolves at call time. Our bodies use
--    unqualified names, so pin to `public, pg_temp` rather than to empty.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at()                SET search_path = public, pg_temp;
ALTER FUNCTION public.recompute_business_rating(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_reviews_recompute()         SET search_path = public, pg_temp;
ALTER FUNCTION public.flag_low_rated_businesses()     SET search_path = public, pg_temp;
ALTER FUNCTION public.unlist_unimproved_businesses()  SET search_path = public, pg_temp;
ALTER FUNCTION public.refresh_analytics()             SET search_path = public, pg_temp;
ALTER FUNCTION public.prune_rate_limits()             SET search_path = public, pg_temp;
