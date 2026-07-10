# Sprint Plan: Sprint 01 — Backend Foundation

**Dates:** Mon 22 Jun 2026 — Fri 3 Jul 2026 (2 weeks) | **Team:** 1 engineer (solo)
**Sprint Goal:** Stand up the Supabase backend — schema, RLS, and seed data live in a real project — and route the data layer (and the Anthropic key) through it, with the leaked API key closed.

> Why this goal: the prototype works but has no backend and calls Anthropic directly from the browser (a leaked key — see `docs/SECURITY.md`). This sprint turns the static prototype into a thin, real app reading from Postgres, without touching the visual layer.

## Capacity

Solo dev, two-week sprint. Plan to ~75% of raw capacity — interrupts, ops, and first-time Supabase setup will eat the rest.

| Person | Available days | Allocation | Notes |
|---|---|---|---|
| Solo engineer | 8 of 10 | ~30 pts | ~2 days reserved for setup friction, M-Pesa sandbox waiting, and interrupts |
| **Total** | **8 days** | **~30 pts committed** | 1 pt ≈ a quarter-day |

## Sprint Backlog

Committed work (P0 + P1 ≈ 30 pts, ~75% of a 40-pt raw fortnight). P2 is explicit stretch — cut first if anything slips.

| Priority | Item | Est | Depends on | Skill / command |
|---|---|---|---|---|
| P0 | Provision Supabase dev project, link CLI, `supabase db reset` to apply all 4 migrations | 3 | — | `supabase-migration` |
| P0 | Load `seed.sql`; verify RLS (anon cannot read `pending` businesses or write any) | 3 | migrations | `rls-policy`, `tests/rls_smoke_test.sql` |
| P0 | Deploy `ask-karibu`; set `ANTHROPIC_API_KEY` secret in Supabase | 2 | project | `edge-function` |
| P0 | Frontend `lib/supabase.js`; swap the direct `api.anthropic.com` fetch → `functions.invoke('ask-karibu')` — **closes the leaked key** | 3 | ask-karibu | `frontend-data-migration` |
| P0 | Migrate `cities` + `categories` constants → one live fetch held in React Context | 3 | client | `frontend-data-migration` |
| P1 | `useBusinesses` keyset-paginated hook; wire Discover + Category screens to live data | 5 | Context | `frontend-data-migration`, `db-performance` |
| P1 | `BusinessScreen` fetch by slug + published reviews | 3 | useBusinesses | `frontend-data-migration` |
| P1 | Deploy `submit-review`; apply `rate_limits` migration; review composer writes through it | 3 | RLS | `edge-function`, `review-moderation` |
| P1 | Deploy `moderate-reviews` (hourly) + `calculate-rankings` (nightly); verify `mv_category_stats` + `refresh_analytics()` | 5 | seed | `ranking-algorithm`, `review-moderation` |

### Stretch (P2 — only if green early)

| Priority | Item | Est | Skill |
|---|---|---|---|
| P2 | `mpesa-stk-push` + `mpesa-callback` → activate a `verified`/`recommended` subscription | 5 | `mpesa-integration` |
| P2 | `send-onboarding-email` via Resend | 2 | `edge-function` |
| P2 | CI `deploy.yml` green on `main`; document the staging→prod promote flow | 3 | — |

**Planned capacity:** ~40 pts raw · **Committed load:** ~30 pts (~75%) · **Stretch:** +10 pts

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| M-Pesa Daraja production access takes 5–10 business days | Billing can't go live this sprint | Build against sandbox now; keep M-Pesa as P2; submit the merchant application on day 1 |
| Leaked Anthropic key in the live prototype | Credits drained / ToS violation | P0, done early (KAR-4); rotate the key after the edge function ships |
| Solo dev — no second pair of eyes | Bugs ship unreviewed | Run `/db-review` before every merge; lean on the `db-reviewer` agent and `tests/` |
| Migrating data tempts a UI rewrite | Breaks the deliberate design; scope creep | Guardrail in `src/CLAUDE.md`: data layer only, one screen at a time, never bulk-split `KaribuApp.jsx` |
| Live aggregation sneaks onto a hot path | Slow pages at scale | Cache on the row + matviews; `db-performance` checklist on every query |

## Definition of Done

Per the root `CLAUDE.md` checklist:

- [ ] All 4 migrations apply cleanly on a fresh `supabase db reset`; RLS enabled on every table.
- [ ] Hot-path queries are indexed and keyset-paginated; no live aggregation added.
- [ ] Edge functions handle CORS, validate input, read secrets from env, return the shared JSON shape; heavy work is on cron.
- [ ] `npm run lint` and `npm run build` pass; the UI renders **unchanged**.
- [ ] No secret in any `VITE_*` var or committed file; the old browser-side Anthropic call is gone.
- [ ] Docs updated where schema or behaviour changed.

## Key Dates

| Date | Event |
|---|---|
| Mon 22 Jun | Sprint start · provision Supabase, submit M-Pesa merchant application |
| Mon 29 Jun | Mid-sprint check-in · P0 should be done; data layer reading live |
| Fri 3 Jul | Sprint end / demo · backend live, Ask Karibu proxied, key closed |
| Mon 6 Jul | Retro · carry stretch items into Sprint 02 |

---
*Run `/sprint-status` any time for progress against this plan.*
