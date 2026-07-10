// _shared/client.ts
// Supabase client factories. Two flavours, deliberately separate:
//
//   createServiceClient() — uses the SERVICE ROLE key. Bypasses RLS. SERVER ONLY.
//     Use inside cron/admin functions and for fire-and-forget logging. NEVER
//     expose this key to the browser.
//
//   createUserClient(req) — uses the ANON key but forwards the caller's
//     Authorization header, so RLS runs as the logged-in user. Use when a
//     function acts on behalf of a user (e.g. submit-review) and you want the
//     database policies to enforce ownership.
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
// the Supabase edge runtime automatically; read them from Deno.env.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Service-role client. Bypasses RLS. Server-only. */
export function createServiceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Anon client that forwards the caller's JWT so RLS runs as that user. */
export function createUserClient(req: Request): SupabaseClient {
  const authorization = req.headers.get("Authorization") ?? "";
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    },
  );
}
