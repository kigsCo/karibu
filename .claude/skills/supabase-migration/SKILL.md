---
name: supabase-migration
description: Use when creating or altering the Karibu database schema — writing a new numbered SQL migration (new table, column, index, constraint, function, view). Covers the project conventions: one concern per file, never edit a shipped migration, UUID PKs + timestamptz + text, RLS and indexes in the SAME migration, and the staging-first push order.
---

# Writing a Supabase migration

Migrations in `supabase/migrations/` are the **source of truth** for the schema. They are numbered, immutable once applied to staging/prod, and run in filename order on `supabase db reset`.

## When to use
Any schema change: a new table, a new column, an index, a constraint, a trigger, a function, a materialized view. If it changes database structure, it is a migration — not a hand-edit of an existing file.

## Procedure
1. **Create the file** — never type the timestamp by hand:
   ```bash
   supabase migration new <short_snake_name>   # e.g. add_business_phone_verified
   ```
   This generates `supabase/migrations/<timestamp>_<short_snake_name>.sql`. Existing files use the `20260601000001_*` form; the CLI continues that ordering.
2. **One concern per file.** A migration does one logical thing (one table, or one related set of columns, or one index batch). Do not bundle an unrelated table with a column tweak.
3. **Write the SQL** following the conventions below.
4. **If it creates a table:** enable RLS **and** add indexes **in the same file** (see below). A table without RLS or without FK indexes is a defect, not a follow-up.
5. **Test locally:** `supabase db reset` (applies all migrations + `seed.sql` from scratch) must run clean.
6. **Apply staging-first:** `supabase db push --linked` against the **staging** project before prod. Never push straight to prod (dev -> staging -> main; see root `CLAUDE.md`).

## Conventions (match the existing migrations exactly)
- **PK:** `id uuid PRIMARY KEY DEFAULT uuid_generate_v4()` (the `uuid-ossp` extension is enabled in `20260601000001_core_schema.sql`).
- **Time columns:** `timestamptz NOT NULL DEFAULT now()`. Never bare `timestamp`.
- **Strings:** `text`, never `varchar(n)`. Constrain enum-like sets with a `CHECK` named `<table>_<col>_chk` (see `businesses_status_chk`).
- **Geography:** `geography(POINT, 4326)` for location (PostGIS is enabled).
- **FKs:** `uuid NOT NULL REFERENCES <table>(id)`. Add `ON DELETE CASCADE` only for owned child rows (see `reviews.business_id`, `saved_places.business_id`).
- **Cached/derived columns** (`rating`, `review_count`, `recent_review_count_30d`, `ranking_score`) are maintained by trigger/cron — never trust client writes. Default them and let triggers own them.
- **Never edit a shipped migration.** To change an existing table, write a *new* migration with `ALTER TABLE ...`.

## Indexes — add in the SAME migration (non-negotiable)
Index, at minimum:
- **Every foreign key** (`idx_businesses_city ON businesses(city_id)`).
- **Every hot-path filter/sort column** (`idx_businesses_ranking ON businesses(ranking_score DESC) WHERE status = 'active'`).
- **Partial index** for the common live filter: `WHERE status = 'active'` / `WHERE is_published = true`.
- **GiST** for geography: `USING GIST(location)`.
- **GIN + pg_trgm** for fuzzy name search: `USING GIN(name gin_trgm_ops)`.
- A **keyset-pagination composite** for hot lists: `(ranking_score DESC, id) WHERE status = 'active'` (see `idx_businesses_active_rank_id`). See the `db-performance` skill.

## Migration skeleton
```sql
-- <timestamp>_<name>.sql
-- <one line: what this migration does and why>

-- 1. Table ------------------------------------------------------------------
CREATE TABLE example_things (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slug        text UNIQUE NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT example_things_status_chk CHECK (status IN ('active','archived'))
);

-- 2. Indexes (FKs + hot-path filters/sorts) ---------------------------------
CREATE INDEX idx_example_things_business ON example_things(business_id);
CREATE INDEX idx_example_things_active   ON example_things(created_at DESC) WHERE status = 'active';

-- 3. RLS — enable in THIS migration, with at least a read policy ------------
ALTER TABLE example_things ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active example_things"
  ON example_things FOR SELECT USING (status = 'active');
-- (full policy set: use the rls-policy skill)

-- 4. updated_at trigger (reuse the existing function) -----------------------
CREATE TRIGGER example_things_set_updated_at
  BEFORE UPDATE ON example_things
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

To add a column to an existing table, in a NEW migration:
```sql
ALTER TABLE businesses ADD COLUMN phone_verified boolean NOT NULL DEFAULT false;
CREATE INDEX idx_businesses_phone_verified ON businesses(phone_verified) WHERE phone_verified = true;
```

## Common mistakes
- Editing `20260601000001_core_schema.sql` (or any shipped file) to "fix" something — write a new `ALTER` migration instead.
- Creating a table and deferring RLS/indexes to "later" — do them in the same file.
- `varchar`, bare `timestamp`, or serial/int PKs — use `text`, `timestamptz`, `uuid`.
- Forgetting to index a FK, so admin/list queries seq-scan at scale.
- Pushing to prod before staging.

## Checklist
- [ ] Created via `supabase migration new`, one concern.
- [ ] UUID PK, `timestamptz` time cols, `text` strings, named `CHECK` for enums.
- [ ] Every FK + hot-path filter/sort indexed (partial / GiST / GIN as needed).
- [ ] `ENABLE ROW LEVEL SECURITY` + at least one read policy in the same file.
- [ ] `supabase db reset` runs clean locally.
- [ ] Applied to **staging** via `supabase db push --linked` before prod.
- [ ] No shipped migration was edited.
