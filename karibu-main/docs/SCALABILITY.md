# Scalability

> The scaling playbook. The target is plain: **Karibu must reach 10,000+ listings and 300,000 monthly visitors without re-architecting.** This document ties each scaling decision to a concrete object in the schema, so that "scale" is something the database does by design rather than something we firefight later. The schema lives in [`supabase/migrations/`](../supabase/migrations/) and is described in [`DATA_MODEL.md`](DATA_MODEL.md).

The strategy rests on five pillars: index every hot path, cache derived values on the row, paginate by keyset, push heavy work off the request path, and serve analytics from materialized views. None of these is exotic; the discipline is applying all of them from day one.

## 1. Indexing

The rule of thumb is simple: **every foreign key, and every column used in a `WHERE` or `ORDER BY` on a hot path, is indexed** — and where a query only ever touches a subset of rows, the index is partial so it stays small and the planner stays honest. The core migration ships the following:

| Index | Object | Why it exists |
|---|---|---|
| `idx_businesses_category` `(category_id, sub_type_id)` | businesses | Category / sub-type browsing — the main discovery filter. |
| `idx_businesses_city` `(city_id)` | businesses | City filter, on nearly every list query. |
| `idx_businesses_owner` `(owner_id)` | businesses | FK; merchant reading their own listings. |
| `idx_businesses_ranking` `(ranking_score DESC) WHERE status='active'` | businesses | **Partial** — the default sort over only listable rows. |
| `idx_businesses_active_rank_id` `(ranking_score DESC, id) WHERE status='active'` | businesses | **Partial keyset index** — sort key plus `id` tiebreaker for stable cursors. |
| `idx_businesses_location` `GIST(location)` | businesses | PostGIS distance / "closest" sort and radius search. |
| `idx_businesses_name_trgm` `GIN(name gin_trgm_ops)` | businesses | `pg_trgm` fuzzy / typo-tolerant name search — our search service. |
| `idx_sub_types_category` `(category_id)` | sub_types | FK lookup of a category's sub-types. |
| `idx_reviews_business` `(business_id, status)` | reviews | A business's reviews by status. |
| `idx_reviews_recent` `(business_id, created_at DESC) WHERE status='published'` | reviews | **Partial** — latest published reviews on a business. |
| `idx_reviews_moderation` `(status) WHERE status='pending_moderation'` | reviews | **Partial** — the moderation cron scanning only the queue. |
| `idx_guides_published` `(is_published, featured) WHERE is_published=true` | guides | **Partial** — published guides, featured first. |
| `idx_guides_city` `(city_id)` | guides | City-scoped guide lists. |
| `idx_subscriptions_business` `(business_id, status)` | subscriptions | A business's active subscription. |
| `idx_ai_conversations_session` `(session_id)` | ai_conversations | Reconstruct a session. |
| `idx_ai_conversations_created` `(created_at DESC)` | ai_conversations | Time-ordered analytics scans. |

Three index *types* are doing specialised work and deserve a note. The **partial `WHERE status='active'`** indexes mean the planner only ever walks rows that can actually be shown to a visitor — at 10,000 listings with some suspended or unlisted, that index stays markedly smaller than the table. The **GiST geography** index is what makes "salons near me" a millisecond operation instead of a full-table distance computation. The **GIN `pg_trgm`** index is, quite literally, our search engine: it lets `name ILIKE '%nyma%'` find "Nyama Mama" without a dedicated search service. The **keyset index** is covered next.

When adding any new query, the default question is "which existing index serves this, and if none does, what partial index should I add in the same migration?" — never ship a hot-path query that triggers a sequential scan.

## 2. Caching strategy

Karibu caches at three layers, each with a clear owner and a clear invalidation story.

**Derived values, cached on the row.** `businesses.rating`, `review_count`, and `recent_review_count_30d` are maintained synchronously by the `reviews_recompute_rating` trigger (via `recompute_business_rating`); `businesses.ranking_score` is recomputed nightly by the `calculate-rankings` cron. This is the single most important caching decision in the system: a list of 50 businesses reads 50 pre-computed ratings instead of running 50 correlated sub-aggregates against `reviews`. See [ADR-0002](adr/0002-cache-rating-and-ranking-on-the-row.md). The trade-off — that these columns can be wrong if a write bypasses the trigger — is contained by never letting clients write them (RLS) and by the nightly recompute acting as a backstop.

**Reference data, cached in the client.** `cities`, `categories`, and `sub_types` are small and change rarely. The frontend fetches them **once on app load and holds them in React Context** — never refetching per navigation. Their RLS policies are public-read on active rows, so the anon key suffices.

**Static output, cached at the CDN/edge.** The frontend is a static Vite bundle served from Vercel/Netlify's edge. Marketing pages, guide pages, and other content that does not vary per user are edge-cached, so most page loads never reach an origin at all.

**What we deliberately do *not* cache.** Per-user state — `saved_places`, a merchant's view of their own pending/suspended listings, subscription status — is read live and RLS-scoped to the user. Caching it would risk showing one user another's data or a stale billing state, and the read is already cheap and indexed. There is no Redis layer; we have not needed one, and adding one would introduce a second source of truth to keep consistent.

## 3. Pagination

**Never return an unbounded list.** Default page size is **20–50** rows.

Hot lists — the discovery and category screens — use **keyset (cursor) pagination**, not `OFFSET`. The reason is mechanical: `OFFSET 10000` makes Postgres read and discard 10,000 rows before returning the next page, so deep pages get linearly slower; keyset pagination seeks straight to the cursor using the index and stays flat at any depth. The `idx_businesses_active_rank_id` partial index on `(ranking_score DESC, id)` exists precisely to serve this pattern, with `id` as a tiebreaker so the cursor is unambiguous even when several businesses share a `ranking_score`.

