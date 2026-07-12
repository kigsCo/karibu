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

## Phase 2 — Backend foundation ✅

- [x] `@supabase/supabase-js`, client at `src/lib/supabase.js`.
- [x] `.env.example` with the two public `VITE_*` vars.
- [x] Migrations under `supabase/migrations/` (10 files: schema, RLS, functions/triggers/
      views, rate limits, role grants, `cities.sort_order`, payment/abuse hardening,
      API-role grant lockdown, PostGIS relocation, `guides.hero_variant`).
- [x] RLS policies. Verified on the cloud project: all 10 app tables have RLS on.
- [x] `supabase/seed.sql` ports the prototype data; Nairobi salons are `status='active'`.
- [x] **Cloud project provisioned** — `karibu` (`jwiptjcpczamewmyaost`), `eu-central-1`,
      free plan. All 10 migrations applied, seed loaded (5 cities, 13 categories,
      47 sub-types, 10 active businesses, 6 published reviews, 6 published guides).
      Remote migration versions were realigned to the repo filenames, so
      `supabase db push` is now a no-op rather than a re-apply.
- [x] `SUPABASE_SETUP.md` written.
- [x] Every frontend hook query verified against the live API with the public anon key:
      `ReferenceDataContext` (cities, categories + sub_types embed), `useBusinesses`
      (keyset page + city/category/sub-type `!inner` filters), `useBusinessDetail`
      (by slug + reviews). Anon sees only `published` reviews.

### 🔴 Found during provisioning — the cloud grant model is the inverse of local

`20260622225015_add_role_grants.sql` was written against the local stack, where
migrations run as `postgres` and Supabase's auto-grant default privilege never fires,
leaving the API roles with **no** privileges. In the cloud, default privileges hand
`anon` and `authenticated` **every** privilege on every new table in `public`.

Measured on the cloud project right after the first push:
`has_table_privilege('anon','public.businesses','DELETE')` → `true`.

RLS was still filtering the app tables — but that made RLS the only layer, and
**materialized views are not subject to RLS at all**, so `mv_business_review_stats`
(per-business pending-moderation counts) was readable by anyone with the public anon key.

- [x] **Fixed** by `20260710160000_lock_down_api_role_grants.sql`: revoke everything from
      the API roles, re-grant the intended model, pin `search_path` on all 7 functions.
      Applied to cloud **and** local. Verified: the matviews now return `401 / 42501` to
      anon, `anon` has no write privilege on any app table, and every app read still works.
- [x] **`spatial_ref_sys` was INSERT/DELETE-able by `anon`.** PostGIS's own table: no RLS,
      served by PostgREST, owned by `supabase_admin`. Cloud `postgres` is neither a
      superuser nor a member of that role, so no migration could revoke it or enable RLS —
      the `REVOKE` statements in an earlier draft were silent no-ops.
      **Fixed** by `20260710170000_move_postgis_out_of_public.sql`: PostGIS and `pg_trgm`
      now live in the unexposed `extensions` schema. PostGIS does not support
      `ALTER EXTENSION … SET SCHEMA`, so it was dropped and recreated; `businesses.location`
      was read by no code and NULL on every row, so nothing was lost. Verified: the three
      PostGIS endpoints return `404 / PGRST205` (PostgREST no longer knows they exist),
      every app read still returns `200`, and a fresh `supabase db reset` reproduces the
      end state. This also cleared the `extension_in_public` and
      `st_estimatedextent SECURITY DEFINER` warnings.
      **Note for future migrations:** the `geography` type now lives in `extensions` and is
      not on the default `search_path` — write `extensions.geography(...)` and
      `extensions.gin_trgm_ops`.

**Supabase security advisor is now clean**: zero ERROR, zero WARN. The two remaining INFO
items (`ai_conversations` and `rate_limits` have RLS on with no policies) are intentional —
those tables are service-role only.

### Phase 2 follow-ups (not blockers for Phase 3/4)

