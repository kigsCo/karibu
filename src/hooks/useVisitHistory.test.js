// recordVisit: the fire-and-forget history logger. It must write only when
// both ids exist (guests and fallback rows produce no history) and must
// never throw — the business page's render path calls it.
import { supabase } from "../lib/supabase";
import { recordVisit } from "./useVisitHistory.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("writes an upsert to visited_places when signed in with a live row", async () => {
  const from = vi.spyOn(supabase, "from");
  await recordVisit("user-1", "biz-1");
  expect(from).toHaveBeenCalledWith("visited_places");
});

test("does nothing for guests or fallback rows", async () => {
  const from = vi.spyOn(supabase, "from");
  await recordVisit(null, "biz-1");
  await recordVisit("user-1", null);
  expect(from).not.toHaveBeenCalled();
});

test("swallows storage errors instead of throwing", async () => {
  vi.spyOn(supabase, "from").mockImplementation(() => {
    throw new Error("network down");
  });
  await expect(recordVisit("user-1", "biz-1")).resolves.toBeUndefined();
});
