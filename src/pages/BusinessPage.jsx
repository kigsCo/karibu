import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  Heart, ChevronRight, ChevronLeft, Star,
  Phone, MessageCircle, Navigation, Globe, Clock, Check,
  Sparkles,
  Banknote,
  Trophy, Camera, X, ThumbsUp, AlertCircle,
} from "lucide-react";
import { useBusinessDetail } from "../hooks/useBusinessDetail.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSavedPlaces } from "../hooks/useSavedPlaces.js";
import { recordVisit } from "../hooks/useVisitHistory.js";
import Badge from "../components/Badge.jsx";
import StarRow from "../components/StarRow.jsx";
import HeroImage from "../components/HeroImage.jsx";
// KAR-6: `recommended` + `salonsList` are the byte-identical prototype
// literals; other screens use them as the fallback value passed into
// data hooks, and these screens fall back to them directly.
import { recommended, salonsList } from "../data/businesses.js";
import { reviewsSample } from "../data/reviews.js";
import { useLegacyNav } from "../lib/nav.js";
import { useLocalReviews } from "../context/LocalReviewsContext.jsx";

// ---------- SCREEN: BUSINESS DETAIL ----------
const BusinessScreen = ({ payload, back, go, reviews = [], justPosted }) => {
  const b = payload || recommended[0];
  const [saved, setSaved] = useState(false);

  // KAR-7: live-sourced payloads carry a slug — fetch the full row + published
  // reviews. Constant-sourced payloads have no slug; the hook stays inert and
  // the prototype merge below behaves exactly as before.
  const { business: liveBiz, reviews: liveReviews } = useBusinessDetail(b.slug);

  // Saved + history need the DB row id (liveBiz.dbId). Signed-in with a live
  // row: the heart persists to saved_places and the visit lands in history.
  // Guests / fallback rows keep the original local-only heart untouched.
  const { user } = useAuth();
  const { canPersist, savedIds, toggle: toggleSaved } = useSavedPlaces();
  const dbId = liveBiz?.dbId ?? null;
  const heartOn = canPersist && dbId ? savedIds.has(dbId) : saved;
  const onHeart = () => {
    if (canPersist && dbId) toggleSaved(dbId);
    else setSaved(!saved);
  };

  useEffect(() => {
    // Fire-and-forget; recordVisit swallows its own errors.
    if (user?.id && dbId) recordVisit(user.id, dbId);
  }, [user?.id, dbId]);

  // Fall back to full data if the payload was a lightweight list item
  const full = { ...recommended[0], ...b, ...(liveBiz || {}) };

  // Once the live row has loaded, identity-specific detail — the service/price
  // list, opening hours, the M-Pesa till — must come from THIS business only,
  // never the recommended[0] fallback base (a salon) whose data would otherwise
  // show on every listing that has none of its own. Until it loads we keep the
  // fallback for a stable first paint; an empty live value hides its section.
  const services = liveBiz ? liveBiz.services : full.services;
  const hours = liveBiz ? liveBiz.hours : full.hours;
  const mpesa = liveBiz ? liveBiz.mpesa : full.mpesa;

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
            onClick={onHeart}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur"
            style={{ backgroundColor: "rgba(247,241,232,0.85)" }}
          >
            <Heart
              size={18}
              className={heartOn ? "fill-current text-clay" : "text-ink"}
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

      {/* Services & prices — only when this business lists its own */}
      {services?.length > 0 && (
        <div className="px-5 md:px-8 py-4 border-b border-ink-10">
          <h3 className="font-serif-d text-lg text-ink mb-2">Services & prices</h3>
          <div className="space-y-1.5">
            {services.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-ink-10 last:border-0">
                <span className="text-sm text-ink">{s.name}</span>
                <span className="text-sm font-semibold text-ink">{s.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hours + payment */}
      <div className="px-5 md:px-8 py-4 border-b border-ink-10 space-y-3">
        {hours && (
          <div className="flex items-start gap-3">
            <Clock size={17} className="text-stone-w flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-ink">Hours</div>
              <div className="text-sm text-stone-w">{hours}</div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <Banknote size={17} className="text-stone-w flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-ink">Payment</div>
            <div className="text-sm text-stone-w">{`M-Pesa${mpesa ? ` ${mpesa}` : ""} · Visa · Cash (KSh / USD)`}</div>
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

export default function BusinessPage() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { go, back } = useLegacyNav();
  const { reviewsByBusiness, justPostedFor } = useLocalReviews();
  const payload = state?.payload ?? { id: slug, slug };
  const id = payload.id;
  return (
    <BusinessScreen
      payload={payload}
      go={go}
      back={back}
      reviews={id ? reviewsByBusiness[id] || [] : []}
      justPosted={justPostedFor != null && justPostedFor === id}
    />
  );
}
