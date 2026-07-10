# ADR-0004 — Keyset pagination and OLAP materialized views

## Status

Accepted.

## Context

Two read patterns dominate Karibu and both degrade badly under the naive implementation as data grows.

**Browsing long lists.** The discovery and category screens page through active businesses ordered by `ranking_score`. With `OFFSET`-based pagination, fetching page *N* makes Postgres read and discard all preceding rows — so deep pages get linearly slower, and at 10,000 listings a deep scroll is a measurable cost on the hottest path.

**Dashboards and category stats.** The merchant dashboard and category pages want aggregates — review counts, rating distributions, per-category means and standard deviations. Computing these with live `GROUP BY` queries against `reviews` and `businesses` on each page load puts heavy analytical work directly on the transactional tables, competing with the write path and getting slower as the tables grow. The nightly ranking job needs the same per-category statistics and would re-derive them every run.

## Decision

**Keyset (cursor) pagination for hot lists.** Page through active businesses using a row-comparison cursor on the sort key plus a tiebreaker, served by the partial composite index `idx_businesses_active_rank_id` on `(ranking_score DESC, id) WHERE status='active'`:

```sql
WHERE status = 'active'
  AND (ranking_score, id) < ($cursor_score, $cursor_id)
ORDER BY ranking_score DESC, id DESC
LIMIT 24;
```

`OFFSET` pagination is retained **only** for admin / low-traffic views (moderation queue, pending businesses), where jumping to an arbitrary page is convenient and row counts are small. Default page size is 20–50.

**Materialized views for OLAP.** Analytics is served from two materialized views, refreshed on a schedule by `refresh_analytics()`, never computed live on a page load:

- `mv_category_stats` — per-category `active_count`, `rating_mean`, `rating_stddev`, `max_recent_reviews_30d`. Doubles as the input to the nightly ranking z-score.
- `mv_business_review_stats` — per-business published / 30-day / five-star / one-star / pending counts, powering the merchant dashboard.

Both carry a unique index, so the refresh can run as `REFRESH MATERIALIZED VIEW CONCURRENTLY` without taking a read lock.

## Consequences

**Positive.** Keyset pagination has flat cost at any depth — page 1 and page 500 are the same single index seek, no rows discarded. Analytics reads become a single lookup against a pre-aggregated view instead of a growing live aggregation, and dashboards never compete with the transactional write path. Because the views have unique indexes, refreshes don't block readers — dashboards keep serving the previous snapshot while the next builds. The ranking job reads category statistics straight from `mv_category_stats` rather than recomputing them.

**Negative / accepted trade-offs.** Keyset pagination cannot jump to an arbitrary page number — it is strictly next/previous — which is why admin views keep `OFFSET`. The materialized views are **as stale as their last refresh**; for category statistics and dashboard counts, schedule-bounded staleness is perfectly acceptable, and the live, trigger-maintained `rating` on each business covers the number users most care about. Maintaining the views and their refresh schedule is a small standing cost, paid once, in exchange for analytics that never touch the hot path.

This ADR is the read-path complement to ADR-0002 (cached columns on the row); together they keep [`SCALABILITY.md`](../SCALABILITY.md)'s promise of 10,000 listings without re-architecting.
