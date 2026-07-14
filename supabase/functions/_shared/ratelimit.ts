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
 * Records the hit FIRST, then counts (the row just written included). Counting
 * first would let N concurrent callers all read "under the limit" before any of
 * them has written — which is exactly how a botnet slips past the global
 * per-phone STK limit. Uses the service-role client (bypasses RLS). Fails OPEN
 * on a DB error — a rate-limiter outage must not block legitimate users; the DB
 * constraints + RLS are still the hard backstop.
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

    // Record this attempt before counting, so requests racing the same bucket
    // each observe the other's row. Not a hard guarantee (two PostgREST
    // round-trips, not one transaction) but it closes the wide TOCTOU window a
    // count-first check leaves open — the window a botnet uses to ring one
    // phone from many IPs at once.
    const { error: insertError } = await supabase
      .from("rate_limits")
      .insert({ ip, key });
    if (insertError) {
      // Couldn't record the hit, so we can't count it reliably either. Fail
      // open, consistent with the count-error path below.
      console.error("rate-limit insert failed (failing open):", insertError.message);
      return true;
    }

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

    // `count` includes the row just inserted, so the Nth caller in the window
    // sees N; allow up to and including `max`.
    return (count ?? 0) <= max;
  } catch (e) {
    console.error("rate-limit unexpected error (failing open):", e);
    return true;
  }
}

/**
 * The sentinel `ip` for buckets that are not keyed by an IP at all. The column
 * is `inet NOT NULL`, so a global bucket still has to store something.
 *
 * `clientIpFromXff` also falls back to this address, but the two can never
 * collide: a global bucket's `key` is namespaced (`<action>:phone:<hmac>`) and
 * a per-IP bucket's key is the bare action name.
 */
const GLOBAL_BUCKET_IP = "0.0.0.0";

/**
 * A limit on `key` alone, counted across every source IP.
 *
 * Per-IP limits protect *us* from one noisy client. Some abuse is aimed at a
 * third party instead — an STK push makes a stranger's phone buzz with a
 * payment prompt, and an attacker with a botnet has as many IPs as they like.
 * What has to be limited there is the target, not the source.
 */
export function checkGlobalRateLimit(
  supabase: SupabaseClient,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  return checkIpRateLimit(supabase, GLOBAL_BUCKET_IP, key, max, windowSeconds);
}
