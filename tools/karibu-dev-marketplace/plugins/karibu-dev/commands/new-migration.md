---
description: Create a new numbered Supabase migration (table/column/index) with RLS and indexes baked in.
argument-hint: <migration_name>
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Invoke the **`supabase-migration`** skill, then create a new numbered migration named `$ARGUMENTS` for the Karibu database. Read the root `CLAUDE.md` and `supabase/CLAUDE.md` first, and read `supabase/migrations/20260601000001_core_schema.sql` so you match the existing conventions and reuse what already exists.

Procedure:
1. Create the file via `supabase migration new $ARGUMENTS` so the timestamp continues the existing `20260601000001_*` ordering — never hand-type a timestamp. (If the CLI is unavailable here, create the next correctly-numbered `<timestamp>_$ARGUMENTS.sql` file and note it.)
2. Keep it to **one concern**. Use `uuid` PKs (`uuid_generate_v4()`), `timestamptz NOT NULL DEFAULT now()` time columns, `text` over `varchar`, and named `CHECK` constraints for enum-like sets.
3. If this migration creates a table, in the **same file**: `ENABLE ROW LEVEL SECURITY` plus at least a read policy (use the **`rls-policy`** skill), and add indexes — every FK, every hot-path `WHERE`/`ORDER BY` column, partial `WHERE status='active'`, GiST for geography, GIN + `pg_trgm` for fuzzy text, and a `(score DESC, id)` keyset composite for hot lists (see **`db-performance`**).
4. Never edit a shipped migration; to change an existing table, use `ALTER TABLE` in this new file.

When done, report the migration path and remind me: this must apply cleanly on a fresh `supabase db reset`, and it must be pushed to **staging** (`supabase db push --linked`) before prod — never straight to prod.
