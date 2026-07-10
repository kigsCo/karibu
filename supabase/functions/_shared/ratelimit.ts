// _shared/ratelimit.ts
// Minimal IP-based rate limiting backed by a `rate_limits` table. This is an
// abuse-mitigation layer in front of RLS, not a substitute for it.
//
// ---------------------------------------------------------------------------
// REQUIRED MIGRATION (add as a numbered migration, e.g. 20260601000004_rate_limits.sql)
// ---------------------------------------------------------------------------
//   CREATE TABLE rate_limits (
//     id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
//     ip          inet NOT NULL,
//     key         text NOT NULL,            -- the action being limited, e.g. 'submit-review'
//     created_at  timestamptz NOT NULL DEFAULT now()
//   );
//   -- Hot-path lookup: count recent hits for (ip, key).
//   CREATE INDEX idx_rate_limits_ip_key_time ON rate_limits(ip, key, created_at DESC);
//   ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
//   -- No policies => only the service role (edge functions) can touch it.
//   -- A nightly cron can prune old rows:
//   --   DELETE FROM rate_limits WHERE created_at < now() - interval '7 days';
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Returns true if the request is ALLOWED (under the limit), false if it has
 * exceeded `max` hits for `key` from `ip` within the last `windowSeconds`.
 *
 * Records a hit when allowed. Uses the service-role client (bypasses RLS).
 * Fails OPEN on a DB error — a rate-limiter outage must not block legitimate
 * users; the DB constraints + RLS are still the hard backstop.
 */
export async function checkIpRateLimit(
  supabase: SupabaseClient,
  ip: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count, error } = await supabase
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("key", key)
      .gt("created_at", since);

    if (error) {
      console.error("rate-limit count failed (failing open):", error.message);
      return true;
    }

    if ((count ?? 0) >= max) return false;

    // Record this hit. Fire-and-forget-ish: a failure here shouldn't block.
    const { error: insertError } = await supabase
      .from("rate_limits")
      .insert({ ip, key });
    if (insertError) {
      console.error("rate-limit insert failed:", insertError.message);
    }

    return true;
  } catch (e) {
    console.error("rate-limit unexpected error (failing open):", e);
    return true;
  }
}
