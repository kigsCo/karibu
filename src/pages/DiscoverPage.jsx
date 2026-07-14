import { useState, useEffect } from "react";
import {
  MapPin, Bell, ChevronRight, Star, Clock, Sparkles, ArrowUpRight, LayoutDashboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";
import { useBusinesses } from "../hooks/useBusinesses.js";
import { useGuides } from "../hooks/useGuides.js";
import Badge from "../components/Badge.jsx";
import StarRow from "../components/StarRow.jsx";
import HeroImage from "../components/HeroImage.jsx";
import { visitorEssentials } from "../data/discover.js";
import { recommended } from "../data/businesses.js";
import { guides, guideCategories, GUIDE_CATEGORY_FALLBACK } from "../data/guides.js";

// ---------- SCREEN: DISCOVER ----------
const DiscoverScreen = ({ go, activeCity, onOpenCityPicker }) => {
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

export default function DiscoverPage() {
  const { go } = useLegacyNav();
  const navigate = useNavigate();
  const { cityKey } = useCity();
  return (
    <DiscoverScreen go={go} activeCity={cityKey} onOpenCityPicker={() => navigate("/city")} />
  );
}
