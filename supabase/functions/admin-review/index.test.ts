// admin-review/index.test.ts
//
// The staff gate is the whole point: verify_jwt=true only proves "some user".
// Every test asks: can a non-staff caller decide anything, and is every
// decision guarded + logged?
//
// Run: deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/admin-review/index.test.ts

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

const STAFF_UID = "aaaaaaaa-1111-4111-8111-111111111111";
const OWNER_UID = "bbbbbbbb-2222-4222-8222-222222222222";
const BIZ_ID = "44444444-4444-4444-8444-444444444444";
const CLAIM_ID = "55555555-5555-4555-8555-555555555555";

interface Call { url: string; method: string; body: unknown }
let calls: Call[];
let state: {
  isStaff: boolean;
  bizPatchRows: Record<string, unknown>[]; // what PATCH /businesses returns
  claimRow: Record<string, unknown> | null;
  claimPatchRows: Record<string, unknown>[];
};

const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  calls = [];
  state = {
    isStaff: true,
    bizPatchRows: [{ id: BIZ_ID, name: "Posh Palace", tier: "free", owner_id: OWNER_UID }],
    claimRow: {
      id: CLAIM_ID, business_id: BIZ_ID, claimant_id: OWNER_UID, status: "pending",
      business: { id: BIZ_ID, name: "Unowned Co", tier: "free" },
    },
    claimPatchRows: [{ id: CLAIM_ID, status: "approved" }],
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
      return jsonRes({ id: STAFF_UID, email: "staff@karibu.co.ke" });
    }
    if (url.includes("/rest/v1/profiles") && method === "GET") {
      // is_staff lookup, and the owner-email lookup for the welcome mail.
      const params = new URL(rawUrl).searchParams;
      const idFilter = (params.get("id") ?? "").replace(/^eq\./, "");
      if (idFilter === STAFF_UID) return jsonRes([{ is_staff: state.isStaff }]);
      return jsonRes([{ email: "owner@example.com" }]);
    }
    if (url.includes("/rest/v1/businesses") && method === "GET") {
      return jsonRes([]); // queue: no pending registrations in these tests
    }
    if (url.includes("/rest/v1/businesses") && method === "PATCH") {
      return jsonRes(state.bizPatchRows);
    }
    if (url.includes("/rest/v1/business_claims") && method === "GET") {
      return jsonRes(state.claimRow ? [state.claimRow] : []);
    }
    if (url.includes("/rest/v1/business_claims") && method === "PATCH") {
      return jsonRes(state.claimPatchRows);
    }
    if (url.includes("/rest/v1/admin_decisions") && method === "POST") {
      return jsonRes([], 201);
    }
    if (url.includes("/storage/v1/object/sign/")) {
      return jsonRes({ signedURL: "/object/sign/verification-docs/x?token=t" });
    }
    if (url.includes("/functions/v1/send-onboarding-email")) {
      return jsonRes({ ok: true });
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
  Deno.env.set("INTERNAL_FUNCTION_SECRET", "internal-secret");
  await import("./index.ts");
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = realServe;
  assert(cachedHandler, "handler was not registered via Deno.serve");
  return cachedHandler!;
}

function post(body: unknown): Request {
  return new Request("https://karibu.test/functions/v1/admin-review", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer staff-jwt" },
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

const decisionLogged = () =>
  calls.some((c) => c.url.includes("/rest/v1/admin_decisions") && c.method === "POST");
const emailFired = () =>
  calls.some((c) => c.url.includes("/functions/v1/send-onboarding-email"));

Deno.test("a non-staff user is 403 for every action and decides nothing", async () => {
  await withStubs(async (handler) => {
    state.isStaff = false;
    for (const body of [
      { action: "queue" },
      { action: "approve", kind: "registration", id: BIZ_ID },
      { action: "reject", kind: "claim", id: CLAIM_ID, reason: "no evidence" },
    ]) {
      const res = await handler(post(body));
      assertEquals(res.status, 403, JSON.stringify(body));
    }
    assertFalse(decisionLogged());
  });
});

Deno.test("queue returns registrations and claims", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "queue" }));
    assertEquals(res.status, 200);
    const out = await res.json();
    assert(Array.isArray(out.registrations));
    assert(Array.isArray(out.claims));
  });
});

Deno.test("approve registration: activates, logs, and fires the welcome email", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "approve", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 200);
    const patch = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "PATCH");
    assert(patch, "expected a guarded UPDATE on businesses");
    assertEquals((patch!.body as Record<string, unknown>).status, "active");
    assert(String(patch!.url).includes("status=eq.pending"), "guard: WHERE status='pending'");
    assert(decisionLogged());
    const mail = calls.find((c) => c.url.includes("/functions/v1/send-onboarding-email"));
    assert(mail, "welcome email fired");
  });
});

Deno.test("approve registration twice: the second is a 409 no-op with no email", async () => {
  await withStubs(async (handler) => {
    state.bizPatchRows = []; // the guard matched no row
    const res = await handler(post({ action: "approve", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 409);
    assertFalse(decisionLogged());
    assertFalse(emailFired());
  });
});

Deno.test("approve registration still succeeds when the email endpoint fails", async () => {
  await withStubs(async (handler) => {
    // Re-stub the email endpoint to blow up.
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: unknown) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/functions/v1/send-onboarding-email")) {
        return new Response("boom", { status: 500 });
      }
      // deno-lint-ignore no-explicit-any
      return inner(input as any, init as any);
    }) as typeof fetch;
    const res = await handler(post({ action: "approve", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 200, "email failure never blocks the approval");
  });
});

Deno.test("approve claim: assigns the owner (guarded) and marks the claim", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "approve", kind: "claim", id: CLAIM_ID }));
    assertEquals(res.status, 200);
    const bizPatch = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "PATCH");
    assert(bizPatch);
    assert(String(bizPatch!.url).includes("owner_id=is.null"), "guard: WHERE owner_id IS NULL");
    assert(calls.some((c) => c.url.includes("/rest/v1/business_claims") && c.method === "PATCH"));
    assert(decisionLogged());
  });
});

Deno.test("approve claim on a now-owned business is a 409, claim left pending", async () => {
  await withStubs(async (handler) => {
    state.bizPatchRows = [];
    const res = await handler(post({ action: "approve", kind: "claim", id: CLAIM_ID }));
    assertEquals(res.status, 409);
    assertFalse(
      calls.some((c) => c.url.includes("/rest/v1/business_claims") && c.method === "PATCH"),
      "the claim row is untouched for a manual decision",
    );
  });
});

Deno.test("reject requires a reason", async () => {
  await withStubs(async (handler) => {
    const res = await handler(post({ action: "reject", kind: "registration", id: BIZ_ID }));
    assertEquals(res.status, 400);
    assertFalse(decisionLogged());
  });
});

Deno.test("reject registration unlists the business and logs the reason", async () => {
  await withStubs(async (handler) => {
    const res = await handler(
      post({ action: "reject", kind: "registration", id: BIZ_ID, reason: "photos are stock images" }),
    );
    assertEquals(res.status, 200);
    const patch = calls.find((c) => c.url.includes("/rest/v1/businesses") && c.method === "PATCH");
    assertEquals((patch!.body as Record<string, unknown>).status, "unlisted");
    const log = calls.find((c) => c.url.includes("/rest/v1/admin_decisions"));
    assertEquals((log!.body as Record<string, unknown>).reason, "photos are stock images");
  });
});
