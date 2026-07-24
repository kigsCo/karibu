// The signed-in owner's listings, any status, via the owner-read RLS
// policy. Also feeds the ProfilePage "Your business" card. Degrades to []
// on error so consumers never blank.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

const COLUMNS =
  "id, slug, name, status, tier, rating, review_count, improvement_until, " +
  "hero_image_url, gallery_image_urls, hours_json, phone, whatsapp, email, " +
  "website, about, price_range, address, hood, category:categories(label)";

export function useMyBusinesses() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user) {
      setBusinesses(null);
      return undefined;
    }
    let cancelled = false;
    supabase
      .from("businesses")
      .select(COLUMNS)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setBusinesses([]);
        } else {
          setBusinesses(data ?? []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return {
    businesses,
    loading: Boolean(user) && businesses === null,
    error,
    refresh,
  };
}
