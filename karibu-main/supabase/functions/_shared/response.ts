// _shared/response.ts
// Consistent JSON response shape for every edge function. Success returns the
// raw payload; errors always return { error: string } so the frontend can
// rely on one shape (see supabase/CLAUDE.md "return the shared JSON error shape").

import { corsHeaders } from "./cors.ts";

const JSON_HEADERS = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

/** Success (or any) JSON response with CORS headers attached. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/** Error response with the consistent { error } shape. Defaults to 500. */
export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}
