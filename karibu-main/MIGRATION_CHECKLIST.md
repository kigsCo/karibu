# Migration checklist — prototype → live app

Tracks the phases in `KARIBU_CLAUDE_CODE_BRIEF.md`. Tick items as they land; record
every deviation from `docs/karibu-developer-guide.docx`. Where the guide and the
running code disagree, **trust production** and update the doc.

---

## Phase 1 — De-mockup + PWA ✅

- [x] Delete the desktop marketing column and the caption under the phone.
- [x] Delete the fake phone chrome: `border-4` bezel, `rounded-[2.5rem]` frame,
      notch, and the `9:41` / ●●● / 📶 / 🔋 status bar.
- [x] Replace the fixed `820px` scroll model with the real viewport
      (`100dvh`, `100vh` fallback); the scroll region flexes to fill.
- [x] `<BottomNav>` docks to the true bottom, padded with `env(safe-area-inset-bottom)`.
- [x] `hideBottomNav` behaviour preserved for the five full-screen flows.
- [x] Responsive: full-bleed at 360px, centred `max-w-sm` column on desktop against
      the kitenge backdrop. No device frame, no fake chrome.
- [x] `public/manifest.webmanifest` + 192/512 PNG icons + a maskable 512, linked from
      `index.html`.
- [x] Minimal hand-rolled service worker (`public/sw.js`), registered in production only.
- [x] `npm run build` and `npm run lint` pass (lint: 0 errors, the same 3 pre-existing
      warnings as before the change).

### Deviations and decisions — Phase 1

- **The brief was written against an older tree.** It describes a static prototype with
  no backend and an `AskKaribuScreen` that calls `api.anthropic.com` directly. That has
  not been true since commit `0834111`: the screen already calls
  `supabase.functions.invoke('ask-karibu', ...)`, and there is no Anthropic reference
  anywhere in `src/`. Phases 2–4 are largely shipped. Phase 1 was the only untouched one.
  Verified: `grep -r "anthropic" src/` returns only a stale line in `src/CLAUDE.md`.
- **`src/CLAUDE.md:17` is stale** — it still lists "replace the direct fetch" as pending
  work. Left alone here to keep this phase surgical; correct it in the next doc pass.
- **`viewport-fit=cover` added** to the existing viewport meta. The brief asks for
  `env(safe-area-inset-bottom)` to be respected, and those `env()` variables resolve to
  `0` without it. Paired with safe-area padding on the app column (top) and the bottom
  nav, so on non-notched devices nothing moves.
- **`merchantMode` state removed.** Its only reader was the deleted caption under the
  phone. Both writes (`go`, `exitMerchant`) were dead once the reader went. Leaving it
  would have added a fourth `no-unused-vars` warning.
- **`.phone-shadow` removed** from `src/index.css` and the `GlobalStyles` component. It
  styled only the deleted bezel. `.hide-scroll` is kept — Ask Karibu's chat area still
  uses it.
- **No `vite-plugin-pwa`.** CI runs `npm ci`, which hard-fails when `package.json` and
  `package-lock.json` disagree. A hand-rolled worker adds no dependency and no lockfile
  churn. Navigations are network-first (so a redeploy can never strand a user on a stale
  `index.html`); `/assets/*` is cache-first because the filenames are content-hashed.
  Deliberately no `skipWaiting()` — see the comment at the top of `public/sw.js`.
- **Desktop column width is `max-w-sm` (384px)**, matching the prototype's phone. Screen
  content is 8px wider than before only because the 4px bezel on each side is gone.

### Verified in a real browser (not just built)

| Check | Result |
|---|---|
| Page never scrolls; the inner region does | `documentElement.scrollHeight === innerHeight` |
| Bottom nav at the true bottom | nav bottom `= 900px` on a 900px viewport |
| `AskKaribuScreen` `h-full` resolves | root `= 900px`; composer bottom `= 900px` |
| `PlaceholderScreen` centres | 348px above, 348px below |
| `CategoryScreen` `sticky top-0` pins | stays at scroll-port top after scrolling |
| Full-bleed at 360px, no h-overflow | column width `= 360px` |
| Service worker registers, scope `/` | page controlled; `karibu-cache-v1` |
| Cross-origin never cached | 0 Supabase / Google Fonts URLs in the cache |
| Offline shell | app still renders after the preview server is killed |
| No Anthropic key in the bundle | `grep -ril "sk-ant\|api.anthropic.com" dist/` → no hits |

---

## Phase 2 — Backend foundation ✅ (in-repo; no cloud project yet)

- [x] `@supabase/supabase-js`, client at `src/lib/supabase.js`.
- [x] `.env.example` with the two public `VITE_*` vars.
- [x] Migrations under `supabase/migrations/` (6 files: schema, RLS, functions/triggers/
      views, rate limits, role grants, `cities.sort_order`).
- [x] RLS policies.
- [x] `supabase/seed.sql` ports the prototype data; Nairobi salons are `status='active'`.
- [ ] **Cloud project provisioned.** `.env` still points at the local stack.
- [ ] `SUPABASE_SETUP.md` documenting the exact CLI steps.

## Phase 3 — Data migration ✅

- [x] `cities` + `categories`/`sub_types` → `ReferenceDataContext` (KAR-5).
- [x] `recommended` + `salonsList` → `useBusinesses` (keyset paginated, KAR-6).
- [x] `BusinessScreen` → `useBusinessDetail` by slug + published reviews (KAR-7).
- [ ] `guides` / `GuidesHubScreen` / `GuideArticleScreen` — still the in-code constant.
- [x] Loading/empty states: fallback-first, so first paint is unchanged.

## Phase 4 — Edge functions

- [x] `ask-karibu` implemented; frontend calls it via `functions.invoke`. **No key in the
      browser bundle** (grep-verified against `dist/`).
- [x] `submit-review`, `moderate-reviews`, `calculate-rankings`, `mpesa-stk-push`,
      `mpesa-callback`, `send-onboarding-email` exist in `supabase/functions/`.
- [ ] Deployed anywhere real; secrets set; crons scheduled.
- [ ] Confirm the model string against current Anthropic docs before go-live.

## Phase 5 — Auth ⛔ blocker

- [ ] Supabase Auth. **`submit-review` requires a signed-in user**, so guest reviews stay
      local-only (optimistic UI + a console warning) until this ships.
- [ ] `saved_places` per-user; `MerchantDashboardScreen` on the real owner's business.

## Phase 6 — Real routing (optional)

- [ ] Route-based pages under `src/pages/`. Skip if it risks the launch.

## Phase 7 — Deploy & operations

- [x] `.github/workflows/deploy.yml` exists (lint → build, then deploy functions on `main`).
- [ ] Frontend host, `VITE_*` env vars, edge-function secrets, Sentry.
