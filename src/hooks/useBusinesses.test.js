// Regression for the keyset-pagination tiebreaker bug (FIX_PLAN P0 #3).
//
// The list is ordered by (ranking_score DESC, id DESC) but the cursor used to
// filter on ranking_score alone. When every row shares a score — the state of a
// fresh database before calculate-rankings has run, ranking_score = 0 on every
// row — `ranking_score < 0` matched nothing and page 2 was empty, so at most 20
// of the seeded businesses were ever reachable. The fix makes the cursor
// composite: rows ranked lower OR tied-on-score-with-a-smaller-id.
//
// We mock the Supabase client at the query-builder level so we can (a) capture
// the exact PostgREST `.or()` filter page 2 sends and (b) prove pages stitch
// together with no duplicates or gaps when all scores are equal.
import { renderHook, waitFor, act } from "@testing-library/react";

// Two full-scoreless pages: page 1 returns a full PAGE_SIZE (20) so loadMore is
// enabled and not `done`; page 2 returns a short page so the hook terminates.
function pageRows(count, startIdx) {
  return Array.from({ length: count }, (_, i) => ({
    id: `bid-${startIdx + i}`, // raw uuid stand-in — the cursor reads this
    slug: `biz-${startIdx + i}`,
    name: `Biz ${startIdx + i}`,
    hood: "Westlands",
    about: "A business.",
    price_range: "KSh 1,000",
    tags: [],
    tier: "free",
    rating: 4,
    review_count: 1,
    ranking_score: 0, // every row tied — the exact condition that broke page 2
    hero_image_url: null,
    category: { slug: "beauty", label: "Beauty" },
  }));
}

const state = { fetchCount: 0, orCalls: [] };

vi.mock("../lib/supabase", () => {
  function makeChain() {
    const chain = {
      _or: null,
      select: () => chain,
      eq: () => chain,
      lt: () => chain,
      order: () => chain,
      limit: () => chain,
      or(arg) {
        chain._or = arg;
        return chain;
      },
      // The query builder is awaited directly, so the chain itself is thenable.
      then(onFulfilled) {
        const call = state.fetchCount++;
        if (chain._or) state.orCalls.push(chain._or);
        const data = call === 0 ? pageRows(20, 0) : pageRows(3, 20);
        return Promise.resolve({ data, error: null }).then(onFulfilled);
      },
    };
    return chain;
  }
  return { supabase: { from: () => makeChain() } };
});

import { useBusinesses } from "./useBusinesses.js";

beforeEach(() => {
  state.fetchCount = 0;
  state.orCalls = [];
});

test("page 2 filters on a composite (score, id) keyset — not score alone", async () => {
  const { result } = renderHook(() =>
    useBusinesses({ citySlug: "nairobi", categorySlug: "beauty" }),
  );

  // Page 1 resolves: a full page, live, more to load.
  await waitFor(() => expect(result.current.live).toBe(true));
  expect(result.current.items).toHaveLength(20);
  expect(result.current.done).toBe(false);
  expect(state.orCalls).toHaveLength(0); // first page carries no cursor

  await act(async () => {
    await result.current.loadMore();
  });

  // The page-2 query used the composite keyset built from the LAST row of page 1
  // (id "bid-19", score 0). Without the `and(...eq...,id.lt...)` branch this
  // request would be `ranking_score.lt.0` and return nothing.
  expect(state.orCalls).toEqual([
    "ranking_score.lt.0,and(ranking_score.eq.0,id.lt.bid-19)",
  ]);

  // 20 + 3 rows stitched with no duplicates and no gaps, then done.
  expect(result.current.items).toHaveLength(23);
  expect(new Set(result.current.items.map((i) => i.id)).size).toBe(23);
  expect(result.current.done).toBe(true);
});
