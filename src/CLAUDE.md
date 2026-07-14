# CLAUDE.md — src/

Area rules for the frontend. Read the root `CLAUDE.md` first.

## The golden rule
**Migrate the data layer; do not touch the visual layer.** The design, typography, palette, and copy are deliberate. No restyling, no component-library swaps, no "while I'm here" cleanup.

## The monolith split is COMPLETE

`KaribuApp.jsx` — the original ~3,200-line, single-file prototype with 14 screens and
hardcoded constants (`cities`, `categories`, `recommended`, `salonsList`, `reviewsSample`,
`guides`) — has been fully extracted and **deleted** (SP1 architecture refactor, task 21).
Every screen was moved out one at a time, verifying the app still rendered after each
step; nothing does a big-bang refactor here again. The app is now entirely route-based —
screens are reached by real URLs and are deep-linkable (shareable, bookmarkable,
refresh-safe), not by in-memory `payload`/`go(screen, payload)` state alone. The current
structure:

- `pages/` — one file per screen/route (`DiscoverPage.jsx`, `BusinessPage.jsx`,
  `GuideArticlePage.jsx`, ...). Each page component reads `useParams()`/`useLocation()`
  for its slug and optional nav-state payload, and renders the screen that used to live
  inline in `KaribuApp.jsx`.
- `components/` — shared UI (`BottomNav`, `DesktopNav`, `Badge`, `StarRow`, `HeroImage`,
  `GlobalStyles`, ...) used across multiple pages.
- `layout/` — `AppFrame.jsx` (the persistent viewport: kitenge background, mobile-width
  column, safe-area insets), `AppShell.jsx` (chrome routes: desktop/bottom nav around a
  scrollable `<Outlet/>`), `FullBleedLayout.jsx` (full-screen routes with no nav chrome —
  `/ask`, `/city`, `/b/:slug/review`, `/guides/:slug`, `/merchant`).
- `routes.jsx` — the route table: chrome routes nest under `AppShell`, full-bleed routes
  under `FullBleedLayout`, both inside `AppFrame`. Source of truth for which path renders
  which page and which layout.
- `lib/nav.js` — the legacy-nav adapter. `useLegacyNav()` gives screens the same
  `go(screen, payload)` / `back()` calls the prototype used, translated to real
  `navigate()` calls via `pathFor()` / `TAB_PATH`; `activeTabFromPath()` derives the
  highlighted tab from the current path.
- `context/` — `CityContext` (the selected city), `LocalReviewsContext` (optimistic
  guest-review state, see root `CLAUDE.md`), `ReferenceDataContext` (cities/categories,
  KAR-5). Each lifted out of the old root component's `useState` so any route can read
  or change it.

**Known gaps, not bugs to silently "fix":** `SearchPage` is routed (`/search`) but
currently unlinked from any nav/UI — reachable only by typing the URL. `SubCategoryPage`
exists but is unrouted entirely. Both are inherited from the prototype's screen set;
whether to link, route, or retire them is a pending team decision (see task 20), not
something to resolve unilaterally.

## Migration order (historical record — see `frontend-data-migration` skill)

All seven steps are **done**. Kept here as the record of what the fallback-first contract
means in practice, and as the order to follow if a similar migration is ever needed again.

1. ✅ `lib/supabase.js` — typed client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
2. ✅ Replace `cities` + `categories` constants with a one-time fetch held in React Context (small, read-only).
3. ✅ Replace `recommended` + `salonsList` with **paginated** queries (`hooks/useBusinesses.js`).
4. ✅ Wire `BusinessScreen` to fetch one business by slug + its published reviews.
5. ✅ Replace the direct `fetch("https://api.anthropic.com/...")` in `AskKaribuScreen` with `supabase.functions.invoke('ask-karibu', ...)`. The leaked API key is gone; keep it that way.
6. ✅ Replace in-memory review state with `submit-review` calls + re-fetch.
7. ✅ Replace the `guides` constant with `hooks/useGuides.js` (`useGuides` for the list, `useGuideDetail` for one article + its related businesses).

Every hook takes the prototype constant as a `fallback`, so the first paint is identical
and the app still renders when Supabase is unreachable. An **empty** live result is real
data, not an error: the screens render their existing "coming soon" state.

## Conventions
- Data fetching in `hooks/`, the Supabase client + helpers in `lib/`, extracted reference data in `data/`.
- Lists are always paginated; never `select('*')` an unbounded table.
- Only `VITE_*` vars are available client-side, and only the two public Supabase values belong there.
- Tests live beside what they cover (`pages/BusinessPage.test.jsx`) or in `test/` for
  cross-cutting concerns (`test/routes.test.jsx` mounts every route; `test/navigation.test.jsx`
  drives real tab clicks). `routes.test.jsx` already proves every route mounts — new tests
  should add real behavioral coverage (interaction, deep-link content), not repeat that check.
