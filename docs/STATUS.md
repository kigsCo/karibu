# Karibu — Status Audit (2026-07-18)

> Read-only audit against `docs/KARIBU_SPEC.md`. Every claim cites file:line. Companion
> document: `docs/FIX_PLAN.md` (numbered tasks per gap, grouped by priority).

---

## 1. Executive summary

**Overall: ~45% of the spec's feature Definition of Done.** Of the 18 feature rows in
spec §6: **3 DONE, 9 PARTIAL, 6 MISSING.** The backend foundation (schema, RLS, grants,
edge-function code) is strong — roughly 85% of *its* scope is genuinely finished and
well-tested (66 Deno tests, 29 vitest tests, all passing). What's missing is the entire
authenticated half of the product (auth, saved places, onboarding, subscriptions checkout,
admin) plus the configuration that turns the deployed backend on.

**Migration stage (spec §4):** all 6 steps of the static→live migration are **done** —
client (`src/lib/supabase.js`), cities/categories in Context
(`src/context/ReferenceDataContext.jsx:94-103`), paginated listings
(`src/hooks/useBusinesses.js`), business detail by slug (`src/hooks/useBusinessDetail.js`),
Ask Karibu via `functions.invoke` (`src/pages/AskKaribuPage.jsx:39-47`), review submission
through `submit-review` (`src/pages/ReviewComposePage.jsx:56-92`) — plus guides beyond the
required six. **But the deployed backend is inert:** all 7 edge functions are live in the
cloud with **no secrets set and no cron schedules installed**
(`MIGRATION_CHECKLIST.md:198-199`, `SUPABASE_SETUP.md:52-53`), so in production today
Ask Karibu returns 500, reviews would never be moderated, and rankings are never computed.

### Top 5 risks, in plain language

1. **The backend is deployed but switched off.** No `ANTHROPIC_API_KEY`, no
   `INTERNAL_FUNCTION_SECRET`, no pg_cron jobs (`SUPABASE_SETUP.md:102-158` is SQL that
   was never run). Consequences chain: `ranking_score` is 0 on every row
   (`MIGRATION_CHECKLIST.md:136`), so the "Recommended" sort is arbitrary — and because
   the keyset cursor paginates on `ranking_score` alone
   (`src/hooks/useBusinesses.js:114`) while all scores are tied at 0, **page 2 of any
   list is empty**: at most 20 of the ~38 seeded businesses are ever reachable. Reviews
   submitted would sit in `pending_moderation` forever.
2. **Review capture is a polite lie.** There is no sign-in UI anywhere
   (`src/pages/ProfilePage.jsx` is a placeholder), `submit-review` requires a session
   (`supabase/config.toml:76-77`), so every review a real user writes is silently dropped
   after showing them "Thanks — your review is live" (`src/pages/BusinessPage.jsx:117-124`,
   `src/pages/ReviewComposePage.jsx:49-66`). Reviews are the product's ranking engine.
3. **Half the feature checklist doesn't exist**: search (stub,
   `src/pages/SearchPage.jsx`), saved places UI, auth, onboarding + verification pipeline,
   subscription checkout, admin tooling. The verification pipeline is the spec's stated
   core product feature.
4. **Zero observability, fragile hosting.** Sentry appears nowhere in `src/` or
   `supabase/functions/` (grep: 0 hits); the cloud project is on the **free plan**, which
   **pauses after 7 idle days** (`MIGRATION_CHECKLIST.md:140`) and has no backups. An
   outage would be invisible until a user reports it.
5. **Fabricated data is displayed as fact** — against the "trust is the product"
   guardrail: every business shows a hardcoded "Open · Closes 8pm" and "2.3 km away"
   (`src/pages/BusinessPage.jsx:143-152`), Discover's "Visitors are loving" rail is
   hardcoded (`src/pages/DiscoverPage.jsx:198-222`), and Ask Karibu's grounding directory
   **ignores the selected city** (`supabase/functions/ask-karibu/index.ts:74-79`) — a
   Mombasa visitor gets Nairobi salons presented as local.

---

## 2. Feature table (spec §6)

