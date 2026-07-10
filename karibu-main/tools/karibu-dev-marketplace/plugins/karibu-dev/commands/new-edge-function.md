---
description: Scaffold a new Supabase Deno edge function using the _shared helpers and register it in config.toml.
argument-hint: <function-name>
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Invoke the **`edge-function`** skill, then scaffold a new Deno edge function at `supabase/functions/$ARGUMENTS/index.ts` for Karibu. Read the root `CLAUDE.md` and `supabase/CLAUDE.md` first, and read `supabase/functions/_shared/` so you import the helpers instead of re-implementing them.

The function must:
1. Handle `OPTIONS`/CORS first via `handleOptions(req)` from `_shared/cors.ts`.
2. Guard the method, then parse and **validate** input — reject missing/malformed fields with a 400 before doing any work.
3. Read any secrets (`ANTHROPIC_API_KEY`, `MPESA_*`, `RESEND_API_KEY`) from `Deno.env` — never hardcode, never from a `VITE_*` var.
4. Use the service-role client (`_shared/client.ts`) only where bypassing RLS is intended; rate-limit user input (`_shared/ratelimit.ts`) and paginate any list response (`_shared/pagination.ts`, keyset by default).
5. Return the shared shape: `json(data)` on success, `errorResponse(msg, status)` (always `{ error }`) on failure, from `_shared/response.ts`.
6. Keep heavy/batch work on cron, never inline in a request-path function.

Then **register it in `supabase/config.toml`**: add a `[functions.$ARGUMENTS]` block with the correct `verify_jwt` (`true` for user-acting endpoints; `false` for anon-callable public functions, webhooks, and cron), matching the documented pattern and comments already in the file. If it is a cron function, add the schedule as a comment.

When done, report the file path and the `config.toml` change, and note it should be verified locally with `supabase functions serve $ARGUMENTS`.