- [ ] `.mcp.json` still carries `--project-ref=YOUR_PROJECT_REF`. Replace with
      `jwiptjcpczamewmyaost`. (Left for a human: editing the MCP startup config from an
      agent session widens the agent's own tool surface.)
- [ ] `.env` still points at the local stack. Switch it — or a host env var — to the cloud
      project when you want the dev server reading live data.
- [ ] `ranking_score` is `0` on every row until `calculate-rankings` runs, so Discover's
      ordering is currently arbitrary (it falls through to the `id` tiebreaker).
- [ ] **Transfer the project to a Kigs Apex organization** before go-live. It currently
      lives in `allaniteba37@gmail.com's Org`.
- [ ] **A free project pauses after 7 days of inactivity.** Upgrade to Pro ($25/mo) before
      launch, per guide section 02.

## Phase 3 — Data migration ✅

- [x] `cities` + `categories`/`sub_types` → `ReferenceDataContext` (KAR-5).
- [x] `recommended` + `salonsList` → `useBusinesses` (keyset paginated, KAR-6).
- [x] `BusinessScreen` → `useBusinessDetail` by slug + published reviews (KAR-7).
- [x] `guides` / `GuidesHubScreen` / `GuideArticleScreen` → `useGuides` + `useGuideDetail`.
- [x] Loading/empty states: fallback-first, so first paint is unchanged.

### Deviations and decisions — Phase 3 (guides)

- **The seed only carried 2 of the 6 guides, and truncated both.** `safety-nairobi` had 7
  body blocks against the prototype's 11; `areas-nairobi` had 8 against 14. The seed's
  GUIDES section is now **generated** from the `guides` constant in `KaribuApp.jsx` rather
  than retyped, so the live copy cannot drift from the prototype's. A diff proved the
  result byte-identical to the constant.
- **New column: `guides.hero_variant`** (`20260710180000`). Both guide screens draw their
  hero with `<HeroImage variant={g.heroVariant} />`, and the table had nowhere to put it —
  every guide would have rendered the same hero. Nullable; the mapper falls back to
  `'default'`, exactly as `HeroImage` already did. `hero_image_url` remains the column for
  the day real photography exists.
- **`updated_at` is pinned to April 2026 in the seed**, because the UI renders
  "Updated April 2026" from it. The `guides_set_updated_at` trigger is `BEFORE UPDATE`
  only, so an INSERT keeps the value. Loading the guides into the cloud project used an
  upsert with that trigger suspended inside a single atomic `DO` block — an UPDATE would
  otherwise have stamped `now()` over the editorial date on the two pre-existing rows.
- **`related_businesses` is a `uuid[]`, not a foreign key**, so PostgREST cannot embed it.
  `useGuideDetail` fetches those rows in a second query and re-sorts them into the array's
  order, because an array has an order and an `IN (...)` does not. The seed resolves the
  uuids by slug subquery, never by literal, since PKs differ per environment.
- **The list query omits `body_json`.** Bodies are a few KB each and no list screen renders
  one (`db-performance`: never select an unbounded column on a list path).

Verified against the cloud project with the public anon key: 6 guides, block counts
11/14/10/8/10/8, both featured guides resolving 2 related businesses each, every row
reading "Updated April 2026", unpublished guides invisible to `anon`, and no `body_json`
on the list path.

## Phase 4 — Edge functions ✅ (code complete; deploy is Phase 7)

- [x] `ask-karibu` implemented; frontend calls it via `functions.invoke`. **No key in the
      browser bundle** — `dist/` greps clean for `api.anthropic.com`, `sk-ant`, `x-api-key`,
      `anthropic-version`, and `ANTHROPIC_API_KEY`. This is the phase's stated acceptance
      test, and it passes.
- [x] `submit-review`, `moderate-reviews`, `calculate-rankings`, `mpesa-stk-push`,
      `mpesa-callback`, `send-onboarding-email` exist in `supabase/functions/`.
- [x] Every function that only our backend may call is authenticated as such, and every
      publicly-reachable function that costs money is metered. See the blockers below.
- [x] 66 Deno tests pass (`deno test --allow-env --allow-net --node-modules-dir=none
      supabase/functions/`). The 10 new hardening tests were run against the pre-fix
      handlers from `main` and **all 10 fail there** — they encode the vulnerabilities, not
      the implementation.
- [ ] Deployed anywhere real; secrets set; crons scheduled.
- [ ] Confirm the model string against current Anthropic docs before go-live.

### 🔴 Security blockers — must be fixed BEFORE any edge function is deployed

Found by automated review on 2026-07-10 and confirmed by reading the code. **None is
exploitable today**: a cloud project now exists, but **no edge function is deployed to it**,
so none is reachable. Each becomes live the moment Phase 7 deploys. The CI deploy job is
gated on `SUPABASE_PROJECT_REF` being set, so adding that secret is the trigger that arms
all of this. Do not add it until every box below is ticked.

Seven code findings were fixed on 2026-07-10 (three in the first pass, four more found
while closing out Phase 4). Their regression tests live beside the functions and fail
against the pre-fix handlers:
`deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/`.

What remains open below is **configuration**, not code: two secrets to generate and the
cron schedule to install.

- [x] **CRITICAL — `mpesa-callback` was an unauthenticated payment bypass.**
      `verify_jwt = false` has to stay (Safaricom cannot send a Supabase JWT), so
      authentication is now a shared secret: `mpesa-stk-push` bakes `MPESA_CALLBACK_SECRET`
      into the `CallBackURL` it registers, and the handler compares it in constant time.
      It also cross-checks the paid `Amount` against `subscriptions.amount_kes`, records
      the `MpesaReceiptNumber` (now `UNIQUE`, a second replay guard), and refuses to settle
      a subscription that is not `pending_payment`. An unauthenticated caller gets `401`
      and never reaches the database; with no secret configured the handler fails closed
      with `503` rather than guessing whether a caller is Safaricom.
- [x] **HIGH — `moderate-reviews` was prompt-injectable.** The review body is wrapped in a
      `<review_body>` tag the system prompt declares to be data, the tag is stripped from
      the body itself, and the model must answer through a **forced tool call** — the
      free-text JSON scraping that let a body supply its own verdict is gone. An
      independent `publishGate()` runs in code **before** the model sees the body and
      forces `flagged` on URLs, contact details, over-length, and injection markers, so no
      single model response can promote a review.
- [x] **MEDIUM — `submit-review` rate limit was spoofable.** Now takes the **last**
      `x-forwarded-for` hop (the one Supabase's edge appends, which a client cannot forge)
      and adds two limits bound to the authenticated `auth.uid()`: 3 reviews per user per
      24h, and 1 review per business per 30 days. Backed by a new composite index.
- [x] **HIGH — `mpesa-stk-push` could ring any phone in Kenya.** `verify_jwt = false` and no
      limits: a stranger could POST a phone number and make Safaricom push a payment prompt
      to it, on our Daraja credentials, while writing `pending_payment` rows for arbitrary
      `business_id`s. Now: **`MPESA_ENABLED` defaults to off** (503 before any parsing, DB
      call, or Daraja call — the guide's "gate it behind config and don't block launch on
      it"); when on, a per-IP limit (5/hour) and a **per-phone limit counted across every
      IP** (3/hour), because the person harmed is the one holding the phone and an attacker
      has as many IPs as they like. The phone is bucketed under an HMAC keyed by
      `MPESA_CALLBACK_SECRET`, so `rate_limits` never stores a subscriber's number. The
      `business_id` must be a uuid naming an `active` business.
- [x] **HIGH — `send-onboarding-email` was an open mail relay.** `verify_jwt = false` and no
      caller check: anyone could POST a recipient and an attacker-chosen `businessName` and
      have it delivered, signed and aligned, from our verified sending domain. Now gated on
      `INTERNAL_FUNCTION_SECRET`.
- [x] **HIGH — `ask-karibu` was a public, unmetered LLM proxy.** Public by design, but every
      call spends Anthropic tokens on our key, and there was no rate limit — a `for` loop
      was a bill. Now metered at 60 turns per IP per hour, checked **before** the model is
      reached. Loose on purpose: Kenyan mobile traffic is heavily CGNAT'd, so an "IP" can be
      a whole neighbourhood. The hard cost ceiling belongs in Anthropic's spend limits.
- [x] **MEDIUM — the cron functions were publicly invokable.** `moderate-reviews` and
      `calculate-rankings` run with the service role: one spends Anthropic tokens and
      rewrites `reviews`, the other rewrites `ranking_score` on every active business and
      can unlist them. Both now require an `x-karibu-internal-secret` header compared in
      constant time against `INTERNAL_FUNCTION_SECRET`, and **fail closed** (503) when it is
      unset. `verify_jwt = true` would *not* have fixed this: the anon key is a valid JWT
      that ships in the browser bundle, so it authenticates every visitor.
- [ ] **Set `MPESA_CALLBACK_SECRET`** (`openssl rand -hex 32`) as a Supabase edge-function
      secret alongside the M-Pesa credentials. Both `mpesa-stk-push` and `mpesa-callback`
      refuse to run without it, by design.
- [ ] **Set `INTERNAL_FUNCTION_SECRET`** (`openssl rand -hex 32`) as an edge-function secret
      **and** as a Vault secret named `internal_function_secret`, so the pg_cron jobs can
      present it. Rotating one means rotating both. See `SUPABASE_SETUP.md`.
- [ ] **Schedule the crons** (`pg_cron` + `pg_net`, SQL in `SUPABASE_SETUP.md`). Not a
      migration: a migration is committed to git, and the secret would go with it.
- [ ] **Residual prompt-injection risk in `moderate-reviews`.** The gate and the forced
      tool call mean a review cannot publish *itself*. A body that slips past the gate
      could still argue the model into a wrong verdict on the five axes — the blast radius
      is one wrongly-published review, not arbitrary output. Revisit if abuse appears.
- [ ] **Confirm the Anthropic model string before go-live.** `ask-karibu` and
      `moderate-reviews` both pin `claude-sonnet-4-6`, which is current and valid. Newer
      Sonnet models exist; changing it is a deliberate decision, not a security fix.

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
