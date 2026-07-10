// src/hooks/useBusinessDetail.js
// KAR-7 — live business detail + published reviews (migration step 4:
// BusinessScreen fetches one business by slug + its published reviews).
//
// Inert unless given a slug: payloads built from the prototype constants have
// no slug, so those navigations keep the untouched prototype merge behaviour.
// Live-sourced payloads (from useBusinesses) carry `slug`; this hook then
// fetches the full row (detail columns the list query deliberately skips) and
// the 20 newest published reviews.
//
// Same render-safe contract as the other data hooks: `business`/`reviews` are
// null until a fetch succeeds, and the screen keeps its fallbacks meanwhile —
// identical first paint, and still rendering if Supabase is unreachable.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const REVIEWS_PAGE = 20;

const TIER_BADGE = {
  recommended: "Karibu Recommended",
  verified: "Verified",
};

const RECOMMENDATION_LABEL = {
  yes: "Yes, absolutely",
  caveats: "Yes, with caveats",
  no: "Not really",
};

/** "3 days ago" / "2 weeks ago" — matches the prototype's relative dates. */
function relativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return months <= 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "1 year ago" : `${years} years ago`;
}

/** Map a DB business row to the prototype detail shape. Absent values are
 *  OMITTED so `{ ...recommended[0], ...payload, ...business }` merges keep the
 *  prototype's fallback fields instead of blanking them. */
function mapDetailRow(row) {
  const detail = {
    id: row.slug,
    dbId: row.id,
    slug: row.slug,
    name: row.name,
    hood: row.hood,
    rating: Number(row.rating) || 0,
    reviews: row.review_count ?? 0,
    price: row.price_range,
    badge: TIER_BADGE[row.tier] || null,
    tags: row.tags || [],
  };
  if (row.category?.label) detail.category = row.category.label;
  if (row.about) detail.about = row.about;
  if (row.hero_image_url) detail.image = row.hero_image_url;
  if (Array.isArray(row.services_json) && row.services_json.length) {
    detail.services = row.services_json; // [{ name, price }]
  }
  // hours_json has no fixed shape yet; accept a plain display string or a
  // { display } object, otherwise leave the fallback hours in place.
  const hours =
    typeof row.hours_json === "string" ? row.hours_json : row.hours_json?.display;
  if (hours) detail.hours = hours;
  if (row.phone) detail.phone = row.phone;
  if (row.whatsapp) detail.whatsapp = row.whatsapp;
  if (row.mpesa_till) detail.mpesa = `Till ${row.mpesa_till}`;
  else if (row.mpesa_paybill) detail.mpesa = `Paybill ${row.mpesa_paybill}`;
  return detail;
}

/** Map a DB review row to the prototype review-card shape. */
function mapReviewRow(row) {
  const type = row.reviewer_type
    ? row.reviewer_type.charAt(0).toUpperCase() + row.reviewer_type.slice(1)
    : null;
  return {
    name: row.reviewer_name,
    country: [row.reviewer_country, type].filter(Boolean).join(" · "),
    rating: row.rating,
    date: relativeDate(row.created_at),
    text: row.body,
    serviceUsed: row.service_used || undefined,
    recommendation: RECOMMENDATION_LABEL[row.recommendation] || undefined,
  };
}

/**
 * Live detail for one business.
 *
 * @param {string=} slug business slug; undefined disables the hook entirely
 * @returns {{ business: object|null, reviews: Array|null,
 *             loading: boolean, error: any }}
 *   `reviews` stays null (screen shows its fallback) until the fetch succeeds;
 *   an empty published set resolves to [] — the honest live truth.
 */
export function useBusinessDetail(slug) {
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: biz, error: bizError } = await supabase
          .from("businesses")
          .select(
            "id, slug, name, hood, about, price_range, tags, tier, rating, review_count, hours_json, services_json, phone, whatsapp, mpesa_till, mpesa_paybill, hero_image_url, category:categories(slug, label)",
          )
          .eq("slug", slug)
          .eq("status", "active")
          .maybeSingle();

        if (cancelled) return;
        if (bizError || !biz) {
          if (bizError) setError(bizError);
          return; // keep the payload/fallback view
        }
        setBusiness(mapDetailRow(biz));

        const { data: revs, error: revError } = await supabase
          .from("reviews")
          .select(
            "id, reviewer_name, reviewer_country, reviewer_type, rating, body, service_used, recommendation, created_at",
          )
          .eq("business_id", biz.id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(REVIEWS_PAGE);

        if (cancelled) return;
        if (revError) {
          setError(revError);
          return; // business is live; reviews keep their fallback
        }
        setReviews((revs || []).map(mapReviewRow));
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { business, reviews, loading, error };
}
