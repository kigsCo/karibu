# Data model

> The full reference for Karibu's Postgres schema. The **source of truth is the migration SQL** in [`supabase/migrations/`](../supabase/migrations/) — specifically `20260601000001_core_schema.sql` (tables and indexes), `20260601000002_rls_policies.sql` (security), and `20260601000003_functions_triggers_views.sql` (triggers, cron helpers, materialized views). This document describes what those files create and why. If the two ever disagree, the SQL wins and this doc is the bug.

Conventions throughout: UUID primary keys via `uuid_generate_v4()`, `timestamptz` for every time column, `text` in preference to `varchar`, and PostGIS `geography(POINT, 4326)` (WGS84) for location. Three extensions are enabled up front — `uuid-ossp`, `postgis`, and `pg_trgm`.

## Entity-relationship sketch

```
   cities ─────────────┐
     │ 1                │ 1
     │                  │
     │ *                │ *
  businesses ◄──────── guides            (guides.city_id → cities, nullable)
     ▲  ▲  │ *
     │  │  │ 1
     │  │  └────────────► categories ──1───* sub_types
     │  │                    ▲                  ▲
     │  │                    │ *                │ * (nullable)
     │  │                    └──── businesses.category_id / sub_type_id
     │  │
     │  └───────────── reviews        (reviews.business_id → businesses, ON DELETE CASCADE)
     │  └───────────── subscriptions  (subscriptions.business_id → businesses)
     │  └───────────── saved_places   (saved_places.business_id → businesses, ON DELETE CASCADE)
     │
 auth.users ─┬──► businesses.owner_id          (nullable)
             ├──► reviews.reviewer_id            (nullable; guest reviews allowed)
             ├──► saved_places.user_id           (PK part)
             └──► ai_conversations.user_id       (nullable)

 ai_conversations  — standalone log; references auth.users loosely, no client access
```

The shape is a classic hub-and-spoke: **`businesses` is the hub**, reference tables (`cities`, `categories`, `sub_types`) describe it, and the spoke tables (`reviews`, `subscriptions`, `saved_places`, `ai_conversations`) hang off it.

## Enumerated values

Karibu uses `text` columns with `CHECK` constraints rather than Postgres `ENUM` types — easier to evolve without a type migration. Three sets matter:

| Domain | Column | Allowed values |
|---|---|---|
| Business tier | `businesses.tier` | `free` · `verified` · `recommended` |
| Business status | `businesses.status` | `pending` · `active` · `suspended` · `unlisted` |
| Review status | `reviews.status` | `pending_moderation` · `published` · `rejected` · `flagged` |
| Subscription tier | `subscriptions.tier` | `verified` · `recommended` |
| Subscription status | `subscriptions.status` | `active` · `past_due` · `cancelled` · `pending_payment` |

The first three are enforced by named constraints in the schema (`businesses_tier_chk`, `businesses_status_chk`, `reviews_status_chk`); the subscription constraints are `subscriptions_tier_chk` and `subscriptions_status_chk`.

---

## Reference tables

These three are small, read-only from the client's perspective, world-readable for their active rows, and fetched once on app load into React Context (see [`SCALABILITY.md`](SCALABILITY.md)).

### `cities`

The launch cities (Nairobi, Mombasa, Naivasha, Kisumu, Nakuru) plus room to expand. Each row carries the list of neighbourhoods used throughout the app.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `uuid_generate_v4()` |
| `slug` | `text` | UNIQUE, NOT NULL — e.g. `'nairobi'` |
| `name` | `text` | NOT NULL |
| `country` | `text` | NOT NULL, default `'KE'` |
| `tagline` | `text` | nullable |
| `hoods` | `text[]` | NOT NULL, default `'{}'` — neighbourhoods |
| `is_active` | `boolean` | NOT NULL, default `false` — gates public visibility |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

### `categories`

The parent service categories from the prototype. `sort_order` drives the position of each tile in the discovery grid; `icon` is a lucide icon name shared with the frontend.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `slug` | `text` | UNIQUE, NOT NULL — e.g. `'hotels'`, `'transport'` |
| `label` | `text` | NOT NULL |
| `blurb` | `text` | nullable |
| `icon` | `text` | NOT NULL — lucide icon name |
| `sort_order` | `int` | NOT NULL — drives grid position |
| `is_active` | `boolean` | NOT NULL, default `true` |

### `sub_types`

Sub-categories under a parent — e.g. `hair`, `nails`, `spa` under beauty. A sub-type's `slug` is unique only **within** its parent category.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `category_id` | `uuid` | NOT NULL → `categories(id)` |
| `slug` | `text` | NOT NULL |
| `label` | `text` | NOT NULL |
| `icon` | `text` | NOT NULL |
| `sort_order` | `int` | NOT NULL |
| | | `UNIQUE (category_id, slug)` |

