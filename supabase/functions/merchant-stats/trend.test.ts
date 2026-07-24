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
