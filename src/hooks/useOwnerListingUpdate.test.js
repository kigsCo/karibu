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
