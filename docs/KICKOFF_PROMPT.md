# Claude Code — Sprint 01 kickoff prompt

Paste everything in the block below as your first message to Claude Code in this repo.

---

You're picking up the Karibu backend build. This repo has a full scaffold and a "brain" — use them, don't reinvent.

## Orient first
Read, in this order: `CLAUDE.md` (root), `supabase/CLAUDE.md`, `src/CLAUDE.md`, `docs/SPRINT_01.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/SECURITY.md`. The canonical spec is `docs/karibu-developer-guide.docx`; the schema in `supabase/migrations/` is the source of truth. Confirm you can see `supabase/migrations/`, `supabase/functions/`, and `.claude/skills/`. If this repo contains only the React prototype and not this scaffold, stop and tell me before doing anything else.

## Goal
Execute **Sprint 01 — Backend Foundation**: get the Supabase schema, RLS, and seed data live; route the frontend data layer through Supabase; and close the leaked Anthropic key. Success = the prototype reads live data and Ask Karibu runs through the `ask-karibu` edge function, with the browser-side API key gone — and the UI looks identical.

## How to work
- Build a todo list from the Sprint 01 backlog. Do P0 in order, then P1; treat P2 as stretch.
- Use this repo's own tooling: the `supabase-migration`, `rls-policy`, `edge-function`, `frontend-data-migration`, `ranking-algorithm`, and `db-performance` skills; the `migration-author`, `edge-fn-builder`, `frontend-migrator`, and `db-reviewer` subagents; and the `/db-review` and `/sprint-status` commands.
- Git: work on a branch `feat/sprint-01-backend` cut from `dev`. Make small, focused commits per task. Open a draft PR into `dev` when a slice is green. Ask me before any `git push`, PR creation, or `supabase db push` (the repo's settings gate these).
- After every change: `npm run lint && npm run build` must pass and the UI must render unchanged; for DB work, run `supabase db reset` locally and the checks in `supabase/tests/`. Don't start the next task until the current one is green. Run `/db-review` before each PR.

## Guardrails (non-negotiable — see CLAUDE.md)
- The Anthropic key never touches the frontend. Swapping the `src/KaribuApp.jsx` browser call to `api.anthropic.com` for `supabase.functions.invoke('ask-karibu')` is an early P0.
- Migrate the data layer; do not restyle the UI or bulk-split `KaribuApp.jsx` (one screen at a time, if at all).
- RLS on every table; validate and rate-limit inside edge functions. Cache derived values and paginate — never add live aggregation on a hot path.
- Never commit secrets. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public.

## Where I have to step in (stop and give me a copy-paste checklist — don't fabricate or guess these)
- Creating the Supabase dev/staging/prod projects and handing you the project ref.
- Setting secrets in the Supabase dashboard: `ANTHROPIC_API_KEY`, `MPESA_*`, `RESEND_API_KEY`.
- The `.env` values (anon key + URL) for local dev.
- M-Pesa Daraja credentials, and anything needing my login or a production deploy. Remind me to rotate the exposed Anthropic key once `ask-karibu` is live.

## Your first reply
Summarize the Sprint 01 plan back to me in three lines, list your first three commits, then start the first P0 task. Check in with me after each P0 item before moving on.
