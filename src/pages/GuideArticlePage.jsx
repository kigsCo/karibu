import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Bookmark, Clock, AlertCircle, Lightbulb, Star, ChevronRight, Sparkles,
} from "lucide-react";
import { useGuideDetail, useGuides } from "../hooks/useGuides.js";
import HeroImage from "../components/HeroImage.jsx";
import { recommended } from "../data/businesses.js";
import { guides, guideCategories, GUIDE_CATEGORY_FALLBACK } from "../data/guides.js";
import { useLegacyNav } from "../lib/nav.js";

// ---------- SCREEN: GUIDE ARTICLE ----------
const GuideArticleScreen = ({ payload, back, go }) => {
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

export default function GuideArticlePage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  const payload = state?.payload ?? { id: slug, slug };
  return <GuideArticleScreen key={payload.id} payload={payload} back={() => navigate(-1)} go={go} />;
}
