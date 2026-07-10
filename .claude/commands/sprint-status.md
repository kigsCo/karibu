---
description: Summarize current sprint progress vs the goal, with what's next and any blockers.
argument-hint:
allowed-tools: Read, Grep, Glob
---

Read `docs/SPRINT_01.md` and the sprint task list, then summarize progress against the sprint goal. Read the root `CLAUDE.md` ("Where we are right now") for context on the current phase (backend foundation: schema + RLS + seed live in Supabase).

If `docs/SPRINT_01.md` does not exist yet, say so plainly and fall back to the root `CLAUDE.md` status section plus any task list you can find under `docs/` — do not invent progress.

Produce:
1. **Sprint goal** — one line, quoted from the doc.
2. **Progress** — what's done vs in-progress vs not-started, mapped to the goal (cite the tasks/checklist items as evidence; do not assume completion that isn't recorded).
3. **What's next** — the next 2–4 concrete tasks in priority order.
4. **Blockers / risks** — anything flagged, plus any guardrail risks you notice (e.g. the leaked Anthropic key still in `src/KaribuApp.jsx`).

Keep it tight and factual — this is a status read, not a plan rewrite. Do not edit any files.
