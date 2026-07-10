-- 20260601000003_functions_triggers_views.sql
-- Triggers that maintain cached/derived columns, helper functions for the
-- nightly cron jobs, and OLAP materialized views that keep analytics OFF the
-- transactional hot path. See docs/SCALABILITY.md and the db-performance skill.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER guides_set_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Cached rating maintenance
-- rating / review_count / recent_review_count_30d are CACHED on businesses so
-- the app never JOIN-aggregates reviews on a page load. Recompute on any change
-- to a review's publish status, rating, or row. ranking_score is recomputed
-- separately by the nightly calculate-rankings job.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_business_rating(biz uuid) RETURNS void
LANGUAGE sql AS $$
  UPDATE businesses b SET
    rating = COALESCE(
      (SELECT round(avg(rating)::numeric, 2) FROM reviews
       WHERE business_id = biz AND status = 'published'), 0),
    review_count = (SELECT count(*) FROM reviews
       WHERE business_id = biz AND status = 'published'),
    recent_review_count_30d = (SELECT count(*) FROM reviews
       WHERE business_id = biz AND status = 'published'
         AND created_at > now() - interval '30 days')
  WHERE b.id = biz;
$$;

CREATE OR REPLACE FUNCTION trg_reviews_recompute() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_business_rating(OLD.business_id);
    RETURN OLD;
  END IF;
  PERFORM recompute_business_rating(NEW.business_id);
  IF (TG_OP = 'UPDATE' AND NEW.business_id <> OLD.business_id) THEN
    PERFORM recompute_business_rating(OLD.business_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_recompute_rating
  AFTER INSERT OR DELETE OR UPDATE OF status, rating, business_id ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_reviews_recompute();

-- ---------------------------------------------------------------------------
-- 60-day improvement-window cron helpers (called by a scheduled job)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION flag_low_rated_businesses() RETURNS void
LANGUAGE sql AS $$
  UPDATE businesses
  SET improvement_until = now() + interval '60 days'
  WHERE status = 'active'
    AND review_count >= 20
    AND rating < 3.5
    AND improvement_until IS NULL;
$$;

CREATE OR REPLACE FUNCTION unlist_unimproved_businesses() RETURNS void
LANGUAGE sql AS $$
  UPDATE businesses
  SET status = 'unlisted'
  WHERE improvement_until IS NOT NULL
    AND improvement_until < now()
    AND rating < 3.5;
$$;

-- ---------------------------------------------------------------------------
-- OLAP / analytics materialized views
-- Refreshed on a schedule (nightly, by calculate-rankings or a dedicated job).
-- NEVER run these aggregations live during a page load.
-- ---------------------------------------------------------------------------

-- Per-category statistics. Feeds the ranking z-score and category analytics.
CREATE MATERIALIZED VIEW mv_category_stats AS
SELECT
  category_id,
  count(*) FILTER (WHERE status = 'active')                          AS active_count,
  avg(rating) FILTER (WHERE status = 'active' AND review_count > 0)  AS rating_mean,
  COALESCE(stddev_pop(rating) FILTER (WHERE status = 'active' AND review_count > 0), 0) AS rating_stddev,
  COALESCE(max(recent_review_count_30d) FILTER (WHERE status = 'active'), 0) AS max_recent_reviews_30d
FROM businesses
GROUP BY category_id;
CREATE UNIQUE INDEX idx_mv_category_stats ON mv_category_stats(category_id);

-- Per-business review analytics for the merchant dashboard.
CREATE MATERIALIZED VIEW mv_business_review_stats AS
SELECT
  b.id AS business_id,
  count(r.*) FILTER (WHERE r.status = 'published')                                  AS published_reviews,
  count(r.*) FILTER (WHERE r.status = 'published'
                       AND r.created_at > now() - interval '30 days')               AS reviews_30d,
  count(r.*) FILTER (WHERE r.status = 'published' AND r.rating = 5)                 AS five_star,
  count(r.*) FILTER (WHERE r.status = 'published' AND r.rating = 1)                 AS one_star,
  count(r.*) FILTER (WHERE r.status = 'pending_moderation')                         AS pending_moderation
FROM businesses b
LEFT JOIN reviews r ON r.business_id = b.id
GROUP BY b.id;
CREATE UNIQUE INDEX idx_mv_business_review_stats ON mv_business_review_stats(business_id);

-- Refresh entry point for the scheduled job. Plain REFRESH is transaction-safe
-- and fine in a low-traffic window; for zero-lock refresh, call
-- `REFRESH MATERIALIZED VIEW CONCURRENTLY <name>` directly from cron (outside a txn).
CREATE OR REPLACE FUNCTION refresh_analytics() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_category_stats;
  REFRESH MATERIALIZED VIEW mv_business_review_stats;
END;
$$;
