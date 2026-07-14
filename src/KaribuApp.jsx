import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin, Bell, Heart, ChevronRight, ChevronLeft, Star,
  Phone, MessageCircle, Navigation, Globe, Clock, Check,
  Compass, Bookmark, Briefcase, User, Sparkles, Filter,
  Scissors, UtensilsCrossed, Coffee, Shirt, Pill,
  Dumbbell, Landmark, ShoppingBag, Wine, ShoppingCart, Stethoscope,
  Banknote, ArrowUpRight,
  Trophy, Camera, X, ThumbsUp, AlertCircle,
  Send, Loader2, BarChart3, Eye,
  LayoutDashboard, Users,
  BookOpen, Lightbulb, Building2, MoreHorizontal,
  Hotel, Bed, Palmtree, Building, Beer, Cookie, Hospital,
  ShoppingBasket, Beef, Wheat, Cake, Receipt, Sparkle, Music,
  Gift, Store, Croissant, ChefHat, Activity, Carrot,
  Trees, Key, Scale, Ruler, Warehouse,
} from "lucide-react";
import { supabase } from "./lib/supabase";
// KAR-5: `cities` and `categories` now come from Supabase (fetched once on app
// load) via the ReferenceDataProvider in App.jsx; read them inside each screen
// with `useReferenceData()`. The byte-identical prototype literals live in
// src/data/referenceData.js as the initial/fallback value (identical first
// paint, and the app still renders if Supabase is unreachable).
import { useReferenceData } from "./context/ReferenceDataContext.jsx";
// KAR-6: `recommended` + `salonsList` now come from Supabase via the
// keyset-paginated useBusinesses hook; the byte-identical prototype literals
// live in src/data/businesses.js as the initial/fallback value (identical
// first paint, and the app still renders if Supabase is unreachable).
import { useBusinesses } from "./hooks/useBusinesses.js";
import { useBusinessDetail } from "./hooks/useBusinessDetail.js";
// KAR-9: the `guides` constant is the fallback; published guides come from
// the `guides` table. Same contract — identical first paint, live data
// replaces it. `guides`, `guideCategories`, and `GUIDE_CATEGORY_FALLBACK` live
// in src/data/guides.js.
import { useGuideDetail, useGuides } from "./hooks/useGuides.js";
import Badge from "./components/Badge.jsx";
import StarRow from "./components/StarRow.jsx";
import HeroImage from "./components/HeroImage.jsx";
import { visitorEssentials } from "./data/discover.js";
import { recommended, salonsList } from "./data/businesses.js";
import { reviewsSample } from "./data/reviews.js";
import { guides, guideCategories, GUIDE_CATEGORY_FALLBACK } from "./data/guides.js";

