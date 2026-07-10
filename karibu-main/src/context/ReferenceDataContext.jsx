// src/context/ReferenceDataContext.jsx
// KAR-5 — cities + categories reference data, fetched ONCE on app load and held
// in React Context (small, read-only; never re-fetched per render/per screen).
//
// Render-safe by design: state is initialized to the byte-identical fallback
// constants from src/data/referenceData.js, so the very first paint is identical
// to the prototype and the app still renders if Supabase is unreachable. On
// mount we fetch the live rows once and replace the state, assembling the EXACT
// shapes the screens already consume (the visual layer never changes).
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import {
  cities as fallbackCities,
  categories as fallbackCategories,
  iconFromName,
} from "../data/referenceData";

const ReferenceDataContext = createContext({
  cities: fallbackCities,
  categories: fallbackCategories,
  loading: false,
  error: null,
});

// Map a DB `cities` row -> the prototype `{ key, label, tagline, hoods }` shape.
function mapCity(row) {
  return {
    key: row.slug,
    label: row.name,
    tagline: row.tagline,
    hoods: row.hoods || [],
  };
}

// Map a DB `sub_types` row -> the prototype `{ key, label, Icon }` shape
// (Icon is the lucide component resolved from the stored icon string).
function mapSubType(row) {
  return {
    key: row.slug,
    label: row.label,
    Icon: iconFromName(row.icon),
  };
}

// Map a DB `categories` row (with nested `sub_types`) -> the prototype category
// shape. CRITICAL: the `restaurants` category carries its sub_types as
// `cuisineTags` with `subTypes: []`; every other category carries them as
// `subTypes` and has NO `cuisineTags` key (matching the constant exactly).
function mapCategory(row) {
  const subTypeRows = [...(row.sub_types || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const base = {
    key: row.slug,
    label: row.label,
    Icon: iconFromName(row.icon),
    blurb: row.blurb,
  };
  if (row.slug === "restaurants") {
    return {
      ...base,
      cuisineTags: subTypeRows.map(mapSubType),
      subTypes: [],
    };
  }
  return {
    ...base,
    subTypes: subTypeRows.map(mapSubType),
  };
}

export function ReferenceDataProvider({ children }) {
  // First paint uses the fallback constants => identical render, no empty flash.
  const [cities, setCities] = useState(fallbackCities);
  const [categories, setCategories] = useState(fallbackCategories);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false); // guard StrictMode double-invoke / re-fetch

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [citiesRes, categoriesRes] = await Promise.all([
          supabase
            .from("cities")
            .select("slug, name, tagline, hoods, is_active, sort_order")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("categories")
            .select("slug, label, blurb, icon, sort_order, sub_types(slug, label, icon, sort_order)")
            .order("sort_order", { ascending: true }),
        ]);

        if (cancelled) return;

        if (citiesRes.error || categoriesRes.error) {
          // Keep the fallback constants on the screen; surface the error only.
          setError(citiesRes.error || categoriesRes.error);
        } else {
          if (citiesRes.data?.length) {
            setCities(citiesRes.data.map(mapCity));
          }
          if (categoriesRes.data?.length) {
            setCategories(categoriesRes.data.map(mapCategory));
          }
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ReferenceDataContext.Provider value={{ cities, categories, loading, error }}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

// Consumers only need { cities, categories }; loading/error are available too.
export function useReferenceData() {
  return useContext(ReferenceDataContext);
}
