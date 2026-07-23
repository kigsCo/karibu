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
