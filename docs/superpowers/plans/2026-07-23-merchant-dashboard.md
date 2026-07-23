# Merchant Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/merchant` becomes the owner's real home: their listing(s) with honest reviews-derived stats, safe self-editing of operational fields, real reviews, and real subscription state.

**Architecture:** One migration adds a column-scoped UPDATE grant (+ text bounds) that activates the dormant owner-update RLS policy; one thin `merchant-stats` edge function returns what RLS can't safely expose (stats-MV row, live pending count, monthly rating trend); everything else is direct supabase-js under existing policies. The mock page's constants are deleted; its visual shell is preserved as a composition of `components/merchant/` pieces.

**Tech Stack:** Supabase (Postgres migration, RLS grants, Deno edge function), React 18 + react-router 6 + Tailwind, vitest + @testing-library, Deno test, pgTAP.

**Spec:** `docs/superpowers/specs/2026-07-23-merchant-dashboard-design.md` (approved).

## Global Constraints

- Never restyle existing screens beyond the two sanctioned entry points; the merchant page keeps the mock's visual idiom (`font-serif-d`, `border-ink-10`, `bg-forest-soft`, `text-stone-w`, tile grids) while its mock data and dead sections (engagement tiles, themes, respond buttons, category-rank card) are REMOVED.
- Owner-editable columns, exactly: `hours_json, phone, whatsapp, email, website, about, price_range, address, hero_image_url, gallery_image_urls`. Everything else stays ungranted (locked at the Postgres level).
- `mv_business_review_stats` is NEVER client-granted (RLS does not apply to MVs); only `merchant-stats` (service role) reads it.
- UUID defaults use `gen_random_uuid()` (never unqualified `uuid_generate_v4()` — cloud `db push` cannot resolve it). No new UUIDs are needed this cycle, but the rule binds any deviation.
- Edge functions reuse `_shared` helpers; errors always `{ error: string }`; `verify_jwt = true` is authentication only.
- Commit messages: conventional, NO Co-Authored-By lines.
- Commands: `npx vitest run`, `npm run lint`, `npm run build`, `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/`, `npx supabase db reset`, `npx supabase test db` (CLI is `npx supabase`; local stack must be running — if Docker is down, note it and let the final task re-verify).
- Branch: `feat/merchant-dashboard` (exists; spec committed at its tip).

---

### Task 1: Migration — enable owner listing edits

**Files:**
- Create: `supabase/migrations/20260723200000_enable_owner_listing_edits.sql`

**Interfaces:**
- Produces: `authenticated` may UPDATE exactly the ten safe columns on `businesses` (row-pinned by the existing "Owner updates own business" policy from `20260601000002_rls_policies.sql:32-36`); bounded CHECKs on the newly writable text columns. Consumed by `useOwnerListingUpdate` (Task 4) and EditListingSection (Task 6).

- [ ] **Step 1: Write the migration**

```sql
-- 20260723200000_enable_owner_listing_edits.sql
-- Cycle 2 (merchant dashboard): activate owner self-editing.
--
-- The RLS policy "Owner updates own business" has existed since
-- 20260601000002 but is inert: 20260710160000 grants authenticated
-- SELECT-only on businesses. This grant is column-scoped to operational
-- fields; identity (name, category, city/hood, location), status, tier,
-- owner_id, and the cached ranking columns stay ungranted — Postgres, not
-- the UI, refuses those edits (42501).
GRANT UPDATE (hours_json, phone, whatsapp, email, website, about,
              price_range, address, hero_image_url, gallery_image_urls)
  ON public.businesses TO authenticated;

-- Bounds for the newly client-writable columns, following the profiles
-- precedent ("a client cannot store megabytes in a row"). The intake edge
-- function enforces the same or tighter limits; these CHECKs are the
-- backstop for the direct-UPDATE path.
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_about_chk
    CHECK (about IS NULL OR char_length(about) <= 2000),
  ADD CONSTRAINT businesses_address_chk
    CHECK (address IS NULL OR char_length(address) <= 200),
  ADD CONSTRAINT businesses_price_range_chk
    CHECK (price_range IS NULL OR char_length(price_range) <= 60),
  ADD CONSTRAINT businesses_phone_chk
    CHECK (phone IS NULL OR char_length(phone) <= 20),
  ADD CONSTRAINT businesses_whatsapp_chk
    CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 20),
  ADD CONSTRAINT businesses_email_chk
    CHECK (email IS NULL OR char_length(email) <= 200),
  ADD CONSTRAINT businesses_website_chk
    CHECK (website IS NULL OR char_length(website) <= 300),
  ADD CONSTRAINT businesses_hero_chk
    CHECK (hero_image_url IS NULL OR char_length(hero_image_url) <= 2048),
  -- "Up to 15 photos" per the tier copy.
  ADD CONSTRAINT businesses_gallery_chk
    CHECK (gallery_image_urls IS NULL
           OR array_length(gallery_image_urls, 1) IS NULL
           OR array_length(gallery_image_urls, 1) <= 15),
  ADD CONSTRAINT businesses_hours_json_chk
    CHECK (hours_json IS NULL OR pg_column_size(hours_json) <= 4096);
```

- [ ] **Step 2: Apply**

Run: `npx supabase db reset`
Expected: all migrations apply cleanly and the seed loads — this proves no seed row violates the new CHECKs. If a seed row DOES violate one, raise that bound to the smallest power-of-two-ish value that fits (the bounds are anti-megabyte backstops, not product limits) and note it in your report — never edit the seed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260723200000_enable_owner_listing_edits.sql
git commit -m "feat(db): column-scoped owner edit grant and text bounds on businesses"
```

---

### Task 2: pgTAP — `merchant_dashboard_test.sql`

**Files:**
- Create: `supabase/tests/merchant_dashboard_test.sql`

**Interfaces:**
- Consumes: Task 1's grant + CHECKs; the pre-existing owner-update RLS policy.

- [ ] **Step 1: Write the pgTAP file**

```sql
-- merchant_dashboard_test.sql
-- Migration 20260723200000 (owner edit grant + bounds).
-- Run with: supabase test db
--
-- Proves: an owner can update the safe columns on their own row; the
-- column-scoped grant refuses locked columns (42501); a stranger's update
-- matches zero rows; the exact grant list holds. pgTAP rolls back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(12);

-- Fixtures --------------------------------------------------------------
INSERT INTO cities (slug, name, is_active)
VALUES ('mdcity', 'MD City', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, label, icon, sort_order)
VALUES ('mdcat', 'MD Cat', 'Store', 995) ON CONFLICT (slug) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'md-owner@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'md-stranger@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO businesses (slug, name, category_id, city_id, hood, status, owner_id)
VALUES ('md-owned', 'MD Owned Co',
        (SELECT id FROM categories WHERE slug = 'mdcat'),
        (SELECT id FROM cities WHERE slug = 'mdcity'),
        'CBD', 'active', '00000000-0000-0000-0000-0000000000d1');

