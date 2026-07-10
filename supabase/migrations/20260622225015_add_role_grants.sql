-- 20260622225015_add_role_grants.sql
-- Table-level privilege grants for the API roles.
--
-- WHY THIS EXISTS: RLS policies only decide WHICH rows a role may see; a role
-- still needs a table-level GRANT to touch the table at all. Supabase's
-- auto-grant default-privilege is scoped to the `supabase_admin` role, so the
-- tables created by these `postgres`-run migrations never receive it. That left
-- anon, authenticated, AND service_role with no SELECT/INSERT/UPDATE/DELETE on
-- any app table — silently breaking every anon-key read and every service-role
-- edge function (BYPASSRLS skips row filtering, NOT the missing table grant).
-- These grants make the access model explicit and portable (identical local and
-- cloud) instead of depending on Supabase's internal default privileges.
--
-- MODEL:
--   service_role  -> full access to all app tables (trusted server role behind
--                    the edge functions; also BYPASSRLS).
--   anon          -> SELECT only on the publicly-readable tables; RLS narrows to
--                    live rows. No write privilege at all (defense in depth).
--   authenticated -> SELECT on those, plus exactly the writes its policies
--                    intend: insert a review, manage own saved_places, read own
--                    subscriptions. Deliberately NOT a blanket businesses UPDATE
--                    — that would let an owner rewrite cached rating/
--                    ranking_score/tier/status (trust-critical, cron/trigger-
--                    owned). When owner self-edit ships, grant UPDATE on the
--                    specific editable columns only.
--   ai_conversations, rate_limits -> no anon/authenticated grant (service-role
--                    only); covered by the service_role grant below.

-- 1. service_role: trusted server role for the edge functions ---------------
--    Enumerated (not "ALL TABLES IN SCHEMA public") so we don't try to grant on
--    PostGIS system objects (spatial_ref_sys / geography_columns / geometry_
--    columns), which postgres cannot grant and which service_role never needs.
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
-- Future tables created by postgres should also reach service_role, so this
-- exact gap cannot recur on the next migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

-- 2. Schema usage (idempotent; normally already present) --------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 3. Public-readable tables: SELECT for anon + authenticated ----------------
--    RLS filters rows (active / published / is_active); the grant only permits
--    the SELECT to be attempted.
GRANT SELECT ON
  public.cities,
  public.categories,
  public.sub_types,
  public.businesses,
  public.reviews,
  public.guides
TO anon, authenticated;

-- 4. Authenticated writes, matching the policies in
--    20260601000002_rls_policies.sql ---------------------------------------
--    reviews: "Authenticated inserts own review" (WITH CHECK reviewer_id = auth.uid()).
GRANT INSERT ON public.reviews TO authenticated;
--    saved_places: "Users manage their saved places" (FOR ALL on own rows).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
--    subscriptions: "Owner reads own subscriptions" (read-only; writes happen
--    on the service role inside the M-Pesa edge functions).
GRANT SELECT ON public.subscriptions TO authenticated;
