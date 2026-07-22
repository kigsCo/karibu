# Profile hub: customer-only nav, your reviews, saved sync, visit history

**Date:** 2026-07-23 · **Status:** Approved (scope confirmed interactively:
all four features; auto-tracked history with Clear; provider avatars +
initials, no uploads this round)

## What we're building

Karibu's customer chrome should not advertise the business side: the nav
becomes **Discover / Guides / Saved / Profile** (4 tabs). `/for-business`
stays routed — reachable from `/welcome`'s business card and deep links —
just out of the tab bar. The profile section grows from "name + sign out"
into the customer's home: identity, home city, their reviews with moderation
status, their visit history, and their saved places made real.

## Components

### Migrations (one concern each) + pgTAP

1. `20260722231313_add_reviews_owner_read_policy.sql` — CREATE POLICY
   "Reviewer reads own reviews" ON reviews FOR SELECT TO authenticated
   USING (reviewer_id = auth.uid()). Policies OR together: public keeps
   seeing published only; the reviewer additionally sees their own
   pending_moderation/rejected/flagged rows. SELECT grant already exists.
2. `20260722231317_create_visited_places.sql` — table
   `(user_id uuid → auth.users CASCADE, business_id uuid → businesses
   CASCADE, visited_at timestamptz, PK (user_id, business_id))`.
   Last-visit-wins: revisits upsert `visited_at`, so history = distinct
   places by recency and rows are bounded by places, not visits. Owner-only
   `FOR ALL` RLS (saved_places pattern); explicit revoke-then-grant
   (SELECT/INSERT/UPDATE/DELETE to authenticated, ALL to service_role);
   index `(user_id, visited_at DESC)` for the list + FK index on
   business_id. Client writes directly — it's the user's own data; no edge
   function, no secrets, RLS pins every row to auth.uid().
3. `supabase/tests/profile_hub_test.sql` — pgTAP: reviewer sees own pending
   review, public does not; visited_places owner isolation (read + write +
   delete), grants, RLS enabled.

### Nav slimming

- `BottomNav.jsx` / `DesktopNav.jsx`: remove the `business_signup` item;
  BottomNav grid `grid-cols-5` → `grid-cols-4`.
- `test/routes.test.jsx` + `test/navigation.test.jsx`: the chrome marker
  `.grid-cols-5` becomes `.grid-cols-4`; assert the Business tab is gone.
- `lib/nav.js` route mappings untouched (deep links still resolve).

### Hooks

- `useSavedPlaces` — signed-in: fetch own saved set (embedding business
  name/slug/etc. for SavedPage), `toggle(businessId)` inserts/deletes;
  guest: falls back to the existing local-state behaviour unchanged.
- `useMyReviews` — own reviews newest-first (limit 20) with embedded
  business name/slug; maps status → chip label (pending_moderation "In
  review", published "Live", rejected/flagged "Not published").
- `useVisitHistory` — list (limit 10, `visited_at desc`) + `clear()`
  (delete all own rows); separate `recordVisit(businessId)` helper —
  fire-and-forget upsert called from BusinessPage when a session exists;
  errors are swallowed (history must never break the business page).

### UI (existing visual language, no restyle of existing screens)

- `ProfilePage` becomes a composition; new sections extracted to
  `components/profile/`: `InitialsAvatar` (photo when `avatar_url`, else
  initials circle from name/email), `HomeCitySection` (city chips from
  ReferenceData context → saves `profiles.home_city_id`, and sets the
  active CityContext when chosen), `MyReviewsSection` (status chips),
  `VisitHistorySection` (recent list + "Clear history").
- `SavedPage` renders the real saved list for signed-in users (card rows in
  the existing list idiom, linking to `/b/:slug`); keeps its current
  placeholder/empty state for guests and empty lists.
- `BusinessPage`: heart button drives `useSavedPlaces.toggle` when signed
  in (local behaviour for guests); mount effect calls `recordVisit`.

### Tests

vitest: nav (4 tabs, no Business), SavedPage signed-in list, ProfilePage
sections (reviews chips, history clear, home city save), useSavedPlaces
toggle both modes, BusinessPage visit logging. The shared supabase mock in
`test/setup.js` gains `upsert`/`delete` chain links.

## Error handling

Every hook degrades to empty/local state on error — no screen blanks. Visit
logging is fire-and-forget. Clear-history surfaces its error inline in the
section, nowhere else.

## Out of scope (deliberate)

Avatar uploads (needs Storage buckets — future round), business onboarding
portal (next round), feeding visited_places into the ranking engagement
term (noted as the future data source), review editing/deleting.
