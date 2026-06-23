# CLAUDE.md — Karibu

> The persistent brain for this repo. Claude Code reads this on every session. Keep it current; it is "best-by-date food."

## What Karibu is

Karibu is a services-discovery app for tourists, expats, and newcomers to Kenya — "a local guide, for newcomers." It answers the questions every visitor asks in week one: where to get a haircut, which restaurant won't disappoint, whether a neighbourhood is safe, how M-Pesa works. Trust is the product: every business is verified, and ranking is driven by reviews, not ad spend.

Built by Kigs Apex Solutions, Nairobi. Launch cities: Nairobi, Mombasa, Naivasha, Kisumu, Nakuru.

## Where we are right now

- The repo is a **static React prototype**. The entire app is one ~3,200-line component, `src/KaribuApp.jsx`, with hardcoded data constants and 14 screens.
- There is **no backend yet**. We are building it now, per `docs/karibu-developer-guide.docx` (the canonical spec) and the docs in `docs/`.
- **Current sprint:** Backend foundation — schema + RLS + seed live in Supabase. See `docs/SPRINT_01.md`.
- **Target:** a launch-ready backend in ~2 weeks (solo dev).

## Architecture (intentionally simple)

```
Visitors (browser/mobile)
   │ HTTPS
Frontend — React 18 + Vite + Tailwind  (Vercel/Netlify, static + edge-cached)
   │ supabase-js (anon key)        │ supabase.functions.invoke (server-only)
   ▼                               ▼
Supabase (single project): Postgres (RLS) ←→ Auth ←→ Storage ←→ Edge Functions (Deno)
                                                                   │ Anthropic API
                                                                   ▼
                                                      Claude (claude-sonnet-4-6) — "Ask Karibu"
```

What we deliberately do **not** have: Redis, message queues, microservices, Kubernetes, a dedicated search service. Postgres full-text + `pg_trgm` handles search. Supabase realtime handles live updates. Edge functions cover business logic. Anything else is future-you's problem.

## NON-NEGOTIABLE guardrails

These override convenience. Violating them is a defect, not a style choice.

1. **The Anthropic API key never touches the frontend.** The browser calls the `ask-karibu` edge function; the function reads `ANTHROPIC_API_KEY` from Supabase's encrypted secret store and calls Anthropic. Never put it in a `VITE_*` var. The prototype currently violates this at `src/KaribuApp.jsx` (~line 2097, `fetch("https://api.anthropic.com/...")`) — fixing it is a priority, not optional.
2. **Do not rebuild the UI.** The visual design, typography, palette, and copy represent dozens of hours of decisions. Migrate the **data layer** and leave the **visual layer** alone.
3. **Do not pre-split `KaribuApp.jsx` by hand.** Split it into pages/components only deliberately and incrementally, one screen at a time, verifying the app still renders after each. Never do a big-bang refactor.
4. **Secrets live in Supabase, not in code.** `ANTHROPIC_API_KEY`, `MPESA_*`, `RESEND_API_KEY`, `SENTRY_DSN` are edge-function secrets. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public.
5. **RLS is enabled on every table.** It is the last line of defense, not the only one — edge functions still validate input, rate-limit, and run business logic.
6. **Verification is a product feature, not a checkbox.** The day we list a fraudulent business, trust erodes. Treat the onboarding verification pipeline as core.

## Tech stack & versions

| Layer | Tech |
|---|---|
| Frontend | React 18.3, Vite 6, Tailwind 3.4, react-router-dom 6, lucide-react |
| Type/serif | Instrument Serif (display), Plus Jakarta Sans (body) |
| Backend | Supabase — Postgres 15 + PostGIS + pg_trgm, Auth, Storage, Edge Functions (Deno) |
| AI | Anthropic `claude-sonnet-4-6`, proxied via the `ask-karibu` edge function |
| Payments | M-Pesa Daraja (STK push) |
| Email | Resend |
| Deploy | Vercel/Netlify (frontend), Supabase CLI (functions + migrations), GitHub Actions (CI) |

Node 18+ for the frontend; Supabase Edge runtime is Deno.

## The data model (summary — full detail in `docs/DATA_MODEL.md`)

Nine tables (plus a `rate_limits` helper), UUID PKs, `timestamptz` everywhere, PostGIS `geography(POINT,4326)` for location:

- `cities` — 5 launch cities + `hoods[]`.
- `categories` (13 parents) → `sub_types` (e.g. hair/nails/spa under beauty).
- `businesses` — the core listing. Caches `rating`, `review_count`, `recent_review_count_30d`, `ranking_score` on the row (computed by trigger/nightly job — do NOT JOIN-aggregate on every page load). `tier` ∈ free|verified|recommended. `status` ∈ pending|active|suspended|unlisted.
- `reviews` — the heart of ranking. `status` ∈ pending_moderation|published|rejected|flagged. Anti-abuse fields (`reviewer_ip`, `reviewer_fingerprint`).
- `guides` — editorial, block-based `body_json`.
- `subscriptions` — verified/recommended tiers, M-Pesa.
- `saved_places`, `ai_conversations`.

Source of truth for the schema is `supabase/migrations/`. Read those before writing any query.

