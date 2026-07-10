# Karibu docs

The planning, architecture, and operations reference for Karibu's move from a static React prototype to a Supabase backend.

## Start here

New to the repo? Read **[`../CLAUDE.md`](../CLAUDE.md)** first — it is the persistent "brain" for the project: what Karibu is, the non-negotiable guardrails, the tech stack, and pointers to everything else. Then look at the current sprint plan, **`SPRINT_01.md`** (the active backend-foundation plan; lives alongside this `docs/` folder per the pointers in `CLAUDE.md`).

## The documents

### Architecture & design

| Document | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The system at a glance — one frontend, one Supabase backend, one third-party API; data-flow diagram; what we deliberately don't have; the three environments; request lifecycles. |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Full reference for every table, enum, relationship, cached/derived column, and index. Mirrors the migration SQL exactly. |
| [`SCALABILITY.md`](SCALABILITY.md) | The scaling playbook — indexing, caching, keyset pagination, async/cron work, OLAP materialized views, and the cost/scale projections. |
| [`SECURITY.md`](SECURITY.md) | The Anthropic key boundary, secrets inventory, RLS as last line of defence, edge-function validation/rate-limiting, review anti-abuse, and the verification pipeline. |
| [`OPERATIONS.md`](OPERATIONS.md) | Observability signals, daily/weekly checklists, incident response, and the staging-before-prod migration workflow. |

### Decision records

The [`adr/`](adr/) folder holds Architecture Decision Records — the "why" behind the big choices (Status / Context / Decision / Consequences):

| ADR | Decision |
|---|---|
| [`0001-supabase-as-the-backend.md`](adr/0001-supabase-as-the-backend.md) | Why a single Supabase project is the entire backend. |
| [`0002-cache-rating-and-ranking-on-the-row.md`](adr/0002-cache-rating-and-ranking-on-the-row.md) | Why `rating`/`ranking_score` are cached on the business row (trigger + nightly cron). |
| [`0003-edge-functions-over-microservices.md`](adr/0003-edge-functions-over-microservices.md) | Why server-side logic is edge functions, not microservices. |
| [`0004-keyset-pagination-and-olap-materialized-views.md`](adr/0004-keyset-pagination-and-olap-materialized-views.md) | Why hot lists use keyset pagination and analytics live in materialized views. |

### Product & deployment guides (existing)

| Document | What it covers |
|---|---|
| [`BUSINESS_OWNER_GUIDE.md`](BUSINESS_OWNER_GUIDE.md) | Partner-facing preview guide for business owners testing before launch (placeholder for the distributed PDF). |
| [`GITHUB_PUBLISHING.md`](GITHUB_PUBLISHING.md) | The two publishing paths — GitHub → Lovable for QA, and GitHub → Vercel for production. |
| [`LOVABLE_DEPLOYMENT.md`](LOVABLE_DEPLOYMENT.md) | Deploying via Lovable for QA and wiring up Supabase (quick reference; full guide distributed as a PDF). |

### Canonical spec

[`karibu-developer-guide.docx`](karibu-developer-guide.docx) is the **canonical developer deployment guide** (Kigs Apex Solutions, v1.0) — the authority for architecture, schema, business logic, ops, and cost. The Markdown docs above distil and operationalise it; where they differ, the `.docx` and the migration SQL win.
