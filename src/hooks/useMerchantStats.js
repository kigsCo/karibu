// Owner stats via the merchant-stats edge function. stats stays null on
// any failure — tiles render "—" and the page never blanks.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMerchantStats(businessId) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setStats(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setStats(null);
    supabase.functions
      .invoke("merchant-stats", { body: { business_id: businessId } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data && !data.error) setStats(data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return { stats, loading };
}