## Scalability rules (bake these in from day one)

The app must scale to 10,000+ listings / 300k monthly visitors without re-architecting. Apply these by default:

- **Indexing:** every foreign key, every column used in a `WHERE`/`ORDER BY` on a hot path. Partial indexes for `status='active'`. GiST for `location`, GIN/`pg_trgm` for fuzzy name search. See the indexes in the core migration before adding queries.
- **Caching:** cache derived values (`rating`, `ranking_score`) on the row, refreshed by trigger or nightly cron — never computed live. At the edge, frontend reads of small reference data (`cities`, `categories`) are fetched once on app load and held in React Context. Static pages are edge-cached at the CDN.
- **Pagination:** never return unbounded lists. Use keyset/cursor pagination (`WHERE ranking_score < $cursor ORDER BY ranking_score DESC LIMIT n`) on hot list endpoints; offset pagination only for admin/low-traffic views. Default page size 20–50.
- **Async / heavy work:** moderation, ranking recompute, email, reverse-image checks, and M-Pesa reconciliation run as **cron-triggered edge functions** (off the request path), not inline. Fire-and-forget logging (e.g. `ai_conversations` insert) must never block a response.
- **OLAP / analytics:** keep analytics OFF the transactional hot path. Use **materialized views** (refreshed on a schedule) for dashboards, category statistics, and the merchant dashboard — never run heavy `GROUP BY` against live tables during a page load. See `docs/SCALABILITY.md` and the `db-performance` skill.

When in doubt, invoke the **`db-performance`** skill.

## Repo layout

```
CLAUDE.md                 ← this file (the brain)
README.md, QUICKSTART.md
src/
  KaribuApp.jsx           ← the prototype (do not bulk-refactor)
  lib/                    ← Supabase client + API helpers (supabase.js goes here)
  hooks/                  ← data hooks (useBusinesses, etc.)
  data/                   ← seed/reference data extracted from the prototype
  components/ pages/       ← populated incrementally as screens are split
supabase/
  config.toml
  migrations/             ← numbered SQL; source of truth for the schema
  functions/              ← Deno edge functions (ask-karibu, submit-review, ...)
    _shared/              ← cors, supabase client, rate-limit, pagination helpers
  tests/
  seed.sql
.github/workflows/        ← CI (lint, build, deploy functions)
docs/                     ← architecture, data model, scalability, security, ops, ADRs, sprint plans
.claude/                  ← the tooling: settings.json, skills/, agents/, commands/
.mcp.json                 ← Supabase MCP server config
tools/karibu-dev-marketplace/  ← the installable "karibu-dev" plugin + marketplace
```

Subdirectories with their own `CLAUDE.md` (`supabase/`, `src/`) carry area-specific rules — read them when working there.

## Skills available (invoke by name)

| Skill | Use when |
|---|---|
| `supabase-migration` | creating/altering schema; writing a numbered migration |
| `rls-policy` | adding or auditing row-level security |
| `edge-function` | scaffolding a new Deno edge function (cors, auth, error shape) |
| `seed-data` | (re)generating `seed.sql` from the prototype constants |
| `ranking-algorithm` | implementing/altering `calculate-rankings` and `ranking_score` |
| `review-moderation` | the `moderate-reviews` Claude classification pipeline |
| `mpesa-integration` | STK push + callback handling |
| `frontend-data-migration` | replacing a static constant with a live Supabase query |
| `db-performance` | indexing, caching, pagination, async, OLAP decisions |

Slash commands: `/new-migration`, `/new-edge-function`, `/db-review`, `/seed-refresh`, `/sprint-status`.
Subagents: `migration-author`, `edge-fn-builder`, `db-reviewer`, `frontend-migrator`.

## Dev workflow

```bash
# Frontend
npm install && npm run dev      # http://localhost:5173
npm run build && npm run lint

# Supabase (local)
supabase start                  # local stack
supabase db reset               # apply all migrations + seed.sql
supabase migration new <name>   # create a migration (then edit the SQL)
supabase functions serve <fn>   # run an edge function locally
supabase db push --linked       # apply migrations to the linked project (staging first!)
```

Environments: `dev` → `staging` → `main` (three Supabase projects). Migrations apply to staging before prod. Frontend auto-deploys per branch.

## Definition of done

- [ ] Migrations apply cleanly on a fresh `supabase db reset`, RLS enabled on every new table.
- [ ] Queries on hot paths are indexed and paginated; no live aggregation added.
- [ ] Edge functions: CORS handled, input validated, secrets read from env, errors return a consistent JSON shape, heavy work is async/cron.
- [ ] `npm run lint` and `npm run build` pass; the UI still renders unchanged.
- [ ] Secrets are in Supabase, never in `VITE_*` or committed files.
- [ ] Docs updated if behaviour or schema changed.

## Pointers

- Canonical spec: `docs/karibu-developer-guide.docx`
- Architecture: `docs/ARCHITECTURE.md` · Data model: `docs/DATA_MODEL.md` · Scaling: `docs/SCALABILITY.md` · Security: `docs/SECURITY.md` · Ops: `docs/OPERATIONS.md`
- Decisions: `docs/adr/`
- Current plan: `docs/SPRINT_01.md`
