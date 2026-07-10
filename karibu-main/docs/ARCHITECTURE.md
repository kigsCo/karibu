# Architecture

> The system at a glance. For the schema, see [`DATA_MODEL.md`](DATA_MODEL.md); for scaling decisions, [`SCALABILITY.md`](SCALABILITY.md); for the rationale behind the big choices, the [ADRs](adr/).

Karibu is deliberately simple: **one frontend, one backend, one third-party API.** Anything more complex than that at this stage is overengineering. The whole system is small enough to hold in your head, and that is a feature, not a limitation — it keeps a solo developer fast and keeps the failure surface tiny.

## The three pieces

**One frontend.** A React 18 application built with Vite and styled with Tailwind, deployed as a static bundle to Vercel or Netlify and served edge-cached from a CDN. It talks to the backend two ways: directly to Postgres through `supabase-js` with the public anon key (subject to row-level security), and to server-side logic through `supabase.functions.invoke(...)` for anything that needs a secret or heavier validation. The frontend holds no secrets beyond the two public Supabase values.

**One backend.** A single Supabase project. Supabase bundles Postgres (with the PostGIS and `pg_trgm` extensions enabled), Auth, Storage, and Edge Functions running on Deno — all behind one set of credentials. For a team this size, that consolidation matters more than picking a theoretically optimal database. We can migrate to RDS plus a separate auth provider later if we ever need to; until we are past roughly 10,000 listings, we will not.

**One third-party API.** Anthropic's `claude-sonnet-4-6`, used only to power the "Ask Karibu" conversational assistant. It is reached **exclusively** through the `ask-karibu` edge function — never from the browser. `claude-sonnet-4-6` is the current production-recommended model: faster and cheaper than Opus while delivering excellent results for this use case, at roughly $3 per million input tokens and $15 per million output tokens, which sits comfortably within Karibu's unit economics even at 100,000 queries per month.

## Data-flow diagram

```
        ┌─────────────────────────────────────────────┐
        │           VISITORS (browser, mobile)         │
        └───────────────────────┬─────────────────────┘
                                 │ HTTPS
                                 ▼
        ┌─────────────────────────────────────────────┐
        │     FRONTEND — React 18 + Vite + Tailwind    │
        │        Vercel / Netlify  (static, CDN)       │
        └───────────┬───────────────────────┬─────────┘
                    │                        │
       supabase-js  │                        │  supabase.functions.invoke()
       (anon key,   │                        │  (server-only logic)
        RLS-scoped) │                        │
                    ▼                        ▼
        ┌─────────────────────────────────────────────┐
        │            SUPABASE  (single project)        │
        │                                             │
        │   Postgres  ←→  Auth  ←→  Storage  ←→  Edge  │
        │   + PostGIS                          Functions
        │   + pg_trgm                          (Deno) │
        │   (RLS on every table)                  │   │
        └─────────────────────────────────────────┼───┘
                                                   │ ANTHROPIC_API_KEY
                                                   │ (from encrypted secret store)
                                                   ▼
                                  ┌──────────────────────────────┐
                                  │   ANTHROPIC  claude-sonnet-4-6 │
                                  │        "Ask Karibu" AI         │
                                  └──────────────────────────────┘
```

The single most important line in that diagram is the bottom one. The Anthropic key flows **from Supabase's secret store into the edge function and out to Anthropic** — it never travels to the browser. That boundary is non-negotiable and is detailed in [`SECURITY.md`](SECURITY.md).

## What we deliberately don't have

A short list of things you might expect in a system this shape, and why we left them out:

| Not present | Why we don't need it |
|---|---|
| **Redis / external cache** | Derived values (`rating`, `ranking_score`) are cached on the business row itself; reference data is cached once in the client. Postgres is fast enough for everything else at our scale. |
| **Message queue** | Heavy work (moderation, ranking, email, reconciliation) runs as scheduled cron edge functions, off the request path. There is no fan-out that justifies a broker. |
| **Microservices** | One Postgres and a handful of edge functions cover every server-side concern. Service boundaries would add network hops and deploy complexity with no payoff at this size. See [ADR-0003](adr/0003-edge-functions-over-microservices.md). |
| **Kubernetes / container orchestration** | There is nothing to orchestrate. Supabase manages the database and runs the functions; the frontend is a static bundle on a CDN. |
| **Dedicated search service (Elastic, Algolia, etc.)** | Postgres full-text search plus a `pg_trgm` GIN index handles category browsing and fuzzy name lookup. A search cluster is a future-you problem. |

Each omission is a cost we are choosing not to pay yet. When real scale or a real product need forces one of these, we will add it deliberately — not preemptively.

## Three environments

Three environments, three Supabase projects, three deploy targets. Migrations always reach **staging before production**, and only `main` promotes manually.

| | Dev | Staging | Production |
|---|---|---|---|
| Branch | `dev` | `staging` | `main` |
| URL | `dev.karibu.co.ke` | `staging.karibu.co.ke` | `karibu.co.ke` |
| Supabase project | `karibu-dev` | `karibu-staging` | `karibu-prod` |
| Auto-deploy | push to `dev` | push to `staging` | manual promote |
| Anthropic | sandbox key | sandbox key | production key |
| M-Pesa | sandbox | sandbox | live |
| Backups | — | weekly | daily |

## Request lifecycle

### A typical page load (e.g. a category list)

1. The browser requests the static frontend; the CDN serves the cached HTML/JS/CSS bundle from an edge node close to the user.
2. On first load, the app fetches the small read-only reference data — `cities`, `categories`, `sub_types` — once and holds it in React Context. Subsequent navigation reuses it; no refetch.
3. To render the list, the app issues a single `supabase-js` query against `businesses` filtered to `status = 'active'`, ordered by `ranking_score DESC`, limited to a page (20–50 rows), reading the **cached** `rating` and `review_count` columns directly off each row. No JOIN-aggregation happens at read time.
4. Row-level security silently scopes the query to publicly readable rows. The response returns; the list renders. Further pages use keyset pagination (`WHERE ranking_score < $cursor ...`) — see [`SCALABILITY.md`](SCALABILITY.md).

The hot path is one indexed, paginated `SELECT`. That is the entire point of caching derived columns and using partial indexes.

### An "Ask Karibu" query

1. The user types a question. The frontend calls `supabase.functions.invoke('ask-karibu', { messages, city, sessionId })` — **not** Anthropic directly.
2. The `ask-karibu` edge function (Deno) runs server-side. It reads `ANTHROPIC_API_KEY` from Supabase's encrypted secret store via `Deno.env`.
3. The function queries Postgres with the service-role client for the top ~40 active businesses in the requested city (ordered by `ranking_score`), and builds a system prompt that **grounds** the model in that verified directory.
4. The function calls `https://api.anthropic.com/v1/messages` with `model: claude-sonnet-4-6`, the grounded system prompt, and the conversation `messages`.
5. On success it returns the model's reply to the browser. It also fires a **fire-and-forget** insert into `ai_conversations` for later analysis — that logging must never block or delay the response.
6. On an Anthropic error the function returns a consistent JSON error shape (HTTP 502); on an unexpected error, HTTP 500. The browser never sees the key, the directory query, or the upstream call.

The browser's entire view of "Ask Karibu" is one function invocation in and one answer out. Everything sensitive — the key, the grounding query, the upstream request — stays server-side.
