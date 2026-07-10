# CLAUDE.md — src/

Area rules for the frontend. Read the root `CLAUDE.md` first.

## The golden rule
**Migrate the data layer; do not touch the visual layer.** The design, typography, palette, and copy are deliberate. No restyling, no component-library swaps, no "while I'm here" cleanup.

## `KaribuApp.jsx`
- It is ~3,200 lines, one component, with hardcoded constants (`cities`, `categories`, `recommended`, `salonsList`, `reviewsSample`, `guides`) and 14 screens (`DiscoverScreen`, `CategoryScreen`, `BusinessScreen`, `AskKaribuScreen`, `MerchantDashboardScreen`, ...).
- Do **not** bulk-split it. If a screen must move out, extract exactly one at a time and confirm the app still renders before the next.

## Migration order (strict — see `frontend-data-migration` skill)

All six steps are **done**. Kept here as the order to follow for any screen still on a
constant, and as the record of what the fallback-first contract means in practice.

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
