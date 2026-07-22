// src/hooks/useSavedPlaces.js
// The signed-in user's saved places (the heart button, made real). The
// saved_places table + owner-only RLS have existed since the core schema;
// this hook is the missing wiring. Guests keep the old local-only heart —
// callers check `canPersist` and fall back to their own useState.
//
// Degrade-gracefully contract: any error leaves the current state in place
// and the screens keep rendering; a failed toggle reverts its optimistic
// flip.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

// Embedded columns for the SavedPage list — enough to render a card and
// deep-link to /b/:slug without a second query.
const LIST_SELECT =
  "business_id, saved_at, business:businesses(slug, name, hood, rating, review_count, tier, category:categories(label))";

export function useSavedPlaces({ withBusinesses = false } = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [savedIds, setSavedIds] = useState(() => new Set());
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setSavedIds(new Set());
      setPlaces([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("saved_places")
      .select(withBusinesses ? LIST_SELECT : "business_id")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data)) {
          setSavedIds(new Set(data.map((r) => r.business_id)));
          if (withBusinesses) setPlaces(data.filter((r) => r.business));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, withBusinesses]);

  // Flip one business; optimistic, reverts on error. Returns false when there
  // is no session or no DB id — the caller keeps its local-heart behaviour.
  const toggle = useCallback(
    async (businessId) => {
      if (!userId || !businessId) return false;
      const wasSaved = savedIds.has(businessId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(businessId);
        else next.add(businessId);
        return next;
      });
      const { error } = wasSaved
        ? await supabase
            .from("saved_places")
            .delete()
            .eq("user_id", userId)
            .eq("business_id", businessId)
        : await supabase
            .from("saved_places")
            .insert({ user_id: userId, business_id: businessId });
      if (error) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(businessId);
          else next.delete(businessId);
          return next;
        });
      }
      return !error;
    },
    [userId, savedIds],
  );

  return { canPersist: Boolean(userId), savedIds, places, loading, toggle };
}
