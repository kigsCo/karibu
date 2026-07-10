---
description: Run the db-performance + security review checklist over the current changes (branch or diff).
argument-hint: [branch-or-diff]
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git status:*)
---

Run the **db-reviewer** agent's checklist over the current changes. Scope: `$ARGUMENTS` if given (a branch name, a commit range, or a diff spec); otherwise review the working tree and the current branch vs `main`.

First determine the changed files — use `git diff $ARGUMENTS` / `git diff main...HEAD` / `git status` as appropriate — then Read the changed migrations, edge functions, and frontend files. Consult the **`db-performance`** and **`rls-policy`** skills and the root `CLAUDE.md` scalability rules + guardrails as your rubric.

Audit every change against all of:
1. **Indexing** — every new FK and hot-path `WHERE`/`ORDER BY` column indexed (partial / GiST / GIN where it fits); no seq-scan-at-scale risks.
2. **Keyset pagination** on hot lists; no offset on public lists, no unbounded `select('*')`.
3. **No live aggregation** — `rating`/`review_count`/`ranking_score` read from cached columns; dashboards read materialized views, not `GROUP BY` on page load.
4. **RLS on new tables** — `ENABLE ROW LEVEL SECURITY` + policies in the same migration; no leak of `pending`/unpublished rows.
5. **No secrets in the frontend** — Anthropic / `MPESA_*` / `RESEND_*` only in `Deno.env` server-side; flag any browser `fetch("https://api.anthropic.com/...")` as critical.
6. **N+1 risks** — no per-row query loops; batch/join/cache instead.
7. **Heavy work off the request path** — moderation/ranking/email/reconciliation on cron, not inline; logging never blocks a response.

This is a read-only review: do not edit files and do not run any state-changing git/supabase commands. Return findings grouped by severity (Critical → High → Medium → Low) with file/line and a concrete fix for each, and end with a clear verdict: safe to merge, or blockers remain.
