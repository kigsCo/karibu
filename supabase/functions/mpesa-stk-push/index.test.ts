// mpesa-stk-push/index.test.ts
//
// Drives the real handler with a stubbed Supabase REST layer and a stubbed
// Daraja. Every test asserts on the same question: did a stranger's phone ring?
//
// The assertion that matters is `stkPushed()` — not the status code. A handler
// can return 429 and still have already fired the push.
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/mpesa-stk-push/index.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

const BUSINESS_ID = "11111111-2222-4333-8444-555555555555";
const PHONE = "254712345678";
const CALLBACK_SECRET = "test-callback-secret";

// --- Stubbed Supabase REST + Daraja ------------------------------------------

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let calls: Call[];
/** Recorded hits, keyed exactly the way the real table is: (ip, key). */
let hits: Map<string, number>;
let businessExists: boolean;

const bucketOf = (ip: string, key: string) => `${ip}|${key}`;

const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  hits = new Map();
  businessExists = true;

  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
    const rawUrl = typeof input === "string" ? input : input.url;
    const url = decodeURIComponent(rawUrl);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

    const jsonRes = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });

    // supabase-js `.select(_, { count: "exact", head: true })` -> HEAD, and the
    // count is read back out of the content-range header. Count per (ip, key),
    // exactly as the real index does, so the per-IP and per-phone buckets stay
    // independent — a stub that lumps them together would make the per-IP test
    // pass for the wrong reason.
    if (url.includes("/rest/v1/rate_limits") && method === "HEAD") {
      const params = new URL(rawUrl).searchParams;
      const ip = (params.get("ip") ?? "").replace(/^eq\./, "");
      const key = (params.get("key") ?? "").replace(/^eq\./, "");
      const count = hits.get(bucketOf(ip, key)) ?? 0;
      return new Response(null, {
        status: 200,
        headers: { "content-range": `*/${count}` },
      });
    }
    if (url.includes("/rest/v1/rate_limits") && method === "POST") {
      const { ip, key } = body as { ip: string; key: string };
      const bucket = bucketOf(ip, key);
      hits.set(bucket, (hits.get(bucket) ?? 0) + 1);
      return jsonRes([], 201);
    }

    // maybeSingle() on a GET expects an array; supabase-js unwraps [0].
    if (url.includes("/rest/v1/businesses") && method === "GET") {
      return jsonRes(businessExists ? [{ id: BUSINESS_ID }] : []);
    }
    if (url.includes("/rest/v1/subscriptions") && method === "POST") {
      return jsonRes([], 201);
    }

    if (url.includes("safaricom.co.ke/oauth")) {
      return jsonRes({ access_token: "daraja-token" });
    }
    if (url.includes("safaricom.co.ke/mpesa/stkpush")) {
      return jsonRes({ CheckoutRequestID: "ws_CO_TEST_1" });
    }

    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

/** The only thing that actually rings a stranger's phone. */
function stkPushed(): boolean {
  return calls.some((c) => c.url.includes("/mpesa/stkpush"));
}

function subscriptionWritten(): boolean {
  return calls.some(
    (c) => c.url.includes("/rest/v1/subscriptions") && c.method === "POST",
  );
}

function touchedDatabase(): boolean {
  return calls.some((c) => c.url.includes("/rest/v1/"));
}

// --- Handler bootstrap -------------------------------------------------------

Deno.env.set("SUPABASE_URL", "https://karibu.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

function setMpesaSecrets() {
  Deno.env.set("MPESA_CONSUMER_KEY", "ck");
  Deno.env.set("MPESA_CONSUMER_SECRET", "cs");
  Deno.env.set("MPESA_PASSKEY", "pk");
  Deno.env.set("MPESA_CALLBACK_SECRET", CALLBACK_SECRET);
}

type Handler = (req: Request) => Response | Promise<Response>;
let cachedHandler: Handler | null = null;

async function loadHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler;
  const realServe = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: any) => {
    cachedHandler = typeof h === "function" ? h : h?.handler;
    return { finished: Promise.resolve(), shutdown() {}, ref() {}, unref() {} };
  };
  await import("./index.ts");
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = realServe;
  assert(cachedHandler, "handler was not registered via Deno.serve");
  return cachedHandler!;
}

function push(
  overrides: Partial<{ business_id: string; tier: string; phone: string }> = {},
  ip = "41.90.64.1",
): Request {
  return new Request("https://karibu.test/functions/v1/mpesa-stk-push", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({
      business_id: BUSINESS_ID,
      tier: "verified",
      phone: PHONE,
      ...overrides,
    }),
  });
}

async function withStubs(fn: (handler: Handler) => Promise<void>) {
  const handler = await loadHandler();
  installFetchStub();
  setMpesaSecrets();
  try {
    await fn(handler);
  } finally {
    restoreFetch();
  }
}

// --- The config gate ---------------------------------------------------------

Deno.test("disabled by default: no MPESA_ENABLED means no push, and no DB touch", async () => {
  await withStubs(async (handler) => {
    Deno.env.delete("MPESA_ENABLED");
    const res = await handler(push());
    assertEquals(res.status, 503);
    assertEquals((await res.json()).error, "M-Pesa payments are not enabled");
    assertFalse(stkPushed(), "a disabled function must not reach Daraja");
    assertFalse(touchedDatabase(), "a disabled function must not reach the database");
  });
});