| # | Feature | Status | Evidence | What's missing |
|---|---|---|---|---|
| 1 | Cities | **DONE** | `migrations/20260601000001:17-26`, `20260622233557` (sort_order), seed:19, `ReferenceDataContext.jsx:94-99`, `CityPickerPage.jsx` | — |
| 2 | Categories | **DONE** | `migrations/...0001:28-47`, seed:31-114 (13 parents + sub_types + cuisine sub_types), `ReferenceDataContext.jsx:55-76,100-103` | — |
| 3 | Listings + 3 sorts | **PARTIAL** | Recommended sort live + keyset (`useBusinesses.js:102-116`) | "Top rated" is a client-side re-sort of the 20 loaded rows only (`CategoryPage.jsx:50`), not `ORDER BY rating DESC`. "Closest" is a no-op: sorts on `distanceKm` which live rows never carry (`CategoryPage.jsx:49`, `useBusinesses.js:53-55`); `businesses.location` is NULL on every row (`migrations/20260710170000` notes, seed:195-198). `loadMore` is returned by the hook (`useBusinesses.js:146-151`) but **no page ever calls it** — lists hard-cap at 20. Keyset cursor lacks the `id` tiebreaker (`useBusinesses.js:114` vs order at :107) — skips rows on tied scores, returns nothing when all scores are 0 (current prod state). |
| 4 | Business detail | **PARTIAL** | By slug + 20 published reviews (`useBusinessDetail.js:115-139`) | Select omits `email`, `website`, `gallery_image_urls` (`useBusinessDetail.js:118`); Call/WhatsApp/Directions/Website buttons have no handlers (`BusinessPage.jsx:156-171`); hardcoded "Open · Closes 8pm" + "2.3 km away" (`BusinessPage.jsx:143-152`); "See all N reviews" button dead (`BusinessPage.jsx:306-308`); hood/category rank badge computed from prototype constants (`BusinessPage.jsx:76-82`). |
| 5 | Search | **MISSING** | `SearchPage.jsx:6-52` is a static stub; suggestions navigate to category key `"salons"` which doesn't exist in the DB (`SearchPage.jsx:41`; seed categories use `beauty` etc.) | No `pg_trgm` or FTS query anywhere in `src/` — the GIN trigram index (`migrations/...0001:112`, rebuilt in `20260710170000`) is never used. Route `/search` is also unlinked from any nav (`src/CLAUDE.md` "Known gaps"). |
| 6 | Ask Karibu | **PARTIAL** | Edge proxy + key server-side (`ask-karibu/index.ts`), frontend `functions.invoke` (`AskKaribuPage.jsx:39-47`), ≤120-words prompt (`index.ts:97`), 60/IP/h rate limit before the model (`index.ts:61-71`) | Grounding query has **no city filter** — top 40 by ranking across all cities (`index.ts:74-79`); `city` only decorates the prompt text (`index.ts:96-97`). Conversation logging never fires: it's gated on `sessionId` (`index.ts:125`) and the frontend never sends one (`AskKaribuPage.jsx:42-46`; grep `sessionId` in src/ = 0 hits). No cap on `messages` count/length (`index.ts:43-45`) — unbounded input-token spend per request. Currently returns 500 in prod (no `ANTHROPIC_API_KEY` set). |
| 7 | Review capture | **PARTIAL** | Composer validates rating + ≥40 chars (`ReviewComposePage.jsx:33`), edge fn re-validates (`submit-review/index.ts:62-77`), per-IP 3/24h (`index.ts:18-19,136-146`), optimistic "awaiting moderation" UX (`BusinessPage.jsx:117-124`) | No banned-words check at submit time (spec row 7) — content checks only run at moderation (`_shared/moderation.ts:118-135`). **In practice no review persists**: requires a session (`config.toml:76-77`) and no auth flow exists; guest path is local-state only (`ReviewComposePage.jsx:56-66`, `LocalReviewsContext.jsx`). Frontend never sends `reviewer_fingerprint`. |
| 8 | Review moderation | **PARTIAL** | 5-axis forced-tool-call classification with injection defenses (`moderate-reviews/index.ts:48-83`, `_shared/moderation.ts`), publish-if-all-clean (`index.ts:202-229`), batch 50 (`index.ts:44`) | **Hourly cron never scheduled** (SQL only in `SUPABASE_SETUP.md:123-136`); team notification is a TODO (`index.ts:133-135`); no human queue for flagged reviews (no admin surface at all). |
| 9 | Anti-abuse limits | **PARTIAL** | 3/IP/24h (`submit-review/index.ts:18-19`), 3/user/24h (`:23,101-114`), 1/user/business/30d (`:24,116-134`), backing index (`migrations/20260710150000:37-38`) | Burst pause (10+ reviews in 4h) — nowhere (grep `burst` = 0 app hits). Fingerprint flag at 5+ — `reviewer_fingerprint` is stored (`submit-review/index.ts:161`) but never read, and never sent by the client. Sentiment–rating mismatch flag — not in the moderation axes or gate. |
| 10 | Ranking job | **PARTIAL** | Formula + exact weights implemented (`calculate-rankings/index.ts:44-56,160-195`); cached rating/review_count/recent_30d maintained by real trigger (`migrations/...0003:32-63`); `mv_category_stats` feeds the z-score (`...0003:94-103`) | **Nightly cron never scheduled** → `ranking_score`=0 everywhere. Engagement term hardcoded 0 — no `profile_views` tracking exists (`index.ts:180-181`). Update loop is one PostgREST round-trip per business (`index.ts:129-140`) — fine at ~100 rows, contradicts spec §7's "single batched UPDATE… seconds at 10,000". |
| 11 | 3.5★ improvement window | **PARTIAL** | `flag_low_rated_businesses` + `unlist_unimproved_businesses` (`migrations/...0003:68-85`) invoked nightly by calculate-rankings (`index.ts:150-154`) | Cron not scheduled; notify + refund on unlisting — nowhere. **Logic bug:** `improvement_until` is never cleared when a business recovers, so a business that recovered once and later dips below 3.5 is unlisted *immediately* — `flag_…` won't grant a new window (`improvement_until IS NULL` guard, :75) and `unlist_…` sees the stale past date (:82-84). |
| 12 | Saved places | **PARTIAL** | Table + owner-only RLS done (`migrations/...0001:203-208`, `...0002:58-62`, grants `20260710160000:76`) | Frontend entirely missing: `SavedPage.jsx` is a placeholder; the heart button is local `useState` (`BusinessPage.jsx:25,98-107`). Blocked on auth. |
| 13 | Guides | **DONE** | `useGuides`/`useGuideDetail` (`src/hooks/useGuides.js`), published-only RLS (`...0002:53-55`), block `body_json`, related businesses resolved + ordered (`useGuides.js:143-163`), ask_prompts mapped (:60), featured flag drives rails (`DiscoverPage.jsx:237`) | — |
| 14 | Auth | **MISSING** | Supabase Auth enabled in config (`config.toml:39-49`); client defaults persist sessions | No sign-in/sign-up UI anywhere in `src/` (ProfilePage is a placeholder); nothing calls `supabase.auth.signIn*`. Everything downstream (persisted reviews, saved places, merchant, checkout) is blocked on this. |
| 15 | Onboarding + verification | **MISSING** | Schema supports it (`status='pending'` default, `verified_at`, `owner_id` — `migrations/...0001:86-92`) | No intake form (`ForBusinessPage.jsx` is a static pricing screen, CTAs dead — no `functions.invoke` outside AskKaribu/ReviewCompose), no KRA/OTP/photo/human-review pipeline, no storage buckets configured at all (no PII handling exists because no PII is collected). Note: seed's 28 researched businesses are explicitly "CANDIDATE listings pending the team's own manual verification" yet seeded `status='active'` (`seed.sql:185-190`) — publicly listed as if verified. |
| 16 | Subscriptions + M-Pesa | **PARTIAL** | Backend done and well-tested: STK push with per-IP + cross-IP per-phone limits + `MPESA_ENABLED` gate (`mpesa-stk-push/index.ts:58-131`), idempotent source-verified callback (secret + constant-time compare `mpesa-callback/index.ts:57-67`; amount check :117-123; atomic `pending_payment` transition :130-149; UNIQUE receipt `migrations/20260710150000:20-27`); tier promotion :153-157 | No checkout UI (nothing invokes `mpesa-stk-push` from `src/`). Sandbox base URL + shortcode hardcoded (`mpesa-stk-push/index.ts:46-48`) — needs env-driven prod swap. Nothing ever expires an active subscription: no job checks `current_period_end`, so a lapsed subscriber keeps `tier='recommended'` forever. Secrets unset → both functions currently 503. |
| 17 | Transactional email | **PARTIAL** | `send-onboarding-email` implemented, internal-secret-gated, HTML-escaped (`send-onboarding-email/index.ts`) | **Nothing calls it** (grep across src/ + functions = 0 call sites; `mpesa-callback` doesn't trigger it on activation). No reminder emails. `RESEND_API_KEY` unset; `FROM` domain unverified (`index.ts:20-21`). |
| 18 | Admin tooling | **MISSING** | — | No approve/reject pending listings, no decision log, no flagged-review queue. Nothing in `src/` or `supabase/functions/`. MerchantDashboardPage is 100% mock data (`MerchantDashboardPage.jsx:9-43`). |

---

## 3. Spec contradictions (guardrails, §2 + §8 + §9)

**Guardrails that HOLD** (verified, not assumed):

- Anthropic key never touches the frontend: `dist/assets/*.js` greps **0** for `sk-ant`,
  `api.anthropic.com`, `service_role` (run on today's build). `src/` has no Anthropic call.
- RLS enabled on all 10 tables (`migrations/...0002:7-15`, `...0004:15`); API-role grants
  locked down deterministically (`20260710160000`); MV leak closed (:57-58); the
  `spatial_ref_sys` anon-writable hole was fixed by moving PostGIS to `extensions`
  (`20260710170000`).
- Backend-only functions fail closed on a missing secret (`_shared/internal-auth.ts:46-53`);
  `verify_jwt` semantics documented and correct per function (`config.toml:57-115`).

**Contradictions found:**

1. **Ask Karibu grounding ignores the selected city** — spec §6 row 6 requires "grounded
   directory for the **selected city**"; the query has no city join/filter
   (`ask-karibu/index.ts:74-79`).
2. **Conversation logging (spec §5) never happens** — gated on a `sessionId` the frontend
   never sends (`ask-karibu/index.ts:125`; no `sessionId` anywhere in `src/`).
3. **Hardcoded data presented as live**, against §2.1's spirit and §6: "Visitors are
   loving" rail (`DiscoverPage.jsx:198-222`), fabricated open-status/distance
   (`BusinessPage.jsx:143-152`), illustrative rating distribution shown when reviews
   aren't live (`BusinessPage.jsx:68-74`), mock merchant dashboard
   (`MerchantDashboardPage.jsx:9-43`), fake search suggestions targeting a nonexistent
   category (`SearchPage.jsx:41`).
4. **CI doesn't run the unit tests** — spec §9 requires "npm ci, lint, build, unit tests";
   the vitest step is commented out with "add when you have tests"
   (`.github/workflows/deploy.yml:23`) while 29 tests exist and pass. (Deno edge tests DO
   run in CI, `deploy.yml:28-41`.)
5. **Production plan mismatch** — spec §3 names Supabase Pro; project is on the free plan,
   which pauses after 7 idle days (`MIGRATION_CHECKLIST.md:140`).
6. **Crons required by §5 are not installed** — hourly moderation, nightly rankings exist
   only as un-run SQL in `SUPABASE_SETUP.md:102-158`.
7. **Sentry + Plausible (§1 stack) absent** — zero references in application code;
   `SENTRY_DSN` documented in `.env.example` but read by nothing.
8. **Environments (§9: dev/staging/prod)** — one cloud project exists; no staging;
   `.env` still points at local, `.mcp.json` carries `YOUR_PROJECT_REF`
   (`MIGRATION_CHECKLIST.md:131-134`).
9. **Unverified listings live** — 28 research-sourced candidates seeded `status='active'`
   pre-verification (`seed.sql:185-190`), against §2/"verification is the product".
10. **Ranking at scale (§7)** — per-row HTTP updates instead of one batched UPDATE
    (`calculate-rankings/index.ts:129-140`); acceptable at 100 businesses, not at 10k.
11. **Schema (§8)** — matches closely; one drift: no `profile_views` source exists, so the
    formula's engagement term (weight 0.10) is permanently 0 (`calculate-rankings/index.ts:180-181`).

---

## 4. Can it serve 5,000 users? (spec §3)

### Load model (assumptions stated)

| Assumption | Value | Basis |
|---|---|---|
| Monthly visitors | 5,000 | spec §3 |
| Sessions/month | ~6,000 | ~20% return once |
| Peak-day sessions | ~300 | ~200/day avg × 1.5 weekend factor |
| Peak-hour sessions | ~60 | ~20% of a peak day in the evening hour |
| Peak concurrent users | ~5–10 | 60 sessions/hr × ~5 min avg ÷ 60 |
| API requests | ~24/session → sustained **~0.4 rps**, bursts 5–10 rps | ~8 views × ~3 PostgREST queries |
| Ask Karibu | 2,000/mo → ~65/day, **~10–15/hour peak** | spec §3 |
| Reviews | ~5–10/day (≈2% of sessions) | directory-app norm |
| Data volume | ~100 businesses, <10k reviews/yr, DB well under 100 MB | spec §3 |

At these numbers **raw capacity is a non-issue** — a single free-tier Postgres would idle
through this load. Every real risk is correctness, configuration, or cost, not throughput.

### Verdicts per area

**1. Database — READY, two correctness bugs and one unscheduled job.**
Indexes match the actual queries: list reads hit `idx_businesses_active_rank_id`
(`useBusinesses.js:102-108` ↔ `migrations/...0001:115`), detail by unique slug, reviews by
`idx_reviews_recent` (`useBusinessDetail.js:131-139` ↔ `...0001:153`), moderation queue by
partial status index (`...0001:154`), rate-limit lookups by `idx_rate_limits_ip_key_time`.
No N+1s (one query + embeds per screen; guide related-businesses is a single `IN` fetch,
`useGuides.js:145-151`). No unbounded selects on hot paths (guides list is unpaginated but
editorial-small and excludes `body_json`, `useGuides.js:28-29`). Cached
rating/review_count/recent_30d **are** trigger-maintained (`...0003:61-63`) —
but `ranking_score` is cron-only and the cron doesn't exist, so it is silently stale at 0
today. RLS predicates are simple equalities and will stay fast at 100× this volume.
Defects: keyset tiebreaker bug (feature row 3), `improvement_until` never cleared (row 11),
`prune_rate_limits()` exists (`...0004:20-23`) but nothing schedules it.

**2. Edge functions — code READY, config NOT.**
Input validation on every function (weakest: `ask-karibu` accepts unbounded `messages`,
`index.ts:43-45`). Rate limiting before every costed call: ask-karibu 60/IP/h before
Anthropic (`index.ts:61-71`); STK push 5/IP/h + 3/phone/h across all IPs with the phone
HMAC-bucketed (`mpesa-stk-push/index.ts:109-131`); limiter records-then-counts to shrink
the race window and fails open by design, documented (`_shared/ratelimit.ts:33-52`).
CORS centralized (`_shared/cors.ts`). `mpesa-callback` idempotency is genuinely solid:
shared-secret auth in constant time, amount verification, atomic
`.eq("status","pending_payment")` transition, plus a UNIQUE receipt column as a second
replay guard — a twice-delivered callback cannot double-activate
(`mpesa-callback/index.ts:57-149`, `migrations/20260710150000:20-27`; regression tests in
`mpesa-callback/index.test.ts`). Fire-and-forget log write handles its own error
(`ask-karibu/index.ts:125-137`) — but never runs (no sessionId). Gaps: **no explicit
timeouts** on the Anthropic/Daraja fetches (a hang holds the function to the platform
kill); ask-karibu city filter missing (confirmed above); moderation throughput 50/hour is
ample at ~10 reviews/day.

**3. Secrets & security — architecture READY, operations NOT.**
Anon key only in frontend (verified in `dist/`); service-role key and `ANTHROPIC_API_KEY`
exist only in edge-function env reads (`_shared/client.ts:24-30`). Admin surfaces: none
exist, so nothing to protect yet (merchant dashboard is mock, leaks nothing). Anti-abuse:
3 of 5 spec'd limits real (see row 9). PII buckets: N/A — onboarding is unbuilt, no
storage buckets configured, no PII collected. Operational gaps: none of the secrets are
actually set in the cloud project (functions fail closed — safe but dead), and
`INTERNAL_FUNCTION_SECRET` is missing from `.env.example`'s documented list.

**4. Frontend — MARGINAL for 3G, fine for 4G.**
Bundle: one 527.6 kB chunk (147 kB gzip), **no code splitting** (no `React.lazy` in src;
Vite warns at build). On a 512 kbps 3G link that's ~10–15 s to interactive, cushioned by
the service worker after first visit (`public/sw.js` — sensible network-first shell +
cache-first hashed assets). Images: all heroes are inline SVG components
(`HeroImage.jsx`) — near-zero image bytes (great for 3G, but also means no real photos
anywhere, incl. the spec'd gallery). Fonts: Google Fonts imported **twice**
(`src/index.css:1` and `GlobalStyles.jsx:3`) from a third-party origin the SW won't cache.
Cities/categories: correctly fetched once into Context (`ReferenceDataContext.jsx:84-129`).
Loading/error/empty: the fallback-first contract keeps every screen rendering offline —
genuinely good resilience — but most screens *silently* show prototype constants on error
(only AskKaribu renders an error state, `AskKaribuPage.jsx:161-171`), so a broken backend
is indistinguishable from a working one. Worst honesty gap: the guest-review flow
(risk #2).

**5. Cost & limits — WITHIN BUDGET, one cap needed.**
Ask Karibu per query: system prompt ≈ 1,100 tokens (40 listings × ~25 + instructions,
`ask-karibu/index.ts:89-97`) + history ≈ 1,400 input, ~160 output (120-word replies,
`max_tokens: 1024`). 2,000 queries/mo ⇒ ~2.8M input × $3/M + ~0.32M output × $15/M ≈
**$13/mo**; moderation adds <$1 at ~150–300 reviews/mo. Total Anthropic ≈ **$14–20/mo** —
inside the ~$45 infra budget with Supabase Pro ($25). Caveat: message history is uncapped
both client-side (`AskKaribuPage.jsx:28`) and server-side, so one long conversation (or
one abuser inside the 60/h limit sending 190k-char payloads) inflates input cost —
cap it. Supabase: at this load, egress (<1 GB/mo — SVG heroes, JSON), DB size (<100 MB),
and function invocations (~10k/mo) are all trivially inside even the free tier; the
binding constraints are the free tier's **7-day pause** and **no backups**, both fixed by
Pro.

**6. Operations — NOT READY.**
Sentry: not wired, frontend or functions (grep: 0 app hits). Crons: `moderate-reviews`
hourly, `calculate-rankings` nightly (which also runs the 3.5★ window helpers and MV
refresh) exist **only as SQL snippets in `SUPABASE_SETUP.md:102-158`** — `cron.job` is
empty. No `prune_rate_limits` schedule. Backups: none on free plan; the spec's weekly
restore drill (§10) is impossible today. No spend alerting, no moderation-backlog
monitoring, no M-Pesa success-rate tracking.

### Bottom line

With ~2 days of configuration + the P0 code fixes in `docs/FIX_PLAN.md`, the current
**read-only visitor experience** (browse, detail, guides, Ask Karibu) would serve 5,000
monthly users comfortably. The **full spec** — reviews that persist, verification,
subscriptions, admin — is weeks away, gated primarily on auth (task 8) and the missing
feature surfaces (tasks 17–24).

---

## 5. Quality signals (run 2026-07-18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 6 warnings (react-refresh context exports, 2 hook deps, 1 unused var) |
| `npm run build` | ✅ 6.3 s — `index-DE74lpwK.js` 527.59 kB (gzip 147.07 kB), chunk-size warning |
| `npm run test` (vitest) | ✅ 29/29 across 9 files |
| `deno test supabase/functions/` | ✅ 66/66 |
| Bundle secret grep (`sk-ant`, `api.anthropic.com`, `service_role`) | 0 matches |
