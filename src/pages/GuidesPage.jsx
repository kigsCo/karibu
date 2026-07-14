import { BookOpen, Bookmark, Clock, ChevronRight, Sparkles } from "lucide-react";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";
import { useGuides } from "../hooks/useGuides.js";
import HeroImage from "../components/HeroImage.jsx";
import { guides, guideCategories, GUIDE_CATEGORY_FALLBACK } from "../data/guides.js";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

// ---------- SCREEN: GUIDES HUB ----------
const GuidesHubScreen = ({ go, activeCity }) => {
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

export default function GuidesPage() {
  const { go } = useLegacyNav();
  const { cityKey } = useCity();
  return <GuidesHubScreen go={go} activeCity={cityKey} />;
}