Deno.test("MPESA_ENABLED must be exactly 'true'", async () => {
  await withStubs(async (handler) => {
    for (const value of ["1", "yes", "TRUE", "true "]) {
      Deno.env.set("MPESA_ENABLED", value);
      const res = await handler(push());
      assertEquals(res.status, 503, `MPESA_ENABLED=${JSON.stringify(value)} must not enable`);
      assertFalse(stkPushed());
    }
  });
});

// --- Input validation --------------------------------------------------------

Deno.test("a non-uuid business_id is rejected before Daraja", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    const res = await handler(push({ business_id: "'; DROP TABLE businesses; --" }));
    assertEquals(res.status, 400);
    assertFalse(stkPushed());
    assertFalse(touchedDatabase());
  });
});

Deno.test("a malformed phone is rejected before Daraja", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    for (const phone of ["0712345678", "+254712345678", "2541123456789", "254712345"]) {
      const res = await handler(push({ phone }));
      assertEquals(res.status, 400, `phone=${phone} must be rejected`);
    }
    assertFalse(stkPushed());
  });
});

Deno.test("an unknown business never rings a phone", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    businessExists = false;
    const res = await handler(push());
    assertEquals(res.status, 404);
    assertFalse(stkPushed());
    assertFalse(subscriptionWritten());
  });
});

// --- Rate limiting -----------------------------------------------------------

Deno.test("the per-IP limit stops the sixth push from one address", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    // Five distinct phones so the per-phone limit is never the thing that trips.
    for (let i = 0; i < 5; i++) {
      const res = await handler(push({ phone: `25471234567${i}` }));
      assertEquals(res.status, 200, `push ${i + 1} should be allowed`);
    }
    const pushesBefore = calls.filter((c) => c.url.includes("/mpesa/stkpush")).length;
    assertEquals(pushesBefore, 5);

    const blocked = await handler(push({ phone: "254712345675" }));
    assertEquals(blocked.status, 429);
    const pushesAfter = calls.filter((c) => c.url.includes("/mpesa/stkpush")).length;
    assertEquals(pushesAfter, 5, "the blocked request must not have reached Daraja");
  });
});

Deno.test("the per-phone limit holds across rotating source IPs", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    // A botnet: every request from a fresh IP, all aimed at one victim's phone.
    // The per-IP limit can never fire. Only the per-phone bucket protects them.
    for (let i = 0; i < 3; i++) {
      const res = await handler(push({}, `41.90.64.${10 + i}`));
      assertEquals(res.status, 200, `push ${i + 1} should be allowed`);
    }
    assertEquals(calls.filter((c) => c.url.includes("/mpesa/stkpush")).length, 3);

    const blocked = await handler(push({}, "41.90.64.99"));
    assertEquals(blocked.status, 429);
    assertEquals(
      (await blocked.json()).error,
      "Too many payment attempts for this number.",
    );
    assertEquals(
      calls.filter((c) => c.url.includes("/mpesa/stkpush")).length,
      3,
      "a fresh IP must not buy another prompt to the same number",
    );
  });
});

Deno.test("the phone number never reaches the rate_limits table in the clear", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    await handler(push());
    const rateLimitTraffic = calls.filter((c) => c.url.includes("/rest/v1/rate_limits"));
    assert(rateLimitTraffic.length > 0, "expected the limiter to run");
    for (const call of rateLimitTraffic) {
      assertFalse(call.url.includes(PHONE), `phone leaked into a URL: ${call.url}`);
      assertFalse(
        JSON.stringify(call.body ?? {}).includes(PHONE),
        `phone leaked into a body: ${JSON.stringify(call.body)}`,
      );
    }
  });
});

// --- Happy path --------------------------------------------------------------

Deno.test("an enabled, valid, in-limit request pushes and records the subscription", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    const res = await handler(push());
    assertEquals(res.status, 200);
    assertEquals((await res.json()).CheckoutRequestID, "ws_CO_TEST_1");
    assert(stkPushed());
    assert(subscriptionWritten());

    const stk = calls.find((c) => c.url.includes("/mpesa/stkpush"))!;
    const stkBody = stk.body as Record<string, unknown>;
    assertEquals(stkBody.Amount, 2500, "verified tier is priced server-side");
    assertEquals(stkBody.PhoneNumber, PHONE);
    // The callback can only authenticate itself if the token rode along.
    assert(
      String(stkBody.CallBackURL).includes(`token=${CALLBACK_SECRET}`),
      `CallBackURL must carry the shared secret: ${stkBody.CallBackURL}`,
    );

    const sub = calls.find(
      (c) => c.url.includes("/rest/v1/subscriptions") && c.method === "POST",
    )!;
    const subBody = sub.body as Record<string, unknown>;
    assertEquals(subBody.status, "pending_payment");
    assertEquals(subBody.amount_kes, 2500);
    assertEquals(subBody.mpesa_transaction_id, "ws_CO_TEST_1");
  });
});

Deno.test("the client cannot choose the price", async () => {
  await withStubs(async (handler) => {
    Deno.env.set("MPESA_ENABLED", "true");
    // `amount` is not a parameter; a tier is. An unknown tier is a 400, and the
    // known ones are priced from the server-side table.
    const res = await handler(push({ tier: "free" }));
    assertEquals(res.status, 400);
    assertFalse(stkPushed());

    const ok = await handler(push({ tier: "recommended" }));
    assertEquals(ok.status, 200);
    const stk = calls.find((c) => c.url.includes("/mpesa/stkpush"))!;
    assertEquals((stk.body as Record<string, unknown>).Amount, 7500);
  });
});
