# Karibu — Fix Plan (2026-07-18)

> Companion to `docs/STATUS.md` (the audit that found each gap; citations live there).
> Tasks are numbered and ordered so each priority group can be handed to a follow-up
> session as-is. Effort: S ≈ ≤half a day · M ≈ 1–2 days · L ≈ 3–5 days · XL ≈ a week+.

---

## P0 — Launch blockers (a feature can't work, or a security/cost hole)

### 1. Set the cloud edge-function secrets — S (config, no code) ⏳ MANUAL — needs your dashboard access
- **Status (2026-07-18):** Cannot be done from here (requires the Supabase dashboard +
  generating/holding real secret values). Runbook is ready — see the "MANUAL STEPS" report.
  Note: `.env.example` could not be edited from this session (env-file access is blocked by
  a local permission guard) — add the `INTERNAL_FUNCTION_SECRET` doc line by hand; the value
  belongs ONLY in Supabase edge-function secrets + Vault, never in `.env`/`VITE_*`.
- **What:** In the Supabase dashboard (project `jwiptjcpczamewmyaost`) set
  `ANTHROPIC_API_KEY`, `INTERNAL_FUNCTION_SECRET` (`openssl rand -hex 32` — also store it
  as a Vault secret named `internal_function_secret` for task 2), and `RESEND_API_KEY`.
  Defer `MPESA_*` until Daraja merchant approval (functions stay safely 503 without them).
