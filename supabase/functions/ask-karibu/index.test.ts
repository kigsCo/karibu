// ask-karibu/index.test.ts
// Guardrail unit test. Stubs the Supabase client + global fetch so no network
// or DB is touched, drives the handler, and asserts:
//   1. the Anthropic request uses model "claude-sonnet-4-6"
//   2. the system prompt embeds the verified business directory
//
// Run: deno test --allow-env supabase/functions/ask-karibu/index.test.ts
//
// We invoke the handler directly rather than booting the server. The handler
// reads ANTHROPIC_URL/MODEL as module constants and the Supabase client via the
// _shared/client factory, so we set env + a fetch stub before importing.

import { assert, assertEquals } from "jsr:@std/assert@1";

// --- Test fixtures ----------------------------------------------------------
const FAKE_BUSINESSES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Posh Palace Salon",
    hood: "Westlands",
    category_id: "cat-beauty",
    price_range: "KSh 1,500-6,000",
    rating: 4.8,
    tier: "recommended",
    about: "A Westlands favourite for 12 years — meticulous gel work.",
    tags: ["Gel nails", "Braids"],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Artcaffe Westgate",
    hood: "Westlands",
    category_id: "cat-cafes",
    price_range: "KSh 500-1,800",
    rating: 4.4,
    tier: "free",
    about: "All-day brunch and good coffee.",
    tags: ["Wi-Fi"],
  },
];

// Capture what the handler sends to Anthropic.
let capturedAnthropicBody: Record<string, unknown> | null = null;

// --- Stub the Supabase service client BEFORE importing the handler ---------
// The handler imports createServiceClient from ../_shared/client.ts. We can't
// easily monkey-patch an ESM import, so we provide a fake module via an import
// map-free approach: stub global fetch (covers Anthropic) and stub the client
// by replacing the module's behaviour through a minimal builder injected on a
// global the handler will pick up. Simpler: stub fetch for Anthropic AND make
// the Supabase REST call go through the same fetch stub.
//
// supabase-js issues its DB query as an HTTP GET to the PostgREST endpoint, so
// a single fetch stub can serve both the directory fetch and Anthropic.

const REAL_FETCH = globalThis.fetch;

function installFetchStub() {
  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
    const url = typeof input === "string" ? input : input.url;

    // Anthropic messages endpoint.
    if (url.includes("api.anthropic.com")) {
      capturedAnthropicBody = JSON.parse(init?.body ?? "{}");
      return new Response(
        JSON.stringify({
          id: "msg_test",
          content: [{ type: "text", text: "Karibu! Try Posh Palace Salon." }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    // Supabase PostgREST: the businesses directory query. Return our fixtures.
    if (url.includes("/rest/v1/businesses")) {
      return new Response(JSON.stringify(FAKE_BUSINESSES), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // ai_conversations fire-and-forget insert — accept silently.
    if (url.includes("/rest/v1/ai_conversations")) {
      return new Response("[]", {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

// Env the handler + supabase-js need. (Values are dummies; fetch is stubbed.)
Deno.env.set("ANTHROPIC_API_KEY", "test-anthropic-key");
Deno.env.set("SUPABASE_URL", "http://localhost:54321");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

Deno.test("ask-karibu grounds the prompt in the directory and uses claude-sonnet-4-6", async () => {
  installFetchStub();
  capturedAnthropicBody = null;

  // Import the handler module. Importing for side effects registers Deno.serve;
  // we capture the handler it was given by stubbing Deno.serve first.
  let handler: ((req: Request) => Response | Promise<Response>) | null = null;
  const realServe = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: any) => {
    handler = typeof h === "function" ? h : h?.handler;
    // Return a dummy server-like object; nothing calls its methods in the test.
    return { finished: Promise.resolve(), shutdown() {}, ref() {}, unref() {} };
  };

  await import("./index.ts");

  (Deno as any).serve = realServe;
  assert(handler, "handler was not registered via Deno.serve");

  const req = new Request("http://localhost/ask-karibu", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Where can I get my nails done?" }],
      city: "nairobi",
      sessionId: "test-session",
    }),
  });

  const res = await handler!(req);
  assertEquals(res.status, 200);

  // --- Assertions on the Anthropic request --------------------------------
  assert(capturedAnthropicBody, "no Anthropic request captured");
  assertEquals(
    capturedAnthropicBody!.model,
    "claude-sonnet-4-6",
    "must call the exact model claude-sonnet-4-6",
  );

  const system = String(capturedAnthropicBody!.system ?? "");
  assert(
    system.includes("verified directory"),
    "system prompt should describe the verified directory",
  );
  assert(
    system.includes("Posh Palace Salon"),
    "system prompt should embed the fetched businesses (directory grounding)",
  );
  assert(
    system.includes("Karibu Recommended"),
    "recommended businesses should be marked in the directory",
  );
  assert(
    system.includes("nairobi"),
    "system prompt should mention the requested city",
  );

  restoreFetch();
});
