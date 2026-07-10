# ranking-algorithm — reference

Longer detail behind `SKILL.md`. The **developer guide** (`docs/karibu-developer-guide.docx`, §08) is the source of truth for the formula, and the shipped `supabase/functions/calculate-rankings/index.ts` implements it exactly. This file shows the worked term definitions and an optional SQL port.

## Term definitions

Given a business row `b` and its category stats `s` (from `mv_category_stats`). Note: the terms are **not** all normalized to 0..1 — this matches the guide. The weights sum to 1.0; the total `ranking_score` runs roughly **-0.5 .. 1.5**.

1. **rating_z (0.35)** — per-category z-score (raw, can be negative).
   ```
   rating_z = (b.rating - s.rating_mean) / NULLIF(s.rating_stddev, 0)
   rating_z = 0   when stddev is 0 (single-business / zero-variance category)
   ```
   The view filters `review_count > 0` out of the mean/stddev, so unrated businesses don't distort the category baseline.

2. **review_volume_log (0.20)** — confidence from volume, diminishing returns.
   ```
   review_volume_log = log10(1 + b.review_count)
   ```
   Raw `log10` (not re-normalized). 10->100 reviews moves it ~1.0; 1000->1100 barely moves it.

3. **recency (0.15)** — recent activity vs the busiest peer in the category.
   ```
   recency = b.recent_review_count_30d / NULLIF(s.max_recent_reviews_30d, 0)   -- 0 when none
   ```

4. **verification_bonus (0.15)** — trust signal, by tier.
   ```
   verification_bonus = { free: 0, verified: 0.5, recommended: 1.0 }[b.tier]
   ```

5. **engagement (0.10)** — currently **0** (there is no profile-views column yet).
   ```
   engagement = 0   -- TODO: clamp(profile_views_30d / 1000, 0, 1) once views are tracked
   ```

6. **tier_modifier (0.05)** — the smallest lever.
   ```
   tier_modifier = (b.tier === 'recommended') ? 0.1 : 0
   ```

## Weighted sum
```
ranking_score =
    0.35 * rating_z
  + 0.20 * review_volume_log
  + 0.15 * recency
  + 0.15 * verification_bonus
  + 0.10 * engagement
  + 0.05 * tier_modifier
```
Persist as `numeric` on `businesses.ranking_score` (the shipped code rounds to 6 dp — ordering is unaffected).

## Why tier can't beat rating
The dominant lever is `rating_z` at weight 0.35. The spread between a strong and a weak rating within a category easily exceeds the entire `tier_modifier` contribution (max `0.05 * 0.1 = 0.005`); even `verification_bonus` (max `0.15`) cannot lift a poorly-rated listing past a strongly-rated one. Per the guide, being Karibu Recommended never beats a 4.9-star free listing. Any change that inverts this is a defect.

## Reference implementation
The shipped function computes scores in a readable **JS loop** — `supabase/functions/calculate-rankings/index.ts` (cron, `verify_jwt = false`, service-role). Shape:
```ts
import { createServiceClient } from "../_shared/client.ts";
import { json, errorResponse } from "../_shared/response.ts";

Deno.serve(async (_req) => {
  const db = createServiceClient();
  // 1. refresh_analytics() first — stale mv_category_stats => wrong z-scores.
  await db.rpc("refresh_analytics");
  // 2. read mv_category_stats, page through active businesses, compute the
  //    weighted sum per row, UPDATE businesses.ranking_score.
  // 3. improvement window: flag_low_rated_businesses() then unlist_unimproved_businesses().
  return json({ ok: true });
});
```

### Optional SQL port (faster at scale)
At ~10k rows the JS loop runs in seconds. If it ever needs to be faster, do the arithmetic set-based in one `UPDATE` and expose it as an `.rpc` added via a migration (it does **not** exist yet):
```sql
-- add via a migration, e.g. recompute_all_ranking_scores()
UPDATE businesses b SET ranking_score =
    0.35 * COALESCE((b.rating - s.rating_mean) / NULLIF(s.rating_stddev, 0), 0)
  + 0.20 * log(10, 1 + b.review_count)
  + 0.15 * COALESCE(b.recent_review_count_30d::numeric / NULLIF(s.max_recent_reviews_30d, 0), 0)
  + 0.15 * (CASE b.tier WHEN 'recommended' THEN 1.0 WHEN 'verified' THEN 0.5 ELSE 0.0 END)
  + 0.10 * 0.0   -- engagement: fill in once profile_views exists
  + 0.05 * (CASE WHEN b.tier = 'recommended' THEN 0.1 ELSE 0.0 END)
FROM mv_category_stats s
WHERE s.category_id = b.category_id
  AND b.status = 'active';
```

## Scheduling
Nightly, 03:00 EAT (low-traffic window). pg_cron or a Supabase scheduled invocation. Heavy work stays off the request path (root `CLAUDE.md`). Hot-list reads of `ranking_score` use `idx_businesses_active_rank_id` with keyset pagination (`db-performance` skill).