- **Files:** none (dashboard). Update `.env.example` to document `INTERNAL_FUNCTION_SECRET`
  (it's currently absent from the secrets list), and tick the boxes in
  `MIGRATION_CHECKLIST.md:198-199` / `SUPABASE_SETUP.md:52-53`.
- **Verify:** `curl` ask-karibu with a one-turn message → 200 with content; moderate-reviews
  with the header → 200; without → 401 (not 503).

### 2. Install the cron schedules — S (config, no code) ⏳ MANUAL — needs your cloud SQL editor
- **Status (2026-07-18):** Cannot be run from here (modifies the live cloud project; depends
  on #1's secret). Runbook is now COMPLETE: added the third job (`prune-rate-limits-nightly`,
  `30 0 * * *`, a direct `select prune_rate_limits();` — no pg_net) to
  `SUPABASE_SETUP.md` alongside the two function crons. Run that whole block once in the
  cloud SQL editor; `select jobname, schedule, active from cron.job;` should then show 3 rows.
- **What:** Run the pg_cron + pg_net + Vault SQL already written in
  `SUPABASE_SETUP.md:102-158` against the cloud project: `moderate-reviews-hourly`
  (`0 * * * *`), `calculate-rankings-nightly` (`0 0 * * *`). Add a third job for
  `SELECT prune_rate_limits();` nightly (function exists,
  `supabase/migrations/20260601000004_rate_limits.sql:20-23`, nothing calls it).
- **Verify:** `select jobname, schedule, active from cron.job;` shows 3 rows; after the
  nightly run, `select count(*) from businesses where ranking_score <> 0` > 0; a test
  pending review flips to published/flagged within the hour.

### 3. Fix the keyset-pagination tiebreaker and wire `loadMore` — M ✅ DONE (2026-07-18)
- **Done:** `useBusinesses` cursor is now composite `{score,id}`, filtered with
  `.or(ranking_score.lt.<s>,and(ranking_score.eq.<s>,id.lt.<id>))` to match the
  `(ranking_score DESC, id DESC)` order; `CategoryPage` calls `loadMore` via an
  invisible IntersectionObserver sentinel (no visible UI added). New vitest
  `src/hooks/useBusinesses.test.js` asserts the page-2 composite filter and
  no-dup/no-gap stitching with all-equal scores. Lint clean, 30 vitest pass, build ok.
- **What:** The cursor filters `lt("ranking_score", cursor)` only
  (`src/hooks/useBusinesses.js:113-114`) while ordering by `(ranking_score DESC, id DESC)`
  (:106-107). Ties spanning a page boundary are skipped; with all scores equal (today's
  prod state) page 2 is empty. Make the cursor composite — keep `{score, id}` in
  `cursorRef` and filter with PostgREST
  `.or(`ranking_score.lt.${score},and(ranking_score.eq.${score},id.lt.${id})`)`.
  Then actually call `loadMore` from `CategoryPage` (sentinel div + IntersectionObserver,
  or a "Show more" button — the hook contract at `useBusinesses.js:146-151` already
  supports it; currently **no page calls it**, so lists hard-cap at 20).
- **Files:** `src/hooks/useBusinesses.js`, `src/pages/CategoryPage.jsx`.
- **Verify:** with `ranking_score` uniformly 0 (fresh `db reset`, cron not yet run), a
  category with >20 rows pages through all of them with no duplicates/gaps (add a vitest
  with a mocked supabase client asserting the page-2 filter).

### 4. Filter the Ask Karibu grounding directory by the requested city — S ✅ DONE (2026-07-18)
- **Done:** `ask-karibu` now validates `city` against the 5 launch slugs (unknown →
  nairobi, which also closes the prompt-injection vector), grounds the directory with
  an `.eq("city.slug", city)` inner-join embed, and when the city has no listings the
  prompt says so instead of surfacing another city's businesses. 4 new Deno tests
  (mombasa→empty+honest, unknown→nairobi, + the two task-5 bounds). deno check + 70 tests pass.
- **What:** `supabase/functions/ask-karibu/index.ts:74-79` selects the top 40 active
  businesses across **all** cities; spec §6 row 6 requires the selected city. Validate
  `city` against the known slugs (reject or default to `nairobi` otherwise — it is also
  interpolated into the system prompt unsanitized, :96-97), then add
  `.eq("cities.slug", city)` via an inner join embed (mirror the pattern in
  `src/hooks/useBusinesses.js:98-110`).
- **Files:** `supabase/functions/ask-karibu/index.ts` (+ its test file).
- **Verify:** Deno test: request with `city: "mombasa"` grounds on 0 businesses (seed is
  all-Nairobi) and the prompt says so; `city: "nairobi"` grounds on Nairobi rows only.

### 5. Cap Ask Karibu input and send a sessionId (cost hole + dead logging) — M ✅ DONE (2026-07-18)
- **Done:** Server bounds `messages` to ≤20 turns, ≤2,000 chars/turn, role whitelist
  `user|assistant`, non-empty string content — rejected 400 before the rate-limiter or
  the model. Client (`AskKaribuPage`) now generates a per-tab `sessionId`
  (sessionStorage, in-memory fallback) and sends it, so the `ai_conversations` insert
  fires; client history is trimmed to the last 20 turns to match the cap. Deno tests:
  21-turn → 400, oversized turn → 400 (both prove Anthropic is never reached).
- **Post-review fix:** the client history trim now drops any leading assistant turn so
  the sent window always starts with a user message (Anthropic rejects assistant-first
  arrays). New vitest `AskKaribuPage.test.jsx` asserts a non-empty sessionId is sent and
  an 11-turn conversation stays ≤20 turns and user-first.
- **What:** Server: bound `messages` (e.g. ≤20 turns, ≤2,000 chars/turn, role whitelist
  `user|assistant`, string content only) in `ask-karibu/index.ts:43-45` — today one
  request inside the 60/h limit can carry unbounded input tokens. Client: generate a
  session id once (`crypto.randomUUID()` in module scope or sessionStorage) and send it
  (`src/pages/AskKaribuPage.jsx:42-46`) so the `ai_conversations` insert
  (`ask-karibu/index.ts:125-137`) stops being dead code; optionally trim client history to
  the same cap.
- **Verify:** Deno test: 21-turn payload → 400; oversized turn → 400. Manual: one chat
  turn → a row in `ai_conversations`.

### 6. Ship a minimal auth flow — L ✅ DONE (2026-07-18)
- **Done:** New `src/context/AuthContext.jsx` (session state via `getSession` +
  `onAuthStateChange`, `AuthProvider` added to `App.jsx`). Real `ProfilePage`:
  signed-out → passwordless email sign-in via `supabase.auth.signInWithOtp` (magic
  link, `emailRedirectTo` origin — no dashboard template change needed) with a
  "check your inbox" state; signed-in → email + Sign out. Composer is session-aware
  (see #7). Visual language reused throughout (no new palette/type). 4 new vitest
  (ProfilePage x2, ReviewComposePage auth x2); 34 vitest + build pass. NOTE: adds one
  more benign `react-refresh` context warning identical to the 3 existing context
  files (lint cleanup is task 30). MANUAL: enable an email provider / SMTP in Supabase
  Auth so links actually send (see report).
- **What:** Everything user-owned is blocked on this (persisted reviews, saved places,
  merchant, checkout). Minimum: email OTP/magic-link via `supabase.auth.signInWithOtp`,
  a real `ProfilePage` (signed-out → sign-in form; signed-in → email + sign-out), and a
  session-aware review composer. Keep the visual language; this is the one place new UI
  is unavoidable — smallest possible surface.
- **Files:** `src/pages/ProfilePage.jsx`, new `src/context/AuthContext.jsx` (or hook),
  `src/pages/ReviewComposePage.jsx`.
- **Verify:** sign in → submit review → row lands in `reviews` as `pending_moderation`
  with `reviewer_id = auth.uid()`; signed-out submit prompts sign-in instead of lying.

### 7. Make the guest-review UX honest — S (interim until task 6 lands) ✅ DONE (2026-07-18)
- **Done:** With auth shipped (#6) the composer no longer fabricates persistence for
  signed-out users: it shows an honest "you're not signed in" notice and the primary
  CTA becomes "Sign in to post review", which routes to `/profile` instead of adding a
  local review and lying. The `BusinessPage` "review posted" banner copy changed from
  "your review is live" to "your review is in … once it clears moderation" (accurate:
  it's `pending_moderation`, and the banner now only fires for signed-in posts).
  Covered by the new `ReviewComposePage.auth.test.jsx`.
- **What:** `ReviewComposePage.jsx:49-66` shows success and `BusinessPage.jsx:117-124`
  says "your review is live" even when nothing was persisted (no session → silent drop
  with a console.warn). Until auth ships: either gate the composer behind "sign in to
  post" messaging or change the banner copy to say the review is only on this device.
  This is a trust product; don't fabricate persistence.
- **Verify:** signed-out flow never claims the review is live/moderated.

### 8. Fix the improvement-window re-flag bug — S ✅ DONE (2026-07-18)
- **Done:** New migration `20260718000000_fix_improvement_window_reset.sql` replaces
  `flag_low_rated_businesses` so it FIRST clears `improvement_until` for recovered
  (rating ≥ 3.5) businesses, then grants fresh windows to those still < 3.5 — so a
  re-dip earns a new 60-day grace instead of instant unlisting. `unlist_…` unchanged;
  the nightly job already runs flag before unlist. New pgTAP test
  `supabase/tests/improvement_window_test.sql` (recover→dip→fresh window→not unlisted,
  + expiry control). Verified locally: `supabase db reset` applied all 11 migrations
  clean, `supabase test db` → 11/11 pass.
- **Post-review fix:** the `CREATE OR REPLACE` now declares `SET search_path = public,
  pg_temp` INLINE — a plain replace resets proconfig and would have silently dropped the
  pin migration `20260710160000` applied, re-triggering the `function_search_path_mutable`
  advisor. Verified via `pg_proc.proconfig` after `db reset`: the pin is present and
  matches the untouched `unlist_unimproved_businesses`.
- **What:** `improvement_until` is never cleared on recovery
  (`supabase/migrations/20260601000003_functions_triggers_views.sql:68-85`): a business
  that recovered ≥3.5 keeps its stale past-dated window, so a later dip unlists it
  instantly with no new 60-day grace. New migration: replace the helpers —
  `flag_…` also clears `improvement_until` where `rating >= 3.5` (recovered), and only
  then sets new windows; keep `unlist_…` as-is.
- **Files:** new `supabase/migrations/2026…_fix_improvement_window_reset.sql` (never edit
  the shipped one). Use the `supabase-migration` skill.
- **Verify:** SQL test in `supabase/tests/`: recover → dip → gets a fresh window, not
  unlisted.

### 9. Run the frontend tests in CI — S ✅ DONE (2026-07-18)
- **Done:** Replaced the commented `# - run: npm run test:unit` with `- run: npm run test`
  (the real script name; `vitest run`, one-shot) in the `test` job of
  `.github/workflows/deploy.yml`. Confirmed `npm run test` → 34/34 locally. CI will now
  run vitest on every push/PR (verify the green step on the next CI run).
- **What:** `.github/workflows/deploy.yml:23` has the unit-test step commented out
  ("add when you have tests") — 29 vitest tests exist. Add `- run: npm run test` to the
  `test` job.
- **Verify:** CI run shows the vitest step green.

---

## P1 — Required to serve 5,000 users reliably

### 10. Upgrade the Supabase project to Pro — S (money + config)
- **What:** Free plan pauses after 7 idle days (`MIGRATION_CHECKLIST.md:140`) and has no
  backups; spec §3 names Pro ($25/mo) as the production plan. Also transfer the project
  to the Kigs Apex org (`MIGRATION_CHECKLIST.md:138`) and point `.env` / `.mcp.json`
  (`YOUR_PROJECT_REF` placeholder) at the cloud project.
- **Verify:** plan shows Pro; daily backups visible; one restore-to-scratch drill done
  (spec §10).

### 11. Wire Sentry (frontend + edge functions) — M
- **What:** Nothing reads `SENTRY_DSN` anywhere. Frontend: `@sentry/react` init in
  `src/main.jsx` (DSN via `VITE_SENTRY_DSN` — public by design), ErrorBoundary around
  `AppRoutes`. Functions: Sentry's Deno SDK (or minimal fetch-based capture in
  `_shared/`) reading `SENTRY_DSN`, wrapping each handler's catch paths.
- **Verify:** a thrown test error appears in Sentry from both surfaces.

### 12. Real search — L
- **What:** `SearchPage.jsx` is a stub whose suggestions navigate to a nonexistent
  `salons` category (:41). Implement: debounced query → `businesses` name search using
  the trigram index (`.ilike('name', %q%)` or an `rpc` using `similarity()`), scoped to
  active + selected city, keyset-paginated, rendered with the existing list-card visual;
  link the page from the UI (it is currently unreachable — `src/CLAUDE.md` "Known gaps";
  resolve task 20's pending decision).
- **Files:** `src/pages/SearchPage.jsx`, possibly a small `search_businesses` SQL function
  in a new migration for ranked trigram search.
- **Verify:** typing "posh" surfaces Posh Palace from the DB; empty result shows an honest
  empty state; `EXPLAIN` uses `idx_businesses_name_trgm`.

### 13. Complete the business-detail data path — M
- **What:** (a) add `email, website, gallery_image_urls` to the detail select
  (`src/hooks/useBusinessDetail.js:118`); (b) give the four action buttons real handlers
  (`BusinessPage.jsx:156-171`): `tel:`, `wa.me/<whatsapp>`, Google-Maps directions URL,
  `website` — hide a button when the field is null; (c) delete the fabricated
  "Open · Closes 8pm" and "2.3 km away" (`BusinessPage.jsx:143-152`) — render hours from
  `hours_json` when present, nothing otherwise; (d) drop or live-source the
  constants-derived rank badge (:76-82).
- **Verify:** a business with only a phone shows Call alone and no invented open state;
  vitest updated (`BusinessPage.services.test.jsx` pattern).

### 14. Honest sorts: server-side "Top rated", remove or implement "Closest" — M
- **What:** "Top rated" re-sorts only the loaded page (`CategoryPage.jsx:50`) — add a
  `sort` option to `useBusinesses` (`order("rating", …)` + matching keyset cursor and a
  partial index if needed). "Closest" sorts on a field that never exists (:49) over a
  `location` column that is NULL on every row — either hide the chip until geolocation +
  geocoded seed data exist, or implement a PostGIS `rpc` (`ST_Distance` ordered, GiST
  index already in place) fed by browser geolocation.
- **Verify:** switching sorts changes the query (network tab), not just the loaded array.

### 15. Subscription lifecycle + activation email — M
- **What:** (a) nothing expires subscriptions: add a nightly step (inside
  calculate-rankings or a SQL helper it calls) that marks `active` subs `past_due` when
  `current_period_end < now()` and reverts `businesses.tier` to `free` after a grace
  period; (b) on successful activation, `mpesa-callback` should invoke
  `send-onboarding-email` (service-to-service with `x-karibu-internal-secret`) — today the
  email function has zero call sites; (c) make the Daraja base URL + shortcode env-driven
  (`mpesa-stk-push/index.ts:46-48` hardcodes sandbox) so go-live is a secret change, not
  a code change.
- **Verify:** Deno tests: expired sub → past_due + tier downgrade; activation → email fn
  called once (mock fetch); `MPESA_BASE_URL` env respected.

### 16. Moderation completeness: notify + flagged queue — L
- **What:** (a) implement the Slack/webhook notification TODO
  (`moderate-reviews/index.ts:133-135`) so flagged reviews reach a human (env
  `MODERATION_WEBHOOK_URL`, fire-and-forget); (b) a minimal human queue — smallest viable:
  a documented SQL runbook in `docs/OPERATIONS.md` + Supabase Studio saved queries;
  better: a tiny internal admin page (see task 24).
- **Verify:** flag a test review → webhook fires; runbook queries list/publish/reject work.

### 17. Finish the spec'd anti-abuse set — M
- **What:** In `moderate-reviews` (data is all server-side): (a) burst pause — if a
  business received 10+ reviews in 4h, hold its pending reviews as `flagged`
  (`coordinated`) instead of publishing; (b) fingerprint — flag when
  `reviewer_fingerprint` has 5+ reviews in the window (field stored at
  `submit-review/index.ts:161`, never read); frontend must actually send a fingerprint
  (simple canvas/UA hash) in `ReviewComposePage.jsx:70-82`; (c) sentiment–rating
  mismatch — add a sixth boolean axis to the classify tool
  (`moderate-reviews/index.ts:48-70`) comparing body sentiment to the star rating; flag on
  mismatch.
- **Verify:** Deno tests for each rule with synthetic review sets.

### 18. Frontend performance for 3G — M
- **What:** (a) route-level code splitting: `React.lazy` each page in `src/routes.jsx` +
  a suspense fallback matching the existing loading style; add `manualChunks` for
  react/router/supabase vendors (single 527 kB chunk today); (b) self-host the two font
  families (`@fontsource/instrument-serif`, `@fontsource/plus-jakarta-sans`) and delete
  the duplicate Google `@import` (`src/index.css:1` AND
  `src/components/GlobalStyles.jsx:3`) — third-party origin the SW can't cache;
  (c) keep an eye on the icon import surface (lucide is tree-shaken, fine).
- **Verify:** `npm run build` emits per-route chunks, main chunk < 200 kB gz; no request
  to fonts.googleapis.com; Lighthouse mobile TTI improves.

### 19. Saved places end-to-end — M (depends on task 6)
- **What:** Wire the heart (`BusinessPage.jsx:25,98-107`) to `saved_places`
  (insert/delete as the user; RLS already owner-scoped), and make `SavedPage.jsx` list
  saved businesses (join to active businesses, existing card visuals).
- **Verify:** save → row in `saved_places`; appears on /saved; unsave removes; RLS smoke:
  user A cannot read B's rows.

### 20. Reconcile the 28 unverified "candidate" listings — S (product decision + data)
- **What:** Seed comments admit these are candidates "pending the team's own manual
  verification" yet they ship `status='active'` (`seed.sql:185-190`) — live listings on a
  product whose promise is verification. Decide: flip to `pending` until verified, or
  accept and mark. Execute as a data migration on the cloud project.
- **Verify:** listing count in the app matches the deliberate decision; decision recorded
  in `docs/adr/`.

### 21. Ops runbook items — S each
- **What:** (a) Anthropic spend alert (console budget alert at ~$30); (b) uptime ping on
  the frontend + one edge function (any free monitor); (c) confirm the nightly cron ran
  each morning (spec §10 daily checklist) — `cron.job_run_details` query in
  `docs/OPERATIONS.md`.
- **Verify:** alerts fire on test thresholds; runbook steps executable as written.

---

## P2 — Nice-to-have (post-launch or scale-driven)

### 22. Onboarding + verification pipeline — XL
- **What:** The spec's row 15, currently 0%: intake form (`ForBusinessPage` CTAs are
  dead), `status='pending'` insert, KRA PIN regex + manual cross-check queue, phone OTP
  (Africa's Talking), location-pin/hood consistency, photo checks, human review ≤48h →
  `active` + `verified_at` → welcome email. **Private storage buckets** for KRA PINs /
  owner-ID scans with owner-only + service-role policies — the spec's PII requirement
  becomes real the day this form exists, so build buckets and policies first.
- **Progress:** Spine shipped (branch `feat/business-onboarding-spine`): intake form +
  claims + evidence storage + human review; OTP/iTax still open.
- **Follow-up (from final review):** storage-abuse posture for the onboarding buckets —
  cleanup cron for orphaned uploads + optional per-user object cap; direct-to-bucket
  uploads are currently unmetered. Implementation note (learned 2026-07-23): the cron
  must delete through the Storage API (service-role `storage.from(...).remove(paths)`
  in an edge function) — a `storage.protect_delete()` trigger blocks direct SQL
  deletes on `storage.objects`.
- **Verify:** end-to-end onboarding on staging: submit → pending (invisible to anon via
  existing RLS) → approve → active + email; bucket objects unreadable with the anon key.

### 23. Subscription checkout UI — M (depends on 6, 15, and Daraja approval)
- **What:** Business-owner flow from `ForBusinessPage` → pick tier → phone entry →
  `functions.invoke('mpesa-stk-push')` → poll subscription status. Flip
  `verify_jwt = true` on `mpesa-stk-push` and move to per-user limits once callers are
  authenticated (noted in `mpesa-stk-push/index.ts:32-33`).
- **Verify:** sandbox end-to-end: prompt on phone → callback → tier badge appears.

### 24. Minimal admin surface — L
- **What:** Internal-only page (or separate tiny app) for: pending-listing approve/reject
  with a decision log (new `admin_decisions` table), flagged-review queue
  (publish/reject), candidate-listing reconciliation. Auth-gated to staff emails; served
  by service-role edge functions with an admin allowlist — never the anon key.
- **Progress:** Minimal queue shipped at `/admin` (`profiles.is_staff` +
  `admin_decisions`).
- **Verify:** approve flow flips `pending → active` and logs who/when; non-staff get 403.

### 25. Merchant dashboard on real data — L (depends on 6)
- **What:** Replace the mock (`MerchantDashboardPage.jsx:9-43`) with the owner's business
  via `owner_id`, stats from `mv_business_review_stats` (service-role edge fn — the MV is
  deliberately revoked from client roles, `migrations/20260710160000:57-58`), and real
  recent reviews. Requires owner-claiming in onboarding (task 22).
- **Progress:** merchant dashboard live on real data (branch `feat/merchant-dashboard`) —
  owner listings via `owner_id`, `merchant-stats` fn (MV + live pending + trend),
  safe-fields self-editing via column-scoped grant; engagement analytics still open
  (needs an events pipeline).

### 26. Port calculate-rankings to one SQL UPDATE — M
- **What:** Needed before ~1,500+ businesses (year-1 spec): replace the per-row PostgREST
  loop (`calculate-rankings/index.ts:129-140`) with a single
  `UPDATE … FROM mv_category_stats` exposed as an `rpc`, per the note in the function
  header (:34-37).
- **Verify:** identical scores before/after on the seed; runtime < 5 s at 10k synthetic
  rows.

### 27. Profile-views tracking → engagement factor — M
- **What:** The formula's 0.10-weight engagement term is permanently 0
  (`calculate-rankings/index.ts:180-181`). Add a `profile_views_30d` counter (batched
  insert or a lightweight events table rolled up nightly) and feed it in.

### 28. Staging environment + migration promote flow — M
- **What:** Spec §9's dev/staging/prod: create a staging Supabase project, wire the
  `staging` branch deploy, document `supabase db push --linked` staging-first.

### 29. Error-state surfacing on silent screens — S
- **What:** Discover/Category/Guides swallow live-fetch errors into the fallback
  constants with no user-visible signal (e.g. `DiscoverPage.jsx` ignores `error`
  entirely). Add the toast/banner pattern AskKaribu already uses so a degraded backend is
  detectable.

### 30. Housekeeping — S
- **What:** Fix the 6 lint warnings (unused `go` in `AskKaribuPage.jsx:10`, hook deps);
  adopt React Router v7 future flags (test noise); update `SUPABASE_SETUP.md` /
  `MIGRATION_CHECKLIST.md` "not deployed" text to match the 2026-07-12 deploys
  (root `CLAUDE.md` already flags this); add Plausible (`VITE_PLAUSIBLE_DOMAIN` is
  documented, unused).

---

## Suggested sequencing

- **Session A (config day):** 1, 2, 10 — the backend switches on; rankings + moderation
  start running. Then 9 (CI tests).
- **Session B (correctness):** 3, 4, 5, 7, 8 — pagination, city grounding, cost cap,
  honest UX, window bug.
- **Session C (auth spine):** 6, then 19 — unlocks everything user-owned.
- **Session D (product completeness):** 12, 13, 14 — search + detail + sorts.
- **Session E (money + ops):** 15, 16, 17, 11, 18, 20, 21.
- **P2 as prioritized after launch.**
