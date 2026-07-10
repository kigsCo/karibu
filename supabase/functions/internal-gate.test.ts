// internal-gate.test.ts
//
// `_shared/internal-auth.test.ts` proves the gate makes the right decision.
// This proves the gate is actually BOLTED ON to every function that needs it —
// a distinction a unit test of the helper can never make, and exactly the kind
// of thing that rots when someone adds function number eight.
//
// For each guarded handler, an unauthenticated request must:
//   * come back 401, and
//   * never reach the network — no Anthropic call, no database write, no email.
//
// The second assertion is the real one. A handler that does its work and *then*
// returns 401 is not gated; it is just rude.
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/internal-gate.test.ts

import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { INTERNAL_SECRET_HEADER } from "./_shared/internal-auth.ts";

const SECRET = "test-internal-secret";

// The edge runtime injects these; supabase-js needs them to construct a client.
Deno.env.set("SUPABASE_URL", "https://karibu.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

type Handler = (req: Request) => Response | Promise<Response>;

// Every function that must only ever be called by our own backend. If you add
// one, add it here — that is the point of this file.
const GUARDED: Array<[string, () => Promise<unknown>]> = [
  ["moderate-reviews", () => import("./moderate-reviews/index.ts")],
  ["calculate-rankings", () => import("./calculate-rankings/index.ts")],
  ["send-onboarding-email", () => import("./send-onboarding-email/index.ts")],
];

const handlers = new Map<string, Handler>();

async function loadAll() {
  if (handlers.size === GUARDED.length) return;
  for (const [name, importer] of GUARDED) {
    const realServe = Deno.serve;
    let captured: Handler | null = null;
    // deno-lint-ignore no-explicit-any
    (Deno as any).serve = (h: any) => {
      captured = typeof h === "function" ? h : h?.handler;
      return { finished: Promise.resolve(), shutdown() {}, ref() {}, unref() {} };
    };
    await importer();
    // deno-lint-ignore no-explicit-any
    (Deno as any).serve = realServe;
    assert(captured, `${name} did not register a handler via Deno.serve`);
    handlers.set(name, captured!);
  }
}

/** Body that passes each handler's *input* validation, so only the gate can stop it. */
function bodyFor(name: string): string {
  if (name === "send-onboarding-email") {
    return JSON.stringify({ to: "victim@example.com", businessName: "Totally Legit Ltd" });
  }
  return JSON.stringify({});
}

function request(name: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://karibu.test/functions/v1/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: bodyFor(name),
  });
}

const REAL_FETCH = globalThis.fetch;

/** Any outbound call at all is a failure for the unauthenticated cases. */
function installTripwire(): { count: () => number } {
  let calls = 0;
  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any): Promise<Response> => {
    calls++;
    const url = typeof input === "string" ? input : input.url;
    throw new Error(`gate leaked: handler reached the network at ${url}`);
  }) as typeof fetch;
  return { count: () => calls };
}

Deno.test("every guarded function refuses an unauthenticated caller, before doing anything", async () => {
  await loadAll();
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);

  const tripwire = installTripwire();
  try {
    for (const [name] of GUARDED) {
      const res = await handlers.get(name)!(request(name));
      assertEquals(res.status, 401, `${name} must reject an unauthenticated caller`);
      await res.body?.cancel();
    }
    assertEquals(tripwire.count(), 0, "a guarded function reached the network while unauthenticated");
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});

Deno.test("every guarded function refuses a caller holding only an anon-key JWT", async () => {
  await loadAll();
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);

  const tripwire = installTripwire();
  try {
    // What `verify_jwt = true` would have accepted. It ships in the bundle.
    const anon = { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon.sig" };
    for (const [name] of GUARDED) {
      const res = await handlers.get(name)!(request(name, anon));
      assertEquals(res.status, 401, `${name} must not accept a bare anon JWT`);
      await res.body?.cancel();
    }
    assertEquals(tripwire.count(), 0);
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});

Deno.test("every guarded function fails closed when INTERNAL_FUNCTION_SECRET is unset", async () => {
  await loadAll();
  Deno.env.delete("INTERNAL_FUNCTION_SECRET");

  const tripwire = installTripwire();
  try {
    for (const [name] of GUARDED) {
      const res = await handlers.get(name)!(request(name, { [INTERNAL_SECRET_HEADER]: SECRET }));
      assertEquals(res.status, 503, `${name} must refuse to run unconfigured`);
      await res.body?.cancel();
    }
    assertEquals(tripwire.count(), 0);
  } finally {
    globalThis.fetch = REAL_FETCH;
    Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  }
});

Deno.test("the gate opens for the right secret (it is not simply always-deny)", async () => {
  await loadAll();
  Deno.env.set("INTERNAL_FUNCTION_SECRET", SECRET);
  // Deliberately unset so the handlers stop at their own config check, one step
  // PAST the gate. That is what distinguishes "authorized" from "always 401".
  Deno.env.delete("ANTHROPIC_API_KEY");
  Deno.env.delete("RESEND_API_KEY");

  const authorized = { [INTERNAL_SECRET_HEADER]: SECRET };

  const moderate = await handlers.get("moderate-reviews")!(
    request("moderate-reviews", authorized),
  );
  assertEquals(moderate.status, 500, "should pass the gate and fail on the missing API key");
  assertEquals((await moderate.json()).error, "Server misconfigured");

  const email = await handlers.get("send-onboarding-email")!(
    request("send-onboarding-email", authorized),
  );
  assertEquals(email.status, 500);
  assertEquals((await email.json()).error, "Server misconfigured (RESEND_API_KEY)");

  // calculate-rankings has no env of its own; it goes straight to the database.
  // Stub that away — we only care that it got past the gate.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "nope" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const rankings = await handlers.get("calculate-rankings")!(
      request("calculate-rankings", authorized),
    );
    assertNotEquals(rankings.status, 401, "an authorized cron call must pass the gate");
    assertNotEquals(rankings.status, 503);
    await res_cancel(rankings);
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});

async function res_cancel(res: Response) {
  await res.body?.cancel();
}
