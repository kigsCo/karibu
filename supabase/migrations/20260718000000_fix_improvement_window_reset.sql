-- 20260718000000_fix_improvement_window_reset.sql
-- Fix the 3.5★ improvement-window re-flag bug (FIX_PLAN P0 #8).
--
-- `improvement_until` doubles as the "on a 60-day improvement clock" sentinel,
-- but the original flag_low_rated_businesses (20260601000003) never cleared it
-- when a business RECOVERED to >= 3.5. The stale, now past-dated window then
-- became a landmine: on a later dip below 3.5, flag_low_rated_businesses would
-- NOT grant a fresh window (its `improvement_until IS NULL` guard is false) and
-- unlist_unimproved_businesses would see a past `improvement_until` + rating < 3.5
-- and unlist the business IMMEDIATELY — with no new 60-day grace at all.
--
-- The fix: flag_low_rated_businesses now first CLEARS the window for any business
-- that has recovered (rating >= 3.5), then grants fresh windows to those still
-- below 3.5 with no active window. The nightly job (calculate-rankings) runs this
-- BEFORE unlist_unimproved_businesses, so a re-dip earns a brand-new future window
-- and is never unlisted on a stale date. unlist_unimproved_businesses is unchanged.
--
-- CREATE OR REPLACE only — no new objects, so no new grants/RLS/indexes are
-- needed (both helpers are called with the service role from the cron function).
-- Never edits the shipped 20260601000003; this supersedes the function body.
--
-- IMPORTANT: the search_path pin from 20260710160000 (`ALTER FUNCTION ... SET
-- search_path = public, pg_temp`) is NOT preserved by CREATE OR REPLACE —
-- Postgres resets proconfig on replace. We therefore declare it INLINE here so
-- the hardening survives this replacement (and any future one), keeping the
-- Supabase `function_search_path_mutable` advisor clean. The body uses the
-- unqualified `businesses`, so a mutable search_path would be a shadowing risk.

CREATE OR REPLACE FUNCTION flag_low_rated_businesses() RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  -- Recovery first: a business back at or above 3.5 no longer has a pending
  -- unlisting, so clear its window. THIS is the statement the original was
  -- missing — without it a recovered business kept a stale, past-dated window
  -- forever, and a later dip unlisted it instantly with no fresh grace.
  UPDATE businesses
  SET improvement_until = NULL
  WHERE improvement_until IS NOT NULL
    AND rating >= 3.5;

  -- Then flag: an active business with enough reviews to be judged (>= 20) that
  -- is still below 3.5 and has no active window gets a fresh 60-day window.
  UPDATE businesses
  SET improvement_until = now() + interval '60 days'
  WHERE status = 'active'
    AND review_count >= 20
    AND rating < 3.5
    AND improvement_until IS NULL;
$$;
