# Merchant dashboard: real owner data, safe self-editing, honest stats

**Date:** 2026-07-23 · **Status:** Approved (scope confirmed interactively:
reviews-only honest analytics — no engagement tracking this cycle; safe-fields
self-editing enforced by a column-scoped grant; thin stats edge function +
direct RLS for everything else; switcher/entry-point/subscription defaults
accepted)

## What we're building

Cycle 2 of the business portal: `/merchant` stops being a mock and becomes
the owner's real home. The onboarding spine (cycle 1, live in production)
now mints owners via `businesses.owner_id`; this cycle gives those owners:

- **their listing(s)**, selected via `owner_id` (auto-select when they own
  one, a compact switcher when several, a register CTA when none, an
  "under review" panel when only pending);
- **honest stats** — the mock's engagement tiles (profile views, WhatsApp
  taps, direction taps) and sentiment "themes" have no data source and are
  **removed**, replaced by four real tiles: Rating (cached on the row),
  Total reviews (cached), Reviews last 30 days (stats MV), In moderation
  (live count). The rating-trend sparkline stays, fed by real monthly
  buckets; the themes section is deleted;
- **safe self-editing** — hours, phone, WhatsApp, email, website, about,
  price range, address, and photos, saved by direct `UPDATE` under a new
  column-scoped grant. Identity fields (name, category, city/hood,
  location) stay locked with a "contact hello@karibu.co.ke to change"
  note — re-verification flows are a later cycle;
- **real reviews and subscription state** — recent published reviews; the
  subscription card shows the actual tier and period (checkout itself is
  cycle 3, so free tiers see "Upgrade — coming soon"); the improvement
  banner derives from `improvement_until` and the cached rating.

## Components

### Migration (one concern: make owner self-editing safe) + pgTAP

