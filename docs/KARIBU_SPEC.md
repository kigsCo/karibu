# Karibu — Build Spec & Definition of Done

> Distilled from the **Karibu Developer Deployment Guide v1.0 (April 2026, Kigs Apex Solutions)** for use by AI coding agents and engineers working in this repo. Where this file and the full guide disagree, the full guide wins. Where the guide and production disagree, production wins — then update the docs.

---

## 1. What Karibu is

A directory + AI guide for visitors to Kenya. Visitors browse **verified** local businesses (hotels, transport, beauty, restaurants — 13 categories) across 5 launch cities, read reviews and editorial guides, and ask the **Ask Karibu** AI assistant for grounded recommendations. Businesses onboard through a verification pipeline and can pay for **Verified** (KSh 2,500/mo) or **Recommended** (KSh 7,500/mo) tiers via M-Pesa.

**Architecture (intentionally simple — one frontend, one backend, one third-party API):**

- Frontend: React + Vite + Tailwind, static + edge cached (Vercel / Netlify / Cloudflare Pages)
- Backend: **one Supabase project** — Postgres (with RLS), Auth, Storage, Deno Edge Functions
- AI: Anthropic API, model `claude-sonnet-4-6`, called **only** from the `ask-karibu` edge function
- Payments: M-Pesa Daraja (STK push + async callback)
- Email: Resend. Errors: Sentry. Analytics: Plausible.

**Deliberately NOT in the stack:** Redis, message queues, microservices, Kubernetes, dedicated search service. Postgres full-text/trigram search handles browsing; Supabase realtime handles live updates; edge functions handle business logic. Do not introduce these.

---

## 2. Non-negotiable guardrails for AI agents

1. **Never rebuild or restyle the UI.** The prototype's visual design, markup, typography, color palette, and copy are final considered decisions. Migrate the data layer; leave the visual layer alone.
2. **The Anthropic API key never touches the frontend.** Browser → Karibu edge function → Anthropic. The key lives only in Supabase edge function secrets. Same for M-Pesa and Resend secrets. Nothing secret in `VITE_*` vars or the bundle.
3. **RLS stays enabled on every table.** Writes not covered by a policy happen only via the service role inside edge functions. The service role key is never reachable from the client.
4. **Schema changes are additive migrations** — new numbered SQL files in `supabase/migrations/`. Never edit an applied migration.
5. RLS is the last line of defense, not the only one: input validation, rate limiting, and business-logic checks live in edge functions.

---

## 3. Launch targets (the "5,000 users" bar)

| Metric | Launch | Year 1 (survive without rework) |
|---|---|---|
| Monthly visitors | **5,000** | 50,000 |
| Listed businesses | ~100 | 1,500 |
| Ask Karibu queries / month | ~2,000 | 30,000 |
| Infra budget / month | ~$45 | ~$155 |

Traffic is mobile-heavy, much of it mid-range Android on 3G/4G Kenyan networks — performance budgets should assume slow, flaky connections. Supabase Pro ($25/mo) is the production plan; Anthropic costs ≈ $3/M input + $15/M output tokens.

---

## 4. Frontend migration order (from static prototype to live data)

The prototype ships with static data in code. Migration follows this strict sequence — don't skip steps:

1. Install `supabase-js`, create the client at `src/lib/supabase.js` (persistSession, localStorage, autoRefreshToken).
2. Replace the `categories` and `cities` constants with DB fetches — fetch once on app load, hold in React Context.
3. Replace `recommended` and `salonsList` constants with paginated queries against `businesses`.
4. Wire `BusinessScreen` to fetch a single business by slug, including its published reviews.
5. Replace any direct `fetch("https://api.anthropic.com...")` in `AskKaribuScreen` with `supabase.functions.invoke('ask-karibu', ...)`.
6. Replace in-memory `reviewsByBusiness` state with `submit-review` edge function calls + re-fetch.

---

## 5. Edge functions (7)

