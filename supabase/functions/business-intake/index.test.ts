// business-intake/index.test.ts
//
// Drives the real handler with a stubbed Supabase REST layer (same harness as
// mpesa-stk-push/index.test.ts). The question every test answers: can a caller
// create a listing/claim they shouldn't, or skip evidence they must provide?
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/business-intake/index.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";

const UID = "11111111-2222-4333-8444-555555555555";
const CITY_ID = "22222222-2222-4222-8222-222222222222";
const CAT_ID = "33333333-3333-4333-8333-333333333333";
const BIZ_ID = "44444444-4444-4444-8444-444444444444";

interface Call { url: string; method: string; body: unknown }
let calls: Call[];
let hits: Map<string, number>;
let state: {
  authed: boolean;
  cityRow: Record<string, unknown> | null;
  catRow: Record<string, unknown> | null;
  bizRow: Record<string, unknown> | null;      // claim target lookup
  pendingClaims: number;                        // duplicate-claim count
  verificationInsertFails: boolean;
};

const bucketOf = (ip: string, key: string) => `${ip}|${key}`;
const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  hits = new Map();
  state = {
    authed: true,
    cityRow: { id: CITY_ID, hoods: ["Kilimani", "CBD"] },
    catRow: { id: CAT_ID },
    bizRow: { id: BIZ_ID, status: "active", owner_id: null, name: "Unowned Co", tier: "free" },
    pendingClaims: 0,
    verificationInsertFails: false,
  };

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

    if (url.includes("/auth/v1/user")) {
      return state.authed
        ? jsonRes({ id: UID, email: "owner@example.com" })
        : jsonRes({ message: "invalid token" }, 401);
    }
    if (url.includes("/rest/v1/rate_limits") && method === "HEAD") {
      const params = new URL(rawUrl).searchParams;
      const ip = (params.get("ip") ?? "").replace(/^eq\./, "");
      const key = (params.get("key") ?? "").replace(/^eq\./, "");
      const count = hits.get(bucketOf(ip, key)) ?? 0;
      return new Response(null, { status: 200, headers: { "content-range": `*/${count}` } });
    }
    if (url.includes("/rest/v1/rate_limits") && method === "POST") {
      const { ip, key } = body as { ip: string; key: string };
      hits.set(bucketOf(ip, key), (hits.get(bucketOf(ip, key)) ?? 0) + 1);
      return jsonRes([], 201);
    }
    if (url.includes("/rest/v1/cities") && method === "GET") {
      return jsonRes(state.cityRow ? [state.cityRow] : []);
    }
    if (url.includes("/rest/v1/categories") && method === "GET") {
      return jsonRes(state.catRow ? [state.catRow] : []);
    }
    if (url.includes("/rest/v1/businesses") && method === "GET") {
      return jsonRes(state.bizRow ? [state.bizRow] : []);
    }
    if (url.includes("/rest/v1/businesses") && method === "POST") {
      return jsonRes([{ id: BIZ_ID, slug: (body as { slug: string }).slug }], 201);
    }
    if (url.includes("/rest/v1/businesses") && method === "DELETE") {
      return jsonRes([], 200);
    }
    if (url.includes("/rest/v1/business_verifications") && method === "POST") {
      return state.verificationInsertFails
        ? jsonRes({ message: "boom" }, 500)
        : jsonRes([], 201);
    }
    if (url.includes("/rest/v1/business_claims") && method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `*/${state.pendingClaims}` },
      });
    }
    if (url.includes("/rest/v1/business_claims") && method === "POST") {
      return jsonRes([{ id: "55555555-5555-4555-8555-555555555555", status: "pending" }], 201);
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://karibu-test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
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
  setEnv();
  await import("./index.ts");
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = realServe;
  assert(cachedHandler, "handler was not registered via Deno.serve");
  return cachedHandler!;
}

const REGISTER_BODY = {
  action: "register",
  name: "Posh Palace",
  category_slug: "beauty",
  city_slug: "nairobi",
  hood: "Kilimani",
  about: "A calm, spotless salon with senior stylists and fair prices.",
  phone: "0712345678",
  hours_display: "Mon-Sat 9am-7pm",
  photo_paths: [`${UID}/a.jpg`, `${UID}/b.jpg`, `${UID}/c.jpg`],
  id_document_path: `${UID}/id.jpg`,
  kra_pin: "A123456789Z",
};

