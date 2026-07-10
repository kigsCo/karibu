# Karibu backend tests

Two kinds of tests live here:

1. **Database / RLS tests** (pgTAP-style SQL) — verify the schema and that
   row-level security blocks the things it should.
2. **Edge function tests** (Deno) — unit-test function logic with `fetch`
   mocked, so no network or live Supabase is needed.

## Database tests (pgTAP)

These run inside the local Postgres that `supabase start` boots.

```bash
supabase start
supabase db reset          # apply migrations/ + seed.sql first
supabase test db           # runs every *.sql file in supabase/tests/
```

`supabase test db` wraps each file in a transaction and rolls it back, so the
assertions never mutate your local data.

- **`rls_smoke_test.sql`** — switches into the `anon` role and asserts that:
  - anon **cannot** read `pending` businesses (only `status = 'active'`),
  - anon **cannot** `INSERT`/`UPDATE` `businesses` (no anon write policy),
  - anon **cannot** read `pending_moderation` reviews (only `published`).

  It uses pgTAP's `plan()` / `ok()` / `is()` / `throws_ok()`. If pgTAP is not
  installed in your local DB, the assertions are also written as plain
  commented `SELECT`s you can run by hand — each should return **0 rows**.

## Edge function tests (Deno)

Each function may ship an `index.test.ts` beside its `index.ts`.

```bash
# From the repo root. --allow-env so the function can read Deno.env;
# no --allow-net is needed because fetch is stubbed in the test.
deno test --allow-env supabase/functions/

# A single function:
deno test --allow-env supabase/functions/ask-karibu/index.test.ts
```

- **`functions/ask-karibu/index.test.ts`** — stubs `globalThis.fetch` and the
  Supabase client, drives the handler, and asserts that the request sent to the
  Anthropic API uses the model `claude-sonnet-4-6` and that the system prompt
  embeds the verified business directory. This is the guardrail test: it proves
  the model is grounded and the right model string is used.

## Conventions

- DB tests assert **security posture**, not business logic (that's unit-tested
  in Deno). Keep them fast and focused on RLS.
- Function tests must not hit the network or a real database — mock `fetch`
  and inject fakes. Keep them deterministic.
