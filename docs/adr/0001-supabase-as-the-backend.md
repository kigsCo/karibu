# ADR-0001 — Supabase as the backend

## Status

Accepted.

## Context

Karibu is moving from a static React prototype to a real backend, built and operated by a very small team (effectively a solo developer, targeting a launch-ready backend in about two weeks). The backend needs a relational database, authentication, file storage, and somewhere to run server-side logic — most urgently the `ask-karibu` proxy that keeps the Anthropic key off the client.

The alternative was to assemble best-of-breed pieces: a managed Postgres (e.g. RDS), a separate auth provider, an object store, and a serverless platform for functions. That gives maximum flexibility and avoids lock-in, at the cost of integrating and operating four or five separate services, each with its own credentials, dashboard, and failure modes — a lot of surface for a one-person team to carry while also shipping product.

## Decision

Use a **single Supabase project** as the entire backend: Postgres (with the PostGIS and `pg_trgm` extensions), Auth, Storage, and Edge Functions on Deno, all behind one set of credentials. Three Supabase projects mirror the three environments (`karibu-dev`, `karibu-staging`, `karibu-prod`).

## Consequences

**Positive.** One product, one set of credentials, one dashboard — the consolidation matters more at this stage than picking a theoretically optimal database. Auth, storage, and row-level security are integrated with Postgres out of the box, so the anon key plus RLS covers most data access with no bespoke auth layer. Edge Functions give us a server-side execution context for the API-key boundary and the cron jobs without standing up separate infrastructure. The local CLI (`supabase start`, `supabase db reset`) makes the develop-and-migrate loop fast.

**Negative / accepted trade-offs.** We take on a degree of platform lock-in: schema migrations are portable SQL, but RLS policies, edge functions, and the auth integration are Supabase-shaped. The cost curve has one step-change — the **Team plan** becomes necessary around 10,000 listings (more concurrent connections, daily PITR backups, dedicated compute), which lands well after revenue can absorb it. We are explicitly comfortable with this until ~10,000+ users; past that point, migrating to RDS plus a separate auth provider is a known, deliberate exit, not a forced one.

This decision is what makes ADR-0003 (edge functions instead of microservices) and the secrets boundary in [`SECURITY.md`](../SECURITY.md) possible in the first place.
