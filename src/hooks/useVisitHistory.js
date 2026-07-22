// src/hooks/useVisitHistory.js
// Visit history (visited_places, 20260722231317): distinct places by
// recency, owner-only under RLS. Logging is fire-and-forget from the
// business page — history must never break or slow the screen being
// visited. Clearing deletes only the caller's rows (RLS scopes the DELETE).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

// Last-visit-wins: revisits refresh visited_at instead of adding rows.
export async function recordVisit(userId, businessId) {
  if (!userId || !businessId) return;
  try {
    await supabase.from("visited_places").upsert(
      {
        user_id: userId,
        business_id: businessId,
        visited_at: new Date().toISOString(),
      },
      { onConflict: "user_id,business_id" },
    );
  } catch {
    // Never surface: history is a bonus, the business page is the product.
  }
}

export function useVisitHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setVisits([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("visited_places")
      .select(
        "business_id, visited_at, business:businesses(slug, name, hood, category:categories(label))",
      )
      .eq("user_id", userId)
      .order("visited_at", { ascending: false })
      .limit(10)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (!fetchError && Array.isArray(data)) {
          setVisits(data.filter((r) => r.business));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const clear = useCallback(async () => {
    if (!userId) return false;
    setError(null);
    const { error: delError } = await supabase
      .from("visited_places")
      .delete()
      .eq("user_id", userId);
    if (delError) {
      setError("Couldn't clear your history. Please try again.");
      return false;
    }
    setVisits([]);
    return true;
  }, [userId]);

  return { visits, loading, error, clear };
}