The exact pattern for the default "recommended" sort:

```sql
-- First page
SELECT id, slug, name, hood, price_range, rating, review_count, tier, hero_image_url
FROM businesses
WHERE status = 'active'
ORDER BY ranking_score DESC, id DESC
LIMIT 24;

-- Next page: pass the last row's (ranking_score, id) back as the cursor
SELECT id, slug, name, hood, price_range, rating, review_count, tier, hero_image_url
FROM businesses
WHERE status = 'active'
  AND (ranking_score, id) < ($cursor_score, $cursor_id)
ORDER BY ranking_score DESC, id DESC
LIMIT 24;
```

The `(ranking_score, id) < ($cursor_score, $cursor_id)` row-comparison is what the composite index serves directly — a single index seek, no rows discarded, identical cost on page 1 and page 500.

**Offset pagination is allowed only for admin and low-traffic views** — the moderation queue, the pending-business list, internal dashboards. There, the row counts are small, jumping to "page 7" is a genuine convenience, and the performance cost of `OFFSET` is irrelevant.

## 4. Async and heavy work

Anything that is slow, bursty, or non-essential to rendering the current response runs **off the request path** as a scheduled (cron-triggered) edge function. The request path stays a thin, predictable read or write.

| Work | Where it runs | Cadence | Schema touchpoints |
|---|---|---|---|
| Review moderation | `moderate-reviews` cron | hourly | reads `reviews WHERE status='pending_moderation'` (via `idx_reviews_moderation`), sets `published`/`flagged` |
| Ranking recompute | `calculate-rankings` cron | nightly (~03:00 EAT) | reads `mv_category_stats`, writes `businesses.ranking_score` |
| Improvement window | `flag_low_rated_businesses()` / `unlist_unimproved_businesses()` | daily | updates `businesses.improvement_until` / `status` |
| Transactional email | `send-onboarding-email` (Resend) | on event / cron | onboarding + reminders |
| M-Pesa reconciliation | reconciliation cron | scheduled | `subscriptions`, `mpesa_transaction_id` |
| Analytics refresh | `refresh_analytics()` | scheduled | refreshes both materialized views |

The flip side of the same principle is **fire-and-forget logging on the request path**: the `ask-karibu` function inserts into `ai_conversations` without awaiting the result, so logging can never add latency to or fail an Ask Karibu answer. Heavy work is pulled out; cheap-but-non-essential work is detached. Either way, the user-facing response is never held hostage to it.

## 5. OLAP / analytics

**Analytics never runs against the live transactional tables during a page load.** A merchant dashboard that ran `GROUP BY` over `reviews` every time it loaded would compete with the write path and degrade as data grows. Instead, dashboards read from two materialized views, refreshed on a schedule:

- **`mv_category_stats`** — per-category `active_count`, `rating_mean`, `rating_stddev`, `max_recent_reviews_30d`. This is both the analytics source for category pages and the input the nightly ranking job needs for its z-score (`(rating − category_mean) / category_stddev`). Unique index on `(category_id)`.
- **`mv_business_review_stats`** — per-business `published_reviews`, `reviews_30d`, `five_star`, `one_star`, `pending_moderation`. This powers the merchant dashboard's rating-distribution and trend widgets. Unique index on `(business_id)`.

Both are refreshed by **`refresh_analytics()`** on a schedule (alongside the nightly ranking run). Because each view has a unique index, the cron can use `REFRESH MATERIALIZED VIEW CONCURRENTLY` to refresh without taking a read lock — dashboards keep serving the previous snapshot while the new one builds. The merchant dashboard reads a single pre-aggregated row instead of scanning a growing `reviews` table. See [ADR-0004](adr/0004-keyset-pagination-and-olap-materialized-views.md).

## Cost and scale projections

The reason all of the above matters commercially: Karibu's costs are almost entirely fixed, while the AI cost per query sits far below the subscription revenue per business. The platform scales on **conversion and team capacity**, not on infrastructure spend.

| | Launch | Year 1 | Year 2 |
|---|---|---|---|
| Listed businesses | 100 | 1,500 | 10,000 |
| Monthly visitors | 5,000 | 50,000 | 300,000 |
| AI queries / month | 2,000 | 30,000 | 200,000 |
| Supabase | $25 | $25 | $599* |
| Anthropic API | $10 | $120 | $800 |
| Vercel / Netlify | $0 | $0 | $20 |
| Domain + email | $10 | $10 | $10 |
| **Total infra** | **$45** | **$155** | **$1,429** |
| Verified subs (KSh 2,500) | 20 | 300 | 2,000 |
| Recommended subs (KSh 7,500) | 5 | 75 | 500 |
| Monthly revenue (KSh) | 87,500 | 1,312,500 | 8,750,000 |
| Monthly revenue (USD) | ~$675 | ~$10,096 | ~$67,308 |
| **Gross margin** | **93%** | **98%** | **98%** |

\* The Supabase **Team plan** upgrade becomes necessary around the **10,000-listing** mark — more concurrent connections, daily point-in-time-recovery backups, and dedicated compute. That single line is the only step-change in the cost curve, and it lands well after revenue can absorb it.

The headline: gross margin reaches **~98% by year one**, and past roughly 100 paying businesses the marginal cost of each additional listing is near-zero. The binding constraints become sales velocity and verification throughput — never the database. The architecture's job is to make sure that stays true, and the five pillars above are how it does.
