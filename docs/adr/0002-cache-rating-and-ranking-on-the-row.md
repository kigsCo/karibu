# ADR-0002 — Cache rating and ranking on the business row

## Status

Accepted.

## Context

A business's `rating`, `review_count`, recent-review count, and `ranking_score` are read on essentially every list and detail page. The obvious implementation is to derive them at read time — `JOIN reviews` and aggregate `avg(rating)`, `count(*)`, and so on, on each page load.

That works fine at 100 listings. At 10,000 listings, a single category page rendering 50 businesses would run 50 correlated sub-aggregates against a `reviews` table that is itself growing, on the hottest path in the product. The read cost grows with both the number of businesses shown and the total number of reviews — exactly the wrong scaling behaviour for the path users hit most.

Ranking has an additional wrinkle: `ranking_score` is not a per-business fact. It depends on **category-level** statistics (a rating z-score relative to the category mean and standard deviation, log-scaled volume, recency, verification, engagement, a tier modifier). Computing it live would mean re-reading an entire category on every relevant write.

## Decision

**Cache the derived values on the `businesses` row** and maintain them off the read path, with two different update strategies matched to the nature of each value:

- **`rating`, `review_count`, `recent_review_count_30d`** are maintained **synchronously by a trigger**. `reviews_recompute_rating` fires `AFTER INSERT OR DELETE OR UPDATE OF status, rating, business_id ON reviews` and calls `recompute_business_rating(business_id)`, which recomputes the three values from that business's `published` reviews. They are correct the instant a review is published, edited, or removed.
- **`ranking_score`** is recomputed **asynchronously by the nightly `calculate-rankings` cron**, because it is category-relative and expensive to compute per write. The job reads category statistics from the `mv_category_stats` materialized view and updates every active business in one batched run (under two seconds at 10,000 listings).

Clients are never permitted to write these columns (enforced by RLS); the trigger and cron are the only writers.

## Consequences

**Positive.** The read path becomes a single indexed `SELECT` that reads pre-computed numbers off the row — flat cost regardless of how many reviews exist. Per-row facts stay live; the expensive category-relative score is batched into a low-traffic window. No external cache (Redis) is needed, so there is no second source of truth to keep consistent.

**Negative / accepted trade-offs.** The cached columns are **denormalised duplicates** of facts that live in `reviews`, so they can drift if a write ever bypasses the trigger. We contain that two ways: clients cannot write them at all, and the nightly recompute acts as a backstop that re-derives everything. `ranking_score` is also **up to a day stale** by design — acceptable, because ranking is a slow-moving signal and the freshness of the underlying `rating` (which *is* live) is what users actually perceive. The write path pays a small synchronous cost on each review change to keep reads cheap; given reviews are far rarer than reads, that trade is heavily in our favour.

This is the foundation the [`SCALABILITY.md`](../SCALABILITY.md) read path rests on, and it pairs with ADR-0004 (materialized views for the category statistics this job consumes).
