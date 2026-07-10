---
name: db-performance
description: Use when adding any query, list endpoint, or schema change to Karibu and you need it to scale — deciding indexing, caching of derived values, keyset vs offset pagination, pushing heavy work to cron, and using materialized views for analytics. The scalability brain; invoke whenever the root CLAUDE.md says "when in doubt, invoke db-performance."
---

# Database performance & scalability

Karibu must scale to **10,000+ listings / 300k monthly visitors without re-architecting** (root `CLAUDE.md`). Bake these in by default — they are cheaper now than a rewrite later. The stack is deliberately simple: Postgres + `pg_trgm` + PostGIS + Supabase realtime + cron edge functions. No Redis, no queues, no search service.

## When to use
Before adding any query, list, hot-path filter, or schema change. Run the decision checklist at the bottom every time.

## 1. Indexing — index every FK + every hot-path filter/sort
- **Every foreign key** gets an index (`idx_businesses_city ON businesses(city_id)`).
- **Every column in a `WHERE`/`ORDER BY` on a hot path** gets one (`idx_businesses_ranking ON businesses(ranking_score DESC) WHERE status='active'`).
- **Partial indexes** for the live filter — index only the rows you query: `WHERE status='active'`, `WHERE is_published=true`, `WHERE status='pending_moderation'`. Smaller, hotter, faster.
- **GiST** for geography (`USING GIST(location)`) — "businesses near me" radius queries.
- **GIN + pg_trgm** for fuzzy name search (`USING GIN(name gin_trgm_ops)`) — typo-tolerant search without a search service.
- Add indexes **in the same migration** as the query/table (`supabase-migration` skill). Read the existing indexes in `20260601000001_core_schema.sql` before adding queries — the ones you need may already exist.

## 2. Caching derived values on the row (never live-aggregate)
Counts and scores are **cached columns on `businesses`**, maintained by trigger or cron — the app never JOIN-aggregates reviews on a page load:
- `rating`, `review_count`, `recent_review_count_30d` — refreshed by the `reviews_recompute_rating` trigger via `recompute_business_rating(biz)` whenever a review's publish status/rating/row changes (see `...0003_functions_triggers_views.sql`).
- `ranking_score` — recomputed nightly by the `calculate-rankings` cron (`ranking-algorithm` skill).

Rule: if a value is read far more often than it changes, **compute it on write and cache it on the row**. Reading it is then a single indexed column lookup, not an aggregate. Reference data (`cities`, `categories`) is fetched once on app load into React Context (`frontend-data-migration` skill); static pages are edge-cached at the CDN.

## 3. Pagination — keyset on hot lists, offset only for admin
**Never return an unbounded list.** Default page size 20-50.
- **Keyset / cursor (hot paths):** order by the cached score and page with a cursor — O(1) per page regardless of depth:
  ```sql
  SELECT ... FROM businesses
  WHERE status = 'active' AND ranking_score < $cursor   -- last score seen
  ORDER BY ranking_score DESC, id DESC
  LIMIT 20;
  ```
  Backed by `idx_businesses_active_rank_id` (`(ranking_score DESC, id) WHERE status='active'`). The `id` tiebreaker makes the cursor stable.
- **Offset (admin/low-traffic only):** `LIMIT n OFFSET m` is fine for an admin table nobody hammers, but degrades on deep pages — never use it on a public hot list.

## 4. Async / heavy work -> cron edge functions (off the request path)
Anything slow or batchy runs as a **cron-triggered edge function**, not inline in a user request: `moderate-reviews` (hourly), `calculate-rankings` (nightly), emails, reverse-image checks, M-Pesa reconciliation, materialized-view refresh. Fire-and-forget logging (e.g. the `ai_conversations` insert after an Ask Karibu answer) must **never block the response**. See the `edge-function` skill (cron vs request-path).

## 5. OLAP / analytics -> materialized views (never GROUP BY live on a page load)
Keep analytics off the transactional hot path. Use the materialized views in `...0003_functions_triggers_views.sql`, refreshed on a schedule:
- **`mv_category_stats`** — per-category `rating_mean` / `rating_stddev` / `max_recent_reviews_30d` / `active_count`. Feeds the ranking z-score and category analytics.
- **`mv_business_review_stats`** — per-business `published_reviews` / `reviews_30d` / `five_star` / `one_star` / `pending_moderation`. Feeds the merchant dashboard.
- Refresh via `refresh_analytics()` (plain `REFRESH`, transaction-safe) on a schedule, or `REFRESH MATERIALIZED VIEW CONCURRENTLY <name>` directly from cron for a zero-lock refresh. Both views have a `UNIQUE` index (required for CONCURRENTLY).
- If you find yourself writing a heavy `GROUP BY` over `businesses`/`reviews` for a dashboard or stats panel, that is a **materialized view**, not a page-load query.

## Decision checklist — run before adding ANY query
1. **Indexed?** Is every FK and every `WHERE`/`ORDER BY` column on this path backed by an index (partial / GiST / GIN where it fits)? If not, add one in the same migration.
2. **Paginated?** Does it return a bounded set? Hot list => keyset cursor; admin => offset OK. No unbounded `select('*')`.
3. **Cached?** Is it aggregating values that change rarely but are read often? If so, cache on the row via trigger/cron and read the column instead.
4. **Could this be a matview?** Is it a heavy `GROUP BY` for analytics/dashboard? Make it a materialized view refreshed on schedule.
5. **Off the request path?** Is the work slow/batchy? Move it to a cron edge function; never block a user response.

## Common mistakes
- Live-aggregating `avg(rating)` / `count(reviews)` on a page load instead of reading the cached column.
- Offset pagination on a public hot list (slows to a crawl on deep pages).
- An unindexed FK or filter column that seq-scans once the table grows.
- Running dashboard `GROUP BY`s against live tables instead of a materialized view.
- Doing moderation/ranking/email inline in a request instead of a cron function.
- Forgetting the `UNIQUE` index a matview needs for `REFRESH ... CONCURRENTLY`.

## Checklist
- [ ] Every FK + hot-path filter/sort is indexed (partial / GiST / GIN as appropriate).
- [ ] Derived values cached on the row via trigger/cron; no live aggregation on page load.
- [ ] Hot lists use keyset/cursor pagination; offset only for admin.
- [ ] Heavy/batch work runs in a cron edge function, off the request path.
- [ ] Analytics/dashboards read materialized views, refreshed on schedule.
- [ ] Ran the 5-question decision checklist for this change.
