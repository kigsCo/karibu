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

### 🔴 Security blockers — must be fixed BEFORE any edge function is deployed

Found by automated review on 2026-07-10 and confirmed by reading the code. **None is
exploitable today**: no cloud Supabase project exists, so no function is reachable. Each
becomes live the moment Phase 2 provisions a project and Phase 7 deploys. The CI deploy
job is gated on `SUPABASE_PROJECT_REF` being set, so adding that secret is the trigger
that arms all of this. Do not add it until these are closed.

- [ ] **CRITICAL — `mpesa-callback` is an unauthenticated payment bypass.**
      `supabase/config.toml:95` sets `verify_jwt = false` and the function does no origin
      check, no shared secret, and no amount verification. On `ResultCode === 0` it
      activates the subscription (`index.ts:65`) and promotes `businesses.tier`
      (`index.ts:75`). Worse, `mpesa-stk-push` is *also* `verify_jwt = false`
      (`config.toml:90`), so an attacker can mint a real `CheckoutRequestID`, never pay,
      then POST a forged success callback for it and self-promote to "Karibu
      Recommended". Fix: a shared-secret token on the `CallBackURL` compared in constant
      time, plus cross-check `Amount` / `MpesaReceiptNumber` from `CallbackMetadata`
      against the stored `amount_kes`. Consider an IP allowlist for Daraja's published
      source IPs. Reject unauthenticated calls rather than returning `Accepted`.
- [ ] **HIGH — `moderate-reviews` is prompt-injectable.** `index.ts:66` interpolates the
      raw `${review.body}` into the classification prompt inside quotes. A review body can
      close the quote and instruct Claude to return all-clean, publishing itself. Fix:
      wrap untrusted fields in delimited tags the system prompt declares to be data, use
      structured tool output instead of parsing the first JSON blob, and gate publication
      behind an independent heuristic (URL/keyword/length) so no single model response can
      promote a review.
- [ ] **MEDIUM — `submit-review` rate limit is spoofable.** `index.ts:84` takes the
      **first** `x-forwarded-for` hop, which the client controls, so the per-IP limit is
      bypassed by sending a header. Fix: take the **last** hop (appended by the trusted
      proxy) and additionally rate-limit on the authenticated `reviewerId`, which the
      function already has.
- [ ] **Review `verify_jwt = false` on the cron functions.** `moderate-reviews` and
      `calculate-rankings` are publicly invokable. Low impact (they only run work early),
      but they should be reachable only by the scheduler.

## Phase 5 — Auth ⛔ blocker

- [ ] Supabase Auth. **`submit-review` requires a signed-in user**, so guest reviews stay
      local-only (optimistic UI + a console warning) until this ships.
- [ ] `saved_places` per-user; `MerchantDashboardScreen` on the real owner's business.

## Phase 6 — Real routing (optional)

- [ ] Route-based pages under `src/pages/`. Skip if it risks the launch.

## Phase 7 — Deploy & operations

- [x] `.github/workflows/deploy.yml` exists (lint → build, then deploy functions on `main`).
- [x] **Repo root flattened so CI can actually see it.** Everything lived under
      `karibu-main/`, and GitHub Actions only reads `.github/workflows/` at the
      repository root — so the workflow was invisible and `gh run list` returned zero
      runs for the whole repo's history. Moved all 114 tracked files up one level
      (pure renames, 100% similarity, no content change).
- [x] **`pull_request` trigger unfiltered.** `branches: [main]` matches the PR's *base*,
      so a PR into any phase branch was never checked. Deviates from guide section 10,
      which specifies `pull_request: branches: [main]` — the guide assumes PRs only ever
      target `main`. `workflow_dispatch` added so the pipeline can be run by hand.
- [x] **`deploy-supabase-functions` gated on configuration.** It would otherwise fail on
      the first push to `main`, since `supabase link --project-ref` gets an empty ref with
      no `SUPABASE_PROJECT_REF` secret. A `check-config` job resolves the secrets (the
      `secrets` context is unavailable in a job-level `if:`) and the deploy job skips
      unless both `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` are set. It
      auto-enables the moment they are. **Setting those two secrets arms the deploy —
      close the security blockers above first.**
- [ ] Frontend host, `VITE_*` env vars, edge-function secrets, Sentry.
- [ ] Point the Vercel/Netlify **root directory** at the repo root, not `karibu-main/`.
