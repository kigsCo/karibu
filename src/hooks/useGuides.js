// src/hooks/useGuides.js
// Phase 3, final step — the `guides` constant becomes a live query.
//
// Same fallback-first contract as ReferenceDataContext (KAR-5) and useBusinesses
// (KAR-6): `items` starts as the byte-identical prototype constant, so the very
// first paint is unchanged and the app still renders if Supabase is unreachable.
// Once the query resolves, `live` flips true and `items` is the database truth —
// including an EMPTY list, which the screens render as their existing
// "coming soon" state.
//
// Two hooks, mirroring the businesses pair:
//   useGuides()             list rows, WITHOUT body_json — feeds Discover + Guides hub
//   useGuideDetail(slug)    one guide WITH its body and resolved related businesses
//
// The list deliberately omits `body_json`. Guides are editorial and few, but a
// body is a few KB each and no list screen renders one (see db-performance:
// never select an unbounded column on a list path).
//
// Field mapping (schema -> prototype shape):
//   slug -> id          read_time -> readTime      hero_variant -> heroVariant
//   ask_prompts -> askPrompts      body_json.blocks -> body
//   updated_at -> updated ("Updated April 2026")
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { mapBusinessRow } from "./useBusinesses";

// Columns a list row needs. No body_json.
const LIST_COLUMNS =
  "slug, category, title, subtitle, summary, read_time, author, hero_variant, featured, updated_at";

const DETAIL_COLUMNS = `${LIST_COLUMNS}, body_json, related_businesses, ask_prompts`;

/** "2026-04-01T00:00:00Z" -> "Updated April 2026", matching the prototype copy. */
export function formatUpdated(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `Updated ${month} ${date.getUTCFullYear()}`;
}

/** Map a DB `guides` row to the shape the screens already render. */
export function mapGuideRow(row) {
  const guide = {
    id: row.slug, // screens key and route on `id`; slug is the stable public key
    slug: row.slug,
    category: row.category,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    readTime: row.read_time,
    author: row.author,
    heroVariant: row.hero_variant || "default",
    featured: Boolean(row.featured),
    updated: formatUpdated(row.updated_at),
  };
  // Present only on a detail fetch. Absent (not undefined-valued) on list rows,
  // so `{ ...fallback, ...guide }` merges keep working exactly as before.
  if (row.body_json) guide.body = row.body_json.blocks ?? [];
  if (row.ask_prompts) guide.askPrompts = row.ask_prompts;
  return guide;
}

/**
 * Every published guide, ordered the way the prototype constant was: featured
 * first, then by the editorial order the seed inserted them in.
 *
 * @param {object}  opts
 * @param {Array=}  opts.fallback  prototype constant shown until live
 * @returns {{ items: Array, live: boolean, loading: boolean, error: any }}
 */
export function useGuides({ fallback = [] } = {}) {
  const [items, setItems] = useState(fallback);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("guides")
      .select(LIST_COLUMNS)
      .eq("is_published", true)
      .order("featured", { ascending: false })
      // `nullsFirst: false` keeps a published-but-undated guide from floating to
      // an unpredictable spot; `slug` is a stable tiebreaker so the order is
      // deterministic when two guides share featured + published_at.
      .order("published_at", { ascending: true, nullsFirst: false })
      .order("slug", { ascending: true })
      .then(({ data, error: qError }) => {
        if (cancelled) return;
        setLoading(false);
        if (qError) {
          // Keep the fallback on screen; surface the error only.
          setError(qError);
          return;
        }
        setError(null);
        setLive(true);
        setItems((data || []).map(mapGuideRow));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, live, loading, error };
}

/**
 * One guide by slug, with its body and its related businesses resolved from
 * `related_businesses` (a uuid[], not a foreign key, so PostgREST cannot embed
 * it — we fetch the rows in a second query and re-order them to match).
 *
 * @param {string}  slug
 * @param {object=} fallback  the prototype guide, rendered until live data lands
 */
export function useGuideDetail(slug, fallback = null) {
  const [guide, setGuide] = useState(fallback);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState(null);

  const fetchGuide = useCallback(async () => {
    if (!slug) return null;

    const { data, error: qError } = await supabase
      .from("guides")
      .select(DETAIL_COLUMNS)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (qError) return { error: qError };
    if (!data) return { guide: null };

    const mapped = mapGuideRow(data);

    // Resolve the related businesses, preserving the editorial order the guide
    // listed them in (a uuid[] has an order; `IN (...)` does not).
    const ids = data.related_businesses ?? [];
    if (ids.length) {
      const { data: bizRows, error: bizError } = await supabase
        .from("businesses")
        .select(
          "id, slug, name, hood, about, price_range, tags, tier, rating, review_count, ranking_score, hero_image_url, category:categories(slug, label)",
        )
        .in("id", ids)
        .eq("status", "active");

      if (bizError) {
        // Don't fail the whole article over its related-businesses rail, but
        // don't swallow it either — the guide's own `error` only covers the
        // guide fetch, so this would otherwise vanish silently.
        console.warn("guide related-businesses fetch failed:", bizError.message);
      } else if (bizRows) {
        const byId = new Map(bizRows.map((row) => [row.id, mapBusinessRow(row)]));
        mapped.relatedBusinesses = ids.map((id) => byId.get(id)).filter(Boolean);
      }
    }
    if (!mapped.relatedBusinesses) mapped.relatedBusinesses = [];

    return { guide: mapped };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(Boolean(slug));

    fetchGuide().then((result) => {
      if (cancelled || !result) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setLive(true);
      // A published guide that vanished from the DB leaves the fallback on
      // screen rather than blanking the article.
      if (result.guide) setGuide(result.guide);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchGuide, slug]);

  return { guide, live, loading, error };
}
