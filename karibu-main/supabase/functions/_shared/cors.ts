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
  "Access-Control-Allow-Headers": "authorization, content-type",
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
