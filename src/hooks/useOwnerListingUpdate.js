// Direct column-scoped UPDATE on the owner's own businesses row
// (20260723200000 grant + the owner-update RLS policy). The .select("id")
// is load-bearing: RLS filters a non-owner's update to zero rows, and a
// zero-row "success" must read as failure, never as saved.
import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";

export function useOwnerListingUpdate(businessId) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = useCallback(
    async (fields) => {
      if (!businessId) return false;
      setSaving(true);
      setError(null);
      const { data, error: upError } = await supabase
        .from("businesses")
        .update(fields)
        .eq("id", businessId)
        .select("id");
      setSaving(false);
      if (upError || !data?.length) {
        setError(upError?.message || "Could not save your changes.");
        return false;
      }
      return true;
    },
    [businessId],
  );

  return { save, saving, error };
}