// ---------- SCREEN: DISCOVER ----------
export const DiscoverScreen = ({ go, activeCity, onOpenCityPicker }) => {
  const { cities, categories } = useReferenceData();
  // KAR-6: the carousel reads the live top-ranked active businesses. Not
  // city-filtered — the prototype shows the same cards in every city, and an
  // empty rail would collapse the section; live-and-empty keeps the fallback.
  const { items: liveTop } = useBusinesses({ fallback: recommended });
  const topBusinesses = (liveTop.length ? liveTop : recommended).slice(0, 6);
  // KAR-9: the "Read before you go" rail reads the live featured guides.
  const { items: liveGuides } = useGuides({ fallback: guides });
  const placeholders = [
    "nails in Westlands",
    "airport transfer tonight",
    "best nyama choma",
    "pharmacy open now",
    "forex bureau near me",
  ];
  const [phIndex, setPhIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % placeholders.length), 2400);
    return () => clearInterval(t);
  }, []);

  const cityLabel = cities.find((c) => c.key === activeCity)?.label || "Nairobi";

  return (
    <div className="fade-in">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-clay flex items-center justify-center">
            <span className="font-serif-d text-xl" style={{ color: "#F7F1E8", lineHeight: 1 }}>K</span>
          </div>
          <span className="font-serif-d text-xl text-ink">Karibu</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCityPicker}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-ink-10 bg-ivory-2 active:bg-ivory"
          >
            <MapPin size={12} className="text-clay" />
            <span className="text-xs font-medium text-ink">{cityLabel}</span>
            <ChevronRight size={10} className="text-stone-w rotate-90" />
          </button>
          <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
            <Bell size={15} className="text-ink" />
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 md:px-8 pt-4 pb-3">
        <div className="font-serif-d text-3xl md:text-4xl text-ink leading-tight">
          <span className="greeting-cycle inline-block">Karibu,</span> traveller.
        </div>
        <div className="font-serif-d italic text-xl md:text-2xl text-stone-w leading-tight mt-0.5">
          What do you need in {cityLabel}?
        </div>
      </div>

      {/* Ask Karibu AI search */}
      <div className="px-5 md:px-8 pb-5">
        <button
          onClick={() => go("ask")}
          className="w-full flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-left relative overflow-hidden border"
          style={{ backgroundColor: "#FBF4E0", borderColor: "#D4A341" }}
        >
          <div className="w-8 h-8 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ochre-d uppercase tracking-wider">
              Ask Karibu · AI
            </div>
            <div className="text-sm text-ink mt-0.5 truncate">
              "<span className="italic">{placeholders[phIndex]}</span>"
            </div>
          </div>
          <ChevronRight size={16} className="text-ochre-d flex-shrink-0" />
        </button>
      </div>

      {/* Visitor essentials */}
      <div className="px-5 md:px-8 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-serif-d text-lg text-ink">For visitors</h3>
          <span className="text-xs text-stone-w uppercase tracking-wider">Karibu picks</span>
        </div>
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {visitorEssentials.map(({ label, sub, Icon }) => (
            <button
              key={label}
              className="flex flex-col items-center text-center px-1 py-3 rounded-xl bg-forest-soft border border-ink-10 transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-full bg-forest flex items-center justify-center mb-1.5">
                <Icon size={16} color="#F7F1E8" />
              </div>
              <span className="text-[11px] font-semibold text-ink leading-tight">{label}</span>
              <span className="text-[9px] text-stone-w leading-tight mt-0.5">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category grid */}
      <div className="px-5 md:px-8 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">Browse services</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
          {categories.map((cat) => {
            const Icon = cat.Icon;
            const hasSubs = (cat.subTypes && cat.subTypes.length > 0) || (cat.cuisineTags && cat.cuisineTags.length > 0);
            return (
              <button
                key={cat.key}
                onClick={() => go(hasSubs ? "subcategory" : "category", cat)}
                className="flex flex-col items-center text-center py-3 md:py-4 px-1.5 rounded-xl border border-ink-10 transition hover:bg-ivory-2 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-clay-soft flex items-center justify-center mb-1.5">
                  <Icon size={16} className="text-clay md:w-5 md:h-5" />
                </div>
                <span className="text-[10px] md:text-xs font-semibold text-ink leading-tight">{cat.label}</span>
                {hasSubs && (
                  <span className="text-[9px] text-stone-w leading-tight mt-0.5">
                    {cat.subTypes?.length || cat.cuisineTags?.length} types
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Karibu Recommended carousel */}
      <div className="pb-6">
        <div className="px-5 md:px-8 flex items-baseline justify-between mb-3">
          <div>
            <h3 className="font-serif-d text-lg text-ink">Karibu Recommended</h3>
            <p className="text-xs text-stone-w">Trusted by visitors · verified monthly</p>
          </div>
          <button className="text-xs text-clay font-semibold flex items-center gap-0.5">
            See all <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scroll-x md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:overflow-visible px-5 md:px-8 pb-1">
          {topBusinesses.map((b) => (
            <button
              key={b.id}
              onClick={() => go("business", b)}
              className="flex-shrink-0 w-60 md:w-auto rounded-2xl overflow-hidden border border-ink-10 bg-white text-left transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="h-32 relative">
                <HeroImage variant={b.image} />
                {b.badge && (
                  <div className="absolute top-2 left-2">
                    <Badge kind={b.badge === "Verified" ? "verified" : "recommended"}>{b.badge}</Badge>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm text-ink leading-tight">{b.name}</h4>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Star size={12} className="fill-current text-ochre" />
                    <span className="text-xs font-semibold text-ink">{b.rating}</span>
                  </div>
                </div>
                <div className="text-xs text-stone-w mt-0.5">
                  {b.category} · {b.hood}
                </div>
                <div className="text-xs text-ink mt-1 font-medium">{b.price}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tourist favourites */}
      <div className="px-5 md:px-8 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">Visitors are loving</h3>
        <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-3">
          {[
            { name: "Mama Oliech's", cat: "Seafood · Fish specialist", hood: "Parklands", rating: 4.7, reviews: 890 },
            { name: "Connect Coffee Roasters", cat: "Specialty coffee", hood: "Lavington", rating: 4.8, reviews: 412 },
            { name: "Nairobi National Park Safari", cat: "Day trip · Wildlife", hood: "Pickup city-wide", rating: 4.9, reviews: 1203 },
          ].map((b, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-ink-10 bg-white text-left transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <HeroImage variant={["posh", "talisman", "artcaffe"][i]} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-ink truncate">{b.name}</h4>
                <p className="text-xs text-stone-w truncate">{b.cat} · {b.hood}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarRow rating={b.rating} size={11} />
                  <span className="text-xs text-ink font-medium">{b.rating}</span>
                  <span className="text-xs text-stone-w">({b.reviews})</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-stone-w flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Read before you go — guides teaser */}
      <div className="pb-6">
        <div className="px-5 md:px-8 flex items-baseline justify-between mb-3">
          <div>
            <h3 className="font-serif-d text-lg text-ink">Read before you go</h3>
            <p className="text-xs text-stone-w">Editorial guides · updated monthly</p>
          </div>
          <button onClick={() => go("guides")} className="text-xs text-clay font-semibold flex items-center gap-0.5">
            All guides <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto scroll-x md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:overflow-visible px-5 md:px-8 pb-1">
          {liveGuides.filter((g) => g.featured).map((g) => {
            const cat = (guideCategories.find((c) => c.key === g.category) || GUIDE_CATEGORY_FALLBACK);
            return (
              <button
                key={g.id}
                onClick={() => go("guide_article", g)}
                className="flex-shrink-0 w-60 md:w-auto rounded-2xl overflow-hidden border border-ink-10 bg-white text-left transition hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="h-24 relative">
                  <HeroImage variant={g.heroVariant} />
                  <div className="absolute top-2 left-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold backdrop-blur"
                      style={{ backgroundColor: "rgba(247,241,232,0.85)", color: cat?.color }}
                    >
                      <cat.Icon size={10} />
                      {cat?.label}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-serif-d text-sm text-ink leading-tight">{g.title}</h4>
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] md:text-xs text-stone-w">
                    <Clock size={10} />
                    <span>{g.readTime} min read</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Own a business CTA */}
      <div className="px-5 md:px-8 pb-6">
        <button
          onClick={() => go("business_signup")}
          className="w-full rounded-2xl p-5 text-left relative overflow-hidden border border-ink-10"
          style={{ backgroundColor: "#2A3D2B" }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #D4A341 0 1px, transparent 1px 14px)",
            }}
          />
          <div className="relative">
            <div className="text-ochre text-xs font-semibold uppercase tracking-wider mb-1">
              For businesses
            </div>
            <h4 className="font-serif-d text-2xl text-white leading-tight mb-1">
              Be found by thousands<br />of visitors weekly
            </h4>
            <p className="text-xs" style={{ color: "#D7CFC4" }}>
              List free · Upgrade for featured placement
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ochre">
              See pricing <ArrowUpRight size={14} />
            </div>
          </div>
        </button>
        <button
          onClick={() => go("merchant_dashboard")}
          className="mt-2 w-full py-2.5 text-xs font-semibold text-stone-w flex items-center justify-center gap-1.5"
        >
          <LayoutDashboard size={13} />
          Already a partner? Open merchant dashboard
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: SUB-CATEGORY PICKER ----------
export const SubCategoryScreen = ({ payload, go, back, activeCity = "nairobi" }) => {
  const { cities } = useReferenceData();
  const cat = payload;
  if (!cat) return null;
  const city = cities.find((c) => c.key === activeCity) || cities[0];

  const items = cat.subTypes && cat.subTypes.length > 0
    ? cat.subTypes
    : cat.cuisineTags && cat.cuisineTags.length > 0
      ? cat.cuisineTags
      : [];

  const isRestaurant = cat.key === "restaurants";

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">{cat.label}</h2>
        <span className="w-8" />
      </div>

      {/* Hero block */}
      <div className="px-5 md:px-8 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-clay-soft flex items-center justify-center">
            <cat.Icon size={22} className="text-clay" />
          </div>
          <div>
            <h1 className="font-serif-d text-2xl text-ink leading-tight">{cat.label}</h1>
            <p className="text-xs text-stone-w">{cat.blurb} · {city.label}</p>
          </div>
        </div>
      </div>

      {/* Browse all */}
      <div className="px-5 md:px-8 pb-3">
        <button
          onClick={() => go("category", { ...cat, subType: null })}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-ink-10 bg-clay-soft active:bg-clay-soft"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-clay flex items-center justify-center">
              <Compass size={15} className="text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm text-ink">Browse all {cat.label.toLowerCase()}</div>
              <div className="text-[11px] text-stone-w">See everything in this category</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-clay" />
        </button>
      </div>

      {/* Sub-type / cuisine grid */}
      <div className="px-5 md:px-8 pb-5">
        <h3 className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
          {isRestaurant ? "By cuisine" : "By type"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {items.map((sub) => {
            const Icon = sub.Icon;
            return (
              <button
                key={sub.key}
                onClick={() => go("category", { ...cat, subType: sub })}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-ink-10 bg-white text-left active:bg-ivory-2"
              >
                <div className="w-9 h-9 rounded-full bg-ivory-2 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-clay" />
                </div>
                <span className="text-xs font-semibold text-ink leading-tight">{sub.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ask Karibu nudge */}
      <div className="px-5 md:px-8 pb-6">
        <button
          onClick={() => go("ask")}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-ochre bg-ochre-soft text-left"
        >
          <div className="w-9 h-9 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-xs text-ink">Not sure which type?</div>
            <div className="text-[11px] text-stone-w">
              Ask Karibu AI — describe what you need
            </div>
          </div>
          <ChevronRight size={15} className="text-ochre-d" />
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: CATEGORY ----------
export const CategoryScreen = ({ payload, go, back, activeCity = "nairobi" }) => {
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
  const { items: liveItems, live } = useBusinesses({
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

// ---------- SCREEN: BUSINESS DETAIL ----------
export const BusinessScreen = ({ payload, back, go, reviews = [], justPosted }) => {
  const b = payload || recommended[0];
  const [saved, setSaved] = useState(false);

  // KAR-7: live-sourced payloads carry a slug — fetch the full row + published
  // reviews. Constant-sourced payloads have no slug; the hook stays inert and
  // the prototype merge below behaves exactly as before.
  const { business: liveBiz, reviews: liveReviews } = useBusinessDetail(b.slug);

  // Fall back to full data if the payload was a lightweight list item
  const full = { ...recommended[0], ...b, ...(liveBiz || {}) };

  // Combine existing seed reviews with new user-submitted ones (new first).
  // Once the published set is live it replaces the sample constants.
  const allReviews = [...reviews, ...(liveReviews ?? reviewsSample)];

  // Live-computed rating: folds user reviews into the stored aggregate
  const seedSum = full.rating * full.reviews;
  const addSum = reviews.reduce((a, r) => a + r.rating, 0);
  const totalCount = full.reviews + reviews.length;
  const liveRating =
    totalCount > 0 ? (seedSum + addSum) / totalCount : full.rating;

  // Rating distribution — computed from the live published reviews when we
  // have them; the prototype's illustrative split otherwise.
  const distribution = liveReviews
    ? [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        pct: liveReviews.length
          ? Math.round(
              (liveReviews.filter((r) => r.rating === stars).length /
                liveReviews.length) *
                100,
            )
          : 0,
      }))
    : [
        { stars: 5, pct: 72 },
        { stars: 4, pct: 21 },
        { stars: 3, pct: 5 },
        { stars: 2, pct: 1 },
        { stars: 1, pct: 1 },
      ];

  // Rank within hood/category — derived from rating position in seed list
  const sameHoodAndCategory = salonsList.filter(
    (s) => s.hood === full.hood && full.category?.toLowerCase().includes("salon")
  );
  const sortedByRating = [...sameHoodAndCategory].sort((a, b) => b.rating - a.rating);
  const rankIndex = sortedByRating.findIndex((s) => s.id === full.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  return (
    <div className="fade-in pb-6">
      {/* Hero */}
      <div className="relative h-52">
        <HeroImage variant={full.image || "posh"} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.45) 100%)" }} />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={back}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <ChevronLeft size={18} className="text-ink" />
          </button>
          <button
            onClick={() => setSaved(!saved)}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <Heart
              size={18}
              className={saved ? "fill-current text-clay" : "text-ink"}
            />
          </button>
        </div>
        {full.badge === "Karibu Recommended" && (
          <div className="absolute bottom-3 left-4">
            <Badge kind="recommended">Karibu Recommended</Badge>
          </div>
        )}
      </div>

      {/* "Review posted" banner */}
      {justPosted && (
        <div className="px-5 md:px-8 py-2.5 bg-forest-soft border-b border-ink-10 flex items-center gap-2 fade-in">
          <Check size={15} className="text-forest" />
          <span className="text-xs font-semibold text-forest">
            Thanks — your review is live. Others will see it after moderation.
          </span>
        </div>
      )}

      {/* Name block */}
      <div className="px-5 md:px-8 pt-4 pb-4 border-b border-ink-10">
        <h1 className="font-serif-d text-3xl text-ink leading-tight">{full.name}</h1>
        <p className="text-sm text-stone-w mt-0.5">{full.category} · {full.hood}</p>
        <div className="flex items-center gap-2 mt-2">
          <StarRow rating={liveRating} size={14} />
          <span className="text-sm font-semibold text-ink">{liveRating.toFixed(1)}</span>
          <span className="text-sm text-stone-w">({totalCount.toLocaleString()} reviews)</span>
        </div>
        {rank && rank <= 3 && (
          <div className="flex items-center gap-1.5 mt-2">
            <Trophy size={13} className="text-ochre" />
            <span className="text-xs font-semibold text-ochre-d">
              Ranked #{rank} in {full.hood} · {full.category}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-forest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-forest pulse-dot" />
            Open · Closes 8pm
          </span>
          <span className="text-stone-w">·</span>
          <span className="text-ink font-medium">{full.price}</span>
          <span className="text-stone-w">·</span>
          <span className="text-stone-w">2.3 km away</span>
        </div>
      </div>

      {/* Action row */}
      <div className="px-5 md:px-8 py-4 grid grid-cols-4 gap-2 border-b border-ink-10">
        {[
          { label: "Call", Icon: Phone, color: "#2A3D2B" },
          { label: "WhatsApp", Icon: MessageCircle, color: "#2A3D2B" },
          { label: "Directions", Icon: Navigation, color: "#B8472E" },
          { label: "Website", Icon: Globe, color: "#2A3D2B" },
        ].map(({ label, Icon, color }) => (
          <button
            key={label}
            className="flex flex-col items-center py-2 rounded-xl border border-ink-10"
          >
            <Icon size={17} color={color} />
            <span className="text-[11px] font-medium text-ink mt-1">{label}</span>
          </button>
        ))}
      </div>

      {/* About */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <h3 className="font-serif-d text-lg text-ink mb-1.5">About</h3>
        <p className="text-sm text-ink leading-relaxed">{full.about}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {full.tags?.map((t) => (
            <span
              key={t}
              className="px-2.5 py-0.5 rounded-full bg-ivory-2 text-xs text-ink border border-ink-10"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <h3 className="font-serif-d text-lg text-ink mb-2">Services & prices</h3>
        <div className="space-y-1.5">
          {full.services?.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-ink-10 last:border-0">
              <span className="text-sm text-ink">{s.name}</span>
              <span className="text-sm font-semibold text-ink">{s.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hours + payment */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10 space-y-3">
        <div className="flex items-start gap-3">
          <Clock size={17} className="text-stone-w flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-ink">Hours</div>
            <div className="text-sm text-stone-w">{full.hours}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Banknote size={17} className="text-stone-w flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-ink">Payment</div>
            <div className="text-sm text-stone-w">M-Pesa {full.mpesa} · Visa · Cash (KSh / USD)</div>
          </div>
        </div>
      </div>

      {/* Reviews summary */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-serif-d text-lg text-ink">Reviews</h3>
          <button
            onClick={() => go("review_compose", full)}
            className="text-xs text-clay font-semibold flex items-center gap-1"
          >
            <Star size={12} className="fill-current" />
            Write a review
          </button>
        </div>

        {/* Rating distribution */}
        <div className="flex items-start gap-4 p-3 rounded-xl bg-ivory-2 border border-ink-10 mb-3">
          <div className="text-center flex-shrink-0">
            <div className="font-serif-d text-4xl text-ink leading-none">
              {liveRating.toFixed(1)}
            </div>
            <div className="mt-1">
              <StarRow rating={liveRating} size={12} />
            </div>
            <div className="text-[10px] md:text-xs text-stone-w mt-1">
              {totalCount.toLocaleString()} reviews
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {distribution.map((d) => (
              <div key={d.stars} className="flex items-center gap-2">
                <span className="text-[10px] md:text-xs text-stone-w w-2">{d.stars}</span>
                <Star size={9} className="fill-current text-ochre" />
                <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                  <div className="h-full bg-ochre" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-[10px] md:text-xs text-stone-w w-7 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review cards */}
        <div className="space-y-3">
          {allReviews.slice(0, 4).map((r, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border ${
                r.isNew ? "bg-ochre-soft border-ochre" : "bg-ivory-2 border-ink-10"
              }`}
            >
              {r.isNew && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Sparkles size={10} className="text-ochre-d" />
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-ochre-d">
                    Just posted
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-sm font-semibold text-ink">{r.name}</div>
                  <div className="text-[11px] text-stone-w">{r.country}</div>
                </div>
                <div className="text-right">
                  <StarRow rating={r.rating} size={12} />
                  <div className="text-[11px] text-stone-w mt-0.5">{r.date}</div>
                </div>
              </div>
              {r.recommendation && (
                <div className="mt-1 mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-ink-10">
                  <ThumbsUp size={10} className="text-forest" />
                  <span className="text-[10px] md:text-xs font-medium text-ink">{r.recommendation}</span>
                </div>
              )}
              {r.serviceUsed && (
                <div className="text-[10px] md:text-xs text-stone-w mb-1.5">
                  Service used: <span className="text-ink font-medium">{r.serviceUsed}</span>
                </div>
              )}
              <p className="text-xs text-ink leading-relaxed mt-1">{r.text}</p>
            </div>
          ))}
        </div>
        <button className="mt-3 w-full py-2.5 text-sm font-semibold text-clay border border-clay rounded-xl">
          See all {totalCount.toLocaleString()} reviews
        </button>
      </div>

      {/* Write-a-review nudge at bottom */}
      <div className="px-5 md:px-8 pt-4">
        <button
          onClick={() => go("review_compose", full)}
          className="w-full rounded-xl p-4 border border-ink-10 bg-clay-soft flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-clay flex items-center justify-center flex-shrink-0">
            <Star size={17} className="text-white fill-current" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-ink">Been here? Share your experience</div>
            <div className="text-[11px] text-stone-w">
              Your review helps other visitors — and keeps good businesses ranked high.
            </div>
          </div>
          <ChevronRight size={16} className="text-clay" />
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: REVIEW COMPOSER ----------
export const ReviewComposerScreen = ({ payload, back, onSubmit }) => {
  const biz = payload || recommended[0];
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [service, setService] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [country, setCountry] = useState("🇺🇸 United States");
  const [visitType, setVisitType] = useState("Tourist");

  const services = biz.services?.map((s) => s.name) || ["General visit"];
  const recos = [
    { key: "yes", label: "Yes, absolutely", Icon: ThumbsUp },
    { key: "caveats", label: "Yes, with caveats", Icon: AlertCircle },
    { key: "no", label: "Not really", Icon: X },
  ];
  const countries = [
    "🇺🇸 United States", "🇬🇧 United Kingdom", "🇩🇪 Germany", "🇫🇷 France",
    "🇮🇹 Italy", "🇨🇳 China", "🇮🇳 India", "🇯🇵 Japan", "🇿🇦 South Africa",
    "🇳🇬 Nigeria", "🇰🇪 Kenya (resident)", "🇪🇹 Ethiopia", "Other",
  ];
  const visitTypes = ["Tourist", "Business visitor", "Expat", "New resident", "Resident"];

  const canSubmit = rating > 0 && text.trim().length >= 40 && recommendation !== "";
  const charCount = text.length;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const recoLabel = recos.find((r) => r.key === recommendation)?.label;
    const newReview = {
      name: "You",
      country: `${country} · ${visitType}`,
      rating,
      date: "Just now",
      text: text.trim(),
      isNew: true,
      serviceUsed: service || null,
      recommendation: recoLabel,
    };
    // Optimistic local update first — the on-screen UX ("live after
    // moderation") is identical whether or not the server write happens.
    onSubmit(biz.id, newReview);

    // KAR-8: persist through the submit-review edge function when possible.
    // It requires a signed-in user (verify_jwt = true) and a live business
    // (dbId). Until the app ships an auth flow, guest reviews stay local-only.
    if (biz.dbId) {
      (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData?.session;
          if (!session) {
            console.warn(
              "[Karibu] review kept local — sign in required to persist reviews.",
            );
            return;
          }
          const { error: fnError } = await supabase.functions.invoke(
            "submit-review",
            {
              body: {
                business_id: biz.dbId,
                reviewer_name:
                  session.user.user_metadata?.full_name ||
                  session.user.email?.split("@")[0] ||
                  "Karibu visitor",
                reviewer_country: country.replace(/^\S*\s+/, ""), // drop the flag emoji
                reviewer_type: visitType.toLowerCase(),
                rating,
                body: text.trim(),
                service_used: service || null,
                recommendation, // the key the function validates: yes | caveats | no
              },
            },
          );
          if (fnError) {
            console.error("[Karibu] submit-review failed:", fnError.message);
          }
        } catch (e) {
          console.error("[Karibu] submit-review failed:", e);
        }
      })();
    }
  };

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <X size={16} className="text-ink" />
        </button>
        <h2 className="font-serif-d text-lg text-ink">Write a review</h2>
        <span className="w-8" />
      </div>

      {/* Business card */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <HeroImage variant={biz.image || "posh"} />
        </div>
        <div>
          <div className="font-semibold text-sm text-ink">{biz.name}</div>
          <div className="text-xs text-stone-w">{biz.category} · {biz.hood}</div>
        </div>
      </div>

      {/* Rating */}
      <div className="px-5 md:px-8 pt-5 pb-5 text-center border-b border-ink-10">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-3">
          How was it?
        </div>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(i)}
              className="transition-transform active:scale-90"
            >
              <Star
                size={36}
                className={i <= (hover || rating) ? "fill-current" : ""}
                style={{ color: i <= (hover || rating) ? "#D4A341" : "#D7CFC4" }}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div className="mt-2 text-sm text-ink font-medium fade-in">
            {["", "Not great", "Could be better", "It was okay", "Really good", "Outstanding"][rating]}
          </div>
        )}
      </div>

      {/* Service used */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
          What did you get?
        </div>
        <div className="flex flex-wrap gap-1.5">
          {services.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => setService(service === s ? "" : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                service === s
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink border-ink-10"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setService("Other")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              service === "Other"
                ? "bg-ink text-white border-ink"
                : "bg-white text-ink border-ink-10"
            }`}
          >
            Other
          </button>
        </div>
      </div>

      {/* Recommendation */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-2">
          Would you recommend to other visitors?
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {recos.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setRecommendation(key)}
              className={`py-2.5 rounded-xl text-xs font-medium border flex flex-col items-center gap-1 transition ${
                recommendation === key
                  ? key === "no"
                    ? "bg-ink text-white border-ink"
                    : key === "caveats"
                    ? "bg-ochre-soft text-ochre-d border-ochre"
                    : "bg-forest text-white border-forest"
                  : "bg-white text-ink border-ink-10"
              }`}
            >
              <Icon size={14} />
              <span className="leading-tight text-center px-1">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Text */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-semibold text-stone-w uppercase tracking-wider">
            Tell us more
          </div>
          <span
            className={`text-[11px] ${charCount < 40 ? "text-clay" : "text-stone-w"}`}
          >
            {charCount} / 40 min
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What stood out? Anything other visitors should know — communication, wait time, payment methods, language?"
          className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2.5 text-sm text-ink font-sans-d outline-none resize-none"
          rows={4}
        />
      </div>

      {/* Context */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10 space-y-3">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider">
          Your context
          <span className="ml-1 text-stone-w normal-case font-normal tracking-normal">
            · helps other visitors weigh your review
          </span>
        </div>
        <div>
          <label className="text-[11px] text-stone-w block mb-1">Where are you from?</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2 text-sm text-ink font-sans-d outline-none"
          >
            {countries.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-stone-w block mb-1">You're in Kenya as a...</label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value)}
            className="w-full bg-white border border-ink-10 rounded-xl px-3 py-2 text-sm text-ink font-sans-d outline-none"
          >
            {visitTypes.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Photo upload placeholder */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10">
        <button className="w-full py-3 rounded-xl border border-dashed border-ink-20 flex items-center justify-center gap-2 text-xs text-stone-w">
          <Camera size={15} />
          <span>Add photos (optional)</span>
        </button>
      </div>

      {/* Guidelines + submit */}
      <div className="px-5 md:px-8 py-4">
        <p className="text-[11px] text-stone-w mb-3 leading-relaxed">
          By submitting, you agree to Karibu's review guidelines. Reviews are moderated for authenticity — first-person experiences only, no promotional content. Fake reviews lead to account removal.
        </p>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
            canSubmit ? "bg-clay text-white" : "bg-ivory-2 text-stone-w cursor-not-allowed"
          }`}
        >
          {canSubmit ? "Post review" : "Complete all fields to post"}
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: GUIDES HUB ----------
export const GuidesHubScreen = ({ go, activeCity }) => {
  const { cities } = useReferenceData();
  // KAR-9: published guides from the DB; the prototype constant is the fallback.
  const { items: guideList } = useGuides({ fallback: guides });
  const featured = guideList.filter((g) => g.featured);
  const cityLabel = cities.find((c) => c.key === activeCity)?.label || "Nairobi";

  // Group non-featured guides by category
  const byCategory = guideCategories.map((cat) => ({
    ...cat,
    articles: guideList.filter((g) => g.category === cat.key),
  }));

  return (
    <div className="fade-in pb-6">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="font-serif-d text-xl text-ink">Guides</span>
        </div>
        <button className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center">
          <Bookmark size={15} className="text-ink" />
        </button>
      </div>

      {/* Editorial intro */}
      <div className="px-5 md:px-8 pt-4 pb-5">
        <div className="text-xs font-semibold text-stone-w uppercase tracking-wider mb-1">
          {cityLabel} · Visitor library
        </div>
        <h1 className="font-serif-d text-3xl text-ink leading-tight">
          Read before,<br />
          <span className="italic text-clay">refer to during.</span>
        </h1>
        <p className="text-sm text-stone-w mt-2 leading-relaxed">
          Practical guides written by our editorial team and updated monthly. No affiliate links, no sponsored content.
        </p>
      </div>

      {/* Featured articles */}
      <div className="pb-6">
        <div className="px-5 md:px-8 flex items-baseline justify-between mb-3">
          <h3 className="font-serif-d text-lg text-ink">Featured</h3>
          <span className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider">Start here</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scroll-x px-5 md:px-8 pb-1">
          {featured.map((g) => {
            const cat = (guideCategories.find((c) => c.key === g.category) || GUIDE_CATEGORY_FALLBACK);
            return (
              <button
                key={g.id}
                onClick={() => go("guide_article", g)}
                className="flex-shrink-0 w-64 rounded-2xl overflow-hidden border border-ink-10 bg-white text-left"
              >
                <div className="h-28 relative">
                  <HeroImage variant={g.heroVariant} />
                  <div className="absolute top-2 left-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold backdrop-blur"
                      style={{ backgroundColor: "rgba(247,241,232,0.85)", color: cat?.color }}
                    >
                      <cat.Icon size={10} />
                      {cat?.label}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-serif-d text-base text-ink leading-tight">{g.title}</h4>
                  <p className="text-[11px] text-stone-w mt-1 leading-snug line-clamp-2">{g.subtitle}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] md:text-xs text-stone-w">
                    <Clock size={10} />
                    <span>{g.readTime} min read</span>
                    <span>·</span>
                    <span>{g.updated}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category grid */}
      <div className="px-5 md:px-8 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">Browse by topic</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {byCategory.map((cat) => (
            <button
              key={cat.key}
              onClick={() => cat.articles[0] && go("guide_article", cat.articles[0])}
              className="flex items-start gap-3 p-3 rounded-xl border border-ink-10 bg-white text-left active:bg-ivory-2"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cat.color}15` }}
              >
                <cat.Icon size={16} style={{ color: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-ink leading-tight">{cat.label}</div>
                <div className="text-[10px] md:text-xs text-stone-w mt-0.5 leading-tight">{cat.blurb}</div>
                <div className="text-[10px] md:text-xs text-stone-w mt-1">
                  {cat.articles.length} article{cat.articles.length === 1 ? "" : "s"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* All articles list */}
      <div className="px-5 md:px-8 pb-6">
        <h3 className="font-serif-d text-lg text-ink mb-3">All guides</h3>
        <div className="space-y-2">
          {guideList.map((g) => {
            const cat = (guideCategories.find((c) => c.key === g.category) || GUIDE_CATEGORY_FALLBACK);
            return (
              <button
                key={g.id}
                onClick={() => go("guide_article", g)}
                className="w-full flex items-start gap-3 p-3 rounded-xl border border-ink-10 bg-white text-left active:bg-ivory-2"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <cat.Icon size={16} style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink leading-tight">{g.title}</div>
                  <div className="text-[11px] text-stone-w mt-0.5 leading-snug">{g.subtitle}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] md:text-xs text-stone-w">
                    <span style={{ color: cat.color }}>{cat.label}</span>
                    <span>·</span>
                    <Clock size={9} />
                    <span>{g.readTime} min</span>
                  </div>
                </div>
                <ChevronRight size={15} className="text-stone-w flex-shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Ask Karibu nudge */}
      <div className="px-5 md:px-8 pb-6">
        <button
          onClick={() => go("ask")}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border border-ochre bg-ochre-soft text-left"
        >
          <div className="w-10 h-10 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-ink">Can't find your question?</div>
            <div className="text-[11px] text-stone-w">
              Ask Karibu AI — it knows all the guides and the full business directory.
            </div>
          </div>
          <ChevronRight size={16} className="text-ochre-d flex-shrink-0" />
        </button>
      </div>
    </div>
  );
};

// ---------- SCREEN: GUIDE ARTICLE ----------
export const GuideArticleScreen = ({ payload, back, go }) => {
  const fallbackGuide = payload || guides[0];
  // KAR-9: the list rows that route here carry no body (see useGuides), so the
  // article fetches its own. Until it lands, `fallbackGuide` is what renders —
  // which for the prototype constant already includes a full body.
  const { items: guideList } = useGuides({ fallback: guides });
  const { guide, loading: bodyLoading } = useGuideDetail(fallbackGuide.id, fallbackGuide);
  const g = guide || fallbackGuide;
  const cat = (guideCategories.find((c) => c.key === g.category) || GUIDE_CATEGORY_FALLBACK);
  const [saved, setSaved] = useState(false);

  // Find related businesses. A fallback guide lists prototype business ids; a
  // live one carries already-resolved business objects (related_businesses is a
  // uuid[], not a foreign key, so PostgREST cannot embed it). Accept both.
  const relatedBiz = (g.relatedBusinesses || [])
    .map((b) => (typeof b === "string" ? recommended.find((r) => r.id === b) : b))
    .filter(Boolean);

  const body = g.body || [];

  return (
    <div className="fade-in pb-6">
      {/* Hero */}
      <div className="relative h-44">
        <HeroImage variant={g.heroVariant} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.50) 100%)",
          }}
        />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={back}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <ChevronLeft size={18} className="text-ink" />
          </button>
          <button
            onClick={() => setSaved(!saved)}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <Bookmark
              size={16}
              className={saved ? "fill-current text-clay" : "text-ink"}
            />
          </button>
        </div>
        <div className="absolute bottom-3 left-4">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.90)", color: cat?.color }}
          >
            <cat.Icon size={10} />
            {cat?.label}
          </span>
        </div>
      </div>

      {/* Readable measure: the hero stays full-bleed above, but the long-form
          prose below gets a comfortable centred column on wide screens so lines
          don't stretch edge-to-edge. Full-width on mobile (md-only cap). */}
      <div className="md:max-w-3xl md:mx-auto">
      {/* Title block */}
      <div className="px-5 md:px-8 pt-5 pb-3 border-b border-ink-10">
        <h1 className="font-serif-d text-3xl text-ink leading-tight">{g.title}</h1>
        <p className="font-serif-d italic text-base text-stone-w leading-snug mt-2">
          {g.subtitle}
        </p>
        <div className="flex items-center gap-2 mt-3 text-[11px] text-stone-w">
          <span>{g.author}</span>
          <span>·</span>
          <Clock size={10} />
          <span>{g.readTime} min read</span>
          <span>·</span>
          <span>{g.updated}</span>
        </div>
      </div>

      {/* Summary pullquote */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10 bg-ivory-2">
        <p className="font-serif-d text-base text-ink leading-snug italic">
          {g.summary}
        </p>
      </div>

      {/* Article body */}
      <div className="px-5 md:px-8 py-5 border-b border-ink-10">
        {body.length === 0 && bodyLoading && (
          // Quiet, on-brand placeholder — the article's own palette, no spinner.
          <div className="space-y-2.5" aria-hidden="true">
            <div className="h-3 rounded bg-ivory-2 w-11/12" />
            <div className="h-3 rounded bg-ivory-2 w-full" />
            <div className="h-3 rounded bg-ivory-2 w-10/12" />
            <div className="h-3 rounded bg-ivory-2 w-full mt-5" />
            <div className="h-3 rounded bg-ivory-2 w-9/12" />
          </div>
        )}
        {body.map((block, i) => {
          if (block.type === "h") {
            return (
              <h3 key={i} className="font-serif-d text-xl text-ink leading-tight mt-5 mb-2 first:mt-0">
                {block.text}
              </h3>
            );
          }
          if (block.type === "p") {
            return (
              <p key={i} className="text-sm text-ink leading-relaxed mb-3">
                {block.text}
              </p>
            );
          }
          if (block.type === "list") {
            return (
              <ul key={i} className="my-3 space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-ink leading-relaxed">
                    <span className="text-clay font-bold mt-0.5 flex-shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          if (block.type === "callout") {
            const isWarning = block.tone === "warning";
            return (
              <div
                key={i}
                className={`my-4 p-3 rounded-xl border flex items-start gap-2.5 ${
                  isWarning
                    ? "bg-clay-soft border-clay"
                    : "bg-ochre-soft border-ochre"
                }`}
              >
                {isWarning ? (
                  <AlertCircle size={15} className="text-clay flex-shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb size={15} className="text-ochre-d flex-shrink-0 mt-0.5" />
                )}
                <p className="text-xs text-ink leading-relaxed">{block.text}</p>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Related businesses */}
      {relatedBiz.length > 0 && (
        <div className="px-5 md:px-8 py-4 border-b border-ink-10">
          <h3 className="font-serif-d text-lg text-ink mb-2">Mentioned in this guide</h3>
          <div className="space-y-2">
            {relatedBiz.map((b) => (
              <button
                key={b.id}
                onClick={() => go("business", b)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-ink-10 bg-white text-left"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <HeroImage variant={b.image} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-ink truncate">{b.name}</h4>
                  <div className="text-[11px] text-stone-w truncate">
                    {b.category} · {b.hood}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={10} className="fill-current text-ochre" />
                    <span className="text-[11px] text-ink font-medium">{b.rating}</span>
                    <span className="text-[11px] text-stone-w">({b.reviews})</span>
                  </div>
                </div>
                <ChevronRight size={15} className="text-stone-w flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ask Karibu about this */}
      {g.askPrompts && g.askPrompts.length > 0 && (
        <div className="px-5 md:px-8 py-4 border-b border-ink-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-ochre flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <h3 className="font-serif-d text-lg text-ink">Ask Karibu about this</h3>
          </div>
          <div className="space-y-1.5">
            {g.askPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => go("ask")}
                className="w-full text-left p-3 rounded-xl bg-ochre-soft border border-ochre text-sm text-ink active:bg-ochre-soft"
              >
                <span className="italic text-stone-w">"</span>{p}<span className="italic text-stone-w">"</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* More in this category */}
      <div className="px-5 md:px-8 py-4">
        <h3 className="font-serif-d text-lg text-ink mb-2">More from {cat.label}</h3>
        <div className="space-y-2">
          {guideList
            .filter((other) => other.category === g.category && other.id !== g.id)
            .slice(0, 3)
            .map((other) => (
              <button
                key={other.id}
                onClick={() => go("guide_article", other)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-ink-10 bg-white text-left"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <HeroImage variant={other.heroVariant} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-ink leading-tight">{other.title}</h4>
                  <div className="text-[11px] text-stone-w mt-0.5">
                    {other.readTime} min read
                  </div>
                </div>
                <ChevronRight size={15} className="text-stone-w" />
              </button>
            ))}
          {guideList.filter((o) => o.category === g.category && o.id !== g.id).length === 0 && (
            <p className="text-xs text-stone-w italic">
              More {cat.label.toLowerCase()} guides coming soon.
            </p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
