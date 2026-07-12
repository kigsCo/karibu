// _shared/cors.ts
// Single source of truth for CORS. Every edge function imports these helpers
// instead of re-implementing headers per function (see supabase/CLAUDE.md).
//
// The frontend calls functions from the browser, so we must answer the
// preflight OPTIONS request and echo permissive headers. Origin is "*" because
// the anon key / user JWT is what actually authorizes the request, not origin.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // supabase-js `functions.invoke` sends apikey + x-client-info (and, on newer
  // clients, x-supabase-api-version) alongside authorization. The browser
  // preflight fails unless every one of those is allowed here — omitting them is
  // why an in-browser call 404s/throws "Failed to send a request" even though a
  // raw curl (which skips preflight) works. This is the canonical Supabase set.
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

/**
 * Handle a CORS preflight request. Call this first in every function:
 *
 *   const pre = handleOptions(req);
 *   if (pre) return pre;
 *
 * Returns a 204 Response for OPTIONS, or null for any other method (so the
 * caller continues with its real logic).
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}