1. `enable_owner_listing_edits.sql` — the "Owner updates own business" RLS
   policy has existed since `20260601000002` but is inert because
   `authenticated` holds no UPDATE grant on `businesses`
   (`20260710160000`). Add the capability, column-scoped:
   `GRANT UPDATE (hours_json, phone, whatsapp, email, website, about,
   price_range, address, hero_image_url, gallery_image_urls)
   ON businesses TO authenticated`. Postgres itself refuses owner edits to
   `name`, `category_id`, `sub_type_id`, `city_id`, `hood`, `location`,
   `status`, `tier`, `owner_id`, and every cached ranking column — the UI
   lock is cosmetic on top. Following the `profiles` precedent ("a client
   cannot store megabytes in a row"), the same migration adds bounded
   CHECKs on the newly client-writable text columns (`about` ≤ 2000,
   `address` ≤ 200, `price_range` ≤ 60, `phone`/`whatsapp` ≤ 20,
   `email` ≤ 200, `website` ≤ 300, `hero_image_url` ≤ 2048, and the
   gallery capped by cardinality:
   `CHECK (array_length(gallery_image_urls, 1) IS NULL OR
   array_length(gallery_image_urls, 1) <= 15)` — matching the tier copy's
   "up to 15 photos"). A fresh `supabase db reset` proves the seed
   satisfies the new CHECKs.
2. `supabase/tests/merchant_dashboard_test.sql` — pgTAP: owner updates own
   `hours_json`/`phone` (lives_ok); owner update touching `name`, `status`,
   or `tier` throws 42501; a stranger's update on the owner's row matches
   zero rows; `has_column_privilege` asserts the exact grant list (safe
   columns true, locked columns false).

### Edge function

- `merchant-stats` — new, `verify_jwt=true`; the only data the client
  cannot safely read itself. POST `{ business_id }` →
  1. resolve `auth.uid()` via the user client; 404 when the business does
     not exist, 403 when `owner_id` differs;
  2. (service role) the `mv_business_review_stats` row — `reviews_30d`,
     `five_star`, `one_star`. The MV is **never** client-granted: RLS does
     not apply to materialized views, so a grant would leak every
     business's numbers;
  3. (service role) a **live** `pending_moderation` count from `reviews` —
     owners cannot read pending reviews under RLS, and the MV's copy is up
     to a day stale;
  4. a monthly rating trend: fetch published reviews' `(rating,
     created_at)` (capped at 1000 rows), bucket by calendar month in the
     function (pure helper with unit tests), return the last 6 buckets.
  Headline rating and total review count come from the `businesses` row
  the owner already reads — not from this function. No rate limiting:
  authenticated, ownership-gated, no external cost (the metering guardrail
  targets paid calls). Registered in `config.toml` with the standard
  auth-model comment. Errors use the shared `{ error }` shape
  (400/401/403/404/500).

### Hooks

- `useMyBusinesses()` — the owner's listings (`id, slug, name, status,
  tier, rating, review_count, improvement_until, hero_image_url,
  hours_json, phone, whatsapp, email, website, about, price_range,
  address, gallery_image_urls`) via the existing owner-read RLS policy,
  newest first. Also consumed by the ProfilePage entry-point card.
- `useMerchantStats(businessId)` — invokes `merchant-stats`; `stats` stays
  null on any failure (tiles render "—", page never blanks).
- `useOwnerListingUpdate(businessId)` — `save(fields)` issues the direct
  column-scoped `UPDATE ... WHERE id` (RLS pins the row), returns
  success/failure with the real server message surfaced (same spirit as
  `functionErrorMessage`); exposes `saving` for button state.

### UI (existing visual language; mock constants deleted)

- `MerchantDashboardPage` becomes a composition; sections extracted to
  `components/merchant/`:
  - `BusinessSwitcher` — hidden for one listing; dropdown for several;
    none → "List your business" CTA to `/for-business/register`;
    only-pending → "Your listing is under review" panel (no dashboard).
  - `MetricTiles` — Rating, Total reviews, Reviews last 30 days, In
    moderation. "Updated nightly" microcopy on the MV-sourced tile.
  - `RatingTrend` — the existing sparkline component fed real monthly
    buckets; hidden below two months of data.
  - `RecentReviews` — published reviews via the public-read policy, same
    row-mapping idiom as BusinessPage.
  - `EditListingSection` — the safe-fields form; locked fields shown
    disabled with the contact-us note; photo manager uploads to
    `business-photos/<uid>/…` (existing own-folder pattern) and edits
    `gallery_image_urls`/`hero_image_url`; removing a photo edits the
    array only (storage orphans are the tracked cleanup-cron follow-up).
  - `SubscriptionCard` — real tier; active subscription shows
    `current_period_end` (owner-read RLS on `subscriptions`); free shows
    "Upgrade — coming soon" (cycle 3).
  - `ImprovementBanner` — healthy / warning / improvement-window states
    derived from the cached rating and `improvement_until`.
- Entry points: a "Your business" card on `ProfilePage` when
  `useMyBusinesses()` is non-empty; the applications block's "Live" chip on
  `/for-business` links to `/merchant`. `/merchant` stays off every nav.
- Signed-out `/merchant` → sign-in prompt via `/welcome` with
  `state.next = "/merchant"` (existing pattern).

### Tests

vitest: the four page states (guest prompt, no listings CTA, pending-only
panel, active dashboard with stats), edit-save happy path + server-error
surface, switcher with two listings, ProfilePage card presence/absence,
applications-block link. Deno: `merchant-stats` 401/403/404 gates, response
shape, month-bucketing pure helper. pgTAP as above. `npm run lint`,
`npm run build`; no existing screen changes beyond the two entry points.

## Error handling

Every hook degrades to null/empty — the dashboard renders with "—" tiles
when stats fail and never blanks. Saves disable their button while in
flight and surface the real server message inline on failure. The stats
function returns the shared `{ error }` shape with correct status codes.
A deleted-out-from-under business (owner_id reassigned mid-session) simply
drops out of `useMyBusinesses()` on the next fetch.

## Out of scope (deliberate)

Engagement event tracking (views/taps — needs an events pipeline and a
privacy stance); review themes and owner replies (Recommended-tier feature,
later cycle); M-Pesa checkout and tier upgrades (cycle 3); identity-field
edits and the re-verification flow they demand; MV refresh cadence changes;
storage cleanup of removed photos (tracked FIX_PLAN follow-up).
