import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin, Bell, Heart, ChevronRight, ChevronLeft, Star,
  Phone, MessageCircle, Navigation, Globe, Clock, Check,
  Compass, Briefcase, User, Sparkles, Filter,
  Scissors, UtensilsCrossed, Coffee, Shirt, Pill,
  Dumbbell, Landmark, ShoppingBag, Wine, ShoppingCart, Stethoscope,
  Banknote, ArrowUpRight,
  Trophy, Camera, X, ThumbsUp, AlertCircle,
  BarChart3, Eye,
  LayoutDashboard, Users,
  Building2, MoreHorizontal,
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
