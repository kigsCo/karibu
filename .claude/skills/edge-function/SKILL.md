---
name: edge-function
description: Use when scaffolding or editing a Karibu Deno edge function in supabase/functions/ — handling CORS/OPTIONS, validating input, reading secrets from Deno.env, returning the shared JSON error shape, and registering the function in config.toml with the right verify_jwt. Covers the _shared helpers and cron-vs-request-path functions.
---

# Scaffolding a Deno edge function

Edge functions are Karibu's business-logic layer (Deno runtime). Each lives at `supabase/functions/<name>/index.ts`. Read `supabase/CLAUDE.md` first. Existing functions: `ask-karibu`, `submit-review`, `moderate-reviews`, `calculate-rankings`, `mpesa-stk-push`, `mpesa-callback`, `send-onboarding-email`.

## When to use
Creating a new function, or editing one to fix CORS, validation, secrets, error shape, or registration.

## Procedure
1. **Create the dir + entry file:** `supabase/functions/<name>/index.ts`.
2. **Handle OPTIONS first** via `handleOptions(req)` from `_shared/cors.ts`.
3. **Validate input** — parse JSON, reject missing/malformed fields with a 400 *before* doing work.
4. **Read secrets from `Deno.env`** — never hardcode. `ANTHROPIC_API_KEY`, `MPESA_*`, `RESEND_API_KEY` live in Supabase's secret store, not in code or `VITE_*`.
5. **Use the service-role client** (`_shared/client.ts`) for DB work that must bypass RLS (moderation, ranking, reconciliation). The browser only ever calls functions with the anon key / user JWT.
6. **Return the shared JSON shape** — `json(data)` on success, `errorResponse(msg, status)` on failure (`_shared/response.ts`). Errors are always `{ error: string }`.
7. **Rate-limit** request-path functions that accept user input via `_shared/ratelimit.ts`.
8. **Paginate** any function that returns a list via `_shared/pagination.ts` (keyset by default; see `db-performance`).
9. **Register in `config.toml`** with the correct `verify_jwt` (see below).
10. **Test locally:** `supabase functions serve <name>`.

## _shared helpers — import, don't re-implement
Shared code lives in `supabase/functions/_shared/`:
- `cors.ts` — `corsHeaders`, `handleOptions(req)` (returns a 204 for OPTIONS, else null).
- `response.ts` — `json(data, status=200)`, `errorResponse(message, status=500)`.
- `client.ts` — service-role Supabase client (server-only key). *(Create from the pattern below if not present.)*
- `ratelimit.ts` — per-IP / per-user limiter (used by `submit-review`, `ask-karibu`).
- `pagination.ts` — keyset/offset cursor parsing for list endpoints.

Import with a relative path and pinned versions:
```ts
import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { serviceClient } from "../_shared/client.ts";
```

## Minimal function template
```ts
// supabase/functions/<name>/index.ts
import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { serviceClient } from "../_shared/client.ts";

Deno.serve(async (req) => {
  // 1. CORS preflight
  const pre = handleOptions(req);
  if (pre) return pre;

  // 2. Method guard
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    // 3. Parse + validate input
    const body = await req.json().catch(() => null);
    if (!body || typeof body.business_slug !== "string") {
      return errorResponse("business_slug is required", 400);
    }

    // 4. Secrets from env (never hardcode)
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return errorResponse("Server misconfigured", 500);

    // 5. DB work via service role (bypasses RLS by design)
    const db = serviceClient();
    const { data, error } = await db
      .from("businesses")
      .select("id, name, rating")
      .eq("slug", body.business_slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) return errorResponse(error.message, 500);
    if (!data) return errorResponse("Not found", 404);

    // 6. Consistent success shape
    return json({ business: data });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
```

`_shared/client.ts` pattern (if you need to create it):
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,   // server-only; never exposed to the browser
    { auth: { persistSession: false } },
  );
}
```

## Registering in config.toml — verify_jwt
Add a `[functions.<name>]` block. `verify_jwt` decides whether Supabase requires a valid user JWT before invoking:
```toml
[functions.submit-review]
verify_jwt = true        # request-path, user must be signed in

[functions.ask-karibu]
verify_jwt = false       # public/anon callable from the browser (still rate-limited inside)

[functions.calculate-rankings]
verify_jwt = false       # cron-triggered, not user-facing (protect via cron/secret, not JWT)
```
- **`true`** for user actions that require auth (reviews, owner actions).
- **`false`** for anon-callable public functions and for **cron** functions.

## cron vs request-path
- **Request-path** (`ask-karibu`, `submit-review`, `mpesa-stk-push`): invoked by the browser via `supabase.functions.invoke(...)`. Must be fast, validated, rate-limited. Never do heavy/batch work inline.
- **Cron** (`moderate-reviews`, `calculate-rankings`, reconciliation, emails): scheduled (pg_cron / Supabase scheduled function), off the request path. These do the heavy lifting and write cached columns. Fire-and-forget logging (e.g. `ai_conversations` insert) must never block a response.

## Common mistakes
- Forgetting the `OPTIONS` handler -> browser CORS failure.
- Hardcoding a key or reading it from a `VITE_*` var (the Anthropic key must never reach the client — guardrail 1).
- Returning ad-hoc error JSON instead of `errorResponse` (breaks the frontend's single error shape).
- Using the anon client where service-role is needed (or vice versa).
- Doing heavy/batch work in a request-path function instead of a cron function.
- Wrong `verify_jwt` (locking out anon callers, or leaving a user action unauthenticated).

## Checklist
- [ ] `OPTIONS`/CORS handled via `handleOptions`.
- [ ] Input parsed and validated; bad input -> 400.
- [ ] Secrets read from `Deno.env`, never hardcoded or in `VITE_*`.
- [ ] Service-role client only server-side; lists are paginated; user input rate-limited.
- [ ] Success via `json(...)`, errors via `errorResponse(...)` ({ error } shape).
- [ ] Registered in `config.toml` with correct `verify_jwt`.
- [ ] Heavy/batch work is cron, not inline.
