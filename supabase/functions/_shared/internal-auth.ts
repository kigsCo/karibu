// _shared/internal-auth.ts
// Authenticates the callers that are our own backend rather than a browser:
// the pg_cron jobs behind `moderate-reviews` and `calculate-rankings`, and the
// server-side flow that triggers `send-onboarding-email`.
//
// WHY NOT `verify_jwt = true`?
//
// Because the anon key IS a valid JWT, and it ships inside the browser bundle
// by design. Flipping verify_jwt on would let every visitor invoke these
// functions using a key they already have — it authenticates "some Supabase
// client", which is everyone, not "our backend", which is what we mean. Only a
// secret the browser never sees can express that distinction.
//
// These functions are dangerous in a stranger's hands: two of them spend money
// (Anthropic tokens) and rewrite `reviews` / `ranking_score` with the service
// role, and one of them sends mail from our verified domain. None has any
// business being reachable from a browser.
//
// Fails CLOSED. If `INTERNAL_FUNCTION_SECRET` is unset the function refuses to
// run at all, because an unconfigured deploy should be a broken cron job — loud,
// visible, fixable — and never an open endpoint.

import { errorResponse } from "./response.ts";
import { timingSafeEqual } from "./security.ts";

export const INTERNAL_SECRET_HEADER = "x-karibu-internal-secret";

export interface InternalAuthVerdict {
  allowed: boolean;
  status: number;
  message: string;
}

/**
 * The decision, with no `Request` and no environment in sight, so the whole
 * table can be exercised in a unit test.
 *
 * The comparison is constant-time: a `===` here would return on the first
 * differing byte, and the response latency would then leak how many leading
 * bytes of the secret a caller had guessed correctly.
 */
export function checkInternalSecret(
  presented: string | null,
  configured: string | null | undefined,
): InternalAuthVerdict {
  if (!configured) {
    return {
      allowed: false,
      status: 503,
      message: "Server misconfigured (INTERNAL_FUNCTION_SECRET missing)",
    };
  }
  if (!presented || !timingSafeEqual(presented, configured)) {
    return { allowed: false, status: 401, message: "Unauthorized" };
  }
  return { allowed: true, status: 200, message: "" };
}

/**
 * Guard for the top of a handler. Returns a `Response` to short-circuit with,
 * or `null` when the caller is trusted and the handler should proceed.
 */
export function requireInternalSecret(req: Request): Response | null {
  const verdict = checkInternalSecret(
    req.headers.get(INTERNAL_SECRET_HEADER),
    Deno.env.get("INTERNAL_FUNCTION_SECRET"),
  );
  return verdict.allowed ? null : errorResponse(verdict.message, verdict.status);
}