const CLAIM_BODY = {
  action: "claim",
  business_id: BIZ_ID,
  kra_pin: "A123456789Z",
  contact_phone: "0712345678",
  id_document_path: `${UID}/id.jpg`,
};

function post(body: unknown, ip = "41.90.64.1"): Request {
  return new Request("https://karibu.test/functions/v1/business-intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      authorization: "Bearer user-jwt",
    },
    body: JSON.stringify(body),
  });
}

async function withStubs(fn: (handler: Handler) => Promise<void>) {
  const handler = await loadHandler();
  installFetchStub();
  try {
    await fn(handler);
  } finally {
    restoreFetch();
  }
}

const businessInserted = () =>
  calls.some((c) => c.url.includes("/rest/v1/businesses") && c.method === "POST");
const claimInserted = () =>
  calls.some((c) => c.url.includes("/rest/v1/business_claims") && c.method === "POST");

Deno.test("rejects an unauthenticated caller with 401 and writes nothing", async () => {
  await withStubs(async (handler) => {
    state.authed = false;
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 401);
    assert(!businessInserted());
  });
});

Deno.test("register: happy path inserts business + verification and returns the slug", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 200);
    const out = await res.json();
    assertEquals(out.id, BIZ_ID);
    assert(String(out.slug).startsWith("posh-palace-"));
    const bizCall = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "POST");
    const inserted = bizCall?.body as Record<string, unknown>;
    assertEquals(inserted.status, "pending");
    assertEquals(inserted.tier, "free");
    assertEquals(inserted.owner_id, UID);
    assert(calls.some((c) => c.url.includes("/rest/v1/business_verifications") && c.method === "POST"));
  });
});

Deno.test("register: a bad KRA PIN is a 400 before any write", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ ...REGISTER_BODY, kra_pin: "B123456789Z" }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: fewer than 3 photos is a 400", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ ...REGISTER_BODY, photo_paths: [`${UID}/a.jpg`] }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: a photo path in someone else's folder is a 400", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({
      ...REGISTER_BODY,
      photo_paths: [`${UID}/a.jpg`, `${UID}/b.jpg`, "other-user/c.jpg"],
    }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: an unknown hood for the city is a 400", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ ...REGISTER_BODY, hood: "Atlantis" }));
    assertEquals(res.status, 400);
    assert(!businessInserted());
  });
});

Deno.test("register: verification-insert failure compensates by deleting the business", async () => {
  await withStubs(async (handler) => {
    state.verificationInsertFails = true;
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 500);
    assert(
      calls.some((c) => c.url.includes("/rest/v1/businesses") && c.method === "DELETE"),
      "expected a compensating DELETE of the orphaned business row",
    );
  });
});

Deno.test("register: the 4th registration in a day is a 429", async () => {
  await withStubs(async (handler) => {
    for (let i = 0; i < 3; i++) {
      assertEquals((await handler(post(REGISTER_BODY))).status, 200);
    }
    const res = await handler(post(REGISTER_BODY));
    assertEquals(res.status, 429);
  });
});

Deno.test("register: a failed-validation attempt does not consume the per-user daily budget", async () => {
  await withStubs(async (handler) => {
    // An invalid submission (bad KRA PIN) must 400 without spending any of
    // the merchant's 3 daily register attempts — all 3 real ones still succeed.
    const bad = await handler(post({ ...REGISTER_BODY, kra_pin: "B123456789Z" }));
    assertEquals(bad.status, 400);

    for (let i = 0; i < 3; i++) {
      assertEquals((await handler(post(REGISTER_BODY))).status, 200);
    }
  });
});

Deno.test("claim: happy path inserts a pending claim", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 200);
    assertEquals((await res.json()).status, "pending");
    assert(claimInserted());
  });
});

Deno.test("claim: an already-owned business is a 409", async () => {
  await withStubs(async (handler) => {
    state.bizRow = { ...state.bizRow!, owner_id: "99999999-9999-4999-8999-999999999999" };
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 409);
    assert(!claimInserted());
  });
});

Deno.test("claim: a duplicate pending claim is a 409", async () => {
  await withStubs(async (handler) => {
    state.pendingClaims = 1;
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 409);
    assert(!claimInserted());
  });
});

Deno.test("claim: a missing business is a 404", async () => {
  await withStubs(async (handler) => {
    state.bizRow = null;
    const res = await handler(post(CLAIM_BODY));
    assertEquals(res.status, 404);
    assert(!claimInserted());
  });
});
