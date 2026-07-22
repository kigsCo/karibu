import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, Filter, Compass, Sparkles } from "lucide-react";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";
import { useBusinesses } from "../hooks/useBusinesses.js";
import Badge from "../components/Badge.jsx";
import StarRow from "../components/StarRow.jsx";
import HeroImage from "../components/HeroImage.jsx";
import { recommended, salonsList } from "../data/businesses.js";

// ---------- SCREEN: CATEGORY ----------
const CategoryScreen = ({ payload, go, back, activeCity = "nairobi" }) => {
  const { cities } = useReferenceData();
  const city = cities.find((c) => c.key === activeCity) || cities[0];
  const hoods = [`All ${city.label}`, ...city.hoods];
  const [activeHood, setActiveHood] = useState(hoods[0]);
  const [activeSort, setActiveSort] = useState("Recommended");

  // Only Nairobi salons (Beauty → nails) was seeded in the prototype constants
  const isBeautyNails = payload?.key === "beauty" && (!payload?.subType || payload?.subType?.key === "nails");

  // KAR-6: live listings for this city/category/sub-type. Until the first live
  // page resolves the prototype behaviour holds (salonsList for the one seeded
  // case, "coming soon" otherwise); once live, the database decides — an empty
  // result shows the existing "coming soon" state.
  const { items: liveItems, live, done, loadMore } = useBusinesses({
    citySlug: activeCity,
    categorySlug: payload?.key,
    subTypeSlug: payload?.subType?.key,
    fallback: activeCity === "nairobi" && isBeautyNails ? salonsList : [],
  });
  const hasListings = live
    ? liveItems.length > 0
    : activeCity === "nairobi" && isBeautyNails;

  const subTypeLabel = payload?.subType?.label;
  const screenTitle = subTypeLabel
    ? `${subTypeLabel}`
    : payload?.label || "Services";

  const filtered = useMemo(() => {
    if (!hasListings) return [];
    let list = [...liveItems];
    if (!activeHood.startsWith("All ")) list = list.filter((s) => s.hood === activeHood);
    // Live rows may lack distanceKm/openNow (no user geolocation or hours data
    // yet) — sort unknown distances last, and "Open now" only keeps known-open.
    if (activeSort === "Closest") list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    if (activeSort === "Top rated") list.sort((a, b) => b.rating - a.rating);
    if (activeSort === "Open now") list = list.filter((s) => s.openNow);
    return list;
  }, [liveItems, activeHood, activeSort, hasListings]);

  // Infinite scroll: an invisible sentinel at the end of the list loads the next
  // keyset page when it scrolls into view. No visible "Show more" control is
  // added — the visual design is unchanged; the list simply keeps filling as the
  // reader scrolls (this is what makes the >20-row lists reachable at all; the
  // hook exposed loadMore but nothing called it, so lists hard-capped at 20).
  // Feature-guarded: environments without IntersectionObserver (jsdom, very old
  // browsers) just don't auto-load — the rendered list is unaffected.
  const sentinelRef = useRef(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "200px" }, // prefetch slightly before the reader hits the end
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="fade-in pb-4">
      {/* Top bar */}
      <div className="sticky top-0 bg-ivory z-10 px-5 md:px-8 pt-4 pb-3 border-b border-ink-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={back} className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
            <ChevronLeft size={17} className="text-ink" />
          </button>
          <div className="flex-1 text-center px-2">
            {subTypeLabel && (
              <div className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider leading-tight">
                {payload?.label}
              </div>
            )}
            <h2 className="font-serif-d text-lg text-ink leading-tight">{screenTitle}</h2>
          </div>
          <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
            <Filter size={15} className="text-ink" />
          </button>
        </div>

        {/* Neighborhood chips */}
        <div className="flex gap-1.5 overflow-x-auto scroll-x">
          {hoods.map((h) => (
            <button
              key={h}
              onClick={() => setActiveHood(h)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                activeHood === h
                  ? "bg-ink text-white border-ink"
                  : "border-ink-10 text-ink bg-white"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* Sort row */}
      <div className="px-5 md:px-8 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto scroll-x">
        <span className="text-xs text-stone-w pr-1">Sort:</span>
        {["Recommended", "Closest", "Top rated", "Open now"].map((s) => (
          <button
            key={s}
            onClick={() => setActiveSort(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              activeSort === s
                ? "bg-clay text-white"
                : "bg-ivory-2 text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-5 md:px-8 pt-2 space-y-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            // Live rows carry a slug and are passed as-is (BusinessScreen
            // fetches full detail by slug); constants keep the prototype merge.
            onClick={() => go("business", s.slug ? s : recommended.find((r) => r.id === s.id) || { ...recommended[0], ...s, image: "posh" })}
            className="w-full flex gap-3 p-2.5 rounded-2xl border border-ink-10 bg-white text-left"
          >
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative">
              <HeroImage variant="posh" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-ink leading-tight">{s.name}</h4>
                {/* Unknown open-state (live rows without hours data) shows neither */}
                {s.openNow != null &&
                  (s.openNow ? (
                    <span className="flex items-center gap-1 text-[10px] md:text-xs font-semibold text-forest flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-forest pulse-dot" />
                      Open
                    </span>
                  ) : (
                    <span className="text-[10px] md:text-xs font-semibold text-stone-w flex-shrink-0">Closed</span>
                  ))}
              </div>
              <p className="text-xs text-stone-w mt-0.5">{s.tagline}</p>
              <div className="flex items-center gap-1 mt-1">
                <StarRow rating={s.rating} size={11} />
                <span className="text-xs text-ink font-medium">{s.rating}</span>
                <span className="text-xs text-stone-w">({s.reviews})</span>
                <span className="text-xs text-stone-w">·</span>
                <span className="text-xs text-stone-w">{s.hood}</span>
                {/* Distance needs user geolocation — hidden until it exists */}
                {s.distanceKm != null && (
                  <>
                    <span className="text-xs text-stone-w">·</span>
                    <span className="text-xs text-stone-w">{s.distanceKm} km</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {s.badge === "Karibu Recommended" && <Badge kind="recommended">Recommended</Badge>}
                {s.badge === "Verified" && <Badge kind="verified">Verified</Badge>}
                <span className="text-[11px] text-ink font-medium">{s.price}</span>
              </div>
            </div>
          </button>
        ))}
        {/* Invisible infinite-scroll sentinel — see the observer effect above. */}
        {live && !done && hasListings && (
          <div ref={sentinelRef} aria-hidden="true" className="h-4" />
        )}
        {filtered.length === 0 && hasListings && (
          <div className="text-center py-10 text-sm text-stone-w">
            No businesses match those filters.
          </div>
        )}
        {!hasListings && (
          <div className="text-center py-12 px-4 fade-in">
            <div className="w-12 h-12 rounded-full bg-ochre-soft inline-flex items-center justify-center mb-3">
              <Compass size={18} className="text-ochre-d" />
            </div>
            <h3 className="font-serif-d text-xl text-ink">
              {activeCity !== "nairobi"
                ? `Coming soon to ${city.label}`
                : `${payload?.label || "Listings"} coming soon`}
            </h3>
            <p className="text-xs text-stone-w mt-1 leading-relaxed max-w-[260px] mx-auto">
              {activeCity !== "nairobi"
                ? `We're onboarding verified businesses in ${city.label} now. Ask Karibu AI for recommendations in the meantime.`
                : `We're onboarding verified ${payload?.label?.toLowerCase() || "businesses"} in ${city.label}. Ask Karibu AI for trusted recommendations from local expertise.`}
            </p>
            <button
              onClick={() => go("ask")}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ochre text-white text-xs font-semibold"
            >
              <Sparkles size={12} />
              Ask Karibu AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CategoryPage() {
  const { categorySlug, subSlug } = useParams();
  const { go, back } = useLegacyNav();
  const { cityKey } = useCity();
  const { categories } = useReferenceData();
  const cat = categories.find((c) => c.key === categorySlug) || { key: categorySlug };
  const subList = cat.subTypes?.length ? cat.subTypes : cat.cuisineTags || [];
  const subType = subSlug ? subList.find((s) => s.key === subSlug) || null : null;
  return <CategoryScreen payload={{ ...cat, subType }} go={go} back={back} activeCity={cityKey} />;
}
