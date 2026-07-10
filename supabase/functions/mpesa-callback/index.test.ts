// mpesa-callback/index.test.ts
// Drives the real handler with a stubbed Supabase REST layer and asserts the
// three checks that stand between a POST and a free tier upgrade:
//
//   1. an unauthenticated caller is rejected and never reaches the database
//   2. a callback whose Amount != amount_kes never activates
//   3. a replayed callback for a settled subscription never re-activates
//
// Run: deno test --allow-env supabase/functions/mpesa-callback/index.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

const SECRET = "test-callback-secret";
const CALLBACK_URL = "https://karibu.test/functions/v1/mpesa-callback";

// --- Stubbed Supabase REST layer --------------------------------------------

interface Subscription {
  id: string;
  business_id: string;
  tier: string;
  status: string;
  amount_kes: number;
}

interface Call {
  url: string;
  method: string;
  body: unknown;
}

let subscription: Subscription;
let calls: Call[];

const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

    const jsonRes = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });

    // maybeSingle() on a GET expects an array; supabase-js unwraps [0].
    if (url.includes("/rest/v1/subscriptions") && method === "GET") {
      return jsonRes([subscription]);
    }
    // .update(...).select("id") -> PATCH returning representation.
    if (url.includes("/rest/v1/subscriptions") && method === "PATCH") {
      return jsonRes([{ id: subscription.id }]);
    }
    if (url.includes("/rest/v1/businesses") && method === "PATCH") {
      return jsonRes([]);
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

/** Every write the handler attempted. */
function writes(): Call[] {
  return calls.filter((c) => c.method === "PATCH");
}

function subscriptionActivated(): boolean {
  return writes().some(
    (c) =>
      c.url.includes("/rest/v1/subscriptions") &&
      (c.body as { status?: string })?.status === "active",
  );
}

function tierPromoted(): boolean {
  return writes().some((c) => c.url.includes("/rest/v1/businesses"));
}

// --- Handler bootstrap -------------------------------------------------------

Deno.env.set("SUPABASE_URL", "https://karibu.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

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

/** A Daraja success callback for `amount`. */
function successPayload(amount: number, receipt = "QGR7XYZ123") {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "m-1",
        CheckoutRequestID: "ws_CO_123",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: amount },
            { Name: "MpesaReceiptNumber", Value: receipt },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
      },
    },
  };
}

async function post(url: string, payload: unknown): Promise<Response> {
  const handler = await loadHandler();
  return await handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

function beforeEach() {
  Deno.env.set("MPESA_CALLBACK_SECRET", SECRET);
  subscription = {
    id: "sub-1",
    business_id: "biz-1",
    tier: "recommended",
    status: "pending_payment",
    amount_kes: 7500,
  };
  installFetchStub();
}

// --- 1. Authentication -------------------------------------------------------

Deno.test("rejects a callback with no token and never touches the database", async () => {
  beforeEach();
  const res = await post(CALLBACK_URL, successPayload(7500));

  assertEquals(res.status, 401);
  assertEquals(calls.length, 0, "an unauthenticated request must not reach the DB");
  restoreFetch();
});

Deno.test("rejects a callback with a wrong token", async () => {
  beforeEach();
  const res = await post(`${CALLBACK_URL}?token=not-the-secret`, successPayload(7500));

  assertEquals(res.status, 401);
  assertEquals(calls.length, 0);
  restoreFetch();
});

Deno.test("a near-miss token does not pass (no prefix matching)", async () => {
  beforeEach();
  const res = await post(`${CALLBACK_URL}?token=${SECRET.slice(0, -1)}`, successPayload(7500));

  assertEquals(res.status, 401);
  restoreFetch();
});

Deno.test("fails closed when MPESA_CALLBACK_SECRET is unset", async () => {
  beforeEach();
  Deno.env.delete("MPESA_CALLBACK_SECRET");

  const res = await post(`${CALLBACK_URL}?token=anything`, successPayload(7500));

  assertEquals(res.status, 503, "no secret configured means we cannot authenticate anyone");
  assertEquals(calls.length, 0);
  restoreFetch();
});

Deno.test("accepts the token from a trailing path segment", async () => {
  beforeEach();
  const res = await post(`${CALLBACK_URL}/${SECRET}`, successPayload(7500));

  assertEquals(res.status, 200);
  assert(subscriptionActivated());
  restoreFetch();
});

// --- 2. Amount verification --------------------------------------------------

Deno.test("the happy path activates the subscription and promotes the tier", async () => {
  beforeEach();
  const res = await post(`${CALLBACK_URL}?token=${SECRET}`, successPayload(7500));

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ResultCode: 0, ResultDesc: "Accepted" });
  assert(subscriptionActivated(), "subscription should be active");
  assert(tierPromoted(), "business tier should be promoted");

  // The receipt is recorded so reconciliation has proof money moved.
  const patch = writes().find((c) => c.url.includes("subscriptions"))!;
  assertEquals((patch.body as { mpesa_receipt_number?: string }).mpesa_receipt_number, "QGR7XYZ123");
  restoreFetch();
});

Deno.test("an authenticated callback that underpays never activates", async () => {
  beforeEach();
  // Subscription costs 7500; the callback claims 1 shilling was paid.
  const res = await post(`${CALLBACK_URL}?token=${SECRET}`, successPayload(1));

  assertEquals(res.status, 200, "acknowledge so Daraja stops retrying");
  assertFalse(subscriptionActivated(), "must not activate on an amount mismatch");
  assertFalse(tierPromoted(), "must not promote the tier on an amount mismatch");
  restoreFetch();
});

Deno.test("a success callback with no CallbackMetadata never activates", async () => {
  beforeEach();
  const res = await post(`${CALLBACK_URL}?token=${SECRET}`, {
    Body: { stkCallback: { CheckoutRequestID: "ws_CO_123", ResultCode: 0 } },
  });

  assertEquals(res.status, 200);
  assertFalse(subscriptionActivated(), "no amount to verify means no activation");
  assertFalse(tierPromoted());
  restoreFetch();
});

// --- 3. Replay ---------------------------------------------------------------

Deno.test("replaying a callback for an already-active subscription changes nothing", async () => {
  beforeEach();
  subscription.status = "active";

  const res = await post(`${CALLBACK_URL}?token=${SECRET}`, successPayload(7500));

  assertEquals(res.status, 200);
  assertEquals(writes().length, 0, "a settled subscription must not be written again");
  restoreFetch();
});

Deno.test("the activating update is guarded on status=pending_payment", async () => {
  beforeEach();
  await post(`${CALLBACK_URL}?token=${SECRET}`, successPayload(7500));

  const patch = writes().find((c) => c.url.includes("subscriptions"))!;
  assert(
    patch.url.includes("status=eq.pending_payment"),
    `the UPDATE must be conditional so two racing callbacks cannot both win: ${patch.url}`,
  );
  restoreFetch();
});

// --- Failure callbacks -------------------------------------------------------

Deno.test("a user-cancelled payment is marked cancelled, not activated", async () => {
  beforeEach();
  const res = await post(`${CALLBACK_URL}?token=${SECRET}`, {
    Body: {
      stkCallback: { CheckoutRequestID: "ws_CO_123", ResultCode: 1032, ResultDesc: "Cancelled" },
    },
  });

  assertEquals(res.status, 200);
  assertFalse(tierPromoted());
  const patch = writes().find((c) => c.url.includes("subscriptions"))!;
  assertEquals((patch.body as { status?: string }).status, "cancelled");
  restoreFetch();
});