-- Grant list ------------------------------------------------------------
SELECT ok(has_column_privilege('authenticated', 'public.businesses', 'phone', 'UPDATE'),
          'authenticated may update phone');
SELECT ok(has_column_privilege('authenticated', 'public.businesses', 'hours_json', 'UPDATE'),
          'authenticated may update hours_json');
SELECT ok(has_column_privilege('authenticated', 'public.businesses', 'gallery_image_urls', 'UPDATE'),
          'authenticated may update gallery_image_urls');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'name', 'UPDATE'),
          'name stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'status', 'UPDATE'),
          'status stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'tier', 'UPDATE'),
          'tier stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'owner_id', 'UPDATE'),
          'owner_id stays locked');
SELECT ok(NOT has_column_privilege('authenticated', 'public.businesses', 'ranking_score', 'UPDATE'),
          'ranking_score stays locked');

-- As the owner ----------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ UPDATE businesses SET phone = '254712345678',
       hours_json = to_jsonb('Mon-Sat 9am-7pm'::text)
     WHERE slug = 'md-owned' $$,
  'the owner updates safe fields on their own row');
SELECT throws_ok(
  $$ UPDATE businesses SET name = 'Renamed Co' WHERE slug = 'md-owned' $$,
  '42501', NULL, 'the owner cannot rename their listing');
SELECT throws_ok(
  $$ UPDATE businesses SET about = repeat('x', 2001) WHERE slug = 'md-owned' $$,
  '23514', NULL, 'the about bound holds even for the owner');

-- As a stranger ---------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}', true);

SELECT is(
  (WITH updated AS (
     UPDATE businesses SET phone = '254700000000'
      WHERE slug = 'md-owned' RETURNING id)
   SELECT count(*)::int FROM updated),
  0, 'a stranger''s update matches zero rows');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run pgTAP**

Run: `npx supabase test db`
Expected: `merchant_dashboard_test.sql .. ok` (12/12) and all pre-existing test files still passing.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/merchant_dashboard_test.sql
git commit -m "test(db): pgTAP coverage for the owner edit grant"
```

---

### Task 3: `merchant-stats` edge function (TDD)

**Files:**
- Create: `supabase/functions/merchant-stats/trend.ts`
- Create: `supabase/functions/merchant-stats/trend.test.ts`
- Create: `supabase/functions/merchant-stats/index.ts`
- Create: `supabase/functions/merchant-stats/index.test.ts`
- Modify: `supabase/config.toml` (append after `[functions.admin-review]`)

**Interfaces:**
- Consumes: `_shared` cors/response/client helpers; `mv_business_review_stats` (service role only); `reviews`.
- Produces: POST `{ business_id }` → `200 { reviews_30d, five_star, one_star, pending_moderation, trend: [{ month: "YYYY-MM", avg, count }] }`; errors 400/401/403/404/405 as `{ error }`. `useMerchantStats` (Task 4) consumes this exact shape.

- [ ] **Step 1: Write the failing trend tests**

```ts
// merchant-stats/trend.test.ts
// Run: deno test --allow-env --node-modules-dir=none supabase/functions/merchant-stats/trend.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { bucketMonthlyRatings } from "./trend.ts";

const row = (rating: number, iso: string) => ({ rating, created_at: iso });

Deno.test("buckets by calendar month (UTC) and averages", () => {
  const trend = bucketMonthlyRatings([
    row(5, "2026-06-01T10:00:00Z"),
    row(4, "2026-06-20T10:00:00Z"),
    row(3, "2026-07-05T10:00:00Z"),
  ]);
  assertEquals(trend, [
    { month: "2026-06", avg: 4.5, count: 2 },
    { month: "2026-07", avg: 3, count: 1 },
  ]);
});

Deno.test("sorts chronologically regardless of input order", () => {
  const trend = bucketMonthlyRatings([
    row(4, "2026-07-01T00:00:00Z"),
    row(5, "2026-05-01T00:00:00Z"),
  ]);
  assertEquals(trend.map((t) => t.month), ["2026-05", "2026-07"]);
});

Deno.test("caps at the newest 6 months", () => {
  const rows = [];
  for (let m = 1; m <= 9; m++) rows.push(row(4, `2026-0${m}-15T00:00:00Z`));
  const trend = bucketMonthlyRatings(rows);
  assertEquals(trend.length, 6);
  assertEquals(trend[0].month, "2026-04");
  assertEquals(trend[5].month, "2026-09");
});

Deno.test("ignores malformed rows and rounds to 2dp", () => {
  const trend = bucketMonthlyRatings([
    row(5, "2026-06-01T00:00:00Z"),
    row(4, "2026-06-02T00:00:00Z"),
    row(4, "2026-06-03T00:00:00Z"),
    // deno-lint-ignore no-explicit-any
    { rating: "bad", created_at: "2026-06-04T00:00:00Z" } as any,
    row(3, "not a date"),
  ]);
  assertEquals(trend, [{ month: "2026-06", avg: 4.33, count: 3 }]);
});

