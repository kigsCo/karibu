# Supabase setup

How Karibu's cloud backend was provisioned, and how to reproduce or extend it.
Guide sections 02–04. Phase 2 of `KARIBU_CLAUDE_CODE_BRIEF.md`.

## The project

| | |
|---|---|
| Name | `karibu` |
| Project ref | `jwiptjcpczamewmyaost` |
| API URL | `https://jwiptjcpczamewmyaost.supabase.co` |
| Region | `eu-central-1` (Frankfurt) |
| Postgres | 17 |
| Organization | `allaniteba37@gmail.com's Org` |
| Plan | **Free** |

**Region.** Supabase has no African region. Frankfurt is the usual choice for East
Africa — Nairobi peers into Europe over the EASSy/SEACOM cables — and it is the
cleanest story for the Kenya Data Protection Act 2019's cross-border transfer
rules, since the EU has an adequacy regime to point at. Mumbai (`ap-south-1`) is
sometimes a shorter round trip but has no such framework.

**Two things to fix before go-live.** The project sits in a personal
organization, not a Kigs Apex one; Supabase supports transferring a project
between organizations you own. And a **free project pauses after 7 days of
inactivity** — fine before launch, not after. Both are tracked in
`MIGRATION_CHECKLIST.md`.

## What is deployed

- All 8 migrations in `supabase/migrations/`, applied in filename order.
- `supabase/seed.sql`: 5 cities, 13 categories, 47 sub-types, 10 active
  businesses, 6 published reviews, 2 published guides.
- RLS enabled on all 10 app tables.

Not deployed: **no edge functions, no cron schedules, no secrets.** Those are
Phase 4 and Phase 7, and they are gated behind the security blockers in
`MIGRATION_CHECKLIST.md`.

## Environment variables

Only these two are public and belong in the frontend (`.env`, and the host's
env-var settings). They ship in the browser bundle; that is by design.

```
VITE_SUPABASE_URL=https://jwiptjcpczamewmyaost.supabase.co
VITE_SUPABASE_ANON_KEY=<Dashboard -> Project Settings -> API -> anon public>
```

Everything else is a Supabase **edge-function secret**
(Dashboard → Project Settings → Edge Functions → Secrets). Never a `VITE_*` var:

| Secret | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `ask-karibu`, `moderate-reviews` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` | `mpesa-stk-push` |
| `MPESA_CALLBACK_SECRET` | `mpesa-stk-push`, `mpesa-callback` — **required**, `openssl rand -hex 32` |
| `MPESA_CALLBACK_URL` | optional callback base URL override |
| `RESEND_API_KEY` | `send-onboarding-email` |
| `SENTRY_DSN` | error tracking |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
into edge functions by the platform. Do not set them by hand.

## Reproducing this on a fresh project

The schema was applied through the Supabase MCP server rather than the CLI,
because the CLI's `db push` needs the database password and this project never
had one set. The result is identical — the migrations are the same files — but
if you are standing up a second environment (staging), the CLI is the better
path:

```bash
# One-off
export SUPABASE_ACCESS_TOKEN=<Dashboard -> Account -> Access Tokens>
npx supabase link --project-ref <ref>          # prompts for the DB password

# Every schema change
npx supabase migration new <name>              # write the SQL
npx supabase db push --linked                  # staging first, then prod
```

Local development is unchanged and does not touch the cloud:

```bash
npx supabase start        # local stack
npx supabase db reset     # migrations/ + seed.sql
```

### One wrinkle worth knowing

`apply_migration` over MCP stamps its own timestamp as the migration version, not
the filename's. Left alone, the cloud's `supabase_migrations.schema_migrations`
would not match `supabase/migrations/*.sql`, and the next `supabase db push`
would try to re-apply everything. The versions were rewritten to the repo's
filenames, so the two are in sync and `db push` is now a no-op:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
-- 20260601000001 core_schema
-- 20260601000002 rls_policies
-- 20260601000003 functions_triggers_views
-- 20260601000004 rate_limits
-- 20260622225015 add_role_grants
-- 20260622233557 add_cities_sort_order
-- 20260710150000 harden_payments_and_review_abuse
-- 20260710160000 lock_down_api_role_grants
```

## The grant model differs local vs cloud — and that mattered

`20260622225015_add_role_grants.sql` was written against the local stack, where
migrations run as `postgres` and Supabase's auto-grant default privilege (scoped
to `supabase_admin`) never fires, leaving the API roles with **no** privileges.
In the cloud the opposite happens: default privileges hand `anon` and
`authenticated` **every** privilege on every new table in `public`.

Measured on this project right after the first push:

```
has_table_privilege('anon','public.businesses','DELETE')               -> true
has_table_privilege('anon','public.reviews','UPDATE')                  -> true
has_table_privilege('anon','public.mv_business_review_stats','SELECT') -> true
```

RLS was still filtering the app tables, but that made RLS the only layer — and
**materialized views are not subject to RLS at all**, so
`mv_business_review_stats` (per-business pending-moderation counts) was readable
by anyone holding the public anon key.

`20260710160000_lock_down_api_role_grants.sql` revokes everything from the API
roles and re-grants exactly the intended model, so both environments converge on
the same end state. After it:

```
anon         -> SELECT on cities, categories, sub_types, businesses, reviews, guides
authenticated-> the same, plus INSERT reviews, full saved_places, SELECT subscriptions
service_role -> full access to the app tables and the analytics views
mv_*         -> service_role only (401 to anon)
```

## Verifying a deployment

```bash
URL=https://jwiptjcpczamewmyaost.supabase.co
ANON=<anon key>

# Public reads work
curl -s "$URL/rest/v1/businesses?select=slug&status=eq.active" -H "apikey: $ANON"
curl -s "$URL/rest/v1/guides?select=slug&is_published=eq.true" -H "apikey: $ANON"

# Private tables are denied (expect 401, code 42501 — not an empty array)
curl -s "$URL/rest/v1/ai_conversations?select=id"         -H "apikey: $ANON"
curl -s "$URL/rest/v1/mv_business_review_stats?select=*"  -H "apikey: $ANON"
```

A `200 []` where you expect a denial means the grant is present and only RLS is
stopping you. That is the failure mode this setup is designed to avoid.

Then run the linter, which is what surfaced the grant problem in the first place:
Dashboard → Advisors → Security, or `get_advisors` over MCP.

## Known open items

Tracked in `MIGRATION_CHECKLIST.md`. The short version:

- **`spatial_ref_sys` is writable by `anon`** (PostGIS). It has no RLS, is served
  by PostgREST, and is owned by `supabase_admin`, so no migration of ours can
  revoke it. The fix is to reinstall PostGIS into the unexposed `extensions`
  schema. `businesses.location` is unused and NULL everywhere, so this is cheap
  now and expensive after launch.
- `ranking_score` is `0` on every row until `calculate-rankings` runs, so
  Discover's ordering is currently arbitrary.
- The project must be transferred to a Kigs Apex organization and upgraded off
  the free plan before go-live.
