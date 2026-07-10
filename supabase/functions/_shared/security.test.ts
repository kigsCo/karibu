// _shared/security.test.ts
// Run: deno test supabase/functions/_shared/security.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  clientIpFromXff,
  extractCallbackToken,
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
