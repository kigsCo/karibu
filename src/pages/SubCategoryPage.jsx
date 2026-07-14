import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Compass, Sparkles } from "lucide-react";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";

// ---------- SCREEN: SUB-CATEGORY PICKER ----------
const SubCategoryScreen = ({ payload, go, back, activeCity = "nairobi" }) => {
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

// NOTE: currently unreachable (no navigation targets "subcategory"). Kept for
// parity; wire to a route or remove with the team in a later task.
export default function SubCategoryPage() {
  const { categorySlug, subSlug } = useParams();
  const { go, back } = useLegacyNav();
  const { cityKey } = useCity();
  const { categories } = useReferenceData();
  const cat = categories.find((c) => c.key === categorySlug) || { key: categorySlug };
  const subList = cat.subTypes?.length ? cat.subTypes : cat.cuisineTags || [];
  const subType = subSlug ? subList.find((s) => s.key === subSlug) || null : null;
  return <SubCategoryScreen payload={{ ...cat, subType }} go={go} back={back} activeCity={cityKey} />;
}
