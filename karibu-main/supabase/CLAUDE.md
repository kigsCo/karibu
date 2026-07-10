# CLAUDE.md — supabase/

Area rules for the backend. Read the root `CLAUDE.md` first.

## Migrations (`migrations/`)
- One concern per migration. Numbered, immutable once applied to staging/prod — never edit a shipped migration; write a new one.
- Every new table: `ENABLE ROW LEVEL SECURITY` in the same migration that creates it. A table without RLS is a security hole.
- UUID PKs (`uuid_generate_v4()`), `timestamptz NOT NULL DEFAULT now()` for time columns, `text` over `varchar`.
- Add indexes in the same migration as the table: every FK, every hot-path filter/sort column, partial `WHERE status='active'`, GiST for geography, GIN+`pg_trgm` for fuzzy text.
- Cached/derived columns (`rating`, `ranking_score`, ...) are maintained by trigger or cron — never trust client writes to them.
- Use the `supabase-migration` and `rls-policy` skills.

## Edge functions (`functions/`)
- Deno runtime. Each function: handle `OPTIONS`/CORS, validate input, read secrets from `Deno.env`, return the shared JSON error shape, log fire-and-forget.
- Shared helpers live in `functions/_shared/` (cors, service-role client, rate-limit, pagination, json responses). Import them; don't re-implement.
- The service-role key is server-only. The browser only ever calls functions with the anon key / user JWT.
- Heavy/batch work (`moderate-reviews`, `calculate-rankings`, emails, reconciliation) is **cron-triggered**, never inline in a user request.
- Use the `edge-function`, `ranking-algorithm`, `review-moderation`, `mpesa-integration` skills.

## Local loop
```bash
supabase start
supabase db reset            # migrations + seed.sql
supabase functions serve <fn>
```
Test against staging before prod. `seed.sql` mirrors the prototype's launch data — regenerate with the `seed-data` skill.
