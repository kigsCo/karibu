// _shared/pagination.ts
// Keyset (cursor) pagination for hot list endpoints. We paginate by
// `ranking_score DESC` (with `id` as a tiebreaker in the index
// idx_businesses_active_rank_id), never by OFFSET — see CLAUDE.md
// "Pagination" / db-performance skill.
//
// The cursor is simply the ranking_score of the last row of the previous page.
// Query pattern for the caller:
//   let q = supabase.from("businesses").select(...).eq("status","active")
//     .order("ranking_score", { ascending: false }).limit(limit + 1?);
//   if (cursor !== null) q = q.lt("ranking_score", cursor);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface PageParams {
  /** ranking_score to page after (exclusive), or null for the first page. */
  cursor: number | null;
  /** Clamped page size, 1..MAX_LIMIT. */
  limit: number;
}

/**
 * Parse cursor + limit from a URL's search params (or any URLSearchParams-like).
 *   ?cursor=12.5&limit=30
 * - limit defaults to 20, is clamped to [1, 50].
 * - cursor is a numeric ranking_score; invalid/absent => null (first page).
 */
export function parsePageParams(params: URLSearchParams): PageParams {
  const rawLimit = Number(params.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const rawCursor = params.get("cursor");
  const parsedCursor = rawCursor === null ? NaN : Number(rawCursor);
  const cursor = Number.isFinite(parsedCursor) ? parsedCursor : null;

  return { cursor, limit };
}

/**
 * Build the next cursor from the last row of the current page. Returns null
 * when there are no more rows (caller fetched fewer than `limit`), signalling
 * the end of the list to the client.
 */
export function buildNextCursor<T extends { ranking_score?: number | null }>(
  rows: T[],
  limit: number,
): number | null {
  if (rows.length < limit) return null;
  const last = rows[rows.length - 1];
  const score = last?.ranking_score;
  return typeof score === "number" ? score : null;
}
