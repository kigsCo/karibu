// src/hooks/useBusinesses.js
// KAR-6 — live, keyset-paginated business listings (migration step 3:
// `recommended` + `salonsList` -> paginated Supabase queries).
//
// Render-safe by design, same contract as ReferenceDataContext (KAR-5):
// `items` starts as the caller's `fallback` (the byte-identical prototype
// constants), so the very first paint is unchanged and the app still renders
// if Supabase is unreachable. Once the first page resolves, `live` flips true
// and `items` is the database truth — including an EMPTY list, which screens
// use to show their existing "coming soon" state.
//
// Pagination is keyset on the cached ranking_score (never offset), backed by
// idx_businesses_active_rank_id — see the db-performance skill. Page size 20.
//
// Field mapping (schema -> prototype shape, per frontend-data-migration):
//   slug -> id            review_count -> reviews     price_range -> price
//   tier -> badge         tags[0..1]   -> tagline     hero_image_url -> image
// Keys the DB cannot provide yet (distanceKm without user geolocation,
// openNow until hours_json has a defined shape) are OMITTED — never invented —
// so the `{ ...recommended[0], ...b }` fallback merges in the screens keep
// working exactly as they do for the prototype constants.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const PAGE_SIZE = 20;

const TIER_BADGE = {
  recommended: "Karibu Recommended",
  verified: "Verified",
};

// List-row columns only — detail extras (services_json, phone, ...) are
// fetched by useBusinessDetail when a business screen opens (step 4).
const LIST_COLUMNS =
  "id, slug, name, hood, about, price_range, tags, tier, rating, review_count, ranking_score, hero_image_url";

/** Map a DB `businesses` row to the prototype card shape. Absent values are
 *  omitted (not set to undefined) so downstream `{ ...fallback, ...item }`
 *  merges behave identically to the prototype constants. */
export function mapBusinessRow(row) {
  const item = {
    id: row.slug, // screens key/route on `id`; slug is the stable public key
    dbId: row.id, // uuid — needed by submit-review (step 6)
    slug: row.slug,
    name: row.name,
    hood: row.hood,
    rating: Number(row.rating) || 0,
    reviews: row.review_count ?? 0,
    price: row.price_range,
    badge: TIER_BADGE[row.tier] || null,
    tags: row.tags || [],
    ranking_score: row.ranking_score,
    // distanceKm / openNow deliberately omitted: no user geolocation yet, and
    // hours_json has no defined shape to derive open-now from. Screens
    // null-guard these so unknown never renders as "Closed" or "undefined km".
  };
  if (row.category?.label) item.category = row.category.label;
  if (row.about) item.about = row.about;
  if (row.hero_image_url) item.image = row.hero_image_url;
  if (row.tags?.length) item.tagline = row.tags.slice(0, 2).join(" · ");
  return item;
}

/**
 * Live business listings with keyset pagination.
 *
 * @param {object}   opts
 * @param {string=}  opts.citySlug     filter to a city ('nairobi', ...)
 * @param {string=}  opts.categorySlug filter to a category ('beauty', ...)
 * @param {string=}  opts.subTypeSlug  filter to a sub-type ('nails', ...)
 * @param {Array=}   opts.fallback     prototype constant shown until live
 * @returns {{ items: Array, live: boolean, loading: boolean, error: any,
 *             done: boolean, loadMore: () => Promise<void> }}
 */
export function useBusinesses({
  citySlug,
  categorySlug,
  subTypeSlug,
  fallback = [],
} = {}) {
  const [items, setItems] = useState(fallback);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  // Keyset cursor: the { score, id } of the last row of the previous page.
  // Composite (not score alone) so it matches the ORDER BY exactly — see the
  // filter note in fetchPage. null before the first page.
  const cursorRef = useRef(null);
  // Monotonic id so a stale in-flight page can't clobber a newer filter set.
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    async ({ reset }) => {
      const requestId = ++requestRef.current;
      setLoading(true);

      // Embed the relations we filter/display on. !inner makes the filter
      // exclude non-matching rows instead of null-ing the embed.
      const embeds = ["category:categories!inner(slug, label)"];
      if (citySlug) embeds.push("city:cities!inner(slug)");
      if (subTypeSlug) embeds.push("sub_type:sub_types!inner(slug)");

      let q = supabase
        .from("businesses")
        .select(`${LIST_COLUMNS}, ${embeds.join(", ")}`)
        .eq("status", "active") // RLS also enforces this; explicit for the index
        .order("ranking_score", { ascending: false })
        .order("id", { ascending: false }) // stable keyset tiebreaker
        .limit(PAGE_SIZE);

      if (citySlug) q = q.eq("city.slug", citySlug);
      if (categorySlug) q = q.eq("category.slug", categorySlug);
      if (subTypeSlug) q = q.eq("sub_type.slug", subTypeSlug);
      const cursor = reset ? null : cursorRef.current;
      if (cursor !== null) {
        // Composite keyset matching ORDER BY (ranking_score DESC, id DESC):
        // the next page is everything ranked strictly lower, OR tied on score
        // with a smaller id. Filtering on ranking_score alone (the previous
        // bug) skipped rows that tied across a page boundary, and returned
        // NOTHING once every score was equal — the state of a fresh database
        // before calculate-rankings has run, where ranking_score is 0 on every
        // row and page 2 of any list was empty.
        q = q.or(
          `ranking_score.lt.${cursor.score},and(ranking_score.eq.${cursor.score},id.lt.${cursor.id})`,
        );
      }

      const { data, error: qError } = await q;

      if (requestId !== requestRef.current) return; // superseded by newer filters
      setLoading(false);

      if (qError) {
        // Keep whatever is on screen (fallback or earlier pages); surface only.
        setError(qError);
        return;
      }

      setError(null);
      setLive(true);
      const mapped = (data || []).map(mapBusinessRow);
      setItems((prev) => (reset ? mapped : [...prev, ...mapped]));
      if (data?.length) {
        // Read the raw row (score + uuid) for the next composite cursor, not the
        // mapped card shape (whose `id` is the slug).
        const last = data[data.length - 1];
        cursorRef.current = { score: last.ranking_score, id: last.id };
      }
      setDone(!data || data.length < PAGE_SIZE);
    },
    [citySlug, categorySlug, subTypeSlug],
  );

  // First page — refetched whenever the filters change. Until it resolves the
  // caller keeps rendering `fallback`, so the first paint never changes.
  useEffect(() => {
    setDone(false);
    fetchPage({ reset: true });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || done || !live) return Promise.resolve();
    return fetchPage({ reset: false });
  }, [fetchPage, loading, done, live]);

  return { items, live, loading, error, done, loadMore };
}