**Index:** `idx_sub_types_category` on `(category_id)` — fast lookup of all sub-types for a category.

---

## `businesses` — the core listing

The hub of the whole model and the row every hot-path query reads from. It carries listing content, contact details, media, tier/status, ownership, and — critically — **four cached/derived columns** so the application never JOIN-aggregates reviews on a page load.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `slug` | `text` | UNIQUE, NOT NULL — used for the detail-page URL |
| `name` | `text` | NOT NULL |
| `category_id` | `uuid` | NOT NULL → `categories(id)` |
| `sub_type_id` | `uuid` | nullable → `sub_types(id)` |
| `cuisine_type` | `text` | nullable — used only when category is restaurants |
| `city_id` | `uuid` | NOT NULL → `cities(id)` |
| `hood` | `text` | NOT NULL |
| `address` | `text` | nullable |
| `location` | `geography(POINT,4326)` | WGS84 — for distance/"closest" sort |
| `about` | `text` | nullable |
| `price_range` | `text` | nullable — e.g. `'KSh 1,500-6,000'` |
| `tags` | `text[]` | default `'{}'` |
| `hours_json` | `jsonb` | structured opening hours |
| `services_json` | `jsonb` | `[{name, price}]` |
| `phone`, `whatsapp`, `email`, `website` | `text` | contact methods, all nullable |
| `mpesa_till`, `mpesa_paybill` | `text` | nullable |
| `hero_image_url` | `text` | nullable |
| `gallery_image_urls` | `text[]` | default `'{}'` |
| `tier` | `text` | NOT NULL, default `'free'` — `free\|verified\|recommended` |
| `status` | `text` | NOT NULL, default `'pending'` — `pending\|active\|suspended\|unlisted` |
| `verified_at` | `timestamptz` | nullable — set when verification completes |
| `improvement_until` | `timestamptz` | nullable — end of the 60-day improvement window |
| `owner_id` | `uuid` | nullable → `auth.users(id)` |
| **`rating`** | `numeric(3,2)` | default `0` — **cached**, see below |
| **`review_count`** | `int` | default `0` — **cached** |
| **`recent_review_count_30d`** | `int` | default `0` — **cached** |
| **`ranking_score`** | `numeric` | default `0` — **cached/derived**, set by nightly job |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` — maintained by trigger |

Constraints: `businesses_tier_chk` and `businesses_status_chk` enforce the enums above.

### The cached / derived columns

These four columns exist so reads stay cheap. Computing a business's rating by joining and averaging `reviews` on every page load is fine at 100 listings and ruinous at 10,000. We pay the cost once on write, store it on the row, and read it for free. See [ADR-0002](adr/0002-cache-rating-and-ranking-on-the-row.md).

How each is maintained:

- **`rating`, `review_count`, `recent_review_count_30d`** — maintained **synchronously by a trigger**. The `reviews_recompute_rating` trigger fires `AFTER INSERT OR DELETE OR UPDATE OF status, rating, business_id ON reviews`, calling `recompute_business_rating(business_id)`. That function recomputes all three from the `published` reviews of the affected business (and, on a row that moves between businesses, both the old and new business). So the moment a review is published, rejected, edited, or deleted, the cached figures on the business row are correct.
- **`ranking_score`** — maintained **asynchronously by a nightly cron job** (`calculate-rankings`, run ~03:00 EAT). It is intentionally *not* recomputed on every review because it depends on **category-level** statistics (a rating z-score relative to the category mean and standard deviation, log-scaled review volume, recency, verification, engagement, and a small tier modifier). Recomputing it live would mean re-reading the whole category on every write. Batching it nightly keeps writes cheap and the run takes under two seconds even at 10,000 listings. The category statistics it needs come from the `mv_category_stats` materialized view.

The split is deliberate: **per-row facts update instantly via trigger; cross-row/category-relative scores update on a schedule via cron.** Neither is ever computed during a page render, and client writes to these columns are never trusted.

### Indexes on `businesses`

| Index | Definition | Rationale |
|---|---|---|
| `idx_businesses_category` | `(category_id, sub_type_id)` | Category and sub-type browsing — the primary discovery filter. |
| `idx_businesses_city` | `(city_id)` | City filter, present on nearly every list query. |
| `idx_businesses_ranking` | `(ranking_score DESC) WHERE status='active'` | Partial index: the default "recommended" sort over only the rows that can be shown. |
| `idx_businesses_location` | `GIST(location)` | PostGIS distance / "closest" sort and radius search. |
| `idx_businesses_name_trgm` | `GIN(name gin_trgm_ops)` | Fuzzy / typo-tolerant business-name search via `pg_trgm`. |
| `idx_businesses_owner` | `(owner_id)` | Merchant dashboard: an owner reading their own listings. |
| `idx_businesses_active_rank_id` | `(ranking_score DESC, id) WHERE status='active'` | **Keyset pagination** of active listings — composite on the sort key plus a tiebreaker `id` so cursors are stable. See [`SCALABILITY.md`](SCALABILITY.md). |

---

## `reviews` — the heart of ranking

Every review is staged for moderation, then published. Reviewer context is denormalized onto the row so guest (un-authenticated) reviews still carry a name and country. Reviews drive the cached business figures and, through them, ranking.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `business_id` | `uuid` | NOT NULL → `businesses(id)` **ON DELETE CASCADE** |
| `reviewer_id` | `uuid` | nullable → `auth.users(id)` (null for guests) |
| `reviewer_name` | `text` | NOT NULL |
| `reviewer_country` | `text` | nullable — e.g. `'United States'` |
| `reviewer_type` | `text` | nullable — `tourist\|expat\|resident` |
| `rating` | `int` | NOT NULL, `CHECK (rating BETWEEN 1 AND 5)` |
| `body` | `text` | NOT NULL, `CHECK (length(body) >= 40)` |
| `service_used` | `text` | nullable |
| `recommendation` | `text` | nullable — `yes\|caveats\|no` |
| `status` | `text` | NOT NULL, default `'pending_moderation'` — `pending_moderation\|published\|rejected\|flagged` |
| `moderation_notes` | `text` | nullable — set by the moderation pipeline |
| `flagged_at` | `timestamptz` | nullable |
| `rejected_reason` | `text` | nullable |
| `reviewer_ip` | `inet` | anti-abuse signal (per-IP rate limiting) |
| `reviewer_fingerprint` | `text` | anti-abuse signal (browser fingerprint) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `published_at` | `timestamptz` | nullable — set when moderation publishes |

Constraint: `reviews_status_chk` enforces the four-value status enum. The `rating` and `body` checks are also re-asserted in the RLS insert policy as a defense-in-depth.

### Indexes on `reviews`

| Index | Definition | Rationale |
|---|---|---|
| `idx_reviews_business` | `(business_id, status)` | The detail page fetching a business's reviews by status. |
| `idx_reviews_recent` | `(business_id, created_at DESC) WHERE status='published'` | Partial index for "latest published reviews" on a business. |
| `idx_reviews_moderation` | `(status) WHERE status='pending_moderation'` | The hourly moderation cron scanning only the pending queue cheaply. |

---

## `guides` — editorial content

Long-form editorial pieces (safety, neighbourhoods, M-Pesa, transport, etc.). Body content is stored as a block-based `jsonb` document, and a guide can optionally be scoped to a city and link out to related businesses and suggested Ask Karibu prompts.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `slug` | `text` | UNIQUE, NOT NULL |
| `category` | `text` | NOT NULL — `safety\|areas\|...` (free text, not a constrained enum) |
| `city_id` | `uuid` | nullable → `cities(id)` |
| `title` | `text` | NOT NULL |
| `subtitle`, `summary`, `author` | `text` | nullable |
| `read_time` | `int` | nullable — minutes |
| `hero_image_url` | `text` | nullable |
| `featured` | `boolean` | default `false` |
| `body_json` | `jsonb` | NOT NULL — block-based content |
| `related_businesses` | `uuid[]` | default `'{}'` |
| `ask_prompts` | `text[]` | default `'{}'` |
| `is_published` | `boolean` | default `false` |
| `published_at` | `timestamptz` | nullable |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` — maintained by trigger |

