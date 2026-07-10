# Operations

> How Karibu is run day to day: what we watch, what we check, how we respond when something breaks, and how schema changes reach production safely. The guiding principle is the same one that shapes the architecture — keep it small enough that a solo operator can actually do all of it, and automate the rest.

## Observability — what we monitor

We watch a deliberately short list of signals. Each one maps to a way the product can fail a user or burn money.

| Signal | Source | Why it matters / alert |
|---|---|---|
| **Error rate** (frontend + edge functions) | Sentry | The first sign that a deploy or a dependency broke. |
| **API latency on critical paths** | Sentry / function logs | Specifically **Ask Karibu**, **business-detail load**, and **review submission** — the three flows a slow response actually hurts. |
| **DB slow query log** | Supabase / Postgres | Anything **> 500 ms** gets surfaced; it usually means a missing index or an accidental live aggregation. |
| **Review volume + moderation backlog** | DB (`reviews WHERE status='pending_moderation'`) | A growing backlog means moderation isn't keeping up; an abnormal spike can mean review-bombing. |
| **M-Pesa transaction success rate** | DB / function logs | Failed payments are lost revenue and unhappy merchants. |
| **Anthropic API spend** | Anthropic billing | **Alert if 80% of the monthly budget is consumed within the first 20 days** — the early-warning that usage (or abuse) is outrunning the plan. |

These six cover the failure surface: code health, user-facing speed, database health, the trust pipeline, the money-in path, and the money-out path.

## Daily checklist

A short, repeatable pass — most days it is five quiet minutes:

- Check Sentry for any **new** error pattern (≈5 min).
- Work the **moderation queue** — manually approve or reject anything the pipeline flagged.
- Confirm the **overnight `ranking_score` recalculation** completed (the `calculate-rankings` cron).
- **Spot-check 5 new business listings** sitting in `pending` — sanity-check the verification.
- **Verify Ask Karibu quality** on 3 sample queries — confirm it still grounds answers in the real directory.

## Weekly tasks

- **Founder standup** (Slack) covering signups, reviews, and AI usage.
- **Backup verification** — restore last week's backup to a scratch project and confirm it is intact. A backup you have never restored is a hope, not a backup.
- **Sentry digest** — root-cause the top 3 error patterns of the week.
- **Anthropic invoice check** — actual spend vs budget, reconciled against the daily spend signal.

## Incident response

When something breaks, the sequence is fixed so that no judgement is needed under pressure:

1. **Acknowledge** in the team Slack channel **within 15 minutes**. Visible ownership stops duplicated effort.
2. **Triage** — is the site *down* or just *slow*? Are all users affected, or one feature? This decides urgency and scope.
3. **Communicate** — if it is visitor-facing, post a status banner via **`status.karibu.co.ke`** (a status page on a simple Vercel deploy). Tell users before they tell you.
4. **Fix** — if a recent deploy caused it, **roll back**; if it is a data issue, **hotfix**. Prefer the fastest safe path to restoring service over the most elegant one.
5. **Post-mortem within 48 hours**, even for small incidents. The compounding learning is worth the write-up; blameless and focused on the system, not the person.

## Database migration workflow

Schema changes are managed exclusively through the **Supabase CLI**, as numbered SQL files in [`supabase/migrations/`](../supabase/migrations/). The rules from [`supabase/CLAUDE.md`](../supabase/CLAUDE.md) hold: one concern per migration, RLS enabled in the same migration that creates a table, and a shipped migration is **immutable** — never edit one that has reached staging or production; write a new one.

The workflow always reaches **staging before production**:

```bash
# 1. Create the migration and edit the generated SQL
supabase migration new add_subscriptions_table

# 2. Apply and verify locally
supabase db reset            # runs all migrations + seed.sql on the local stack

# 3. Apply to STAGING first — verify there before touching prod
supabase db push --linked    # linked to karibu-staging

# 4. Only once staging is verified, promote to PRODUCTION
supabase db push --linked    # linked to karibu-prod
```

In CI, the same ordering is enforced by the pipeline: GitHub Actions runs lint, type-check, and build on every push; on merge to `dev` it auto-deploys to `dev.karibu.co.ke`; a manual promotion to `staging` deploys there; and a manual promotion to `main` deploys to `karibu.co.ke`, where the `deploy-supabase-functions` job links the production project and deploys the edge functions. Migrations apply in numbered order on staging and then production — never straight to prod.

The discipline is non-negotiable for one reason: production data has no undo beyond the backups, and the backups are only as good as last week's restore test. Staging is where a bad migration is allowed to fail.
