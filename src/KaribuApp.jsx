import React, { useState } from "react";
import {
  Heart, ChevronRight, ChevronLeft, Star,
  Phone, MessageCircle, Navigation, Globe, Clock, Check,
  Sparkles,
  Banknote,
  Trophy, Camera, X, ThumbsUp, AlertCircle,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { useBusinessDetail } from "./hooks/useBusinessDetail.js";
import Badge from "./components/Badge.jsx";
import StarRow from "./components/StarRow.jsx";
import HeroImage from "./components/HeroImage.jsx";
// KAR-6: `recommended` + `salonsList` are the byte-identical prototype
// literals; other screens use them as the fallback value passed into
// data hooks, and these screens fall back to them directly.
import { recommended, salonsList } from "./data/businesses.js";
import { reviewsSample } from "./data/reviews.js";

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
