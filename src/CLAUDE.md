# CLAUDE.md — src/

Area rules for the frontend. Read the root `CLAUDE.md` first.

## The golden rule
**Migrate the data layer; do not touch the visual layer.** The design, typography, palette, and copy are deliberate. No restyling, no component-library swaps, no "while I'm here" cleanup.

## `KaribuApp.jsx`
- It is ~3,200 lines, one component, with hardcoded constants (`cities`, `categories`, `recommended`, `salonsList`, `reviewsSample`, `guides`) and 14 screens (`DiscoverScreen`, `CategoryScreen`, `BusinessScreen`, `AskKaribuScreen`, `MerchantDashboardScreen`, ...).
- Do **not** bulk-split it. If a screen must move out, extract exactly one at a time and confirm the app still renders before the next.

## Migration order (strict — see `frontend-data-migration` skill)
1. `lib/supabase.js` — typed client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
2. Replace `cities` + `categories` constants with a one-time fetch held in React Context (small, read-only).
3. Replace `recommended` + `salonsList` with **paginated** queries (`hooks/useBusinesses.js`).
4. Wire `BusinessScreen` to fetch one business by slug + its published reviews.
5. Replace the direct `fetch("https://api.anthropic.com/...")` in `AskKaribuScreen` with `supabase.functions.invoke('ask-karibu', ...)`. **This removes the leaked API key — do it early.**
6. Replace in-memory review state with `submit-review` calls + re-fetch.

## Conventions
- Data fetching in `hooks/`, the Supabase client + helpers in `lib/`, extracted reference data in `data/`.
- Lists are always paginated; never `select('*')` an unbounded table.
- Only `VITE_*` vars are available client-side, and only the two public Supabase values belong there.
