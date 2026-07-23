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

- All 10 migrations in `supabase/migrations/`, applied in filename order.
- `supabase/seed.sql`: 5 cities, 13 categories, 47 sub-types, 10 active
  businesses, 6 published reviews, 6 published guides.
- RLS enabled on all 10 app tables.
- **All 7 edge functions (deployed 2026-07-12).** Each was pushed with its
  `_shared/*.ts` closure bundled and `verify_jwt` set per the table below.
  Verified from outside: every function boots and **fails closed** until its
  secret is set (see the sweep in "Verifying a deployment"). They are inert but
  live — a stranger gets a 401/503, never a working endpoint.

  | Function | `verify_jwt` | Inert until |
  |---|---|---|
  | `ask-karibu` | false | `ANTHROPIC_API_KEY` |
  | `submit-review` | true | a signed-in user (Phase 5 auth) |
  | `moderate-reviews` | false | `INTERNAL_FUNCTION_SECRET` + cron |
  | `calculate-rankings` | false | `INTERNAL_FUNCTION_SECRET` + cron |
  | `send-onboarding-email` | false | `INTERNAL_FUNCTION_SECRET` + `RESEND_API_KEY` |
  | `mpesa-stk-push` | false | `MPESA_ENABLED=true` + M-Pesa creds |
  | `mpesa-callback` | false | `MPESA_CALLBACK_SECRET` |

Not yet done: **no secrets set, no cron schedules, no frontend host.** Setting
the secrets below and scheduling the three crons is what turns these live-but-inert
functions on. The functions were deployed with the Supabase MCP `deploy_edge_function`
tool rather than the CLI; the CI deploy job stays disarmed (`SUPABASE_PROJECT_REF`
unset) and setting it later simply re-deploys the same code on the next push to `main`.

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
| `INTERNAL_FUNCTION_SECRET` | `moderate-reviews`, `calculate-rankings`, `send-onboarding-email`, `admin-review` (caller — attaches it when triggering `send-onboarding-email` on approval) — **required**, `openssl rand -hex 32` |
| `MPESA_ENABLED` | `mpesa-stk-push`. Set to the exact string `true` to accept payments. Anything else, including unset, means the function returns 503 and does nothing. |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` | `mpesa-stk-push` |
| `MPESA_CALLBACK_SECRET` | `mpesa-stk-push`, `mpesa-callback` — **required**, `openssl rand -hex 32` |
| `MPESA_CALLBACK_URL` | optional callback base URL override |
| `RESEND_API_KEY` | `send-onboarding-email` |
| `SENTRY_DSN` | error tracking |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
into edge functions by the platform. Do not set them by hand.

### Why `INTERNAL_FUNCTION_SECRET` exists, and why `verify_jwt` is not it

Three functions must only ever be called by our own backend: two crons that
rewrite `reviews` and `ranking_score` with the service role and spend Anthropic
tokens, and one that sends mail from our verified domain.

The obvious lever is `verify_jwt = true` in `config.toml`. It is the wrong lever.
**The anon key is a valid JWT, and it ships in the browser bundle by design.**
Turning `verify_jwt` on would authenticate "some Supabase client" — which is
every visitor — not "our backend". So those three functions keep `verify_jwt`
off and compare an `x-karibu-internal-secret` header against
`INTERNAL_FUNCTION_SECRET` in constant time instead
(`supabase/functions/_shared/internal-auth.ts`).

They **fail closed**: with the secret unset they return 503 and do nothing. An
unconfigured deploy is a visibly broken cron job, never an open endpoint.

## Auth: Google sign-in and the profiles table

The `/welcome` landing page offers three sign-in flavours: Google OAuth,
email + password, and the passwordless magic link. Email/password and magic
link work out of the box (GoTrue). Google needs one-time configuration:

1. **Google Cloud Console** → APIs & Services → Credentials → Create
   Credentials → *OAuth client ID* → Web application. Authorized redirect URI:
   `https://jwiptjcpczamewmyaost.supabase.co/auth/v1/callback`
   (plus `http://127.0.0.1:54321/auth/v1/callback` if you want it locally).
2. **Supabase Dashboard** → Authentication → Providers → Google → enable, and
   paste the client ID + secret. Nothing goes in the repo or in `VITE_*` vars.
3. **Dashboard → Authentication → URL Configuration**: set the site URL to the
   deployed frontend origin and add it to the redirect allow-list — the app
   passes `redirectTo: <origin>/welcome`, which must be allow-listed or GoTrue
   silently falls back to the site URL.