### Indexes on `guides`

| Index | Definition | Rationale |
|---|---|---|
| `idx_guides_published` | `(is_published, featured) WHERE is_published=true` | The published-guides list, with featured ones surfaced first. |
| `idx_guides_city` | `(city_id)` | City-scoped guide lists. |

---

## `subscriptions` — paid tiers

A business's billing record for the Verified or Recommended tier, settled via M-Pesa. One business may accumulate several subscription rows over time (renewals, changes); the current state is the active one.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `business_id` | `uuid` | NOT NULL → `businesses(id)` |
| `tier` | `text` | NOT NULL — `verified\|recommended` |
| `status` | `text` | NOT NULL — `active\|past_due\|cancelled\|pending_payment` |
| `current_period_start` | `timestamptz` | NOT NULL |
| `current_period_end` | `timestamptz` | NOT NULL |
| `amount_kes` | `int` | NOT NULL |
| `mpesa_transaction_id` | `text` | nullable |
| `cancelled_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Constraints: `subscriptions_tier_chk`, `subscriptions_status_chk`.

**Index:** `idx_subscriptions_business` on `(business_id, status)` — find a business's active subscription.

---

## `saved_places` — per-user favourites

A simple join table between a user and a business. The **composite primary key `(user_id, business_id)`** both identifies the row and prevents duplicate saves — there is no surrogate `id`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | NOT NULL → `auth.users(id)` — PK part |
| `business_id` | `uuid` | NOT NULL → `businesses(id)` **ON DELETE CASCADE** — PK part |
| `saved_at` | `timestamptz` | NOT NULL, default `now()` |

The composite PK is itself the index for "this user's saved places." Cascade delete cleans up saves when a business is removed.

---

## `ai_conversations` — Ask Karibu logs

A fire-and-forget log of Ask Karibu sessions, written by the `ask-karibu` edge function for later analysis and tuning. It is **not** read or written by the client at all (see RLS below).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | nullable → `auth.users(id)` |
| `session_id` | `text` | NOT NULL |
| `city_slug` | `text` | NOT NULL |
| `messages_json` | `jsonb` | NOT NULL — the conversation |
| `business_ids_returned` | `uuid[]` | which businesses the answer surfaced |
| `user_clicked_business_id` | `uuid` | which one the user then opened (attribution) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

### Indexes on `ai_conversations`

| Index | Definition | Rationale |
|---|---|---|
| `idx_ai_conversations_session` | `(session_id)` | Reconstruct a full session for analysis. |
| `idx_ai_conversations_created` | `(created_at DESC)` | Time-ordered scans for analytics jobs. |

---

## Security model (summary)

RLS is enabled on **every** table in `20260601000002_rls_policies.sql`. The shape is "public reads what's live, owners read/manage their own, the rest goes through edge functions on the service role." A per-table policy summary:

| Table | Policy summary |
|---|---|
| `cities`, `categories` | Public `SELECT` of rows where `is_active = true`. No client writes. |
| `sub_types` | Public `SELECT` of all rows. No client writes. |
| `businesses` | Public `SELECT` where `status='active'`; owner may `SELECT` and `UPDATE` their own rows (`owner_id = auth.uid()`). Inserts/approvals go through server-side flows. |
| `reviews` | Public `SELECT` where `status='published'`; authenticated users may `INSERT` only their own (`reviewer_id = auth.uid()`) with `rating 1–5` and `length(body) >= 40`. |
| `guides` | Public `SELECT` where `is_published = true`. |
| `saved_places` | Owner-only `ALL` (`user_id = auth.uid()`). |
| `subscriptions` | Owner-only `SELECT` (business belongs to `auth.uid()`). Writes happen in the M-Pesa edge functions. |
| `ai_conversations` | **No policies at all** — therefore no anon/authenticated access. Only the service role (inside edge functions, which bypasses RLS) reads or writes it. That absence is intentional. |

The full reasoning, the secrets boundary, and the anti-abuse signals live in [`SECURITY.md`](SECURITY.md).

---

## Triggers, cron helpers, and materialized views

Defined in `20260601000003_functions_triggers_views.sql`:

- **`set_updated_at()`** — a `BEFORE UPDATE` trigger function wired to `businesses` (`businesses_set_updated_at`) and `guides` (`guides_set_updated_at`) to keep `updated_at` honest.
- **`recompute_business_rating(biz uuid)`** + **`trg_reviews_recompute()`** + the `reviews_recompute_rating` trigger — maintain the cached `rating`, `review_count`, and `recent_review_count_30d` on `businesses` whenever a review's `status`, `rating`, or `business_id` changes (or it is inserted/deleted).
- **`flag_low_rated_businesses()`** — daily cron helper: sets `improvement_until = now() + 60 days` on active businesses with `review_count >= 20` and `rating < 3.5` not already in the window.
- **`unlist_unimproved_businesses()`** — daily cron helper: sets `status = 'unlisted'` on businesses whose `improvement_until` has passed and whose `rating` is still `< 3.5`.
- **`mv_category_stats`** — materialized view of per-category `active_count`, `rating_mean`, `rating_stddev`, and `max_recent_reviews_30d`. Feeds the ranking z-score and category analytics. Unique index on `(category_id)`.
- **`mv_business_review_stats`** — materialized view of per-business published-review counts, 30-day counts, five-star, one-star, and pending-moderation counts. Powers the merchant dashboard. Unique index on `(business_id)`.
- **`refresh_analytics()`** — the scheduled entry point that refreshes both materialized views. (For a zero-lock refresh, the cron may instead call `REFRESH MATERIALIZED VIEW CONCURRENTLY` directly, outside a transaction — possible because both MVs have unique indexes.)

These objects are what let the read path stay a single indexed `SELECT`. The "why" is in [`SCALABILITY.md`](SCALABILITY.md) and [ADR-0004](adr/0004-keyset-pagination-and-olap-materialized-views.md).
