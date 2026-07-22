// src/hooks/useProfile.js
// The signed-in user's public.profiles row (the customer database). One row
// per auth user, created server-side by the on_auth_user_created trigger, so
// this hook only ever reads and updates — it never inserts.
//
// Follows the app's degrade-gracefully contract: on any error `profile` stays
// null and screens fall back to what the session itself knows (the email).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext.jsx";

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, home_city_id")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError(fetchError.message);
        setProfile(data ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Update the display name (RLS + a column-scoped grant restrict everything
  // else). Resolves true on success so callers can close their edit UI.
  const saveName = useCallback(
    async (fullName) => {
      if (!userId) return false;
      const trimmed = fullName.trim().slice(0, 120);
      setSaving(true);
      setError(null);
      try {
        const { data, error: updateError } = await supabase
          .from("profiles")
          .update({ full_name: trimmed || null })
          .eq("id", userId)
          .select("id, email, full_name, avatar_url, home_city_id")
          .maybeSingle();
        if (updateError) throw updateError;
        if (data) setProfile(data);
        else setProfile((p) => (p ? { ...p, full_name: trimmed || null } : p));
        return true;
      } catch (e) {
        setError(e.message || "Couldn't save your name. Please try again.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  // Set (or clear, with null) the home city. Same column-scoped grant as
  // full_name; the FK constrains the value to a real city.
  const saveHomeCity = useCallback(
    async (cityId) => {
      if (!userId) return false;
      setSaving(true);
      setError(null);
      try {
        const { data, error: updateError } = await supabase
          .from("profiles")
          .update({ home_city_id: cityId })
          .eq("id", userId)
          .select("id, email, full_name, avatar_url, home_city_id")
          .maybeSingle();
        if (updateError) throw updateError;
        if (data) setProfile(data);
        else setProfile((p) => (p ? { ...p, home_city_id: cityId } : p));
        return true;
      } catch (e) {
        setError(e.message || "Couldn't save your home city. Please try again.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  return { profile, loading, saving, error, saveName, saveHomeCity };
}
