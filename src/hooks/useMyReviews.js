// src/hooks/useMyReviews.js
// The signed-in user's own reviews, every status — powered by the
// "Reviewer reads own reviews" RLS policy (20260722231313). Public readers
// still only ever see published rows; this list is the author's private
// view of where each review stands in moderation.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

// status -> profile chip. Rejection/flag details stay internal; the customer
// sees an honest but non-alarming label.
export const REVIEW_STATUS_CHIP = {
  pending_moderation: { label: "In review", tone: "pending" },
  published: { label: "Live", tone: "live" },
  rejected: { label: "Not published", tone: "off" },
  flagged: { label: "Not published", tone: "off" },
};

export function useMyReviews() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setReviews([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("reviews")
      .select(
        "id, rating, body, status, created_at, business:businesses(slug, name)",
      )
      .eq("reviewer_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data)) setReviews(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { reviews, loading };
}
