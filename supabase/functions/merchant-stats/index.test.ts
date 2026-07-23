// merchant-stats/index.test.ts
//
// Same harness as business-intake: stub Deno.serve to capture the handler,
// stub fetch as a fake Supabase REST layer. The question every test asks:
// can a non-owner read another business's numbers?
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/merchant-stats/index.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";

const OWNER = "11111111-2222-4333-8444-555555555555";
const BIZ_ID = "44444444-4444-4444-8444-444444444444";

interface Call { url: string; method: string }
let calls: Call[];
let state: {
  authed: boolean;
  bizRow: Record<string, unknown> | null;
  mvRow: Record<string, unknown> | null;
  pendingCount: number;
  ratingRows: Array<{ rating: number; created_at: string }>;
};

const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  state = {
    authed: true,
    bizRow: { id: BIZ_ID, owner_id: OWNER },
    mvRow: { reviews_30d: 4, five_star: 10, one_star: 1 },
    pendingCount: 2,
    ratingRows: [
      { rating: 5, created_at: "2026-06-10T00:00:00Z" },
      { rating: 4, created_at: "2026-07-10T00:00:00Z" },
    ],
  };
  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
    const url = decodeURIComponent(typeof input === "string" ? input : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    const jsonRes = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.includes("/auth/v1/user")) {
      return state.authed
        ? jsonRes({ id: OWNER, email: "owner@example.com" })
        : jsonRes({ message: "invalid token" }, 401);
    }
    if (url.includes("/rest/v1/businesses") && method === "GET") {
      return jsonRes(state.bizRow ? [state.bizRow] : []);
    }
    if (url.includes("/rest/v1/mv_business_review_stats") && method === "GET") {
      return jsonRes(state.mvRow ? [state.mvRow] : []);
    }
    if (url.includes("/rest/v1/reviews") && method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-range": `*/${state.pendingCount}` },
      });
    }
    if (url.includes("/rest/v1/reviews") && method === "GET") {
      return jsonRes(state.ratingRows);
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
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
  Deno.env.set("SUPABASE_URL", "https://karibu-test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  await import("./index.ts");
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = realServe;
  assert(cachedHandler, "handler was not registered via Deno.serve");
  return cachedHandler!;
}

function post(body: unknown): Request {
  return new Request("https://karibu.test/functions/v1/merchant-stats", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer user-jwt" },
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

Deno.test("401 for an unauthenticated caller", async () => {
  await withStubs(async (handler) => {
    state.authed = false;
    assertEquals((await handler(post({ business_id: BIZ_ID }))).status, 401);
  });
});

Deno.test("400 without a business_id", async () => {
  await withStubs(async (handler) => {
    assertEquals((await handler(post({}))).status, 400);
  });
});

Deno.test("404 for a missing business", async () => {
  await withStubs(async (handler) => {
    state.bizRow = null;
    assertEquals((await handler(post({ business_id: BIZ_ID }))).status, 404);
  });
});

Deno.test("403 when the caller does not own the business, and no stats are read", async () => {
  await withStubs(async (handler) => {
    state.bizRow = { id: BIZ_ID, owner_id: "99999999-9999-4999-8999-999999999999" };
    const res = await handler(post({ business_id: BIZ_ID }));
    assertEquals(res.status, 403);
    assert(!calls.some((c) => c.url.includes("mv_business_review_stats")),
      "the MV must not be read for a non-owner");
  });
});

Deno.test("owner gets the full stats shape", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ business_id: BIZ_ID }));
    assertEquals(res.status, 200);
    const out = await res.json();
    assertEquals(out.reviews_30d, 4);
    assertEquals(out.five_star, 10);
    assertEquals(out.one_star, 1);
    assertEquals(out.pending_moderation, 2);
    assertEquals(out.trend, [
      { month: "2026-06", avg: 5, count: 1 },
      { month: "2026-07", avg: 4, count: 1 },
    ]);
  });
});

Deno.test("a missing MV row degrades to zeros, not an error", async () => {
  await withStubs(async (handler) => {
    state.mvRow = null;
    const res = await handler(post({ business_id: BIZ_ID }));
    assertEquals(res.status, 200);
    const out = await res.json();
    assertEquals(out.reviews_30d, 0);
    assertEquals(out.five_star, 0);
    assertEquals(out.one_star, 0);
  });
});
