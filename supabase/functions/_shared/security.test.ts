// _shared/security.test.ts
// Run: deno test supabase/functions/_shared/security.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  clientIpFromXff,
  extractCallbackToken,
  hmacHex,
  isIpLiteral,
  timingSafeEqual,
  withCallbackToken,
} from "./security.ts";

Deno.test("timingSafeEqual matches only identical strings", () => {
  assert(timingSafeEqual("s3cr3t", "s3cr3t"));
  assert(timingSafeEqual("", ""));

  assertFalse(timingSafeEqual("s3cr3t", "s3cr3T"));
  assertFalse(timingSafeEqual("s3cr3t", "s3cr3"), "a prefix must not pass");
  assertFalse(timingSafeEqual("s3cr3", "s3cr3t"), "an extension must not pass");
  assertFalse(timingSafeEqual("s3cr3t", ""));
  assertFalse(timingSafeEqual("", "s3cr3t"));
});

Deno.test("timingSafeEqual handles multi-byte characters", () => {
  assert(timingSafeEqual("karibu-🔐", "karibu-🔐"));
  assertFalse(timingSafeEqual("karibu-🔐", "karibu-🔑"));
});

Deno.test("extractCallbackToken reads the ?token= query parameter", () => {
  assertEquals(
    extractCallbackToken("https://x.supabase.co/functions/v1/mpesa-callback?token=abc123"),
    "abc123",
  );
});

Deno.test("extractCallbackToken reads a trailing path segment", () => {
  assertEquals(
    extractCallbackToken("https://x.supabase.co/functions/v1/mpesa-callback/abc123"),
    "abc123",
  );
});

Deno.test("extractCallbackToken returns null when no token is present", () => {
  assertEquals(
    extractCallbackToken("https://x.supabase.co/functions/v1/mpesa-callback"),
    null,
  );
  assertEquals(
    extractCallbackToken("https://x.supabase.co/functions/v1/mpesa-callback?other=1"),
    null,
  );
  assertEquals(extractCallbackToken("not a url"), null);
});

Deno.test("withCallbackToken round-trips through extractCallbackToken", () => {
  const base = "https://x.supabase.co/functions/v1/mpesa-callback";
  assertEquals(extractCallbackToken(withCallbackToken(base, "s3cr3t")), "s3cr3t");

  // A base that already carries a query string must keep it.
  const withQuery = withCallbackToken(`${base}?env=sandbox`, "s3cr3t");
  assert(withQuery.includes("env=sandbox"));
  assertEquals(extractCallbackToken(withQuery), "s3cr3t");
});

Deno.test("isIpLiteral accepts real addresses and rejects junk", () => {
  assert(isIpLiteral("41.90.64.1"));
  assert(isIpLiteral("0.0.0.0"));
  assert(isIpLiteral("2001:db8::1"));

  assertFalse(isIpLiteral("999.1.1.1"), "octets above 255 are not addresses");
  assertFalse(isIpLiteral("not-an-ip"));
  assertFalse(isIpLiteral(""));
  assertFalse(isIpLiteral("41.90.64"));
});

Deno.test("clientIpFromXff takes the LAST hop, which the client cannot forge", () => {
  // An attacker sends `X-Forwarded-For: 1.2.3.4`; the trusted edge appends the
  // address it actually saw. Reading the first hop would trust the attacker.
  assertEquals(clientIpFromXff("1.2.3.4, 41.90.64.1"), "41.90.64.1");
  assertEquals(clientIpFromXff("41.90.64.1"), "41.90.64.1");
  assertEquals(clientIpFromXff("  1.2.3.4 ,  41.90.64.1  "), "41.90.64.1");
});

Deno.test("clientIpFromXff falls back to 0.0.0.0 rather than trusting junk", () => {
  assertEquals(clientIpFromXff(null), "0.0.0.0");
  assertEquals(clientIpFromXff(""), "0.0.0.0");
  assertEquals(clientIpFromXff("1.2.3.4, <script>"), "0.0.0.0");
  assertEquals(clientIpFromXff("999.999.999.999"), "0.0.0.0");
});

Deno.test("a spoofed X-Forwarded-For cannot pick its own rate-limit bucket", () => {
  // Same real client (41.90.64.1) behind three different spoofed prefixes.
  const spoofs = [
    "1.1.1.1, 41.90.64.1",
    "8.8.8.8, 41.90.64.1",
    "203.0.113.9, 203.0.113.10, 41.90.64.1",
  ];
  const buckets = new Set(spoofs.map((s) => clientIpFromXff(s)));
  assertEquals(buckets.size, 1, "all spoofs must land in one bucket");
  assertEquals([...buckets][0], "41.90.64.1");
});

// --- hmacHex -----------------------------------------------------------------

Deno.test("hmacHex: matches the RFC 4231 test vector", async () => {
  // RFC 4231 §4.3, case 2 — both key and data are plain ASCII, so this pins the
  // UTF-8 encoding and the hex formatting, not just "some digest came out".
  assertEquals(
    await hmacHex("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
});

Deno.test("hmacHex: is deterministic and fixed-width", async () => {
  const once = await hmacHex("k", "254712345678");
  const twice = await hmacHex("k", "254712345678");
  assertEquals(once, twice);
  assertEquals(once.length, 64, "SHA-256 is 32 bytes => 64 hex chars");
  assert(/^[0-9a-f]{64}$/.test(once), "lowercase hex, zero-padded");
});

Deno.test("hmacHex: a leading zero byte is not dropped", async () => {
  // A naive `toString(16)` per byte loses "0f" -> "f" and silently shortens the
  // digest. Search a small space for a digest that starts with a zero nibble.
  let sawLeadingZero = false;
  for (let i = 0; i < 64 && !sawLeadingZero; i++) {
    const digest = await hmacHex("k", `2547000000${String(i).padStart(2, "0")}`);
    assertEquals(digest.length, 64);
    if (digest.startsWith("0")) sawLeadingZero = true;
  }
  assert(sawLeadingZero, "expected at least one digest with a leading zero nibble");
});

Deno.test("hmacHex: the key changes the digest", async () => {
  // The point of keying it: without the secret, the phone -> bucket mapping is
  // not reproducible, so the table cannot be brute-forced back to numbers.
  const a = await hmacHex("secret-a", "254712345678");
  const b = await hmacHex("secret-b", "254712345678");
  assert(a !== b, "different keys must produce different buckets");
});

Deno.test("hmacHex: different phones land in different buckets", async () => {
  const a = await hmacHex("k", "254712345678");
  const b = await hmacHex("k", "254712345679");
  assert(a !== b);
});