| Function | Trigger | Job |
|---|---|---|
| `ask-karibu` | HTTP from app | Grounds Claude on the active city's top businesses, proxies to Anthropic, logs to `ai_conversations` |
| `submit-review` | HTTP from app | Validates review, inserts as `pending_moderation` |
| `moderate-reviews` | Cron, hourly | Claude classifies pending reviews on 5 axes; clean → published, else flagged + team notified |
| `calculate-rankings` | Cron, nightly 03:00 EAT | Recomputes `ranking_score` for all active businesses (batched UPDATE) |
| `mpesa-stk-push` | HTTP from app | Initiates M-Pesa payment for subscriptions |
| `mpesa-callback` | HTTP from Safaricom | Handles async payment result — **must be idempotent and source-verified** |
| `send-onboarding-email` | Invoked | Welcome / reminder emails via Resend |

---

## 6. Feature checklist — Definition of Done

| # | Feature | DONE means |
|---|---|---|
| 1 | Cities | 5 launch cities served from `cities` table (slug, hoods[], is_active); city switcher works |
| 2 | Categories | 13 parent categories + sub-types from DB (not constants); `sort_order` drives grid; cuisine types for restaurants |
| 3 | Listings | Paginated queries on `businesses` where `status='active'`; sorts: recommended (`ranking_score DESC`), top rated (`rating DESC`), closest (PostGIS) |
| 4 | Business detail | Fetch by slug: about, hours_json, services_json, price_range, contacts (phone/WhatsApp/email/website), M-Pesa till/paybill, hero + gallery, published reviews |
| 5 | Search | Fuzzy name search via `pg_trgm`; category browsing via Postgres FTS |
| 6 | Ask Karibu | Edge function proxy (see §5); grounded directory for the **selected city**; replies ≤120 words natural prose; conversation logged; frontend uses `functions.invoke` |
| 7 | Review capture | Composer → `submit-review`: rating 1–5, body ≥ 40 chars, banned-words check, per-IP rate limit; optimistic "awaiting moderation" badge |
| 8 | Review moderation | Hourly Claude classification: `authentic / off_topic / hate_speech / promotional / coordinated` (+ 1-sentence reasoning, strict JSON); all clean → `published`; any flag → `flagged` + notify team; human queue for flagged |
| 9 | Anti-abuse | Max 3 reviews/IP/24h; 1 review/user/business/30 days; burst pause if 10+ reviews in 4h; fingerprint flag at 5+; sentiment–rating mismatch flag |
| 10 | Ranking | Nightly recompute (see formula §7); cached `rating`, `review_count`, `recent_review_count_30d`, `ranking_score` on the businesses row, updated by trigger or cron — never computed by JOIN per page load |
| 11 | 3.5★ threshold | Daily cron: `review_count ≥ 20 AND rating < 3.5` → 60-day `improvement_until` window; expired + still < 3.5 → `status='unlisted'` + notify/refund |
| 12 | Saved places | Authed users save/unsave businesses; owner-only via RLS |
| 13 | Guides | Editorial guides: block-based `body_json`, featured flag, related businesses, ask_prompts; public reads published only |
| 14 | Auth | Supabase auth; persisted session; token auto-refresh |
| 15 | Onboarding | Intake (form or manual entry) → `status='pending'` → verification: KRA PIN regex + iTax/manual cross-check, phone OTP (Africa's Talking), location pin matches hood, photo authenticity check, human review ≤ 48h → `active` + `verified_at` → welcome email. Required fields: name, KRA PIN, category/sub-type, city+hood+lat/lng, structured hours, ≥1 contact, ≥3 photos, owner ID verified |
| 16 | Subscriptions | Tiers free / verified (KSh 2,500) / recommended (KSh 7,500); STK push initiates; callback activates; statuses `active / past_due / cancelled / pending_payment`; M-Pesa transaction id stored |
| 17 | Email | Welcome + reminders via Resend from `send-onboarding-email` |
| 18 | Admin | Approve/reject pending listings (decision logged), flagged-review moderation queue |

---

## 7. Ranking formula (weights are product decisions — do not change)

```
ranking_score =
    (rating_z_score        × 0.35)   -- (rating − category_mean) / category_stdev
  + (review_volume_log     × 0.20)   -- log10(1 + review_count)
  + (recency_factor        × 0.15)   -- reviews_last_30d / max(reviews_last_30d in category)
  + (verification_bonus    × 0.15)   -- 0 free · 0.5 verified · 1.0 recommended
  + (engagement_factor     × 0.10)   -- clamp(profile_views_30d / 1000, 0, 1)
  + (tier_modifier         × 0.05)   -- 0 free/verified · 0.1 recommended
```

Rating drives rank; subscription tier only unlocks placement within rank bands. A 4.9★ free listing beats a Karibu Recommended one. Ratings are normalized per category. Full run over 10,000 listings must complete in seconds (single batched UPDATE after computing category stats).

---

## 8. Data layer

**Extensions:** `uuid-ossp`, `postgis`, `pg_trgm`. UUID PKs, `timestamptz` everywhere.

**Tables:** `cities`, `categories`, `sub_types`, `businesses`, `reviews`, `guides`, `subscriptions`, `saved_places`, `ai_conversations` — columns per the full guide. Notable: `businesses.tier` (`free|verified|recommended`), `businesses.status` (`pending|active|suspended|unlisted`), `businesses.improvement_until`, cached ranking fields; `reviews.status` (`pending_moderation|published|rejected|flagged`), `reviewer_ip inet`, `reviewer_fingerprint`; `subscriptions.status` (`active|past_due|cancelled|pending_payment`).

**Required indexes:**

```
businesses(category_id, sub_type_id) · businesses(city_id)
businesses(ranking_score DESC) WHERE status='active'
GIST(businesses.location) · GIN(businesses.name gin_trgm_ops)
reviews(business_id, status)
reviews(business_id, created_at DESC) WHERE status='published'
subscriptions(business_id, status)
```

**RLS minimum set:** public SELECT active businesses / published reviews / published guides; owner SELECT+UPDATE own business (incl. pending); authed INSERT reviews (`reviewer_id = auth.uid()`, rating 1–5, body ≥ 40); `saved_places` owner ALL; `subscriptions` owner SELECT. Everything else via service role in edge functions.

---

## 9. Environments, secrets, CI

| | DEV | STAGING | PROD |
|---|---|---|---|
| Branch | `dev` | `staging` | `main` |
| URL | dev.karibu.co.ke | staging.karibu.co.ke | karibu.co.ke |
| Supabase project | karibu-dev | karibu-staging | karibu-prod |
| Deploy | auto on push | auto on push | manual promote |
| Anthropic / M-Pesa | sandbox | sandbox | live |
| Backups | — | weekly | daily |

**Frontend env (public, safe):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_PLAUSIBLE_DOMAIN`.

**Edge function secrets (Supabase → Settings → Edge Functions → Secrets; NEVER `VITE_*`):** `ANTHROPIC_API_KEY`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `RESEND_API_KEY`, `SENTRY_DSN`.

**CI (GitHub Actions):** every push/PR → `npm ci`, lint, build, unit tests; on `main` push → deploy all edge functions via Supabase CLI (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` secrets). Frontend deploys via Vercel/Netlify Git integration. Migrations: `supabase migration new …` → `supabase db push --linked` (staging first, then prod).

**Accounts needed for production:** Supabase Pro, funded Anthropic account, Vercel/Netlify, GitHub org, M-Pesa Daraja (production merchant approval takes 5–10 business days — start early), domain `karibu.co.ke`.

---

## 10. Observability & operations

Monitor: error rate (Sentry, frontend + functions); latency on Ask Karibu / business detail / review submission; DB slow queries > 500ms; daily review volume + moderation backlog; M-Pesa success rate; Anthropic spend (alert at 80% of monthly budget by day 20).

Daily: Sentry check, moderation queue, confirm overnight ranking run, spot-check 5 pending listings, sample 3 Ask Karibu replies. Weekly: restore last backup to a scratch project and verify. Incidents: acknowledge ≤ 15 min, status banner if visitor-facing, post-mortem ≤ 48h.
