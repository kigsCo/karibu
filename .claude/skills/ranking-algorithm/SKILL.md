---
name: ranking-algorithm
description: Use when implementing or altering the calculate-rankings cron function or the businesses.ranking_score column — the weighted formula that orders listings. Covers the exact weights, each term's definition, per-category rating normalization via mv_category_stats, nightly caching, the tier-never-beats-rating rule, and the 3.5-star / 60-day improvement window. Warns against computing ranking live.
---

# The ranking algorithm

Ranking is **the product** (root `CLAUDE.md`: "ranking is driven by reviews, not ad spend"). `businesses.ranking_score` is a **cached numeric** recomputed nightly by the `calculate-rankings` edge function (cron). The hot list endpoints read it via the partial index `idx_businesses_active_rank_id`. The developer guide (§08) is the source of truth for the math; the shipped `calculate-rankings/index.ts` implements it exactly. See `reference.md` for worked terms and the SQL port.

## When to use
Implementing/altering `supabase/functions/calculate-rankings`, changing the weights, or touching how `ranking_score` is produced.

## The formula
`ranking_score` is a weighted sum of six terms. Weights sum to 1.0, but the terms are **not** all clamped to 0..1 (per the guide): `rating_z` can be negative and `review_volume_log` can exceed 1, so the total runs roughly **-0.5 .. 1.5**.

| Weight | Term | Definition |
|---|---|---|
| **0.35** | `rating_z` | Rating normalized **per category**: z-score against the category mean/stddev from `mv_category_stats`. Raw, can be negative. Quality dominates. |
| **0.20** | `review_volume_log` | `log10(1 + review_count)` — more reviews => more confidence, with diminishing returns (log, not linear). |
| **0.15** | `recency` | `recent_review_count_30d` vs the category's busiest peer (recent activity beats a stale wall of old reviews). |
| **0.15** | `verification_bonus` | Trust signal **by tier**: `free` 0 / `verified` 0.5 / `recommended` 1.0. |
| **0.10** | `engagement` | Profile views / responsiveness / CTR. **0 for now** — no profile_views column yet. |
| **0.05** | `tier_modifier` | Tiny nudge: `recommended` 0.1, else 0. **Smallest lever by design.** |

Quality (`rating_z` x 0.35) is the dominant lever — far larger than the tier nudge.

## Non-negotiable invariants
- **Tier never beats a higher rating.** `tier_modifier` max contribution is `0.05 * 0.1 = 0.005`; even `verification_bonus` (max 0.15) can't lift a poorly-rated listing past a strongly-rated one. A higher-rated business always outranks a lower-rated one. If a code change ever lets tier dominate rating, it is a defect. (This is the whole trust promise.)
- **Rating is normalized per category, not globally.** A 4.5 steakhouse and a 4.5 pharmacy are judged against *their own* category's distribution via `mv_category_stats` (`rating_mean`, `rating_stddev`). Never compare raw ratings across categories.
- **Cached, not live.** `ranking_score` is written to the row by the nightly job. Never compute the weighted sum in a page-load query.

## Per-category normalization (mv_category_stats)
`calculate-rankings` reads the materialized view `mv_category_stats` (defined in `20260601000003_functions_triggers_views.sql`), which provides per `category_id`: `rating_mean`, `rating_stddev`, `max_recent_reviews_30d`, `active_count`. The job:
1. `refresh_analytics()` first, so `mv_category_stats` is current (stale stats => wrong z-scores).
2. For each active business: `rating_z = (rating - rating_mean) / NULLIF(rating_stddev, 0)` — the **raw** z-score, **0 when stddev is 0** (single-business / zero-variance categories). Do not squash; the guide and shipped code use the raw value.
3. Compute the other five terms (see `reference.md`), weight-sum, and `UPDATE businesses SET ranking_score = ...`.

## The 3.5-star / 60-day improvement window
Persistently bad listings are nudged out, but fairly. Two SQL helpers live in migration `...0003`:
- **`flag_low_rated_businesses()`** — for active businesses with `review_count >= 20` AND `rating < 3.5` AND no window yet, sets `improvement_until = now() + interval '60 days'`. The business gets 60 days (and a notification) to improve.
- **`unlist_unimproved_businesses()`** — after the window, if `improvement_until < now()` AND still `rating < 3.5`, sets `status = 'unlisted'`.

The nightly cron calls both after scoring (refresh stats -> recompute scores -> `flag_low_rated_businesses()` -> `unlist_unimproved_businesses()`). The 20-review floor avoids punishing a new business for one bad review.

## Procedure to alter the algorithm
1. Edit `supabase/functions/calculate-rankings/index.ts`. Keep it **cron** (`verify_jwt = false`, scheduled), never request-path. See the `edge-function` skill.
2. If weights change, keep them summing to 1.0 and preserve "tier never beats rating."
3. If you add a term that needs new data, add the column/index via a migration (`supabase-migration` skill) and surface stats through `mv_category_stats` rather than aggregating live.
4. After running, spot-check: a high-rated free listing must outrank a mediocre `recommended` one.

## Common mistakes
- Computing `ranking_score` live in a list query (kills performance — read the cached column).
- Normalizing rating globally instead of per category.
- Bumping `tier_modifier`/`verification_bonus` so paid tier outranks quality (breaks the trust model).
- Forgetting to refresh `mv_category_stats` before scoring (stale means/stddevs).
- Divide-by-zero when a category has one business (stddev 0) — guard it (return 0).
- Running the improvement-window unlister without the `review_count >= 20` floor.

## Checklist
- [ ] Weights: 0.35 / 0.20 / 0.15 / 0.15 / 0.10 / 0.05, summing to 1.0.
- [ ] Rating normalized per category via `mv_category_stats`, z-score divide-by-zero guarded (0 when stddev 0).
- [ ] `ranking_score` written to the row by the nightly cron, never live.
- [ ] Tier change cannot let a lower-rated business outrank a higher-rated one.
- [ ] `flag_low_rated_businesses()` then `unlist_unimproved_businesses()` run in the nightly job.
- [ ] Implemented as a cron edge function, off the request path. (See `reference.md`.)