Deno.test("empty input yields an empty trend", () => {
  assertEquals(bucketMonthlyRatings([]), []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `deno test --allow-env --node-modules-dir=none supabase/functions/merchant-stats/trend.test.ts`
Expected: FAIL — `./trend.ts` not found.

- [ ] **Step 3: Implement the helper**

```ts
// merchant-stats/trend.ts
// Pure monthly bucketing for the owner's rating trend. Dependency-free so
// the whole table is unit-testable.

export interface TrendPoint {
  month: string; // "YYYY-MM", UTC
  avg: number;   // mean published rating that month, 2dp
  count: number; // reviews in the bucket
}

const MAX_BUCKETS = 6;

export function bucketMonthlyRatings(
  rows: Array<{ rating: number; created_at: string }>,
  maxBuckets = MAX_BUCKETS,
): TrendPoint[] {
  const byMonth = new Map<string, { sum: number; count: number }>();
  for (const r of rows ?? []) {
    if (typeof r?.rating !== "number" || typeof r?.created_at !== "string") continue;
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += r.rating;
    bucket.count += 1;
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-maxBuckets)
    .map(([month, { sum, count }]) => ({
      month,
      avg: Math.round((sum / count) * 100) / 100,
      count,
    }));
}
```

- [ ] **Step 4: Run trend tests to green**

Run: `deno test --allow-env --node-modules-dir=none supabase/functions/merchant-stats/trend.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing handler tests**

```ts
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
```

- [ ] **Step 6: Run to verify failure**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/merchant-stats/index.test.ts`
Expected: FAIL — `./index.ts` not found.

- [ ] **Step 7: Implement the handler**

```ts
// merchant-stats — the owner-only stats the client cannot safely read
// itself: the mv_business_review_stats row (RLS does not apply to
// materialized views, so it is never client-granted), a LIVE
// pending-moderation count (owners cannot read pending reviews under RLS,
// and the MV copy is up to a day stale), and a monthly rating trend.
//
// verify_jwt = true authenticates the caller; AUTHORIZATION is the
// owner_id check against the business row. Headline rating and total
// review count are cached on the businesses row the owner already reads —
// deliberately not served here.

import { handleOptions } from "../_shared/cors.ts";
import { createServiceClient, createUserClient } from "../_shared/client.ts";
import { errorResponse, json } from "../_shared/response.ts";
import { bucketMonthlyRatings } from "./trend.ts";

const TREND_FETCH_CAP = 1000;

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const businessId = typeof body.business_id === "string" ? body.business_id : null;
  if (!businessId) return errorResponse("`business_id` is required", 400);

  const userClient = createUserClient(req);
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) return errorResponse("Not authenticated", 401);

  const service = createServiceClient();
  const { data: bizRows, error: bizError } = await service
    .from("businesses").select("id, owner_id").eq("id", businessId);
  if (bizError) {
    console.error("merchant-stats: business lookup failed:", bizError.message);
    return errorResponse("Could not load stats", 500);
  }
  const biz = bizRows?.[0];
  if (!biz) return errorResponse("Business not found", 404);
  if (biz.owner_id !== userData.user.id) return errorResponse("Not your listing", 403);

  const { data: mvRows, error: mvError } = await service
    .from("mv_business_review_stats")
    .select("reviews_30d, five_star, one_star")
    .eq("business_id", businessId);
  if (mvError) console.error("merchant-stats: MV read failed:", mvError.message);
  const mv = mvRows?.[0] ?? null;

  const { count: pending, error: pendingError } = await service
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "pending_moderation");
  if (pendingError) console.error("merchant-stats: pending count failed:", pendingError.message);

  const { data: ratingRows, error: trendError } = await service
    .from("reviews")
    .select("rating, created_at")
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(TREND_FETCH_CAP);
  if (trendError) console.error("merchant-stats: trend fetch failed:", trendError.message);

  return json({
    reviews_30d: mv?.reviews_30d ?? 0,
    five_star: mv?.five_star ?? 0,
    one_star: mv?.one_star ?? 0,
    pending_moderation: pending ?? 0,
    trend: bucketMonthlyRatings(ratingRows ?? []),
  });
});
```

- [ ] **Step 8: Register in config.toml**

Append after the `[functions.admin-review]` block:

```toml
# Owner-only: dashboard stats the client cannot safely read itself — the
# review-stats materialized view ignores RLS (never client-granted), and
# pending reviews are invisible to owners under RLS. JWT authenticates;
# the owner_id check inside is the authorization. No rate limit: authed,
# ownership-gated, no external cost.
[functions.merchant-stats]
verify_jwt = true
```

- [ ] **Step 9: Run all Deno tests**

Run: `deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/`
Expected: all pass (98 existing + 11 new).

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/merchant-stats/ supabase/config.toml
git commit -m "feat(fn): merchant-stats edge function (MV row, live pending count, rating trend)"
```

---

### Task 4: Hooks — `useMyBusinesses`, `useMerchantStats`, `useOwnerListingUpdate` (TDD on the write path)

**Files:**
- Create: `src/hooks/useMyBusinesses.js`
- Create: `src/hooks/useMerchantStats.js`
- Create: `src/hooks/useOwnerListingUpdate.js`
- Create: `src/hooks/useOwnerListingUpdate.test.js`

**Interfaces:**
- Consumes: `useAuth()`, `supabase`, the Task 1 grant, the Task 3 response shape.
- Produces (consumed by Tasks 5–7):
  - `useMyBusinesses() → { businesses: Array|null, loading: boolean, error: string|null, refresh(): void }` — rows carry `id, slug, name, status, tier, rating, review_count, improvement_until, hero_image_url, gallery_image_urls, hours_json, phone, whatsapp, email, website, about, price_range, address, hood, category: { label }`.
  - `useMerchantStats(businessId) → { stats: object|null, loading: boolean }` — stats is the Task 3 payload, null on any failure.
  - `useOwnerListingUpdate(businessId) → { save(fields): Promise<boolean>, saving: boolean, error: string|null }`.

- [ ] **Step 1: Write the failing write-path test**

```js
// useOwnerListingUpdate.test.js — the security-adjacent write path: a save
// resolves true only when a row actually updated (RLS returns zero rows
// for a non-owner, which must surface as failure, not silent success).
import { renderHook, act } from "@testing-library/react";
import { useOwnerListingUpdate } from "./useOwnerListingUpdate.js";

const { dbState } = vi.hoisted(() => ({
  dbState: { current: { rows: [{ id: "b1" }], error: null } },
}));
vi.mock("../lib/supabase", () => {
  const chain = {
    update: () => chain,
    eq: () => chain,
    select: () =>
      Promise.resolve({ data: dbState.current.rows, error: dbState.current.error }),
  };
  return { supabase: { from: () => chain } };
});

test("save resolves true when the update matched a row", async () => {
  dbState.current = { rows: [{ id: "b1" }], error: null };
  const { result } = renderHook(() => useOwnerListingUpdate("b1"));
  let ok;
  await act(async () => {
    ok = await result.current.save({ phone: "254712345678" });
  });
  expect(ok).toBe(true);
  expect(result.current.error).toBeNull();
});

test("a zero-row update (RLS: not the owner) is a failure", async () => {
  dbState.current = { rows: [], error: null };
  const { result } = renderHook(() => useOwnerListingUpdate("b1"));
  let ok;
  await act(async () => {
    ok = await result.current.save({ phone: "254712345678" });
  });
  expect(ok).toBe(false);
  expect(result.current.error).toMatch(/could not save/i);
});

test("a server error surfaces its real message", async () => {
  dbState.current = { rows: null, error: { message: "value too long for phone" } };
  const { result } = renderHook(() => useOwnerListingUpdate("b1"));
  let ok;
  await act(async () => {
    ok = await result.current.save({ phone: "x".repeat(30) });
  });
  expect(ok).toBe(false);
  expect(result.current.error).toBe("value too long for phone");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/hooks/useOwnerListingUpdate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement all three hooks**

```js
// src/hooks/useOwnerListingUpdate.js
// Direct column-scoped UPDATE on the owner's own businesses row
// (20260723200000 grant + the owner-update RLS policy). The .select("id")
// is load-bearing: RLS filters a non-owner's update to zero rows, and a
// zero-row "success" must read as failure, never as saved.
import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";

export function useOwnerListingUpdate(businessId) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = useCallback(
    async (fields) => {
      if (!businessId) return false;
      setSaving(true);
      setError(null);
      const { data, error: upError } = await supabase
        .from("businesses")
        .update(fields)
        .eq("id", businessId)
        .select("id");
      setSaving(false);
      if (upError || !data?.length) {
        setError(upError?.message || "Could not save your changes.");
        return false;
      }
      return true;
    },
    [businessId],
  );

  return { save, saving, error };
}
```

```js
// src/hooks/useMyBusinesses.js
// The signed-in owner's listings, any status, via the owner-read RLS
// policy. Also feeds the ProfilePage "Your business" card. Degrades to []
// on error so consumers never blank.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

const COLUMNS =
  "id, slug, name, status, tier, rating, review_count, improvement_until, " +
  "hero_image_url, gallery_image_urls, hours_json, phone, whatsapp, email, " +
  "website, about, price_range, address, hood, category:categories(label)";

export function useMyBusinesses() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user) {
      setBusinesses(null);
      return undefined;
    }
    let cancelled = false;
    supabase
      .from("businesses")
      .select(COLUMNS)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setBusinesses([]);
        } else {
          setBusinesses(data ?? []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return {
    businesses,
    loading: Boolean(user) && businesses === null,
    error,
    refresh,
  };
}
```

```js
// src/hooks/useMerchantStats.js
// Owner stats via the merchant-stats edge function. stats stays null on
// any failure — tiles render "—" and the page never blanks.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMerchantStats(businessId) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setStats(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setStats(null);
    supabase.functions
      .invoke("merchant-stats", { body: { business_id: businessId } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data && !data.error) setStats(data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return { stats, loading };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/hooks/useOwnerListingUpdate.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMyBusinesses.js src/hooks/useMerchantStats.js src/hooks/useOwnerListingUpdate.js src/hooks/useOwnerListingUpdate.test.js
git commit -m "feat(ui): merchant data hooks (my businesses, stats, owner update)"
```

---

### Task 5: Dashboard composition — components + page rewrite

**Files:**
- Create: `src/components/merchant/BusinessSwitcher.jsx`
- Create: `src/components/merchant/ImprovementBanner.jsx`
- Create: `src/components/merchant/MetricTiles.jsx`
- Create: `src/components/merchant/RecentReviews.jsx`
- Create: `src/components/merchant/SubscriptionCard.jsx`
- Create: `src/components/merchant/EditListingSection.jsx` (stub — fully replaced in Task 6)
- Modify: `src/pages/MerchantDashboardPage.jsx` (full rewrite; mock constants deleted)
- Create: `src/pages/MerchantDashboardPage.test.jsx`

**Interfaces:**
- Consumes: Task 4 hooks; `useAuth()`; `StarRow`; the mock's visual idiom (classes like `font-serif-d`, `border-ink-10`, `bg-forest-soft`, `text-stone-w` — reuse them verbatim).
- Produces: the four page states (guest prompt / no-listings CTA / pending-only panel / active dashboard); `EditListingSection` slots in below the tiles in Task 6 (the page imports it then — leave a clearly marked spot).

- [ ] **Step 1: Write the failing page-state tests**

```jsx
// MerchantDashboardPage.test.jsx — the four states plus switcher, on real
// hook seams (hooks mocked at module level; no network).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MerchantDashboardPage from "./MerchantDashboardPage.jsx";

const { authState, bizState, statsState } = vi.hoisted(() => ({
  authState: { current: { session: { user: { id: "u1" } }, user: { id: "u1" }, loading: false, signOut: vi.fn() } },
  bizState: { current: { businesses: [], loading: false, error: null, refresh: vi.fn() } },
  statsState: { current: { stats: null, loading: false } },
}));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => authState.current }));
vi.mock("../hooks/useMyBusinesses.js", () => ({ useMyBusinesses: () => bizState.current }));
vi.mock("../hooks/useMerchantStats.js", () => ({ useMerchantStats: () => statsState.current }));
vi.mock("../hooks/useOwnerListingUpdate.js", () => ({
  useOwnerListingUpdate: () => ({ save: vi.fn(async () => true), saving: false, error: null }),
}));

const ACTIVE = {
  id: "b1", slug: "posh", name: "Posh Palace", status: "active", tier: "free",
  rating: 4.5, review_count: 12, improvement_until: null,
  hero_image_url: null, gallery_image_urls: [], hours_json: "Mon-Sat 9am-7pm",
  phone: "0712345678", whatsapp: null, email: null, website: null,
  about: "A calm salon.", price_range: null, address: null, hood: "Kilimani",
  category: { label: "Health & Beauty" },
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/merchant"]}>
      <Routes>
        <Route path="/merchant" element={<MerchantDashboardPage />} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
        <Route path="/for-business/register" element={<div>REGISTER ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("guest: sign-in prompt, no dashboard", async () => {
  authState.current = { session: null, user: null, loading: false, signOut: vi.fn() };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText("WELCOME ROUTE")).toBeInTheDocument();
});

test("no listings: register CTA", async () => {
  authState.current = { session: { user: { id: "u1" } }, user: { id: "u1" }, loading: false, signOut: vi.fn() };
  bizState.current = { businesses: [], loading: false, error: null, refresh: vi.fn() };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: /list your business/i }));
  expect(await screen.findByText("REGISTER ROUTE")).toBeInTheDocument();
});

test("pending-only: under-review panel, no dashboard tiles", () => {
  bizState.current = {
    businesses: [{ ...ACTIVE, id: "p1", status: "pending", name: "Pending Co" }],
    loading: false, error: null, refresh: vi.fn(),
  };
  mount();
  expect(screen.getByText(/under review/i)).toBeInTheDocument();
  expect(screen.queryByText(/last 30 days/i)).not.toBeInTheDocument();
});

test("active: real tiles from business + stats, no mock metrics", () => {
  bizState.current = { businesses: [ACTIVE], loading: false, error: null, refresh: vi.fn() };
  statsState.current = {
    stats: { reviews_30d: 3, five_star: 8, one_star: 0, pending_moderation: 1,
             trend: [{ month: "2026-06", avg: 4.4, count: 5 }, { month: "2026-07", avg: 4.5, count: 7 }] },
    loading: false,
  };
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getByText("4.5")).toBeInTheDocument();       // rating tile
  expect(screen.getByText("3")).toBeInTheDocument();          // 30d tile
  expect(screen.getByText("1")).toBeInTheDocument();          // in moderation
  expect(screen.queryByText(/profile views/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/whatsapp taps/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/what reviewers mention/i)).not.toBeInTheDocument();
});

test("stats failure: tiles show em-dashes, page intact", () => {
  bizState.current = { businesses: [ACTIVE], loading: false, error: null, refresh: vi.fn() };
  statsState.current = { stats: null, loading: false };
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
});

test("two active listings: switcher swaps the header", async () => {
  bizState.current = {
    businesses: [ACTIVE, { ...ACTIVE, id: "b2", slug: "second", name: "Second Shop" }],
    loading: false, error: null, refresh: vi.fn(),
  };
  const user = userEvent.setup();
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText(/your listings/i), "b2");
  expect(await screen.findByText("Second Shop")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/MerchantDashboardPage.test.jsx`
Expected: FAIL — the page still renders the mock's hardcoded content ("Posh Palace Salon", "Profile views"), so the state assertions and absence checks cannot pass.

- [ ] **Step 3: Implement the components**

```jsx
// src/components/merchant/BusinessSwitcher.jsx
// Hidden for a single listing; a compact labelled select for several.
export default function BusinessSwitcher({ businesses, selectedId, onSelect }) {
  if (!businesses || businesses.length < 2) return null;
  return (
    <div className="px-5 md:px-8 pt-4">
      <label htmlFor="ms-switcher" className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider block mb-1">
        Your listings
      </label>
      <select
        id="ms-switcher"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2.5 text-sm"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
```

```jsx
// src/components/merchant/ImprovementBanner.jsx
// healthy / warning / window, derived from the cached rating and
// improvement_until — the mock's three improvementStatus states made real.
import { Shield, AlertCircle } from "lucide-react";

function stateOf(rating, improvementUntil) {
  if (improvementUntil) return "window";
  if (rating > 0 && rating < 3.8) return "warning";
  return "healthy";
}

const COPY = {
  healthy: {
    title: "Healthy standing",
    body: "Your rating is above the 3.5★ threshold. Keep responding to what customers say and you'll stay in good standing.",
    wrap: "border-forest bg-forest-soft", icon: "bg-forest", text: "text-forest",
  },
  warning: {
    title: "Getting close to the threshold",
    body: "Your rating is nearing 3.5★. Listings that stay below the threshold enter a 60-day improvement window.",
    wrap: "border-ochre bg-ochre-soft", icon: "bg-ochre", text: "text-ochre-d",
  },
  window: {
    title: "Improvement window active",
    body: "Your rating fell below 3.5★. Bring it back up before the window ends or the listing is unlisted until it recovers.",
    wrap: "border-clay bg-clay-soft", icon: "bg-clay", text: "text-clay",
  },
};

export default function ImprovementBanner({ rating, improvementUntil }) {
  const s = COPY[stateOf(rating, improvementUntil)];
  const Icon = s === COPY.healthy ? Shield : AlertCircle;
  return (
    <div className={`mt-4 p-4 rounded-2xl border ${s.wrap}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full ${s.icon} flex items-center justify-center flex-shrink-0`}>
          <Icon size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <div className={`text-sm font-semibold ${s.text}`}>{s.title}</div>
          <p className="text-xs text-ink mt-0.5 leading-relaxed">{s.body}</p>
        </div>
      </div>
    </div>
  );
}
```

```jsx
// src/components/merchant/MetricTiles.jsx
// The honest replacement for the mock's engagement grid: Rating, Total
// reviews, Reviews last 30 days (MV, refreshed nightly), In moderation
// (live). A missing stats payload renders "—", never fake numbers.
// Includes the rating-trend sparkline (real monthly buckets; hidden below
// two months of data).
import StarRow from "../StarRow.jsx";

function Sparkline({ trend }) {
  if (!trend || trend.length < 2) return null;
  const avgs = trend.map((t) => t.avg);
  const min = Math.min(...avgs);
  const max = Math.max(...avgs);
  const span = Math.max(max - min, 0.2);
  const points = trend
    .map((t, i) => {
      const x = (i / (trend.length - 1)) * 78 + 1;
      const y = 22 - ((t.avg - min) / span) * 20;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 80 24" className="w-full mt-2 h-6" data-testid="rating-sparkline">
      <polyline fill="none" stroke="#D4A341" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export default function MetricTiles({ business, stats }) {
  const dash = "—";
  const tiles = [
    { label: "Total reviews", value: business.review_count ?? 0, note: "All time" },
    { label: "Last 30 days", value: stats ? stats.reviews_30d : dash, note: "Updated nightly" },
    { label: "In moderation", value: stats ? stats.pending_moderation : dash, note: "Awaiting review" },
  ];
  return (
    <div className="px-5 md:px-8 pb-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-serif-d text-lg text-ink">Reviews</h3>
        <span className="text-[10px] md:text-xs text-stone-w uppercase tracking-wider">Live from customers</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl border border-ink-10 bg-white">
          <div className="text-[10px] md:text-xs text-stone-w">Rating</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-serif-d text-2xl text-ink leading-none">
              {business.rating > 0 ? business.rating : dash}
            </span>
          </div>
          <div className="mt-1"><StarRow rating={business.rating ?? 0} size={10} /></div>
          <Sparkline trend={stats?.trend} />
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="p-3 rounded-xl border border-ink-10 bg-white">
            <div className="text-[10px] md:text-xs text-stone-w">{t.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-serif-d text-2xl text-ink leading-none">{t.value}</span>
            </div>
            <div className="text-[10px] md:text-xs text-stone-w mt-1">{t.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```jsx
// src/components/merchant/RecentReviews.jsx
// The owner's latest published reviews via the public-read policy. No
// respond CTA — replies are a later (Recommended-tier) cycle.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import StarRow from "../StarRow.jsx";

export default function RecentReviews({ businessId }) {
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    if (!businessId) return undefined;
    let cancelled = false;
    supabase
      .from("reviews")
      .select("id, reviewer_name, reviewer_country, rating, body, created_at")
      .eq("business_id", businessId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (!cancelled && !error) setReviews(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!reviews || reviews.length === 0) return null;
  return (
    <div className="px-5 md:px-8 pb-4">
      <h3 className="font-serif-d text-lg text-ink mb-2">Recent reviews</h3>
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="p-3 rounded-xl border border-ink-10 bg-white">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{r.reviewer_name}</span>
                {r.reviewer_country && (
                  <span className="text-[10px] md:text-xs text-stone-w">{r.reviewer_country}</span>
                )}
              </div>
              <StarRow rating={r.rating} size={11} />
            </div>
            <p className="text-xs text-stone-w italic">"{r.body}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```jsx
// src/components/merchant/SubscriptionCard.jsx
// Real tier + subscription state (owner-read RLS). Checkout is cycle 3, so
// the only action is "coming soon".
import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { supabase } from "../../lib/supabase";

const TIER_LABEL = {
  free: "Free listing",
  verified: "Verified tier",
  recommended: "Karibu Recommended",
};

export default function SubscriptionCard({ business }) {
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!business?.id) return undefined;
    let cancelled = false;
    supabase
      .from("subscriptions")
      .select("tier, status, amount_kes, current_period_end")
      .eq("business_id", business.id)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!cancelled && !error) setSub(data?.[0] ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [business?.id]);

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-KE", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="px-5 md:px-8 pb-6">
      <div className="p-4 rounded-2xl border border-ink-10 bg-ivory-2">
        <div className="flex items-center gap-2 mb-2">
          <CircleDollarSign size={15} className="text-forest" />
          <span className="text-sm font-semibold text-ink">Subscription</span>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-serif-d text-xl text-ink">
              {TIER_LABEL[business.tier] ?? business.tier}
            </div>
            <div className="text-xs text-stone-w">
              {sub && periodEnd
                ? `Renews ${periodEnd} · KSh ${Number(sub.amount_kes).toLocaleString()}`
                : "Upgrade — coming soon"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the page**

```jsx
// src/pages/MerchantDashboardPage.jsx
// The owner's real home (cycle 2). Every number on this page has a data
// source: the businesses row (cached rating/count), merchant-stats (MV +
// live pending + trend), published reviews, and the subscription row. The
// prototype's engagement tiles and sentiment themes had no source and are
// gone — honest absence beats fabricated numbers.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useMyBusinesses } from "../hooks/useMyBusinesses.js";
import { useMerchantStats } from "../hooks/useMerchantStats.js";
import BusinessSwitcher from "../components/merchant/BusinessSwitcher.jsx";
import ImprovementBanner from "../components/merchant/ImprovementBanner.jsx";
import MetricTiles from "../components/merchant/MetricTiles.jsx";
import RecentReviews from "../components/merchant/RecentReviews.jsx";
import SubscriptionCard from "../components/merchant/SubscriptionCard.jsx";
import EditListingSection from "../components/merchant/EditListingSection.jsx";

const TIER_BADGE = {
  free: "Free listing",
  verified: "Verified",
  recommended: "Karibu Recommended",
};

function CenteredNote({ title, body, cta, onCta }) {
  return (
    <div className="fade-in flex flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="font-serif-d text-2xl text-ink mb-2">{title}</h1>
      <p className="text-sm text-stone-w mb-6 max-w-sm">{body}</p>
      {cta && (
        <button
          type="button"
          onClick={onCta}
          className="bg-forest text-white rounded-xl px-6 py-3 text-sm font-semibold"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const { businesses, loading, refresh } = useMyBusinesses();
  const [selectedId, setSelectedId] = useState(null);

  const active = useMemo(
    () => (businesses ?? []).filter((b) => b.status === "active"),
    [businesses],
  );
  const pending = useMemo(
    () => (businesses ?? []).filter((b) => b.status === "pending"),
    [businesses],
  );
  const business = active.find((b) => b.id === selectedId) ?? active[0] ?? null;
  const { stats } = useMerchantStats(business?.id);

  if (authLoading || loading) return <div className="fade-in pb-6" />;

  if (!session) {
    return (
      <CenteredNote
        title="Your business on Karibu"
        body="Sign in to see your listing's performance and keep its details fresh."
        cta="Sign in to continue"
        onCta={() => navigate("/welcome", { state: { next: "/merchant" } })}
      />
    );
  }

  if ((businesses ?? []).length === 0) {
    return (
      <CenteredNote
        title="No listings yet"
        body="Register your business and it will appear here once our team approves it."
        cta="List your business"
        onCta={() => navigate("/for-business/register")}
      />
    );
  }

  if (!business) {
    return (
      <CenteredNote
        title="Under review"
        body={`${pending.map((p) => p.name).join(", ")} ${pending.length === 1 ? "is" : "are"} still being reviewed by our Nairobi team — allow up to 48 hours. You'll manage it here once it goes live.`}
      />
    );
  }

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Merchant</h2>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <LogOut size={14} className="text-ink" />
        </button>
      </div>

      <BusinessSwitcher businesses={active} selectedId={business.id} onSelect={setSelectedId} />

      {/* Business header */}
      <div className="px-5 md:px-8 pt-5 pb-4">
        <div className="text-xs font-semibold text-ochre-d uppercase tracking-wider">
          {TIER_BADGE[business.tier] ?? business.tier}
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight mt-0.5">{business.name}</h1>
        <p className="text-sm text-stone-w mt-0.5">
          {business.category?.label} · {business.hood}
        </p>
        <ImprovementBanner rating={business.rating} improvementUntil={business.improvement_until} />
      </div>

      <MetricTiles business={business} stats={stats} />
      {pending.length > 0 && (
        <p className="px-5 md:px-8 pb-4 text-xs text-stone-w">
          {pending.length} application{pending.length > 1 ? "s" : ""} under review — see For Business.
        </p>
      )}
      <EditListingSection business={business} onSaved={refresh} />
      <RecentReviews businessId={business.id} />
      <SubscriptionCard business={business} />
    </div>
  );
}
```

NOTE: `EditListingSection` does not exist until Task 6. For THIS task, create a placeholder implementation in `src/components/merchant/EditListingSection.jsx` that Task 6 fully replaces:

```jsx
// src/components/merchant/EditListingSection.jsx
// Fully implemented in the next task; this stub keeps the page composable.
export default function EditListingSection() {
  return null;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/MerchantDashboardPage.test.jsx && npx vitest run`
Expected: new tests PASS (6); whole suite green (the old routes/navigation tests are unaffected — `/merchant` was already routed).

- [ ] **Step 6: Commit**

```bash
git add src/components/merchant/ src/pages/MerchantDashboardPage.jsx src/pages/MerchantDashboardPage.test.jsx
git commit -m "feat(ui): merchant dashboard on real owner data"
```

---

### Task 6: EditListingSection — safe-fields editor + photo manager (TDD)

**Files:**
- Modify: `src/components/merchant/EditListingSection.jsx` (replace the Task 5 stub entirely)
- Create: `src/components/merchant/EditListingSection.test.jsx`

**Interfaces:**
- Consumes: `useOwnerListingUpdate(business.id)` (Task 4), `useAuth()` (for the upload folder), `supabase.storage.from("business-photos").upload(path, file)`; props `{ business, onSaved }` from Task 5's page.
- Produces: saves exactly the granted columns; calls `onSaved()` after a successful save.

- [ ] **Step 1: Write the failing tests**

```jsx
// EditListingSection.test.jsx — the editor saves only granted fields,
// surfaces server errors, and locks identity fields.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditListingSection from "./EditListingSection.jsx";

const { saveState, uploadSpy } = vi.hoisted(() => ({
  saveState: { current: { save: vi.fn(async () => true), saving: false, error: null } },
  uploadSpy: vi.fn(() => Promise.resolve({ data: { path: "p" }, error: null })),
}));
vi.mock("../../hooks/useOwnerListingUpdate.js", () => ({
  useOwnerListingUpdate: () => saveState.current,
}));
vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("../../lib/supabase", () => ({
  supabase: { storage: { from: () => ({ upload: uploadSpy }) } },
}));

const BIZ = {
  id: "b1", name: "Posh Palace", hood: "Kilimani",
  category: { label: "Health & Beauty" },
  hours_json: "Mon-Sat 9am-7pm", phone: "0712345678", whatsapp: "",
  email: "", website: "", about: "A calm salon.", price_range: "",
  address: "", hero_image_url: null, gallery_image_urls: [],
};

beforeEach(() => {
  saveState.current = { save: vi.fn(async () => true), saving: false, error: null };
  uploadSpy.mockClear();
});

test("save sends only granted fields and reports success", async () => {
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(<EditListingSection business={BIZ} onSaved={onSaved} />);
  const phone = screen.getByLabelText(/phone/i);
  await user.clear(phone);
  await user.type(phone, "0722000000");
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  await waitFor(() => expect(saveState.current.save).toHaveBeenCalledTimes(1));
  const sent = saveState.current.save.mock.calls[0][0];
  expect(sent.phone).toBe("0722000000");
  expect(Object.keys(sent).every((k) =>
    ["hours_json", "phone", "whatsapp", "email", "website", "about",
     "price_range", "address", "hero_image_url", "gallery_image_urls"].includes(k),
  )).toBe(true);
  expect(onSaved).toHaveBeenCalled();
  expect(await screen.findByText(/saved/i)).toBeInTheDocument();
});

test("a failed save surfaces the hook's error and does not call onSaved", async () => {
  saveState.current = {
    save: vi.fn(async () => false), saving: false, error: "value too long for phone",
  };
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(<EditListingSection business={BIZ} onSaved={onSaved} />);
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  expect(await screen.findByText("value too long for phone")).toBeInTheDocument();
  expect(onSaved).not.toHaveBeenCalled();
});

test("identity fields are locked with the contact note", () => {
  render(<EditListingSection business={BIZ} onSaved={vi.fn()} />);
  expect(screen.getByText(/contact hello@karibu\.co\.ke to change/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/business name/i)).not.toBeInTheDocument();
});

test("adding photos uploads to the owner folder and joins the gallery", async () => {
  const user = userEvent.setup();
  render(<EditListingSection business={BIZ} onSaved={vi.fn()} />);
  await user.upload(
    screen.getByLabelText(/add photos/i),
    new File(["x"], "new.jpg", { type: "image/jpeg" }),
  );
  await waitFor(() => expect(uploadSpy).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole("button", { name: /save changes/i }));
  await waitFor(() => expect(saveState.current.save).toHaveBeenCalled());
  const sent = saveState.current.save.mock.calls[0][0];
  expect(sent.gallery_image_urls.length).toBe(1);
  expect(sent.gallery_image_urls[0]).toContain("/business-photos/u1/");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/merchant/EditListingSection.test.jsx`
Expected: FAIL (stub renders null).

- [ ] **Step 3: Implement**

```jsx
// src/components/merchant/EditListingSection.jsx
// Safe-fields editor. What may be edited is decided by the column-scoped
// grant (20260723200000), not this form — the locked-fields note is UX,
// the 42501 behind it is the enforcement. Photos upload to the owner's own
// business-photos folder (storage RLS enforces the folder); removal edits
// the array only (storage orphans are the tracked cleanup-cron follow-up).
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext.jsx";
import { useOwnerListingUpdate } from "../../hooks/useOwnerListingUpdate.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_GALLERY = 15;

const field =
  "w-full bg-white border border-ink-10 rounded-xl px-3 py-2.5 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-forest/40";
const label = "block text-xs font-semibold text-ink mb-1";

const hoursToText = (hoursJson) =>
  typeof hoursJson === "string" ? hoursJson : hoursJson?.display ?? "";

export default function EditListingSection({ business, onSaved }) {
  const { user } = useAuth();
  const { save, saving, error } = useOwnerListingUpdate(business.id);
  const [form, setForm] = useState({});
  const [gallery, setGallery] = useState([]);
  const [hero, setHero] = useState(null);
  const [notice, setNotice] = useState(null); // "saved" | upload error text

  useEffect(() => {
    setForm({
      hours: hoursToText(business.hours_json),
      phone: business.phone ?? "",
      whatsapp: business.whatsapp ?? "",
      email: business.email ?? "",
      website: business.website ?? "",
      about: business.about ?? "",
      price_range: business.price_range ?? "",
      address: business.address ?? "",
    });
    setGallery(business.gallery_image_urls ?? []);
    setHero(business.hero_image_url ?? null);
    setNotice(null);
  }, [business]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    setNotice(null);
    if (gallery.length + files.length > MAX_GALLERY) {
      return setNotice(`A gallery holds up to ${MAX_GALLERY} photos.`);
    }
    try {
      const urls = [];
      for (const f of files) {
        if (!PHOTO_TYPES.includes(f.type) || f.size > MAX_FILE_BYTES) {
          throw new Error(`${f.name}: must be an image under 5 MB`);
        }
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upError } = await supabase.storage
          .from("business-photos").upload(path, f);
        if (upError) throw new Error(upError.message);
        urls.push(
          `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business-photos/${path}`,
        );
      }
      setGallery((g) => [...g, ...urls]);
    } catch (err) {
      setNotice(err.message);
    }
  };

  const removePhoto = (url) => setGallery((g) => g.filter((u) => u !== url));

  const submit = async () => {
    setNotice(null);
    const ok = await save({
      hours_json: form.hours.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      about: form.about.trim() || null,
      price_range: form.price_range.trim() || null,
      address: form.address.trim() || null,
      hero_image_url: hero ?? gallery[0] ?? null,
      gallery_image_urls: gallery,
    });
    if (ok) {
      setNotice("saved");
      onSaved?.();
    }
  };

  return (
    <div className="px-5 md:px-8 pb-4">
      <h3 className="font-serif-d text-lg text-ink mb-2">Edit your listing</h3>
      <div className="p-4 rounded-2xl border border-ink-10 bg-white space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="el-hours">Opening hours</label>
            <input id="el-hours" className={field} value={form.hours ?? ""} onChange={set("hours")} />
          </div>
          <div>
            <label className={label} htmlFor="el-phone">Phone</label>
            <input id="el-phone" className={field} value={form.phone ?? ""} onChange={set("phone")} />
          </div>
          <div>
            <label className={label} htmlFor="el-whatsapp">WhatsApp</label>
            <input id="el-whatsapp" className={field} value={form.whatsapp ?? ""} onChange={set("whatsapp")} />
          </div>
          <div>
            <label className={label} htmlFor="el-email">Email</label>
            <input id="el-email" className={field} value={form.email ?? ""} onChange={set("email")} />
          </div>
          <div>
            <label className={label} htmlFor="el-website">Website</label>
            <input id="el-website" className={field} value={form.website ?? ""} onChange={set("website")} />
          </div>
          <div>
            <label className={label} htmlFor="el-price">Price range</label>
            <input id="el-price" className={field} value={form.price_range ?? ""} onChange={set("price_range")} placeholder="KSh 500-2,000" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="el-address">Street address</label>
          <input id="el-address" className={field} value={form.address ?? ""} onChange={set("address")} />
        </div>
        <div>
          <label className={label} htmlFor="el-about">About</label>
          <textarea id="el-about" rows={3} className={field} value={form.about ?? ""} onChange={set("about")} />
        </div>

        <div>
          <span className={label}>Photos ({gallery.length}/{MAX_GALLERY})</span>
          {gallery.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {gallery.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-ink-10" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => removePhoto(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-[10px] leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className={label} htmlFor="el-photos">Add photos</label>
          <input id="el-photos" type="file" multiple accept={PHOTO_TYPES.join(",")}
            onChange={addPhotos} className="text-xs" />
        </div>

        <p className="text-[11px] text-stone-w">
          Name, category, and location are verified details — contact
          hello@karibu.co.ke to change them.
        </p>

        {notice === "saved" && <p className="text-xs text-forest font-semibold">Saved.</p>}
        {notice && notice !== "saved" && <p className="text-xs text-clay">{notice}</p>}
        {error && <p className="text-xs text-clay">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full bg-forest text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/merchant/EditListingSection.test.jsx && npx vitest run src/pages/MerchantDashboardPage.test.jsx`
Expected: PASS (4 new; page tests still green — their EditListingSection mock path stays valid since the module still default-exports a component).
NOTE: the page test file mocks `useOwnerListingUpdate` but not this component; with the real component now rendering inside the page tests, its supabase/storage usage is covered by the global `src/test/setup.js` mock. If a page test breaks on a missing mock method, extend `src/test/setup.js`'s chain (the established pattern), never the component.

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/EditListingSection.jsx src/components/merchant/EditListingSection.test.jsx
git commit -m "feat(ui): owner safe-fields editor with photo manager"
```

---

### Task 7: Entry points — ProfilePage card + ApplicationsBlock link

**Files:**
- Create: `src/components/profile/MyBusinessSection.jsx`
- Modify: `src/pages/ProfilePage.jsx` (import + render after `<HomeCitySection ... />`, before `<MyReviewsSection ... />`)
- Modify: `src/components/business/ApplicationsBlock.jsx` (active rows link to `/merchant`)
- Create: `src/components/profile/MyBusinessSection.test.jsx`

**Interfaces:**
- Consumes: `useMyBusinesses()` (Task 4).
- Produces: owners can reach `/merchant` from their profile and from `/for-business`.

- [ ] **Step 1: Write the failing tests**

```jsx
// MyBusinessSection.test.jsx — the card renders only for owners and links
// to /merchant; non-owners see nothing.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MyBusinessSection from "./MyBusinessSection.jsx";

const { bizState } = vi.hoisted(() => ({
  bizState: { current: { businesses: [], loading: false } },
}));
vi.mock("../../hooks/useMyBusinesses.js", () => ({
  useMyBusinesses: () => bizState.current,
}));

function mount() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<MyBusinessSection />} />
        <Route path="/merchant" element={<div>MERCHANT ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("no listings: renders nothing", () => {
  bizState.current = { businesses: [], loading: false };
  const { container } = mount();
  expect(container).toBeEmptyDOMElement();
});

test("an owner sees the card and it opens the dashboard", async () => {
  bizState.current = {
    businesses: [{ id: "b1", name: "Posh Palace", status: "active" }],
    loading: false,
  };
  const user = userEvent.setup();
  mount();
  expect(screen.getByText("Posh Palace")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /open dashboard/i }));
  expect(await screen.findByText("MERCHANT ROUTE")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/profile/MyBusinessSection.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```jsx
// src/components/profile/MyBusinessSection.jsx
// The owner's doorway from their customer profile to the merchant
// dashboard. Renders nothing for non-owners — the profile stays a purely
// customer surface for everyone else.
import { useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { useMyBusinesses } from "../../hooks/useMyBusinesses.js";

export default function MyBusinessSection() {
  const navigate = useNavigate();
  const { businesses } = useMyBusinesses();
  if (!businesses || businesses.length === 0) return null;
  const first = businesses[0];
  const extra = businesses.length - 1;

  return (
    <div className="w-full max-w-xs mb-6 text-left">
      <h3 className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
        Your business
      </h3>
      <div className="flex items-center justify-between bg-white border border-ink-10 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Store size={15} className="text-forest flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{first.name}</p>
            {extra > 0 && (
              <p className="text-[11px] text-stone-w">+{extra} more</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/merchant")}
          className="text-xs font-semibold text-clay flex-shrink-0"
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}
```

In `src/pages/ProfilePage.jsx`: add `import MyBusinessSection from "../components/profile/MyBusinessSection.jsx";` with the other profile-component imports, and render `<MyBusinessSection />` immediately after the `<HomeCitySection ... />` element (before `<MyReviewsSection ... />`). No other changes.

In `src/components/business/ApplicationsBlock.jsx`: add `import { useNavigate } from "react-router-dom";` and `const navigate = useNavigate();` inside the component; in the businesses map, when `b.status === "active"`, render next to the StatusChip:

```jsx
            {b.status === "active" && (
              <button
                type="button"
                onClick={() => navigate("/merchant")}
                className="text-xs font-semibold text-forest ml-2"
              >
                Open dashboard
              </button>
            )}
```

(Place the button inside the row's right-hand flex, after the `<StatusChip ... />`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/profile/MyBusinessSection.test.jsx src/pages/ProfilePage.test.jsx src/pages/ForBusinessPage.test.jsx`
Expected: PASS — new tests green; ProfilePage tests unaffected (the global supabase mock resolves the businesses query to empty, so the section renders nothing there); ForBusinessPage tests unaffected (its supabase mock returns no active rows in existing cases — if the "statuses are shown" test's active-status fixture now also renders "Open dashboard", assert nothing broke; adjust that test's expectations only if it fails on the new button's presence).

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/MyBusinessSection.jsx src/components/profile/MyBusinessSection.test.jsx src/pages/ProfilePage.jsx src/components/business/ApplicationsBlock.jsx
git commit -m "feat(ui): owner entry points to the merchant dashboard"
```

---

### Task 8: Full verification + docs

**Files:**
- Modify: `docs/FIX_PLAN.md` (task 25 progress line), root `CLAUDE.md` (onboarding bullet gains the cycle-2 sentence)

- [ ] **Step 1: Full test sweep**

```bash
npm run lint
npm run build
npx vitest run
deno test --allow-env --allow-net --node-modules-dir=none supabase/functions/
npx supabase db reset && npx supabase test db
```

Expected: all green. Also grep the built bundle per the standing guardrail: `grep -rE "api.anthropic.com|sk-ant|x-api-key|anthropic-version" dist/` must return nothing.

- [ ] **Step 2: Docs touch**

- `docs/FIX_PLAN.md`, under task 25: add "Progress: merchant dashboard live on real data (branch feat/merchant-dashboard) — owner listings via owner_id, merchant-stats fn (MV + live pending + trend), safe-fields self-editing via column-scoped grant; engagement analytics still open (needs an events pipeline)."
- Root `CLAUDE.md`, the onboarding-spine bullet: append one sentence — "Cycle 2 (merchant dashboard) followed: `/merchant` runs on real owner data with safe-fields self-editing (column-scoped grant, `20260723200000`) and the `merchant-stats` function."

- [ ] **Step 3: Commit docs**

```bash
git add docs/FIX_PLAN.md CLAUDE.md
git commit -m "docs: record the merchant dashboard cycle"
```
