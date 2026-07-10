// _shared/internal-auth.test.ts
//
// Run: deno test --allow-env --node-modules-dir=none supabase/functions/_shared/internal-auth.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  checkInternalSecret,
  INTERNAL_SECRET_HEADER,
  requireInternalSecret,
} from "./internal-auth.ts";

const SECRET = "s3cr3t-internal-function-token";

// --- the decision table, with no Request and no environment ------------------

Deno.test("checkInternalSecret: an unconfigured deploy fails closed with 503", () => {
  for (const configured of [undefined, null, ""]) {
    const verdict = checkInternalSecret(SECRET, configured);
    assertFalse(verdict.allowed, `configured=${JSON.stringify(configured)} must not pass`);
    assertEquals(verdict.status, 503);
  }
});

Deno.test("checkInternalSecret: a missing header is rejected", () => {
  const verdict = checkInternalSecret(null, SECRET);
  assertFalse(verdict.allowed);
  assertEquals(verdict.status, 401);
});

Deno.test("checkInternalSecret: a wrong secret is rejected", () => {
  assertFalse(checkInternalSecret("wrong", SECRET).allowed);
});

Deno.test("checkInternalSecret: a correct prefix is not enough", () => {
  // Would pass a `startsWith`, and would pass a `===` only after the full walk.
  assertFalse(checkInternalSecret(SECRET.slice(0, -1), SECRET).allowed);
  assertFalse(checkInternalSecret(SECRET + "x", SECRET).allowed);
});

Deno.test("checkInternalSecret: whitespace is not trimmed away", () => {
  assertFalse(checkInternalSecret(` ${SECRET}`, SECRET).allowed);
  assertFalse(checkInternalSecret(`${SECRET} `, SECRET).allowed);
});

Deno.test("checkInternalSecret: the exact secret is allowed", () => {
  const verdict = checkInternalSecret(SECRET, SECRET);
  assert(verdict.allowed);
  assertEquals(verdict.status, 200);
});

// --- the guard, against a real Request ---------------------------------------

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://karibu.test/functions/v1/moderate-reviews", {
    method: "POST",
    headers,
  });
}

Deno.test("requireInternalSecret: 503 when INTERNAL_FUNCTION_SECRET is unset", async () => {
  Deno.env.delete("INTERNAL_FUNCTION_SECRET");
  const denied = requireInternalSecret(request({ [INTERNAL_SECRET_HEADER]: SECRET }));
  assert(denied, "an unconfigured function must refuse to run");
  assertEquals(denied.status, 503);
  assertEquals((await denied.json()).error, "Server misconfigured (INTERNAL_FUNCTION_SECRET missing)");
});

Deno.test("requireInternalSecret: 401 with no header", async () => {
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  const denied = requireInternalSecret(request());
  assert(denied);
  assertEquals(denied.status, 401);
  assertEquals((await denied.json()).error, "Unauthorized");
});

Deno.test("requireInternalSecret: a valid Supabase JWT does NOT authenticate", () => {
  // The whole reason this module exists. The anon key is a real, signature-valid
  // JWT that ships in the browser bundle, so `verify_jwt = true` would let any
  // visitor through. Holding one must buy a caller exactly nothing here.
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  const anonKeyBearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon.signature";
  const denied = requireInternalSecret(request({ Authorization: anonKeyBearer }));
  assert(denied, "an anon-key JWT must not be treated as an internal caller");
  assertEquals(denied.status, 401);
});

Deno.test("requireInternalSecret: 401 with the wrong secret", () => {
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  const denied = requireInternalSecret(request({ [INTERNAL_SECRET_HEADER]: "nope" }));
  assert(denied);
  assertEquals(denied.status, 401);
});

Deno.test("requireInternalSecret: null (proceed) with the right secret", () => {
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  assertEquals(requireInternalSecret(request({ [INTERNAL_SECRET_HEADER]: SECRET })), null);
});

Deno.test("requireInternalSecret: the header name is case-insensitive", () => {
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  assertEquals(requireInternalSecret(request({ "X-Karibu-Internal-Secret": SECRET })), null);
});
