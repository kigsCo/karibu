// _shared/security.ts
// Primitives the webhook and anti-abuse paths depend on. Deliberately pure and
// dependency-free so they can be unit-tested without a network or a database.

/**
 * Constant-time string comparison. A `===` on a secret leaks its bytes: the
 * comparison returns on the first differing character, so response latency
 * tells an attacker how many leading bytes they guessed right.
 *
 * The loop always runs over the longer of the two inputs, and every byte is
 * folded into `diff`, so the running time depends only on the input length —
 * which the attacker already controls — and never on the secret's content.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  // Seed with the length difference so mismatched lengths can never pass, while
  // still walking the full loop below.
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Pull the shared secret out of an inbound M-Pesa callback request URL.
 *
 * Safaricom lets us register any `CallBackURL` but never lets us add a request
 * header, so the secret has to ride on the URL itself. We accept it either as a
 * `?token=` query parameter or as a trailing path segment
 * (`/functions/v1/mpesa-callback/<secret>`), because some Daraja setups strip
 * query strings from registered URLs.
 *
 * Returns null when no candidate is present. The caller still has to compare it
 * against the configured secret in constant time.
 */
export function extractCallbackToken(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;

  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  // A bare `/functions/v1/mpesa-callback` carries no token.
  if (last && last !== "mpesa-callback") return last;
  return null;
}

/**
 * Append the shared secret to the CallBackURL we hand to Daraja, so the
 * callback can authenticate itself. Kept next to `extractCallbackToken` — the
 * two are one protocol and must not drift apart.
 */
export function withCallbackToken(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * HMAC-SHA256 of `value` under `secret`, hex-encoded.
 *
 * Used to bucket a phone number for rate limiting without ever writing the
 * number itself to the database. A bare SHA-256 would be security theatre
 * here: Kenyan mobile numbers live in a ~10^8 space, so anyone who got hold of
 * the table could enumerate every digest in seconds and recover the numbers.
 * Keying the digest with a server-side secret makes it meaningless to anyone
 * who does not also hold that secret.
 */
export async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** True when `value` can be stored in a Postgres `inet` column. */
export function isIpLiteral(value: string): boolean {
  const v4 = IPV4.exec(value);
  if (v4) return v4.slice(1).every((octet) => Number(octet) <= 255);
  // Loose IPv6 check: hex groups, colons, and an optional embedded IPv4 tail.
  return value.includes(":") && /^[0-9a-fA-F:.]+$/.test(value);
}

/**
 * The client IP, taken from the **last** `X-Forwarded-For` hop.
 *
 * Each proxy appends the address of the peer it received the request from, so
 * the last entry is the one written by the proxy closest to us — Supabase's
 * edge — and is the only entry a client cannot forge. Reading the *first* hop
 * (the intuitive choice) reads a value the client sent, which makes any per-IP
 * limit bypassable by sending `X-Forwarded-For: <anything>`.
 *
 * Falls back to `0.0.0.0` when the header is absent (local dev) or malformed,
 * which buckets those callers together rather than letting them through
 * unlimited.
 */
export function clientIpFromXff(headerValue: string | null): string {
  const hops = (headerValue ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  const last = hops[hops.length - 1];
  return last && isIpLiteral(last) ? last : "0.0.0.0";
}
