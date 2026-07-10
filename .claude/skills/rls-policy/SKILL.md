---
name: rls-policy
description: Use when adding or auditing Row-Level Security (RLS) on a Karibu table — writing CREATE POLICY statements, deciding read/insert/update rules, or reviewing whether a table leaks pending/unpublished rows. Covers the project's public-read-active / owner-own / authenticated-insert-with-check pattern and the service-role bypass used in edge functions.
---

# Writing & auditing RLS policies

RLS is **the last line of defense, not the only one** (root `CLAUDE.md` guardrail 5). Edge functions still validate input, rate-limit, and run business logic. But every table must still have RLS enabled and at least a read policy. Policies live in `supabase/migrations/20260601000002_rls_policies.sql` — match its style.

## When to use
- A new table was created (RLS must be enabled in the same migration that creates it — see `supabase-migration`).
- You are reviewing whether a table exposes rows it shouldn't (e.g. `pending`/`flagged`/unpublished).
- You need to let owners see/edit their own rows, or let authenticated users insert.

## The project pattern
1. **Public reads only "live" rows.** Anonymous SELECT is gated on the live status:
   - `businesses`: `status = 'active'`
   - `reviews`: `status = 'published'`
   - `guides`: `is_published = true`
   - reference data (`cities`/`categories`): `is_active = true`; `sub_types`: `USING (true)`.
2. **Owner reads/updates own rows.** Scoped `TO authenticated`, gated on `owner_id = auth.uid()` (so an owner sees their own `pending` business). UPDATE needs **both** `USING` and `WITH CHECK`.
3. **Authenticated insert with WITH CHECK.** Inserts are `TO authenticated WITH CHECK (...)` and re-assert the invariants (`reviewer_id = auth.uid()`, rating range, body length) so the client can't forge another user's row.
4. **Service role bypasses RLS.** Edge functions using the service-role client (moderation, ranking, M-Pesa reconciliation) are **not** subject to RLS — that is intentional. Do NOT add policies to make pending rows publicly visible just so a function can read them; the function uses the service role. `ai_conversations` has **no policies at all** => no anon/authenticated access, only the service role touches it.

## CREATE POLICY examples (match the existing file)
For a new table `listings_extra` with `status` and `owner_id`:
```sql
-- Always enable RLS first (in the migration that creates the table)
ALTER TABLE listings_extra ENABLE ROW LEVEL SECURITY;

-- 1. Public reads only active rows
CREATE POLICY "Public reads active listings_extra"
  ON listings_extra FOR SELECT
  USING (status = 'active');

-- 2. Owner reads own rows, including non-active ones
CREATE POLICY "Owner reads own listings_extra"
  ON listings_extra FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- 3. Owner updates own rows (USING + WITH CHECK both required)
CREATE POLICY "Owner updates own listings_extra"
  ON listings_extra FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. Authenticated insert, re-asserting ownership invariants
CREATE POLICY "Authenticated inserts own listings_extra"
  ON listings_extra FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
```

Owner-via-join (subscriptions style — the row has no `owner_id`, ownership is through `businesses`):
```sql
CREATE POLICY "Owner reads own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
```

User-owned-only table (saved_places style — manage all verbs on own rows):
```sql
CREATE POLICY "Users manage their saved places"
  ON saved_places FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## Auditing an existing table
- Is RLS **enabled**? (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.) A table with no RLS is a hole.
- Does the public SELECT policy leak non-live rows? A missing `status`/`is_published` predicate exposes `pending_moderation` reviews or `pending` businesses to the world.
- Does every INSERT/UPDATE policy have a `WITH CHECK` that pins the user to their own row?
- Are cached columns (`rating`, `ranking_score`) writable by clients? They must not be — these are trigger/cron-owned; do not add a client UPDATE policy that lets users touch them. Prefer a `WITH CHECK` / trigger that rejects client writes.
- Is a "no policy" table (`ai_conversations`) being read from the browser? It shouldn't be — only the service role.

## Common mistakes
- Forgetting RLS entirely on a new table.
- A public SELECT policy that omits the status filter and leaks pending/flagged rows.
- UPDATE/INSERT policy with `USING` but no `WITH CHECK` (lets users write rows that violate the rule).
- Loosening RLS so an edge function can read pending rows — use the **service role** instead.
- Treating RLS as the whole security story; input validation + rate-limiting still live in the edge function.

## Checklist
- [ ] RLS enabled on the table (in the creating migration).
- [ ] At least one SELECT policy; it never exposes pending/unpublished/flagged rows publicly.
- [ ] Owner SELECT/UPDATE scoped `TO authenticated` on `auth.uid()`, UPDATE has `WITH CHECK`.
- [ ] INSERT policies re-assert ownership + invariants in `WITH CHECK`.
- [ ] Cached/derived columns are not client-writable.
- [ ] Server-only tables have no anon/authenticated policy (service role only).