4. Locally, the provider is `enabled = false` in `supabase/config.toml`; flip
   it and export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` if you
   need real Google locally. Without it, the button surfaces GoTrue's
   "provider is not enabled" error — an honest failure, not a crash.

Every signup (any flavour) fires the `on_auth_user_created` trigger
(`20260722205636_create_profiles.sql`), which creates the user's row in
`public.profiles` — the customer database. Profiles are owner-only under RLS:
no anon access, and the client can update only `full_name`, `avatar_url`, and
`home_city_id` (column-scoped grant; the `email` copy is trigger-maintained).
`supabase test db` runs `supabase/tests/profiles_test.sql` against all of this.

## Scheduling the cron functions

`moderate-reviews` runs hourly, `calculate-rankings` nightly at 03:00 EAT, and
`prune_rate_limits()` nightly at 03:30 EAT. The two function crons are scheduled
with `pg_cron` + `pg_net` (they make an authenticated HTTP call to the edge
function); the prune job is a direct SQL call, so it needs `pg_cron` only. Either
way the schedule lives in the database rather than in this repo.

**Run this once in the SQL editor. Do not put it in a migration** — migrations
are committed to git, and both the shared secret and the service-role key would
go with them.

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Encrypted at rest, and readable only by postgres.
select vault.create_secret(
  '<the same value as the INTERNAL_FUNCTION_SECRET edge-function secret>',
  'internal_function_secret',
  'Shared secret for backend-only edge functions'
);

select cron.schedule('moderate-reviews-hourly', '0 * * * *', $job$
  select net.http_post(
    url     := 'https://jwiptjcpczamewmyaost.supabase.co/functions/v1/moderate-reviews',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-karibu-internal-secret',
        (select decrypted_secret from vault.decrypted_secrets
          where name = 'internal_function_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- 00:00 UTC == 03:00 Africa/Nairobi.
select cron.schedule('calculate-rankings-nightly', '0 0 * * *', $job$
  select net.http_post(
    url     := 'https://jwiptjcpczamewmyaost.supabase.co/functions/v1/calculate-rankings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-karibu-internal-secret',
        (select decrypted_secret from vault.decrypted_secrets
          where name = 'internal_function_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- Nightly prune of the rate_limits table. 00:30 UTC == 03:30 EAT, offset from
-- the rankings job. This is a direct SQL call — prune_rate_limits() is defined
-- in 20260601000004_rate_limits.sql and just deletes rows older than 7 days —
-- so it needs no pg_net, no HTTP, and no secret.
select cron.schedule('prune-rate-limits-nightly', '30 0 * * *', $job$
  select prune_rate_limits();
$job$);
```

Check on them, and take them away again:

```sql
select jobid, jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select cron.unschedule('moderate-reviews-hourly');
```

If a job's `status` is `succeeded` but nothing changed in the database, read the
edge function's logs: a 401 there means the Vault secret and the edge-function
secret have drifted apart. Rotating one means rotating both.

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
-- 20260710170000 move_postgis_out_of_public
-- 20260710180000 add_guides_hero_variant
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

- `ranking_score` is `0` on every row until `calculate-rankings` runs, so Discover's
  ordering is currently arbitrary (it falls through to the `id` tiebreaker).
- The project must be transferred to a Kigs Apex organization and upgraded off
  the free plan before go-live. A free project pauses after 7 days idle.
- `.mcp.json` still carries `--project-ref=YOUR_PROJECT_REF`.

## PostGIS lives in `extensions`, not `public`

`20260601000001_core_schema.sql` ran `CREATE EXTENSION postgis;` with no schema, so
PostGIS installed into `public` — and so did `spatial_ref_sys`, which has no RLS,
cannot be given any (we do not own it), is served by PostgREST, and had
`INSERT`/`DELETE` granted to `anon` by the cloud's default privileges. The anon key
is public by design, so that was a writable endpoint for anyone.

`20260710170000_move_postgis_out_of_public.sql` moves PostGIS and `pg_trgm` into the
unexposed `extensions` schema. PostGIS does not support `ALTER EXTENSION ... SET
SCHEMA`, so it is dropped and recreated; `businesses.location` was read by no code
and NULL on every row, so nothing was lost. The three PostGIS endpoints now return
`404 / PGRST205`.

**Consequence for future migrations:** the `geography` type is no longer on the
default `search_path`. Write `extensions.geography(Point, 4326)` and
`extensions.gin_trgm_ops` explicitly, as that migration does.

The Supabase security advisor is now clean — zero ERROR, zero WARN. The two
remaining INFO items (`ai_conversations`, `rate_limits`: RLS on, no policies) are
intentional; those tables are service-role only.
